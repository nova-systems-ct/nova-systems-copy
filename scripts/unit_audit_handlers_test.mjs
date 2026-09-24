// Drives the REAL api/client.js audit handlers against an in-memory PostgREST stand-in to prove the
// authorization/approval/delivery rules hold at the API layer. Logic proof only: not a real database,
// not deployed. Auth (session, membership, has_permission) is faked; the org-scoping code paths are not.
process.env.SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
const { default: handler } = await import('../api/client.js');
const { REQUIRED_REPORT_SECTIONS } = await import('../api/_auditRules.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const T = { audit_cases: [], audit_evidence: [], audit_findings: [], audit_finding_evidence: [], audit_recommendations: [], audit_reports: [], audit_deliveries: [], businesses: [], orders: [] };
let seq = 0; const allowedOrgs = new Set(['orgA']);
const get = (row, col) => col.split('.').reduce((o, k) => o?.[k], row);
function matches(row, [col, cond]) {
  if (['select', 'order', 'limit', 'on_conflict'].includes(col)) return true;
  if (col === 'or') { const parts = cond.replace(/^\(|\)$/g, '').split(','); return parts.some((p) => { const [c, ...rest] = p.split('.'); return matches(row, [c, rest.join('.')]); }); }
  const v = get(row, col);
  if (cond === 'is.null') return v == null; if (cond === 'not.is.null') return v != null;
  const m = /^(eq|in)\.(.*)$/.exec(cond); if (!m) return true;
  return m[1] === 'eq' ? String(v) === m[2] : m[2].replace(/[()]/g, '').split(',').includes(String(v));
}
function embed(table, row, select) {
  const out = { ...row };
  if (table === 'audit_findings' && /audit_finding_evidence/.test(select)) out.audit_finding_evidence = T.audit_finding_evidence.filter((l) => l.finding_id === row.id);
  if (table === 'audit_reports' && /audit_cases/.test(select)) out.audit_cases = T.audit_cases.find((c) => c.id === row.case_id) || null;
  return out;
}
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || 'GET';
  const J = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b, text: async () => JSON.stringify(b) });
  if (u.pathname === '/auth/v1/user') return J({ id: 'user1', email: 'staff@nova.test' });
  if (u.pathname === '/rest/v1/organization_members') return J([{ role: 'owner' }]);
  if (u.pathname === '/rest/v1/role_permissions') return J(['intelligence.view', 'growth.view', 'admin.view'].map((k) => ({ role: 'owner', permissions: { key: k } })));
  if (u.pathname === '/rest/v1/rpc/has_permission') return J(allowedOrgs.has(JSON.parse(init.body).target_org_id));
  const table = u.pathname.replace('/rest/v1/', ''); const rows = T[table];
  if (!rows) return J({ message: 'no table' }, 404);
  const filters = [...u.searchParams.entries()];
  const select = u.searchParams.get('select') || '*';
  if (method === 'GET') {
    let hit = rows.filter((r) => filters.every((f) => matches(embed(table, r, select), f)));
    const ord = u.searchParams.get('order'); if (ord) { const [c, d] = ord.split('.'); hit = [...hit].sort((a, b) => (d === 'desc' ? -1 : 1) * (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0)); }
    if (u.searchParams.get('limit')) hit = hit.slice(0, Number(u.searchParams.get('limit')));
    return J(hit.map((r) => embed(table, r, select)));
  }
  const body = init.body ? JSON.parse(init.body) : null;
  if (method === 'POST') { const list = (Array.isArray(body) ? body : [body]).map((b) => { const row = { id: `${table}-${++seq}`, created_at: new Date().toISOString(), ...b }; if (table === 'audit_findings') row.review_status ??= 'draft'; rows.push(row); return row; }); return J(list); }
  if (method === 'PATCH') { const hit = rows.filter((r) => filters.every((f) => matches(r, f))); hit.forEach((r) => Object.assign(r, body)); return J(hit); }
  return J([]);
};

const mkRes = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => (r.code = c, r); r.json = (b) => (r.body = b, r); r.send = (b) => (r.body = b, r); r.end = () => r; r.setHeader = (k, v) => (r.headers[k] = v); return r; };
let ip = 0;
const call = async (op, { method = 'POST', body = {}, query = {} } = {}) => { const res = mkRes(); await handler({ method, body, query: { resource: 'audit', op, ...query }, headers: { authorization: 'Bearer tok', origin: 'https://nova-systems.app', 'x-forwarded-for': `10.0.${++ip >> 8}.${ip & 255}` } }, res); return res; };

