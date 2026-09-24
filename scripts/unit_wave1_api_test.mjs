// Logic test for api/_wave1Api.js staff ops (pilot lifecycle, permissions, checklist, preflight,
// results, authorization plumbing) against a tiny in-memory PostgREST stand-in. Proves rule logic
// only — NOT the real database, NOT deployed.
import { handleWave1 } from '../api/_wave1Api.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`PASS — ${name}`); } else { fail++; console.log(`FAIL — ${name} ${extra}`); } };

const T = { pilots: [], pilot_permissions: [], pilot_checklist_items: [], wave1_conversations: [], wave1_messages: [], wave1_appointments: [], wave1_org_settings: [], jobs: [] };
let seq = 0;
const matchRow = (row, filters) => filters.every(([col, cond]) => {
  const m = /^(eq|gte|in)\.(.*)$/.exec(cond); if (!m) return true;
  const [, op, v] = m;
  if (op === 'eq') return String(row[col]) === v;
  if (op === 'gte') return String(row[col]) >= v;
  if (op === 'in') return v.replace(/[()]/g, '').split(',').includes(String(row[col]));
  return true;
});
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const table = u.pathname.split('/rest/v1/')[1];
  const filters = [...u.searchParams.entries()].filter(([k]) => !['select', 'order', 'limit', 'on_conflict'].includes(k));
  const rows = T[table]; const method = init.method || 'GET';
  const ok = (b, s = 200) => ({ ok: true, status: s, json: async () => b, text: async () => JSON.stringify(b) });
  if (!rows) return { ok: false, status: 404, json: async () => ({}), text: async () => 'no table' };
  if (method === 'GET') return ok(rows.filter((r) => matchRow(r, filters)));
  const body = init.body ? JSON.parse(init.body) : null;
  if (method === 'POST') {
    const list = Array.isArray(body) ? body : [body]; const out = [];
    for (const rec of list) {
      const uniq = u.searchParams.get('on_conflict');
      const existing = uniq && rows.find((r) => uniq.split(',').every((c) => r[c] === rec[c]));
      if (existing) { if (String(init.headers.Prefer).includes('merge')) Object.assign(existing, rec), out.push(existing); continue; }
      const row = { id: `id${++seq}`, created_at: new Date().toISOString(), status: table === 'pilots' ? 'proposed' : undefined, agreement_status: table === 'pilots' ? 'not_sent' : undefined, ...rec };
      if (table === 'pilot_checklist_items') row.status = 'pending';
      rows.push(row); out.push(row);
    }
    return ok(out);
  }
  if (method === 'PATCH') { const hit = rows.filter((r) => matchRow(r, filters)); hit.forEach((r) => Object.assign(r, body)); return ok(hit); }
  return ok([]);
};

process.env.SUPABASE_URL = 'http://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
const sanitize = (v, n = 500) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const mkRes = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => (r.code = c, r); r.json = (b) => (r.body = b, r); r.send = (b) => (r.body = b, r); r.setHeader = (k, v) => (r.headers[k] = v); return r; };
let allowedPerm = true; const permCalls = [];
const deps = {
  requireStaff: async () => ({ id: 'staff1' }),
  requireOrgAccess: async (req, res, orgId, perm) => { permCalls.push([orgId, perm]); if (!orgId) { res.status(400).json({ error: 'organization_id is required' }); return false; } if (!allowedPerm) { res.status(403).json({ error: 'no' }); return false; } return true; },
  sanitize, rateLimit: () => true,
};
const call = async (op, { method = 'POST', body = {}, query = {} } = {}) => { const res = mkRes(); await handleWave1({ method, body, query: { organization_id: body.organization_id, ...query }, headers: {} }, res, op, deps); return res; };
const ORG = 'org-A';

// --- authorization plumbing
let r = await call('pilots', { body: { organization_id: '', action: 'create', name: 'x' } });
check('missing organization_id is rejected before any data access', r.code === 400);
allowedPerm = false; r = await call('pilots', { method: 'GET', body: { organization_id: ORG } });
check('caller without permission on the org gets 403', r.code === 403);
allowedPerm = true;
permCalls.length = 0; await call('pilots', { body: { organization_id: ORG, action: 'create', name: 'Pilot' } });
check('pilot writes require admin.view on the specific org', permCalls[0]?.[0] === ORG && permCalls[0]?.[1] === 'admin.view');
permCalls.length = 0; await call('pilots', { method: 'GET', body: { organization_id: ORG } });
check('pilot reads require only growth.view', permCalls[0]?.[1] === 'growth.view');

