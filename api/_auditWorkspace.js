// Nova Audit workspace (repair 2026-10-26, brief §5 items 2–6 and §6). One coherent owner path:
//   start (five business details, online or in person) → evidence review (public website + public email DNS) →
//   proposed findings (machine-proposed, never auto-reviewed) → draft report → branded PDF stored in the Vault →
//   owner review/approval (existing approval rules) → client access to the approved version only.
// Deterministic: no language model and no paid provider is called here. Every evidence record keeps its source,
// retrieval time, method and confidence. A missing element on a public page is never treated as proof of absence.
// Staff only; every object is re-checked against the caller's organization.
import crypto from 'node:crypto';
import { requireOrgAccess } from './_orgAccess.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, storagePut, storageGet } from './_sales/core.js';
import { sanitize } from './_sanitize.js';
import { normalizeWebsite } from './_demo.js';
import { contentHash, validateReportForApproval } from './_auditRules.js';
import { computeCaseClockStatus } from './_auditClock.js';
import { renderAuditPdf } from './_auditPdf.js';
import { runResearch, MODULES } from './_researchRun.js';

const send = (res, code, body) => res.status(code).json(body);
const PDF_BUCKET = 'nova-vault';
let deps = { fetchImpl: undefined, lookup: undefined, resolver: undefined, now: () => new Date() };
export const setWorkspaceDepsForTests = (d) => { deps = { ...deps, ...d }; };