// ---- fixtures: case A1 + A2 in orgA, case B1 in orgB (with its own evidence)
T.businesses.push({ id: 'bizA', organization_id: 'orgA' }, { id: 'bizB', organization_id: 'orgB' });
let r = await call('cases', { body: { organization_id: 'orgA', action: 'create', business_id: 'bizB' } });
check('a case cannot reference another organization\'s business', r.code === 400, JSON.stringify(r.body));
r = await call('cases', { body: { organization_id: 'orgA', action: 'create', business_id: 'bizA' } });
const caseA = r.body.case.id;
const caseA2 = (await call('cases', { body: { organization_id: 'orgA', action: 'create' } })).body.case.id;
T.audit_cases.push({ id: 'caseB', organization_id: 'orgB', start_condition_met_at: null });
T.audit_evidence.push({ id: 'evB', case_id: 'caseB' });
T.audit_reports.push({ id: 'repB', case_id: 'caseB', version: 1, status: 'approved', content: { x: 1 }, approved_content_sha256: 'x' });

// ---- status guards
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'approved' } });
check('cannot jump a case straight to "approved" (no clock, no approved report)', r.code === 409);
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'delivered' } });
check('cannot mark a case "delivered" with no delivery record', r.code === 409);
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'researching' } });
check('cannot skip the clock start via update-status', r.code === 409 && /mark-ready/.test(r.body.error));
await call('cases', { body: { organization_id: 'orgA', action: 'mark-ready', id: caseA } });
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'evidence_gathered' } });
check('after mark-ready ordinary progress is allowed', r.code === 200);

// ---- evidence + findings
const ev1 = (await call('evidence', { body: { organization_id: 'orgA', case_id: caseA, source: 'Public web page https://x.example (retrieved 2026-10-01)', observation: 'No tel: link found', confidence: 'low' } })).body.evidence.id;
const F = (o) => call('findings', { body: { organization_id: 'orgA', case_id: caseA, title: 'No click-to-call', detail: 'No tel link in fetched HTML', statement_type: 'observed_fact', confidence: 'low', recommended_action: 'Add a click-to-call button', ...o } });
r = await F({});
check('an observed fact with no evidence is rejected at the API', r.code === 400 && r.body.problems?.some((p) => /evidence/.test(p)));
r = await F({ evidence_ids: ['evB'] });
check("a finding cannot cite another organization's evidence", r.code === 400 && /do not belong to this case/.test(r.body.error));
r = await F({ statement_type: 'estimate', detail: 'Maybe 10 calls' });
check('an estimate with no range/assumptions is rejected', r.code === 400);
r = await F({ evidence_ids: [ev1] });
const f1 = r.body.finding.id;
check('a valid evidenced finding is saved as DRAFT', r.code === 200 && r.body.finding.review_status === 'draft');
r = await F({ statement_type: 'unknown', title: 'Missed-call volume', detail: 'Not observable from public sources; needs owner call logs', confidence: null, recommended_action: null });
const fUnknown = r.body.finding.id;
check('an "unknown" gap can be recorded without evidence', r.code === 200);
r = await call('findings', { body: { organization_id: 'orgA', case_id: caseA, action: 'review', id: f1, review_status: 'reviewed' } });
check('an evidenced finding can be marked reviewed', r.code === 200 && r.body.finding.review_status === 'reviewed' && r.body.finding.reviewed_by === 'user1');
await call('findings', { body: { organization_id: 'orgA', case_id: caseA, action: 'review', id: fUnknown, review_status: 'reviewed' } });
r = await call('findings', { body: { organization_id: 'orgA', case_id: caseA2, action: 'review', id: f1, review_status: 'rejected' } });
check("a finding cannot be reviewed through a different case's id", r.code === 404);
r = await call('recommendations', { body: { organization_id: 'orgA', case_id: caseA2, finding_id: f1, mechanism: 'm' } });
check("a recommendation cannot point at another case's finding", r.code === 400);
r = await call('recommendations', { body: { organization_id: 'orgA', case_id: caseA, finding_id: f1, mechanism: 'Add click-to-call to the header' } });
check('a recommendation on its own finding is accepted', r.code === 200);