// --- lifecycle
r = await call('pilots', { body: { organization_id: ORG, action: 'create', name: '' } });
check('a pilot without a name is rejected', r.code === 400);
const pilot = T.pilots[0]; const pid = pilot.id;
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'agreed' } });
check('cannot mark agreed without an accepted agreement', r.code === 409);
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('cannot skip states (proposed → active)', r.code === 409);
r = await call('pilots', { body: { organization_id: ORG, action: 'record-agreement', pilot_id: pid, agreement_status: 'accepted' } });
check('acceptance without evidence is rejected', r.code === 400);
r = await call('pilots', { body: { organization_id: ORG, action: 'record-agreement', pilot_id: pid, agreement_status: 'accepted', agreement_evidence: 'signed-doc #A-17', agreement_version: 'v1-draft' } });
check('acceptance with evidence is recorded with a timestamp', r.code === 200 && !!T.pilots[0].agreement_accepted_at && T.pilots[0].agreement_evidence === 'signed-doc #A-17');
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'agreed' } });
check('agreed is allowed once acceptance is evidenced', r.code === 200 && T.pilots[0].status === 'agreed');
await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'onboarding' } });
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('cannot go active before provider cost payer is set', r.code === 409 && /provider costs/.test(r.body.error));
r = await call('pilots', { body: { organization_id: ORG, action: 'update', pilot_id: pid, provider_cost_payer: 'everyone' } });
check('invalid provider_cost_payer rejected', r.code === 400);
await call('pilots', { body: { organization_id: ORG, action: 'update', pilot_id: pid, provider_cost_payer: 'nova', start_date: '2026-10-01', end_date: '2026-10-31', baseline_start: '2026-09-01', baseline_end: '2026-09-30' } });
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('cannot go active with no checklist at all', r.code === 409 && /No checklist/.test(r.body.error));
r = await call('pilot-checklist', { body: { organization_id: ORG, pilot_id: pid, action: 'seed' } });
const seeded = T.pilot_checklist_items.length;
check('checklist seeds the standard items', r.code === 200 && seeded >= 15);
await call('pilot-checklist', { body: { organization_id: ORG, pilot_id: pid, action: 'seed' } });
check('re-seeding does not duplicate', T.pilot_checklist_items.length === seeded);
r = await call('pilot-checklist', { body: { organization_id: ORG, pilot_id: pid, item_key: 'opt_out_test', status: 'passed' } });
check('a check cannot be marked passed without evidence', r.code === 400);
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('go-live blocked while acceptance/go-live checks are open, and names them', r.code === 409 && r.body.open?.includes('opt_out_test'));
for (const it of T.pilot_checklist_items.filter((i) => i.phase !== 'preflight')) {
  await call('pilot-checklist', { body: { organization_id: ORG, pilot_id: pid, item_key: it.item_key, status: 'passed', evidence: 'observed by tester on 2026-10-01' } });
}
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('go-live allowed once every acceptance/go-live check has evidence', r.code === 200 && T.pilots[0].status === 'active');
await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'review' } });
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'converted' } });
check('conversion requires a recorded outcome reason', r.code === 400);
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'converted', outcome_reason: 'Owner approved paid plan' } });
check('conversion records outcome + reason', r.code === 200 && T.pilots[0].outcome === 'paid' && !!T.pilots[0].outcome_reason);
r = await call('pilots', { body: { organization_id: ORG, action: 'set-status', pilot_id: pid, status: 'active' } });
check('terminal states cannot be reopened', r.code === 409);

// --- cross-org isolation on pilot ids
r = await call('pilots', { body: { organization_id: 'org-B', action: 'set-status', pilot_id: pid, status: 'closed', outcome_reason: 'x' } });
check("org B cannot act on org A's pilot by guessing its id", r.code === 404);
r = await call('pilot-permissions', { method: 'GET', body: { organization_id: 'org-B' }, query: { pilot_id: pid } });
check("org B cannot read org A's pilot permissions", r.code === 404);
r = await call('pilot-checklist', { body: { organization_id: 'org-B', pilot_id: pid, item_key: 'opt_out_test', status: 'failed' } });
check("org B cannot alter org A's checklist", r.code === 404);