async function caseFor(req, res, orgId, caseId) {
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return null;
  if (!caseId) { send(res, 400, { error: 'case_id is required' }); return null; }
  const c = await dbOne(`audit_cases?id=eq.${enc(caseId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!c) { send(res, 404, { error: 'Audit not found' }); return null; }
  return c;
}
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

export { checkEmailDns } from './_researchRun.js';

const CHECK_LABELS = { home: 'Home page loads', https: 'Served securely (HTTPS)', mobile: 'Set up for phones', phones: 'One consistent phone number', inquiry_path: 'A visible way to get in touch', link: 'Contact or booking link works', dns_mx: 'Receives email at its own domain (MX)', dns_spf: 'Email sender list published (SPF)', dns_dmarc: 'Email protection policy published (DMARC)' };

// ------------------------------------------------------------------------------------------------ summary / next steps
// The five starting details (owner brief 2026-10-30): name, location, website, industry/service, main goal or concern.
// Phone is optional and not counted.
const DETAIL_KEYS = [['name', 'Business name'], ['location', 'City / area'], ['website', 'Website'], ['industry', 'Industry or main service'], ['goal', 'Main goal or concern'], ['public_phone', 'Main phone (optional)']];
const REQUIRED_DETAILS = ['name', 'location', 'website', 'industry', 'goal'];
function nextSteps({ c, details, evidence, findings, latest, pdfs }) {
  const steps = [];
  const missing = details.filter((d) => REQUIRED_DETAILS.includes(d.key) && !d.value).map((d) => d.label);
  steps.push({ key: 'details', done: !missing.length, label: 'Business details', detail: missing.length ? `Missing: ${missing.join(', ')}. Research can still start; missing details limit it.` : 'All five details saved.', action: 'details' });
  const reviewRuns = evidence.filter((e) => String(e.method || '').startsWith('automated_review:')).length;
  const inPerson = evidence.filter((e) => String(e.method || '').startsWith('in_person:')).length;
  steps.push({ key: 'evidence', done: evidence.length > 0, label: 'Evidence', detail: evidence.length ? `${evidence.length} records (${reviewRuns} from the website and email review, ${inPerson} captured in person).` : (c.scope === '360' ? 'Run the website review, then capture the in-person walkthrough.' : 'Run the website and email review.'), action: 'review' });
  const live = findings.filter((f) => f.review_status !== 'rejected');
  const proposed = live.filter((f) => f.review_status !== 'reviewed');
  steps.push({ key: 'findings', done: live.length > 0 && !proposed.length, label: 'Findings reviewed', detail: !live.length ? 'No findings yet.' : proposed.length ? `${proposed.length} of ${live.length} still need your review.` : `All ${live.length} reviewed.`, action: 'findings' });
  steps.push({ key: 'report', done: !!latest, label: 'Report drafted', detail: latest ? `Version ${latest.version} (${latest.status}).` : 'Create a draft from the recorded evidence.', action: 'report' });
  const pdfLatest = latest && pdfs.find((p) => p.audit_report_id === latest.id);
  steps.push({ key: 'pdf', done: !!pdfLatest, label: 'PDF saved in the Vault', detail: pdfLatest ? `${pdfLatest.file_name}` : latest ? `No PDF of version ${latest.version} yet.` : 'Available after a draft exists.', action: 'pdf' });
  steps.push({ key: 'approve', done: latest?.status === 'approved', label: 'Owner approval', detail: latest?.status === 'approved' ? `Version ${latest.version} approved.` : 'Approve the exact version you will deliver.', action: 'report' });
  return steps;
}
function clockState(c) {
  const clock = computeCaseClockStatus({ status: c.status, startConditionMetAt: c.start_condition_met_at, targetHours: c.target_hours, clockBasis: c.clock_basis, timezone: c.timezone, pausedAt: c.paused_at, totalPausedSeconds: c.total_paused_seconds, agreedExtensionHours: Number(c.agreed_extension_hours || 0) });
  const missing = (c.input_checklist || []).filter((i) => !i.received_at);
  const basis = c.clock_basis === 'business_hours' ? 'business hours' : 'calendar hours';
  if (c.start_condition_met_at) return { state: c.paused_at ? 'paused' : 'running', clock, basis, message: c.paused_at ? `Paused since ${c.paused_at}. Paused time does not count.` : `Running on ${basis}. Due ${clock.dueAt || 'unknown'}.`, missing: [] };
  if (!c.clock_policy) return { state: 'no_policy', clock, basis, missing: [], message: 'Not started. No delivery policy has been written for this audit yet. A proposed default (48-hour aim, 72-hour deadline) is ready for you to review; nothing starts until you approve it.' };
  if (!c.clock_policy_approved_at) return { state: 'policy_not_approved', clock, basis, missing: [], message: `Not started. Delivery policy v${c.clock_policy_version || 1} is saved but not approved. Approve it to allow the clock to start.` };
  if (missing.length) return { state: 'inputs_missing', clock, basis, missing: missing.map((m) => ({ key: m.key, label: m.label, responsible: m.responsible })), message: `Not started. Waiting for ${missing.length} required input${missing.length === 1 ? '' : 's'}.` };
  return { state: 'ready_to_start', clock, basis, missing: [], message: 'Policy approved and every required input received. You can start the clock.' };
}

// ------------------------------------------------------------------------------------------------ report composition
async function composeDraft(c, { summary } = {}) {
  const [biz, evidence, findings, links, recs, competitors, lastRun] = await Promise.all([
    c.business_id ? dbOne(`businesses?id=eq.${enc(c.business_id)}&select=name,website,confirmed_website,phone,city,state,industry`) : null,
    dbGet(`audit_evidence?case_id=eq.${enc(c.id)}&select=id,source,capture_date,method,observation,confidence&order=capture_date.asc`),
    dbGet(`audit_findings?case_id=eq.${enc(c.id)}&review_status=neq.rejected&select=*`),
    dbGet(`audit_finding_evidence?select=finding_id,evidence_id,audit_findings!inner(case_id)&audit_findings.case_id=eq.${enc(c.id)}`),
    dbGet(`audit_recommendations?case_id=eq.${enc(c.id)}&select=*&order=priority_rank.asc.nullslast`),
    dbGet(`audit_competitors?case_id=eq.${enc(c.id)}&select=name,url,rationale,observations&order=created_at.asc`),
    dbOne(`audit_research_runs?case_id=eq.${enc(c.id)}&status=in.(completed,partial)&select=id,summary,finished_at,scope&order=created_at.desc`).catch(() => null),
  ]);
  const evById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const rank = { high: 0, medium: 1, low: 2 };
  const gone = findings.filter((f) => f.recheck_status === 'no_longer_observed');
  const ordered = [...findings.filter((f) => f.recheck_status !== 'no_longer_observed')].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || String(a.created_at).localeCompare(String(b.created_at)));
  // Checks of the latest automated run: only evidence whose method carries an explicit result (automated_review:run:key:result).
  const runIds = evidence.filter((e) => String(e.method || '').startsWith('automated_review:')).map((e) => e.method.split(':')[1]);
  const latestRun = runIds[runIds.length - 1];
  const runEvidence = latestRun ? evidence.filter((e) => String(e.method || '').startsWith(`automated_review:${latestRun}:`)) : [];
  const checks = runEvidence.filter((e) => { const p = e.method.split(':'); return p.length === 4 && ['ok', 'issue', 'unknown'].includes(p[3]); })
    .map((e) => { const p = e.method.split(':'); return { label: CHECK_LABELS[p[2]] || String(p[2]).replace(/_/g, ' '), result: p[3], checked_at: e.capture_date }; });
  // Evidence in this version: anything recorded by people, the latest research run, and older evidence a finding still cites
  // (re-running research must not inflate the counts).
  const cited = new Set(links.map((l) => l.evidence_id));
  const used = evidence.filter((e) => !String(e.method || '').startsWith('automated_review:') || String(e.method).startsWith(`automated_review:${latestRun}:`) || cited.has(e.id));
  const website = c.intake?.website || biz?.confirmed_website || biz?.website || null;
  const name = c.intake?.name || biz?.name || 'the business';
  const goal = c.intake?.goal || null;
  const inPerson = used.filter((e) => String(e.method || '').startsWith('in_person:')).length;
  const proposed = ordered.filter((f) => f.review_status !== 'reviewed').length;
  const rs = lastRun?.summary || null;
  const autoSummary = [
    website ? `Nova researched ${name}'s public footprint${rs ? `: ${rs.pages_read} page(s) of ${website}, its public email records, its OpenStreetMap listing (${rs.identity}; other listings not checked)${rs.competitors ? ` and ${rs.competitors} comparable nearby business(es)` : ''}` : ` at ${website}`}.` : `No website was saved for ${name}.`,
    goal ? `The owner's main goal: "${goal}".` : '',
    inPerson ? `${inPerson} observation${inPerson === 1 ? ' was' : 's were'} recorded in person.` : '',
    ordered.length ? `${ordered.length} finding${ordered.length === 1 ? ' is' : 's are'} recorded${proposed ? `, ${proposed} of them proposed and not yet reviewed by Nova` : ''}. The most important: ${ordered.slice(0, 2).map((f) => f.title).join('; ')}.` : "No problem was verified on what was checked. That does not mean there is none; the full audit looks at calls, replies and bookings with the owner's permission.",
    'Financial impact is unknown: no call, booking or revenue records were supplied.',
  ].filter(Boolean).join(' ');
  const recList = recs.length ? recs.map((r, i) => ({ priority: r.priority_rank ?? i + 1, mechanism: r.mechanism, effort: r.effort_range, cost: r.cost_range, verification_plan: r.verification_plan, source: 'recommendation' }))
    : ordered.filter((f) => f.recommended_action).map((f, i) => ({ priority: i + 1, mechanism: f.recommended_action, module: MODULES[f.module_key] || null, source: `finding: ${f.title}` }));
  const prescriptions = Object.entries(MODULES).map(([k, label]) => ({ key: k, label, findings: ordered.filter((f) => f.module_key === k).map((f) => f.title) })).filter((m) => m.findings.length);
  return {
    title: 'The Nova Audit',
    executive_summary: summary || autoSummary,
    owner_goal: goal,
    business_identity: { name, website, phone: c.intake?.public_phone || biz?.phone || null, location: c.intake?.location || [biz?.city, biz?.state].filter(Boolean).join(', ') || null, industry: c.intake?.industry || biz?.industry || null },
    scope_and_method: { mode: c.scope === '360' ? 'online and in person' : 'online', depth: lastRun?.scope === 'full' ? 'full public research' : 'demo-depth public research', method: 'Public web pages (robots.txt respected, no forms submitted), public DNS records, OpenStreetMap identity and nearby same-category businesses, plus any evidence recorded by Nova staff. No one was contacted.', in_person_observations: inPerson, research_completed_at: lastRun?.finished_at || null },
    metrics: rs ? { pages_read: rs.pages_read, evidence_records: used.length, checks: checks.length, issues_observed: checks.filter((x) => x.result === 'issue').length, competitors_compared: rs.competitor_websites_compared } : null,
    checks_performed: checks,
    client_features: rs?.client_features || null,
    competitor_comparison: competitors.map((x) => ({ name: x.name, url: x.url, rationale: x.rationale, observations: (x.observations || []).map((o) => o.text) })),
    evidence_reviewed: used.map((e) => ({ source: e.source, captured: e.capture_date, method: e.method, observation: e.observation, confidence: e.confidence })),
    findings: ordered.map((f) => ({ title: f.title, type: f.statement_type, priority: f.priority, confidence: f.confidence, review_status: f.review_status, origin: f.origin, observed: f.detail, customer_impact: f.customer_impact, financial_impact_status: f.financial_impact_status || 'unknown', limitations: f.limitations, remedy: f.recommended_action, module: MODULES[f.module_key] || null, nova_can_implement: f.nova_can_implement, owner_decision: f.owner_decision, evidence: links.filter((l) => l.finding_id === f.id).map((l) => evById[l.evidence_id]?.source).filter(Boolean), recheck: f.recheck_status ? { status: f.recheck_status, note: f.recheck_note, at: f.rechecked_at } : null })),
    no_longer_observed: gone.map((f) => ({ title: f.title, rechecked_at: f.rechecked_at, note: f.recheck_note })),
    prescriptions,
    estimates_and_assumptions: { scenarios: [], statement: 'No financial scenario was prepared; financial impact is unknown.' },
    recommendations: recList,
    research_limitations: rs?.limitations || [],
    limitations: 'This research reads public sources at the times stated. It cannot see calls, texts, response times, bookings or revenue, and a missing element on a page does not prove the business lacks it. A source that could not be reached is reported as unavailable, not as a problem. This is an operational review, not a CPA financial audit.',
    next_steps: 'Review each finding with Nova, confirm the items marked "to confirm", and decide which fixes to approve first. The full audit adds call, reply and booking tests with your permission.',
  };
}