// ---- research SSRF
for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'file:///etc/passwd', 'http://localhost:3000/']) {
  r = await call('research', { body: { organization_id: 'orgA', case_id: caseA, url } });
  check(`research refuses ${url}`, r.code === 400 && /Could not research/.test(r.body.error), JSON.stringify(r.body));
}
check('refused research URLs wrote no evidence', T.audit_evidence.filter((e) => e.case_id === caseA).length === 1);

// ---- reports: readiness + binding
const full = Object.fromEntries(REQUIRED_REPORT_SECTIONS.map((s) => [s, `text for ${s}`]));
const mkDraft = async (content) => (await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'create-draft', content } })).body.report;
let d1 = await mkDraft({ executive_summary: 'only this' });
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d1.id } });
check('an incomplete report cannot be approved and the problems are listed', r.code === 422 && r.body.problems.length >= 8);
check('draft creation stores a content hash', typeof d1.content_sha256 === 'string' && d1.content_sha256.length === 64);
const d2 = await mkDraft(full);
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d1.id } });
check('a superseded version cannot be approved (a newer draft exists)', r.code === 409);
const dProhibited = await mkDraft({ ...full, executive_summary: 'We guarantee recovered revenue' });
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: dProhibited.id } });
check('prohibited claims block approval', r.code === 422 && r.body.problems.some((p) => /claim Nova does not make/.test(p)));
const d3 = await mkDraft(full);
T.audit_findings.find((f) => f.id === f1).review_status = 'draft';
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d3.id } });
check('an unreviewed finding blocks approval', r.code === 422 && r.body.problems.some((p) => /not been reviewed/.test(p)));
T.audit_findings.find((f) => f.id === f1).review_status = 'reviewed';

// ---- delivery before approval / cross-org
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: d3.id, provider_accepted: true } });
check('a draft report cannot be delivered', r.code === 409);
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: 'repB', provider_accepted: true } });
check("permission on org A cannot record a delivery against org B's report", r.code === 404);
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d3.id } });
check('a complete report with reviewed findings is approved, bound to its content hash', r.code === 200 && r.body.report.approved_content_sha256?.length === 64 && r.body.report.approved_by === 'user1');
r = await call('reports', { body: { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d3.id } });
check('an approved version is immutable (cannot be re-approved)', r.code === 400);
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'delivered' } });
check('still cannot mark the case delivered before a delivery exists', r.code === 409);
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: d3.id, delivered: true } });
check('claiming "delivered" without a confirmation is rejected', r.code === 400);
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: d3.id, provider_accepted: true } });
check('an accepted-but-unconfirmed send is recorded WITHOUT a delivered timestamp', r.code === 200 && r.body.delivery.delivered_at === null && !!r.body.delivery.provider_accepted_at && r.body.delivery.delivered_by === 'user1' && !!r.body.delivery.report_content_sha256);
r = await call('cases', { body: { organization_id: 'orgA', action: 'update-status', id: caseA, status: 'delivered' } });
check('the case can be marked delivered once a delivery is recorded for the approved report', r.code === 200);
T.audit_reports.find((x) => x.id === d3.id).content = { ...full, executive_summary: 'edited AFTER approval' };
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: d3.id, delivered: true, confirmation: 'customer replied' } });
check('content edited after approval can no longer be delivered', r.code === 409 && /no longer matches/.test(r.body.error));
const d4 = await mkDraft(full);
r = await call('deliveries', { body: { organization_id: 'orgA', report_id: d3.id, provider_accepted: true } });
check('a newer draft supersedes the approved version for delivery purposes', r.code === 409);
void d2; void d4;

// ---- org access is enforced on every audit op
allowedOrgs.clear();
for (const [op, method, body, query] of [['cases', 'GET', {}, { organization_id: 'orgA' }], ['findings', 'POST', { organization_id: 'orgA', case_id: caseA }], ['reports', 'POST', { organization_id: 'orgA', case_id: caseA, action: 'approve', id: d3.id }], ['deliveries', 'POST', { organization_id: 'orgA', report_id: d3.id }], ['research', 'POST', { organization_id: 'orgA', case_id: caseA, url: 'https://example.com' }]]) {
  r = await call(op, { method, body, query: query || {} });
  check(`without org permission, audit ${op} returns 403`, r.code === 403, `got ${r.code}`);
}

console.log(`\n${pass}/${pass + fail} audit handler checks passed (real handlers, in-memory PostgREST stand-in — not a real database, not deployed)`);
process.exit(fail ? 1 : 0);