// --- testimonial permissions: separate, per-use, evidenced, never implied
const pilot2 = (await call('pilots', { body: { organization_id: ORG, action: 'create', name: 'Pilot 2' } })).body.pilot.id;
check('a NEW pilot has no permissions granted at all', T.pilot_permissions.filter((p) => p.pilot_id === pilot2).length === 0);
r = await call('pilot-permissions', { body: { organization_id: ORG, pilot_id: pilot2, kind: 'video', granted: true } });
check('granting requires the grantor name and evidence', r.code === 400);
r = await call('pilot-permissions', { body: { organization_id: ORG, pilot_id: pilot2, kind: 'everything', granted: true, granted_by_name: 'Owner', evidence: 'email' } });
check('a blanket "everything" permission is rejected', r.code === 400);
await call('pilot-permissions', { body: { organization_id: ORG, pilot_id: pilot2, kind: 'quotation', granted: true, granted_by_name: 'Owner', evidence: 'email 2026-10-05' } });
const perms = T.pilot_permissions.filter((p) => p.pilot_id === pilot2);
check('granting quotation does NOT grant video/logo/name/case study', perms.length === 1 && perms[0].kind === 'quotation');
await call('pilot-permissions', { body: { organization_id: ORG, pilot_id: pilot2, kind: 'quotation', granted: false } });
check('revoking clears the grant and stamps revoked_at', T.pilot_permissions.find((p) => p.pilot_id === pilot2).granted === false && !!T.pilot_permissions.find((p) => p.pilot_id === pilot2).revoked_at);
check('permission is not gated on the agreement status (separate decision)', T.pilots.find((p) => p.id === pilot2).agreement_status !== 'accepted');

// --- results honesty
T.wave1_conversations.push({ id: 'c1', organization_id: ORG, created_at: '2026-10-05T10:00:00Z', is_test: false }, { id: 'c2', organization_id: ORG, created_at: '2026-10-06T10:00:00Z', is_test: true }, { id: 'c3', organization_id: 'org-B', created_at: '2026-10-06T10:00:00Z', is_test: false });
T.wave1_appointments.push({ organization_id: ORG, status: 'requested', created_at: '2026-10-07T00:00:00Z', is_test: false }, { organization_id: ORG, status: 'confirmed', confirmed_at: '2026-10-08T00:00:00Z', created_at: '2026-10-08T00:00:00Z', is_test: false }, { organization_id: ORG, status: 'confirmed', confirmed_at: null, created_at: '2026-10-09T00:00:00Z', is_test: false });
r = await call('pilot-results', { method: 'GET', body: { organization_id: ORG }, query: { pilot_id: pid } });
const pp = r.body.pilot_period;
check('results exclude test activity and report it separately', pp.inquiries_captured === 1 && r.body.test_activity_excluded.conversations === 1);
check("results never include another organization's rows", pp.inquiries_captured === 1);
check('requested appointments are not counted as confirmed', pp.appointments_requested === 3 && pp.appointments_confirmed === 1);
check('a "confirmed" status without confirmed_at is not counted as confirmed', pp.appointments_confirmed === 1);
r = await call('pilot-results', { method: 'GET', body: { organization_id: ORG }, query: { pilot_id: pilot2 } });
check('undefined period says "not set", not zero', r.body.pilot_period.defined === false && r.body.pilot_period.inquiries_captured === undefined);
check('revenue / qualified leads / response time are declared not measured', !!r.body.not_measured.verified_revenue && !!r.body.not_measured.qualified_leads && !!r.body.not_measured.response_time);

// --- settings validation
r = await call('settings', { body: { organization_id: ORG, timezone: 'Mars/Olympus' } });
check('invalid IANA timezone rejected', r.code === 400);
r = await call('settings', { body: { organization_id: ORG, quiet_hours: { start: 25, end: 8 } } });
check('invalid quiet hours rejected', r.code === 400);

// --- preflight honesty
delete process.env.WAVE1_PUBLIC_BASE; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.WAVE1_SEND_ENABLED;
r = await call('preflight', { method: 'GET', body: { organization_id: ORG } });
const byKey = Object.fromEntries(r.body.checks.map((c) => [c.key, c]));
check('preflight is not "ready" on an unconfigured org/deployment', r.body.ready === false);
check('preflight reports live sending OFF as a failure to surface, not a pass', byKey.live_sends_enabled.status === 'fail');
check('worker liveness and provider webhook registration are UNKNOWN, never pass', byKey.worker_running.status === 'unknown' && byKey.webhook_urls_registered_with_provider.status === 'unknown');
check('missing webhook base is flagged (webhooks fail closed)', byKey.webhook_base_configured.status === 'fail');

// --- webhooks fail closed without config
let wres = mkRes();
await handleWave1({ method: 'POST', body: { From: '+15550001111' }, query: {}, headers: {} }, wres, 'sms-inbound', deps);
check('inbound SMS with no public base / auth token / signature is refused', wres.code === 403 || wres.code === 503, `got ${wres.code}`);
wres = mkRes();
await handleWave1({ method: 'GET', body: {}, query: {}, headers: {} }, wres, 'sms-inbound', deps);
check('webhooks reject non-POST', wres.code === 405);

console.log(`\n${pass}/${pass + fail} API logic checks passed (in-memory PostgREST stand-in — not a real database, not deployed)`);
process.exit(fail ? 1 : 0);
