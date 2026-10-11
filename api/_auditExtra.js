// Nova Audit — intake/clock policy, authorized test plan, competitor benchmarks, software review, financial scenarios,
// report composition from recorded evidence, PDF of the exact approved version, and secure client delivery links.
// Staff ops require intelligence.view on the case's organization (re-checked per object). Public ops are scoped by a
// random delivery token whose hash is stored; they expose only the approved, unchanged report.
import { requireOrgAccess } from './_orgAccess.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, appBase } from './_sales/core.js';
import { sanitize } from './_sanitize.js';
import { textPdf } from './_sales/pdf.js';
import { contentHash, computeScenario, totalScenarios, checkTestEntry, interpretTest, validateClockPolicy, REQUIRED_REPORT_SECTIONS, validateFinding } from './_auditRules.js';
import { newToken, sha256 } from './_ops/rules.js';

export const REPORT_TITLE = 'Operational Findings & Revenue Opportunity Report';
const send = (res, code, body) => res.status(code).json(body);
const isOwner = (caller) => (caller?.roles || []).includes('nova_super_admin');
async function caseFor(req, res, orgId, caseId) {
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return null;
  const c = await dbOne(`audit_cases?id=eq.${enc(caseId)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!c) { send(res, 404, { error: 'Case not found' }); return null; }
  return c;
}

export async function handleAuditExtra(req, res, op, caller) {
  const b = req.body || {}; const q = req.query || {};
  const orgId = sanitize(req.method === 'GET' ? q.organization_id : b.organization_id, 60);
  const caseId = sanitize(req.method === 'GET' ? q.case_id : b.case_id, 60);
  try {
    if (op === 'intake') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      if (req.method === 'GET') return send(res, 200, { intake: c.intake, reviewer_user_id: c.reviewer_user_id, deadline_terms: c.deadline_terms, clock_policy: c.clock_policy, clock_policy_approved_at: c.clock_policy_approved_at, active_test_authorization: c.active_test_authorization, is_preview: c.is_preview });
      const patch = { updated_at: nowIso() };
      if (b.intake && typeof b.intake === 'object') {
        const i = b.intake; const keep = {};
        for (const k of ['website', 'public_phone', 'public_email', 'listings', 'industry', 'hours', 'location', 'contact_name', 'contact_role', 'requested_scope', 'optional_inputs']) if (i[k] != null) keep[k] = typeof i[k] === 'string' ? sanitize(i[k], 1000) : i[k];
        if (keep.website && !/^https?:\/\//.test(keep.website)) return send(res, 400, { error: 'Website must be a full http(s) URL' });
        patch.intake = { ...c.intake, ...keep };
      }
      if ('reviewer_user_id' in b) patch.reviewer_user_id = sanitize(b.reviewer_user_id, 60) || null;
      if (b.clock_policy) {
        if (c.start_condition_met_at) return send(res, 409, { error: 'The clock already started; its policy can no longer change' });
        const errs = validateClockPolicy(b.clock_policy); if (errs.length) return send(res, 400, { error: errs.join('; ') });
        patch.clock_policy = { start_event: sanitize(b.clock_policy.start_event, 300), hours_basis: b.clock_policy.hours_basis, target_hours: Number(b.clock_policy.target_hours), missing_input_rule: sanitize(b.clock_policy.missing_input_rule, 300), extension_notice: sanitize(b.clock_policy.extension_notice, 300) };
        patch.clock_policy_approved_at = null; patch.clock_policy_approved_by = null; // a changed policy needs approval again
        patch.target_hours = patch.clock_policy.target_hours; patch.clock_basis = patch.clock_policy.hours_basis === 'business_hours' ? 'business_hours' : 'elapsed';
      }
      if (b.deadline_terms != null) patch.deadline_terms = sanitize(b.deadline_terms, 600) || null;
      if (b.approve_clock_policy === true) {
        if (!isOwner(caller)) return send(res, 403, { error: 'Only the owner can approve the clock policy and deadline terms' });
        const pol = patch.clock_policy || c.clock_policy; if (!pol) return send(res, 400, { error: 'Write the clock policy first' });
        patch.clock_policy_approved_at = nowIso(); patch.clock_policy_approved_by = caller.id;
      }
      if (b.active_test_authorization) {
        const a = b.active_test_authorization;
        if (!a.authorized_by_name || !Array.isArray(a.channels) || !a.channels.length || !a.ends_on) return send(res, 400, { error: 'Record who authorized the tests, which channels, and the end date' });
        patch.active_test_authorization = { authorized_by_name: sanitize(a.authorized_by_name, 120), role: sanitize(a.role, 80), channels: a.channels.filter((x) => ['phone', 'form', 'sms'].includes(x)), max_per_day: Math.max(1, Math.min(3, Number(a.max_per_day) || 1)), ends_on: sanitize(a.ends_on, 10), evidence: sanitize(a.evidence, 300), at: nowIso(), recorded_by: caller.id };
      }
      if (b.cancel_active_tests === true && c.active_test_authorization) {
        patch.active_test_authorization = { ...c.active_test_authorization, cancelled_at: nowIso() };
        await dbPatch('audit_test_plan', `case_id=eq.${enc(c.id)}&status=eq.planned&channel=neq.public_review`, { status: 'cancelled', notes: 'permission cancelled by the business' });
      }
      const [row] = await dbPatch('audit_cases', `id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}`, patch);
      return send(res, 200, { ok: true, case: row });
    }

    if (op === 'finding-details') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      const f = await dbOne(`audit_findings?id=eq.${enc(sanitize(b.finding_id, 60))}&case_id=eq.${enc(c.id)}&select=*`);
      if (!f) return send(res, 404, { error: 'Finding not in this case' });
      const patch = { updated_at: nowIso() };
      for (const k of ['customer_impact', 'limitations', 'owner_decision']) if (k in b) patch[k] = sanitize(b[k], 1500) || null;
      for (const k of ['period_start', 'period_end']) if (k in b) patch[k] = /^\d{4}-\d{2}-\d{2}$/.test(String(b[k] || '')) ? b[k] : null;
      if ('financial_impact_status' in b) {
        if (!['verified', 'scenario', 'unknown', 'none'].includes(b.financial_impact_status)) return send(res, 400, { error: 'financial_impact_status: verified, scenario, unknown or none' });
        if (b.financial_impact_status === 'verified' && !(await dbOne(`audit_scenarios?case_id=eq.${enc(c.id)}&finding_id=eq.${enc(f.id)}&status=eq.verified&select=id`))) return send(res, 409, { error: 'A verified financial impact needs a scenario built only from verified records' });
        patch.financial_impact_status = b.financial_impact_status;
      }
      if ('nova_can_implement' in b) { if (!['yes', 'partial', 'no', 'unknown'].includes(b.nova_can_implement)) return send(res, 400, { error: 'nova_can_implement: yes, partial, no or unknown' }); patch.nova_can_implement = b.nova_can_implement; }
      if (f.review_status === 'reviewed') patch.review_status = 'draft'; // changed after review → needs review again
      const [row] = await dbPatch('audit_findings', `id=eq.${enc(f.id)}&case_id=eq.${enc(c.id)}`, patch);
      return send(res, 200, { ok: true, finding: row, review_reset: f.review_status === 'reviewed' });
    }

    if (op === 'test-plan') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      if (req.method === 'GET') { const rows = await dbGet(`audit_test_plan?case_id=eq.${enc(c.id)}&select=*&order=planned_at.asc`); return send(res, 200, rows.map((t) => ({ ...t, interpretation: interpretTest(t) }))); }
      if (b.action === 'create') {
        const entry = { channel: b.channel, target: sanitize(b.target, 300), is_competitor: b.is_competitor === true, planned_at: sanitize(b.planned_at, 40) || nowIso(), test_identity: sanitize(b.test_identity, 200), conditions: sanitize(b.conditions, 300) };
        const day = entry.planned_at.slice(0, 10);
        const same = (await dbGet(`audit_test_plan?case_id=eq.${enc(c.id)}&channel=eq.${enc(entry.channel)}&target=eq.${enc(entry.target)}&status=neq.cancelled&planned_at=gte.${enc(`${day}T00:00:00Z`)}&planned_at=lte.${enc(`${day}T23:59:59Z`)}&select=id`)).length;
        const err = checkTestEntry({ entry, authorization: c.active_test_authorization, sameTargetSameDay: same });
        if (err) return send(res, 409, { error: err });
        return send(res, 200, { ok: true, test: (await dbInsert('audit_test_plan', { case_id: c.id, ...entry, created_by: caller.id })).row });
      }
      const t = await dbOne(`audit_test_plan?id=eq.${enc(sanitize(b.id, 60))}&case_id=eq.${enc(c.id)}&select=*`);
      if (!t) return send(res, 404, { error: 'Test not found' });
      if (b.action === 'record') {
        if (t.status !== 'planned') return send(res, 409, { error: `Test is ${t.status}` });
        const outcome = ['answered', 'responded', 'no_response', 'voicemail', 'auto_reply', 'not_applicable'].includes(b.outcome) ? b.outcome : null;
        if (!outcome || typeof b.within_published_hours !== 'boolean') return send(res, 400, { error: 'Record the outcome and whether it was within published hours' });
        const [row] = await dbPatch('audit_test_plan', `id=eq.${enc(t.id)}&status=eq.planned`, { status: 'done', performed_at: sanitize(b.performed_at, 40) || nowIso(), outcome, within_published_hours: b.within_published_hours, response_seconds: b.response_seconds == null || b.response_seconds === '' ? null : Math.round(Number(b.response_seconds)), notes: sanitize(b.notes, 1000) || null });
        return send(res, 200, { ok: true, test: { ...row, interpretation: interpretTest(row) } });
      }
      if (b.action === 'cancel') { const [row] = await dbPatch('audit_test_plan', `id=eq.${enc(t.id)}&status=eq.planned`, { status: 'cancelled', notes: sanitize(b.notes, 300) || 'cancelled' }); return send(res, 200, { ok: true, test: row }); }
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'competitors') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      if (req.method === 'GET') return send(res, 200, await dbGet(`audit_competitors?case_id=eq.${enc(c.id)}&select=*&order=created_at.asc`));
      if (b.action === 'create') {
        if ((await dbGet(`audit_competitors?case_id=eq.${enc(c.id)}&select=id`)).length >= 3) return send(res, 409, { error: 'At most three competitors per audit' });
        const rationale = sanitize(b.rationale, 600); if (!rationale || rationale.length < 15) return send(res, 400, { error: 'Explain why this competitor is relevant (15+ characters)' });
        const obs = (Array.isArray(b.observations) ? b.observations : []).slice(0, 10).map((o) => ({ kind: ['advertised', 'observed', 'untested'].includes(o.kind) ? o.kind : 'untested', text: sanitize(o.text, 400), source: sanitize(o.source, 300) || null, captured_at: sanitize(o.captured_at, 40) || nowIso(), conditions: sanitize(o.conditions, 200) || null }));
        if (obs.some((o) => o.kind !== 'untested' && !o.source)) return send(res, 400, { error: 'Advertised or observed statements need a source' });
        return send(res, 200, { ok: true, competitor: (await dbInsert('audit_competitors', { case_id: c.id, name: sanitize(b.name, 160), url: sanitize(b.url, 300) || null, rationale, observations: obs })).row });
      }
      if (b.action === 'delete') { await dbPatch('audit_competitors', `id=eq.${enc(sanitize(b.id, 60))}&case_id=eq.${enc(c.id)}`, { observations: [] }); const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/audit_competitors?id=eq.${enc(sanitize(b.id, 60))}&case_id=eq.${enc(c.id)}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }); return send(res, r.ok ? 200 : 500, { ok: r.ok }); }
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'software') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      if (req.method === 'GET') return send(res, 200, await dbGet(`audit_software_items?case_id=eq.${enc(c.id)}&select=*&order=created_at.asc`));
      if (b.action === 'create') {
        const source = ['owner_supplied', 'authorized_export'].includes(b.cost_source) ? b.cost_source : 'unknown';
        const cost = b.monthly_cost_cents == null || b.monthly_cost_cents === '' ? null : Math.round(Number(b.monthly_cost_cents));
        if (cost != null && source === 'unknown') return send(res, 400, { error: 'A cost needs its source (owner-supplied or an authorized export). Nova never estimates software spend.' });
        const cls = ['confirmed_duplicate', 'possible_overlap', 'unknown_usage', 'cancellation_risk', 'keep'].includes(b.classification) ? b.classification : 'unknown_usage';
        if (cls === 'confirmed_duplicate' && source === 'unknown') return send(res, 400, { error: 'A confirmed duplicate needs owner-supplied or exported evidence' });
        return send(res, 200, { ok: true, item: (await dbInsert('audit_software_items', { case_id: c.id, name: sanitize(b.name, 120), category: sanitize(b.category, 80) || null, monthly_cost_cents: cost, cost_source: source, usage: ['used', 'rarely_used', 'unused', 'unknown'].includes(b.usage) ? b.usage : 'unknown', classification: cls, notes: sanitize(b.notes, 500) || null })).row });
      }
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'scenarios') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      if (req.method === 'GET') { const rows = await dbGet(`audit_scenarios?case_id=eq.${enc(c.id)}&select=*&order=created_at.asc`); return send(res, 200, { scenarios: rows, total: totalScenarios(rows) }); }
      if (b.action === 'create') {
        const comp = computeScenario(b.inputs); if (!comp.ok) return send(res, 400, { error: comp.errors.join('; ') });
        if (b.finding_id && !(await dbOne(`audit_findings?id=eq.${enc(sanitize(b.finding_id, 60))}&case_id=eq.${enc(c.id)}&select=id`))) return send(res, 404, { error: 'Finding not in this case' });
        const row = (await dbInsert('audit_scenarios', { case_id: c.id, finding_id: sanitize(b.finding_id, 60) || null, label: sanitize(b.label, 200), overlap_group: sanitize(b.overlap_group, 60) || null, inputs: b.inputs, result: comp.result, status: comp.status, created_by: caller.id })).row;
        return send(res, 200, { ok: true, scenario: row });
      }
      return send(res, 400, { error: 'Unknown action' });
    }

    if (op === 'compose') {
      const c = await caseFor(req, res, orgId, caseId); if (!c) return;
      const summary = sanitize(b.executive_summary, 4000); if (!summary || summary.length < 40) return send(res, 400, { error: 'Write the one-page executive summary (40+ characters)' });
      const content = await composeReport(c, { summary, limitations: sanitize(b.limitations, 2000), next_steps: sanitize(b.next_steps, 2000) });
      const last = await dbOne(`audit_reports?case_id=eq.${enc(c.id)}&select=version&order=version.desc`);
      const r = (await dbInsert('audit_reports', { case_id: c.id, version: (last?.version || 0) + 1, status: 'draft', content, content_sha256: contentHash(content) })).row;
      return send(res, 200, { ok: true, report: r });
    }

    if (op === 'report-pdf') {
      if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
      const rep = await dbOne(`audit_reports?id=eq.${enc(sanitize(q.report_id || b.report_id, 60))}&select=*,audit_cases!inner(organization_id)&audit_cases.organization_id=eq.${enc(orgId)}`);
      if (!rep) return send(res, 404, { error: 'Report not found' });
      if (rep.status !== 'approved' || contentHash(rep.content) !== rep.approved_content_sha256) return send(res, 409, { error: 'Only the exact approved version can be exported' });
      return send(res, 200, { filename: `nova-report-v${rep.version}.pdf`, pdf_base64: renderReportPdf(rep).toString('base64'), content_sha256: rep.approved_content_sha256 });
    }

    if (op === 'publish' || op === 'revoke') {
      if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
      if (op === 'revoke') {
        const d = await dbOne(`audit_deliveries?id=eq.${enc(sanitize(b.delivery_id, 60))}&select=*,audit_reports!inner(case_id,audit_cases!inner(organization_id))&audit_reports.audit_cases.organization_id=eq.${enc(orgId)}`);
        if (!d) return send(res, 404, { error: 'Delivery not found' });
        await dbPatch('audit_deliveries', `id=eq.${enc(d.id)}`, { revoked_at: nowIso() }); return send(res, 200, { ok: true });
      }
      const rep = await dbOne(`audit_reports?id=eq.${enc(sanitize(b.report_id, 60))}&select=*,audit_cases!inner(organization_id)&audit_cases.organization_id=eq.${enc(orgId)}`);
      if (!rep) return send(res, 404, { error: 'Report not found' });
      if (rep.status !== 'approved') return send(res, 409, { error: 'Only an approved report can be made available' });
      const latest = await dbOne(`audit_reports?case_id=eq.${enc(rep.case_id)}&select=version&order=version.desc`);
      if (latest.version > rep.version) return send(res, 409, { error: `Superseded by v${latest.version}` });
      if (contentHash(rep.content) !== rep.approved_content_sha256) return send(res, 409, { error: 'Content changed after approval — approve the new version first' });
      const t = newToken(); const days = Math.min(60, Math.max(1, Number(b.days) || 30));
      const d = (await dbInsert('audit_deliveries', { report_id: rep.id, delivery_method: 'secure_link', delivered_by: caller.id, report_content_sha256: rep.approved_content_sha256, link_token_hash: t.hash, link_expires_at: new Date(Date.now() + days * 86400_000).toISOString(), available_at: nowIso(), notification_status: 'not_requested' })).row;
      return send(res, 200, { ok: true, delivery_id: d.id, link: `${appBase()}/report/${t.token}`, expires_at: d.link_expires_at, note: 'Available to the client through this link only. Nothing was emailed; send the link yourself or record a notification separately. Opening is recorded.' });
    }
    return send(res, 400, { error: `Unknown audit op: ${op}` });
  } catch (e) {
    if (e.status && e.status < 500) return send(res, e.status, { error: e.message });
    console.error('[audit-extra]', e.message, e.detail ? String(e.detail).slice(0, 300) : ''); return send(res, 500, { error: 'Something went wrong' });
  }
}

// Public: the client opens the exact approved version through the delivery link.
export async function handleReportView(req, res, op) {
  const token = sanitize(req.query?.token, 80);
  if (!token || token.length < 20) return send(res, 404, { error: 'This link is invalid or has expired.' });
  const d = await dbOne(`audit_deliveries?link_token_hash=eq.${enc(sha256(token))}&select=*`);
  if (!d || d.revoked_at || !d.link_expires_at || new Date(d.link_expires_at) < new Date()) return send(res, 404, { error: 'This link is invalid or has expired.' });
  const rep = await dbOne(`audit_reports?id=eq.${enc(d.report_id)}&select=*`);
  if (!rep || rep.status !== 'approved' || rep.approved_content_sha256 !== d.report_content_sha256 || contentHash(rep.content) !== rep.approved_content_sha256) return send(res, 410, { error: 'This report version is no longer available. Ask Nova for the current version.' });
  await dbPatch('audit_deliveries', `id=eq.${enc(d.id)}`, { view_count: (d.view_count || 0) + 1, ...(d.first_viewed_at ? {} : { first_viewed_at: nowIso() }) });
  if (op === 'report-view-pdf') return send(res, 200, { filename: `nova-report-v${rep.version}.pdf`, pdf_base64: renderReportPdf(rep).toString('base64') });
  return send(res, 200, { title: REPORT_TITLE, version: rep.version, approved_at: rep.approved_at, content_sha256: rep.approved_content_sha256, content: rep.content, expires_at: d.link_expires_at });
}

async function composeReport(c, { summary, limitations, next_steps }) {
  const [biz, evidence, findings, recs, scenarios, competitors, software, tests] = await Promise.all([
    c.business_id ? dbOne(`businesses?id=eq.${enc(c.business_id)}&select=name,website,confirmed_website,phone,city,state,industry`) : null,
    dbGet(`audit_evidence?case_id=eq.${enc(c.id)}&select=id,source,capture_date,method,observation,confidence&order=capture_date.asc`),
    dbGet(`audit_findings?case_id=eq.${enc(c.id)}&select=*&order=priority.asc.nullslast,created_at.asc`),
    dbGet(`audit_recommendations?case_id=eq.${enc(c.id)}&select=*&order=priority_rank.asc.nullslast`),
    dbGet(`audit_scenarios?case_id=eq.${enc(c.id)}&select=*`),
    dbGet(`audit_competitors?case_id=eq.${enc(c.id)}&select=*`),
    dbGet(`audit_software_items?case_id=eq.${enc(c.id)}&select=*`),
    dbGet(`audit_test_plan?case_id=eq.${enc(c.id)}&select=*&order=planned_at.asc`),
  ]);
  const tot = totalScenarios(scenarios);
  return {
    title: REPORT_TITLE,
    executive_summary: summary,
    business_identity: { name: biz?.name || c.intake?.name || null, website: biz?.confirmed_website || biz?.website || c.intake?.website || null, phone: biz?.phone || c.intake?.public_phone || null, location: [biz?.city, biz?.state].filter(Boolean).join(', ') || c.intake?.location || null, industry: biz?.industry || c.intake?.industry || null, hours: c.intake?.hours || null },
    scope_and_method: { requested_scope: c.intake?.requested_scope || c.scope, clock_policy: c.clock_policy, active_tests_authorized: !!c.active_test_authorization && !c.active_test_authorization.cancelled_at, tests: tests.filter((t) => t.status === 'done').map((t) => ({ channel: t.channel, target: t.target, competitor: t.is_competitor, performed_at: t.performed_at, conditions: t.conditions, outcome: t.outcome, response_seconds: t.response_seconds, interpretation: interpretTest(t) })) },
    evidence_reviewed: evidence.map((e) => ({ source: e.source, captured: e.capture_date, method: e.method, observation: e.observation, confidence: e.confidence })),
    findings: findings.filter((f) => f.review_status === 'reviewed').map((f) => ({ title: f.title, type: f.statement_type, observed: f.detail, period: f.period_start || f.period_end ? `${f.period_start || '?'} to ${f.period_end || '?'}` : null, customer_impact: f.customer_impact, financial_impact_status: f.financial_impact_status, confidence: f.confidence, limitations: f.limitations, remedy: f.recommended_action, nova_can_implement: f.nova_can_implement, owner_decision: f.owner_decision })),
    estimates_and_assumptions: { scenarios: scenarios.map((s) => ({ label: s.label, status: s.status, inputs: s.inputs, result: s.result, overlap_group: s.overlap_group })), total_monthly_gross_opportunity_cents: tot.monthly_gross_opportunity_cents, counting: `${tot.scenarios} scenario(s); overlapping ones counted once`, all_verified: !tot.any_unverified && scenarios.length > 0, statement: scenarios.length ? 'Scenarios are labeled with the source of every input. A scenario is not a measured loss.' : 'No financial scenario was prepared; financial impact is unknown.' },
    competitor_benchmarks: competitors.map((x) => ({ name: x.name, url: x.url, rationale: x.rationale, observations: x.observations })),
    software_review: software.length ? { items: software.map((s) => ({ name: s.name, category: s.category, monthly_cost: s.monthly_cost_cents, cost_source: s.cost_source, usage: s.usage, classification: s.classification, notes: s.notes })), statement: 'Owner-supplied information only. No cancellation is recommended automatically; any change is the owner’s decision.' } : { statement: 'No software inventory was supplied. Public information cannot show subscriptions, spending or usage.' },
    recommendations: recs.map((r, i) => ({ priority: r.priority_rank ?? i + 1, mechanism: r.mechanism, effort: r.effort_range, cost: r.cost_range, dependencies: r.dependencies, uncertainty: r.uncertainty, verification_plan: r.verification_plan })),
    limitations: [limitations, 'This is an operational review, not a CPA financial audit. Public observations cannot establish exact revenue loss. Tests reflect the conditions recorded with each one.'].filter(Boolean).join(' '),
    next_steps: next_steps || 'Review the findings with Nova and decide which installation steps, if any, to approve.',
  };
}

const flat = (v, depth = 0) => {
  if (v == null || v === '') return [];
  if (typeof v !== 'object') return [String(v)];
  if (Array.isArray(v)) return v.flatMap((x, i) => (typeof x === 'object' && x ? [`${i + 1}.`, ...flat(x, depth + 1).map((l) => `   ${l}`)] : [`- ${x}`]));
  return Object.entries(v).flatMap(([k, x]) => (x != null && typeof x === 'object' ? [`${k.replace(/_/g, ' ')}:`, ...flat(x, depth + 1).map((l) => `   ${l}`)] : x == null || x === '' ? [] : [`${k.replace(/_/g, ' ')}: ${x}`]));
};
export function renderReportPdf(rep) {
  const c = rep.content || {};
  const order = ['executive_summary', 'business_identity', 'findings', 'recommendations', 'estimates_and_assumptions', 'scope_and_method', 'competitor_benchmarks', 'software_review', 'evidence_reviewed', 'limitations', 'next_steps'];
  const names = { executive_summary: 'Executive summary', business_identity: 'Business', findings: 'Findings', recommendations: 'Prioritized installation recommendation', estimates_and_assumptions: 'Financial scenarios and assumptions', scope_and_method: 'Scope, method and tests', competitor_benchmarks: 'Competitor benchmarks', software_review: 'Software review', evidence_reviewed: 'Evidence appendix', limitations: 'Limitations', next_steps: 'Next steps' };
  const blocks = [{ style: 'h1', text: REPORT_TITLE }, { style: 'p', text: `Version ${rep.version} · approved ${rep.approved_at || ''}` }, { style: 'mono', text: `Content SHA-256: ${rep.approved_content_sha256}` }, { style: 'gap' }];
  for (const k of [...order, ...REQUIRED_REPORT_SECTIONS.filter((x) => !order.includes(x))]) {
    if (c[k] == null) continue;
    blocks.push({ style: 'h2', text: names[k] || k });
    for (const line of flat(c[k])) blocks.push({ style: 'p', text: line });
  }
  blocks.push({ style: 'gap' }, { style: 'p', text: 'Nova Systems — operational review. Not a CPA financial audit. Figures labeled "scenario" depend on the stated inputs.' });
  return textPdf({ title: REPORT_TITLE, blocks });
}
export { validateFinding };
