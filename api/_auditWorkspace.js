// Nova Audit workspace (repair 2026-10-26, brief §5 items 2–6 and §6). One coherent owner path:
//   start (five business details, online or in person) → evidence review (public website + public email DNS) →
//   proposed findings (machine-proposed, never auto-reviewed) → draft report → branded PDF stored in the Vault →
//   owner review/approval (existing approval rules) → client access to the approved version only.
// Deterministic: no language model and no paid provider is called here. Every evidence record keeps its source,
// retrieval time, method and confidence. A missing element on a public page is never treated as proof of absence.
// Staff only; every object is re-checked against the caller's organization.
import crypto from 'node:crypto';
import dns from 'node:dns';
import { requireOrgAccess } from './_orgAccess.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, storagePut, storageGet } from './_sales/core.js';
import { sanitize } from './_sanitize.js';
import { runQuickScan, normalizeWebsite } from './_demo.js';
import { contentHash, validateReportForApproval } from './_auditRules.js';
import { computeCaseClockStatus } from './_auditClock.js';
import { renderAuditPdf } from './_auditPdf.js';

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

// ------------------------------------------------------------------------------------------------ email DNS checks
// Public DNS only. A lookup failure is "could not check", never "missing".
export async function checkEmailDns(domain, { resolver = dns.promises, now = () => new Date() } = {}) {
  const at = now().toISOString(); const checks = [];
  const absent = (e) => ['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(e?.code);
  const txt = async (name) => { try { return { ok: true, records: (await resolver.resolveTxt(name)).map((r) => r.join('')) }; } catch (e) { return absent(e) ? { ok: true, records: [] } : { ok: false, error: e?.code || e?.message }; } };
  let mx; try { mx = { ok: true, records: (await resolver.resolveMx(domain)).map((r) => r.exchange).filter(Boolean) }; } catch (e) { mx = absent(e) ? { ok: true, records: [] } : { ok: false, error: e?.code || e?.message }; }
  const base = { checked_at: at, kind: 'dns', target: domain };
  if (!mx.ok) { checks.push({ ...base, key: 'dns_mx', label: 'Email domain can be checked', result: 'unknown', observation: `The DNS lookup for ${domain} did not answer (${mx.error}). Nothing was assumed.` }); return checks; }
  checks.push({ ...base, key: 'dns_mx', label: 'Receives email at its own domain (MX)', result: 'ok', observation: mx.records.length ? `Mail server (MX) records for ${domain}: ${mx.records.slice(0, 4).join(', ')}.` : `No mail server (MX) records were found for ${domain}; the business may use another address for email.` });
  if (!mx.records.length) return checks;
  const spf = await txt(domain); const dmarc = await txt(`_dmarc.${domain}`);
  const spfRec = spf.ok ? spf.records.find((r) => /^v=spf1\b/i.test(r)) : null;
  checks.push(!spf.ok ? { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'unknown', observation: `The SPF lookup for ${domain} did not answer (${spf.error}).` }
    : spfRec ? { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'ok', observation: `${domain} publishes an SPF record: "${spfRec.slice(0, 180)}".` }
    : { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'issue', observation: `${domain} receives email (MX records exist) but publishes no SPF record.`, why: 'Messages sent from this domain, such as quotes, invoices and replies, are more likely to land in spam or be spoofed.', confirm: 'Which services send email for the business (for example the website, booking tool or invoicing).', next: 'Publish an SPF record that lists every service that sends email for the domain.', strength: 45 });
  const dRec = dmarc.ok ? dmarc.records.find((r) => /^v=DMARC1\b/i.test(r)) : null;
  checks.push(!dmarc.ok ? { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'unknown', observation: `The DMARC lookup for ${domain} did not answer (${dmarc.error}).` }
    : dRec ? { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'ok', observation: `${domain} publishes a DMARC policy: "${dRec.slice(0, 160)}".` }
    : { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'issue', observation: `No DMARC record was found at _dmarc.${domain}.`, why: 'Without DMARC, anyone can send mail that appears to come from the business, and inbox providers trust its real mail less.', confirm: 'Whether the business sends email from this domain.', next: 'Publish a DMARC record (start with p=none and reporting), then tighten it once SPF and DKIM pass.', strength: 40 });
  return checks;
}

const CHECK_LABELS = { home: 'Home page loads', https: 'Served securely (HTTPS)', mobile: 'Set up for phones', phones: 'One consistent phone number', inquiry_path: 'A visible way to get in touch', link: 'Contact or booking link works', dns_mx: 'Receives email at its own domain (MX)', dns_spf: 'Email sender list published (SPF)', dns_dmarc: 'Email protection policy published (DMARC)' };
const priorityOf = (strength = 0) => (strength >= 80 ? 'high' : strength >= 40 ? 'medium' : 'low');
const sourceOf = (c) => (c.kind === 'dns' ? `Public DNS records for ${c.target} (queried ${c.checked_at})` : `Public web page ${c.url} (retrieved ${c.checked_at})`);
const checkKey = (c) => `${c.key}:${c.kind === 'dns' ? c.target : (hostOf(c.url) || '') + (() => { try { return new URL(c.url).pathname; } catch { return ''; } })()}`;

// ------------------------------------------------------------------------------------------------ summary / next steps
const DETAIL_KEYS = [['name', 'Business name'], ['website', 'Website'], ['industry', 'Industry'], ['location', 'City / area'], ['public_phone', 'Main phone']];
function nextSteps({ c, details, evidence, findings, latest, pdfs }) {
  const steps = [];
  const missing = details.filter((d) => !d.value).map((d) => d.label);
  steps.push({ key: 'details', done: !missing.length, label: 'Business details', detail: missing.length ? `Missing: ${missing.join(', ')}.` : 'All five details saved.', action: 'details' });
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
  const [biz, evidence, findings, links, recs] = await Promise.all([
    c.business_id ? dbOne(`businesses?id=eq.${enc(c.business_id)}&select=name,website,confirmed_website,phone,city,state,industry`) : null,
    dbGet(`audit_evidence?case_id=eq.${enc(c.id)}&select=id,source,capture_date,method,observation,confidence&order=capture_date.asc`),
    dbGet(`audit_findings?case_id=eq.${enc(c.id)}&review_status=neq.rejected&select=*`),
    dbGet(`audit_finding_evidence?select=finding_id,evidence_id,audit_findings!inner(case_id)&audit_findings.case_id=eq.${enc(c.id)}`),
    dbGet(`audit_recommendations?case_id=eq.${enc(c.id)}&select=*&order=priority_rank.asc.nullslast`),
  ]);
  const evById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const rank = { high: 0, medium: 1, low: 2 };
  const ordered = [...findings].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || String(a.created_at).localeCompare(String(b.created_at)));
  const lastRun = evidence.filter((e) => String(e.method || '').startsWith('automated_review:')).map((e) => e.method.split(':')[1]).pop();
  const runChecks = lastRun ? evidence.filter((e) => String(e.method || '').startsWith(`automated_review:${lastRun}:`)) : [];
  const checks = runChecks.map((e) => { const [, , key, result] = e.method.split(':'); return { label: CHECK_LABELS[key] || String(key || 'check').replace(/_/g, ' '), result: ['ok', 'issue', 'unknown'].includes(result) ? result : 'unknown', checked_at: e.capture_date }; });
  const website = c.intake?.website || biz?.confirmed_website || biz?.website || null;
  const name = c.intake?.name || biz?.name || 'the business';
  const inPerson = evidence.filter((e) => String(e.method || '').startsWith('in_person:')).length;
  const proposed = ordered.filter((f) => f.review_status !== 'reviewed').length;
  const autoSummary = [
    website ? `Nova reviewed the public website ${website}${runChecks.length ? ` and its public email records on ${runChecks[0].capture_date.slice(0, 10)}` : ''}.` : 'No website was reviewed.',
    inPerson ? `${inPerson} observation${inPerson === 1 ? ' was' : 's were'} recorded in person.` : '',
    ordered.length ? `${ordered.length} finding${ordered.length === 1 ? ' is' : 's are'} recorded${proposed ? `, ${proposed} of them proposed and not yet reviewed by Nova` : ''}. The most important: ${ordered.slice(0, 2).map((f) => f.title).join('; ')}.` : 'No problem was verified on what was checked. That does not mean there is none.',
    'Financial impact is unknown: no call, booking or revenue records were supplied.',
  ].filter(Boolean).join(' ');
  const recList = recs.length ? recs.map((r, i) => ({ priority: r.priority_rank ?? i + 1, mechanism: r.mechanism, effort: r.effort_range, cost: r.cost_range, verification_plan: r.verification_plan, source: 'recommendation' }))
    : ordered.filter((f) => f.recommended_action).map((f, i) => ({ priority: i + 1, mechanism: f.recommended_action, source: `finding: ${f.title}` }));
  return {
    title: 'The Nova Audit',
    executive_summary: summary || autoSummary,
    business_identity: { name, website, phone: c.intake?.public_phone || biz?.phone || null, location: c.intake?.location || [biz?.city, biz?.state].filter(Boolean).join(', ') || null, industry: c.intake?.industry || biz?.industry || null },
    scope_and_method: { mode: c.scope === '360' ? 'online and in person' : 'online', method: 'Automated review of public web pages and public DNS records (no forms submitted, no one contacted), plus any evidence recorded by Nova staff.', in_person_observations: inPerson },
    checks_performed: checks,
    evidence_reviewed: evidence.map((e) => ({ source: e.source, captured: e.capture_date, method: e.method, observation: e.observation, confidence: e.confidence })),
    findings: ordered.map((f) => ({ title: f.title, type: f.statement_type, priority: f.priority, confidence: f.confidence, review_status: f.review_status, origin: f.origin, observed: f.detail, customer_impact: f.customer_impact, financial_impact_status: f.financial_impact_status || 'unknown', limitations: f.limitations, remedy: f.recommended_action, nova_can_implement: f.nova_can_implement, owner_decision: f.owner_decision, evidence: links.filter((l) => l.finding_id === f.id).map((l) => evById[l.evidence_id]?.source).filter(Boolean) })),
    estimates_and_assumptions: { scenarios: [], statement: 'No financial scenario was prepared; financial impact is unknown.' },
    recommendations: recList,
    limitations: 'This review read up to four public web pages and the domain\'s public DNS records at the times stated. It cannot see calls, texts, response times, bookings or revenue, and a missing element on a page does not prove the business lacks it. This is an operational review, not a CPA financial audit.',
    next_steps: 'Review each finding with Nova, confirm the items marked "to confirm", and decide which fixes to approve first.',
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
      const intake = { name, website, industry: sanitize(b.industry, 100) || null, location: sanitize(b.location, 150) || null, public_phone: sanitize(b.phone, 40) || null, contact_name: sanitize(b.contact_name, 120) || null };
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
      for (const [k, max] of [['name', 200], ['industry', 100], ['location', 150], ['public_phone', 40], ['contact_name', 120]]) if (k in b) next[k] = sanitize(b[k], max) || null;
      if ('website' in b) { if (b.website && String(b.website).trim()) { const n = normalizeWebsite(b.website); if (n.error) return send(res, 400, { error: n.error, field: 'website' }); next.website = n.url; } else next.website = null; }
      const [row] = await dbPatch('audit_cases', `id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}`, { intake: next, updated_at: nowIso() });
      return send(res, 200, { ok: true, intake: row.intake, saved_at: row.updated_at });
    }

    // ---------------------------------------------------------------- review: website + email DNS → evidence + proposed findings
    if (op === 'review') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const biz = c.business_id ? await dbOne(`businesses?id=eq.${enc(c.business_id)}&select=website,confirmed_website`) : null;
      const website = c.intake?.website || biz?.confirmed_website || biz?.website;
      if (!website) return send(res, 409, { error: 'Add the business website in Business details first. Without one, record in-person or owner-provided evidence instead.', need: 'website' });
      const runId = crypto.randomUUID().slice(0, 8);
      const scan = await runQuickScan(website, { fetchImpl: deps.fetchImpl, lookup: deps.lookup, now: deps.now });
      const webChecks = (scan.checks || []).map((x) => ({ ...x, kind: 'web' }));
      const domain = hostOf(scan.checks?.[0]?.url || website);
      const dnsChecks = domain ? await checkEmailDns(domain, { resolver: deps.resolver, now: deps.now }) : [];
      const checks = [...webChecks, ...dnsChecks];
      if (!checks.length) return send(res, 422, { error: scan.limitation || 'Nothing could be checked.', result: scan.result });
      const author = `Nova automated review (run by ${caller.email || caller.id})`;
      const rows = checks.map((x) => ({ case_id: c.id, source: sourceOf(x), capture_date: x.checked_at, method: `automated_review:${runId}:${x.key}:${x.result}`, observation: [x.observation, x.result === 'issue' && x.confirm ? `To confirm: ${x.confirm}` : ''].filter(Boolean).join(' ').slice(0, 3000), source_quality: 'medium', confidence: x.result === 'unknown' ? 'low' : 'high', privacy_level: 'internal', author }));
      const inserted = (await dbInsert('audit_evidence', rows)).rows || [];
      const existing = new Set((await dbGet(`audit_findings?case_id=eq.${enc(c.id)}&check_key=not.is.null&select=check_key`)).map((f) => f.check_key));
      let proposed = 0; let skipped = 0;
      for (let i = 0; i < checks.length; i++) {
        const x = checks[i]; if (x.result !== 'issue') continue;
        const key = checkKey(x); if (existing.has(key)) { skipped++; continue; }
        const ev = inserted[i]; if (!ev) continue;
        const f = await dbInsert('audit_findings', { case_id: c.id, title: x.label === 'A visible way to get in touch' ? 'No visible way to get in touch on the home page' : x.observation.length <= 110 ? x.observation.replace(/\.$/, '') : x.label, statement_type: 'observed_fact', detail: x.observation, priority: priorityOf(x.strength), confidence: 'high', recommended_action: x.next || null, customer_impact: x.why || null, limitations: x.confirm ? `To confirm: ${x.confirm}` : null, financial_impact_status: 'unknown', nova_can_implement: 'unknown', review_status: 'draft', origin: 'automated_review', check_key: key });
        if (f.conflict || !f.row) { skipped++; continue; }
        await dbInsert('audit_finding_evidence', { finding_id: f.row.id, evidence_id: ev.id });
        existing.add(key); proposed++;
      }
      await dbPatch('audit_cases', `id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}`, { last_review_at: nowIso(), updated_at: nowIso() });
      return send(res, 200, { ok: true, run_id: runId, website: webChecks[0]?.url || website, result: scan.result, checks: { total: checks.length, issues: checks.filter((x) => x.result === 'issue').length, ok: checks.filter((x) => x.result === 'ok').length, unknown: checks.filter((x) => x.result === 'unknown').length }, evidence_added: inserted.length, findings_proposed: proposed, findings_already_recorded: skipped, limitation: scan.limitation });
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
export const WORKSPACE_OPS = ['start', 'workspace', 'details', 'review', 'draft-report', 'pdf', 'pdf-file', 'archive'];