// ------------------------------------------------------------------------------------------------ handler
export async function handleAuditWorkspace(req, res, op, caller) {
  const b = req.body || {}; const q = req.query || {};
  const orgId = sanitize(req.method === 'GET' ? q.organization_id : b.organization_id, 60);
  const caseId = sanitize(req.method === 'GET' ? q.case_id : b.case_id, 60);
  try {
    // ---------------------------------------------------------------- start: five details, no duplicates
    if (op === 'start') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
      const name = sanitize(b.name, 200); if (!name || name.length < 2) return send(res, 400, { error: 'Enter the business name.', field: 'name' });
      let website = null;
      if (b.website && String(b.website).trim()) { const n = normalizeWebsite(b.website); if (n.error) return send(res, 400, { error: n.error, field: 'website' }); website = n.url; }
      const intake = { name, website, industry: sanitize(b.industry, 100) || null, location: sanitize(b.location, 150) || null, public_phone: sanitize(b.phone, 40) || null, goal: sanitize(b.goal, 400) || null, contact_name: sanitize(b.contact_name, 120) || null };
      const scope = b.mode === 'in_person' ? '360' : 'digital';
      // Reuse the business when the name or website already exists in this organization.
      const all = await dbGet(`businesses?organization_id=eq.${enc(orgId)}&select=id,name,website,confirmed_website`);
      const host = website ? hostOf(website) : null;
      let biz = all.find((x) => x.name.trim().toLowerCase() === name.toLowerCase()) || (host && all.find((x) => [x.website, x.confirmed_website].some((w) => w && hostOf(w) === host))) || null;
      if (biz && !b.force_new) {
        const open = await dbGet(`audit_cases?organization_id=eq.${enc(orgId)}&business_id=eq.${enc(biz.id)}&archived_at=is.null&select=id,status,created_at,scope&order=created_at.desc`);
        const reps = open.length ? await dbGet(`audit_reports?case_id=in.(${open.map((x) => enc(x.id)).join(',')})&status=eq.approved&select=case_id`) : [];
        const unfinished = open.find((x) => !reps.some((r) => r.case_id === x.id));
        if (unfinished) return send(res, 409, { error: `An audit for ${biz.name} is already open (started ${unfinished.created_at.slice(0, 10)}). Open it, or start a new one anyway.`, existing_case_id: unfinished.id });
      }
      if (!biz) biz = (await dbInsert('businesses', { organization_id: orgId, name, website, phone: intake.public_phone, industry: intake.industry, city: intake.location })).row;
      const ins = await dbInsert('audit_cases', { organization_id: orgId, business_id: biz.id, scope, status: 'intake', clock_basis: 'elapsed', timezone: 'America/New_York', target_hours: 72, owner_user_id: caller.id, intake });
      return send(res, 200, { ok: true, case: ins.row, business_id: biz.id });
    }

    const c = await caseFor(req, res, orgId, caseId); if (!c) return;

    // ---------------------------------------------------------------- workspace: one read for the overview
    if (op === 'workspace') {
      const [biz, evidence, findings, reports, pdfs] = await Promise.all([
        c.business_id ? dbOne(`businesses?id=eq.${enc(c.business_id)}&select=name,website,confirmed_website,phone,city,state,industry`) : null,
        dbGet(`audit_evidence?case_id=eq.${enc(c.id)}&select=id,source,method,capture_date,confidence&order=capture_date.asc`),
        dbGet(`audit_findings?case_id=eq.${enc(c.id)}&select=id,title,priority,review_status,origin,statement_type,confidence,detail,recommended_action,customer_impact,created_at&order=created_at.asc`),
        dbGet(`audit_reports?case_id=eq.${enc(c.id)}&select=id,version,status,created_at,approved_at,content_sha256&order=version.desc`),
        dbGet(`vault_documents?audit_case_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=id,file_name,audit_report_id,report_version,report_status,file_size,created_at&order=created_at.desc`),
      ]);
      const intake = c.intake || {};
      const details = DETAIL_KEYS.map(([k, label]) => ({ key: k, label, value: intake[k] || (k === 'name' ? biz?.name : k === 'website' ? biz?.confirmed_website || biz?.website : k === 'industry' ? biz?.industry : k === 'public_phone' ? biz?.phone : k === 'location' ? [biz?.city, biz?.state].filter(Boolean).join(', ') : null) || null }));
      const latest = reports[0] || null;
      const live = findings.filter((f) => f.review_status !== 'rejected');
      return send(res, 200, {
        case: { id: c.id, scope: c.scope, status: c.status, created_at: c.created_at, archived_at: c.archived_at, last_review_at: c.last_review_at },
        business: { name: details[0].value || 'Unnamed business', website: details[1].value },
        details,
        evidence: { total: evidence.length, website_and_email: evidence.filter((e) => String(e.method || '').startsWith('automated_review:')).length, in_person: evidence.filter((e) => String(e.method || '').startsWith('in_person:')).length, other: evidence.filter((e) => !/^(automated_review|in_person):/.test(String(e.method || ''))).length, last_captured: evidence.length ? evidence[evidence.length - 1].capture_date : null },
        findings: { total: live.length, proposed: live.filter((f) => f.review_status !== 'reviewed').length, reviewed: live.filter((f) => f.review_status === 'reviewed').length, rejected: findings.length - live.length, by_priority: { high: live.filter((f) => f.priority === 'high').length, medium: live.filter((f) => f.priority === 'medium').length, low: live.filter((f) => f.priority === 'low').length }, top: live.sort((a, x) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[x.priority] ?? 3)).slice(0, 5) },
        reports, latest_report: latest, pdfs,
        clock: clockState(c),
        next_steps: nextSteps({ c, details, evidence, findings, latest, pdfs }),
      });
    }

    // ---------------------------------------------------------------- details: save the five details (and keep the rest of intake)
    if (op === 'details') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const next = { ...(c.intake || {}) };
      for (const [k, max] of [['name', 200], ['industry', 100], ['location', 150], ['public_phone', 40], ['goal', 400], ['contact_name', 120]]) if (k in b) next[k] = sanitize(b[k], max) || null;
      if ('website' in b) { if (b.website && String(b.website).trim()) { const n = normalizeWebsite(b.website); if (n.error) return send(res, 400, { error: n.error, field: 'website' }); next.website = n.url; } else next.website = null; }
      // "This website belongs to this business": recorded with who and when, and tied to that exact address
      if (b.website_confirmed === true) { if (!next.website) return send(res, 400, { error: 'Add the website first.', field: 'website' }); next.website_confirmed = { website: next.website, by: caller.email || caller.id, at: nowIso() }; }
      if (b.website_confirmed === false || (next.website_confirmed && next.website_confirmed.website !== next.website)) delete next.website_confirmed;
      const [row] = await dbPatch('audit_cases', `id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}`, { intake: next, updated_at: nowIso() });
      return send(res, 200, { ok: true, intake: row.intake, saved_at: row.updated_at });
    }

    // ---------------------------------------------------------------- review: website + email DNS → evidence + proposed findings
    // ---------------------------------------------------------------- research: start (queued or in-process), status, synchronous review
    if (op === 'review' || op === 'research-start') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const reviewer = await dbOne("workers?capability_key=eq.audit_review&status=neq.inactive&select=status");
      if (reviewer && reviewer.status !== 'active' && reviewer.status !== 'restricted') return send(res, 409, { error: 'The Audit evidence worker is paused. Resume it on the Workers page to run the research.', paused: true });
      const I = c.intake || {};
      if (!I.name && !c.business_id) return send(res, 409, { error: 'Add the business name first.', need: 'name' });
      const active = await dbOne(`audit_research_runs?case_id=eq.${enc(c.id)}&status=in.(queued,running)&select=*&order=created_at.desc`);
      if (active && Date.now() - new Date(active.heartbeat_at || active.created_at).getTime() < 10 * 60_000) {
        if (op === 'research-start') return send(res, 200, { ok: true, run: active, already_running: true });
        return send(res, 409, { error: 'Research is already running for this audit.', run_id: active.id });
      }
      if (active) await dbPatch('audit_research_runs', `id=eq.${enc(active.id)}`, { status: 'failed', error: 'Stopped responding; superseded by a new run.', finished_at: nowIso() });
      const scope = b.scope === 'full' ? 'full' : 'demo';
      const ins = await dbInsert('audit_research_runs', { organization_id: orgId, case_id: c.id, scope, requested_by: caller.id });
      if (!ins.row) return send(res, 409, { error: 'Research was just started from another screen. Reload.' });
      const run = ins.row;
      if (op === 'review') {
        const out = await runResearch(run.id, deps);
        const s = out.summary || {};
        return send(res, 200, { ok: true, run_id: run.id, steps: out.steps, ...s, website: I.website || null });
      }
      const mode = process.env.AUDIT_RESEARCH_MODE || 'auto';
      const beat = mode === 'auto' ? await dbOne('worker_runtime_heartbeats?select=last_seen_at&order=last_seen_at.desc').catch(() => null) : null;
      const queue = mode === 'queue' || (mode === 'auto' && beat && Date.now() - new Date(beat.last_seen_at).getTime() < 2 * 60_000);
      if (queue) {
        await dbInsert('jobs', { job_type: 'audit_research', organization_id: orgId, payload: { run_id: run.id }, idempotency_key: `audit_research:${run.id}` });
      } else {
        // No background worker is alive: run in this server process (local staging). Hosted serverless needs the worker.
        runResearch(run.id, deps).catch(async (e) => { await dbPatch('audit_research_runs', `id=eq.${enc(run.id)}`, { status: 'failed', error: String(e.message).slice(0, 300), finished_at: nowIso() }).catch(() => {}); });
      }
      return send(res, 200, { ok: true, run, mode: queue ? 'queued for the background worker' : 'running on this server' });
    }
    if (op === 'research-status') {
      const rid = sanitize(q.run_id, 60);
      const run = await dbOne(`audit_research_runs?case_id=eq.${enc(c.id)}${rid ? `&id=eq.${enc(rid)}` : ''}&select=*&order=created_at.desc`);
      return send(res, 200, { run: run || null });
    }

    // ---------------------------------------------------------------- draft report (new version only when content changed)
    if (op === 'draft-report') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const content = await composeDraft(c, { summary: sanitize(b.executive_summary, 4000) || null });
      if (!content.findings.length && !content.evidence_reviewed.length) return send(res, 409, { error: 'There is no evidence yet. Run the review or capture evidence first.' });
      const hash = contentHash(content);
      const latest = await dbOne(`audit_reports?case_id=eq.${enc(c.id)}&select=*&order=version.desc`);
      if (latest && latest.status === 'draft' && latest.content_sha256 === hash) return send(res, 200, { ok: true, report: { id: latest.id, version: latest.version, status: latest.status }, unchanged: true });
      const ins = await dbInsert('audit_reports', { case_id: c.id, version: (latest?.version || 0) + 1, status: 'draft', content, content_sha256: hash });
      const readiness = validateReportForApproval(content, []);
      return send(res, 200, { ok: true, report: { id: ins.row.id, version: ins.row.version, status: 'draft' }, approval_blockers: readiness.problems.filter((p) => !/has no findings/.test(p)).slice(0, 8) });
    }

    // ---------------------------------------------------------------- PDF: render + store in the Vault (idempotent per version and content)
    if (op === 'pdf') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const rep = await dbOne(`audit_reports?id=eq.${enc(sanitize(b.report_id, 60))}&case_id=eq.${enc(c.id)}&select=*`);
      if (!rep) return send(res, 404, { error: 'Report version not found on this audit' });
      const hash = contentHash(rep.content);
      if (rep.status === 'approved' && hash !== rep.approved_content_sha256) return send(res, 409, { error: 'This version changed after approval; it cannot be exported' });
      const prior = await dbOne(`vault_documents?audit_report_id=eq.${enc(rep.id)}&content_sha256=eq.${enc(hash)}&report_status=eq.${enc(rep.status)}&select=id,file_name,report_version,report_status,file_size,created_at`);
      if (prior) return send(res, 200, { ok: true, document: prior, reused: true });
      const pdf = renderAuditPdf({ content: rep.content, version: rep.version, status: rep.status, approvedAt: rep.approved_at, contentSha256: hash });
      const safe = String(rep.content?.business_identity?.name || 'audit').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'audit';
      const fileName = `Nova-Audit-${safe}-v${rep.version}-${rep.status}.pdf`;
      const path = `audit-reports/${orgId}/${c.id}/v${rep.version}-${rep.status}-${hash.slice(0, 12)}.pdf`;
      await storagePut(PDF_BUCKET, path, pdf, 'application/pdf');
      const ins = await dbInsert('vault_documents', { file_name: fileName, client_name: rep.content?.business_identity?.name || null, type: 'Audit report', storage_path: path, file_size: pdf.length, status: rep.status === 'approved' ? 'Approved' : 'Draft', source: 'audit_workspace', organization_id: orgId, audit_case_id: c.id, audit_report_id: rep.id, report_version: rep.version, content_sha256: hash, report_status: rep.status, mime_type: 'application/pdf' });
      if (ins.conflict) { const again = await dbOne(`vault_documents?audit_report_id=eq.${enc(rep.id)}&content_sha256=eq.${enc(hash)}&select=id,file_name,report_version,report_status,file_size,created_at`); return send(res, 200, { ok: true, document: again, reused: true }); }
      const { id, file_name, report_version, report_status, file_size, created_at } = ins.row;
      return send(res, 200, { ok: true, document: { id, file_name, report_version, report_status, file_size, created_at } });
    }

    // ---------------------------------------------------------------- PDF file: stream the stored bytes (works over the app-only Wi-Fi route)
    if (op === 'pdf-file') {
      const d = await dbOne(`vault_documents?id=eq.${enc(sanitize(q.document_id, 60))}&audit_case_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=id,file_name,storage_path`);
      if (!d) return send(res, 404, { error: 'PDF not found for this audit' });
      const { buffer } = await storageGet(PDF_BUCKET, d.storage_path);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${q.inline === '1' ? 'inline' : 'attachment'}; filename="${d.file_name.replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(buffer);
    }

    // ---------------------------------------------------------------- archive / restore (reversible; nothing deleted)
    // ---------------------------------------------------------------- re-check recorded findings against the current state
    if (op === 'recheck') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const biz = c.business_id ? await dbOne(`businesses?id=eq.${enc(c.business_id)}&select=website,confirmed_website`) : null;
      const { recheckFindings } = await import('./_auditRecheck.js');
      const out = await recheckFindings(c, { orgId, website: c.intake?.website || biz?.confirmed_website || biz?.website || null });
      return send(res, 200, { ok: true, ...out });
    }

    if (op === 'archive') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const archive = b.archived !== false;
      const [row] = await dbPatch('audit_cases', `id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}`, archive ? { archived_at: nowIso(), archived_by: caller.id, archive_reason: sanitize(b.reason, 300) || null } : { archived_at: null, archived_by: null, archive_reason: null });
      return send(res, 200, { ok: true, archived_at: row.archived_at });
    }
    return send(res, 400, { error: `Unknown audit op: ${op}` });
  } catch (e) {
    if (e.status && e.status < 500) return send(res, e.status, { error: e.message });
    console.error('[audit-workspace]', op, e.message, e.detail ? String(e.detail).slice(0, 300) : '');
    return send(res, 500, { error: 'Something went wrong on the server. Nothing you typed was lost; try again.' });
  }
}
export const WORKSPACE_OPS = ['start', 'workspace', 'details', 'review', 'research-start', 'research-status', 'recheck', 'draft-report', 'pdf', 'pdf-file', 'archive'];
