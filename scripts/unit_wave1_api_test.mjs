// Logic test for api/_wave1Api.js staff ops (pilot lifecycle, permissions, checklist, preflight,
// results, authorization plumbing) against a tiny in-memory PostgREST stand-in. Proves rule logic
// only — NOT the real database, NOT deployed.
import { handleWave1 } from '../api/_wave1Api.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`PASS — ${name}`); } else { fail++; console.log(`FAIL — ${name} ${extra}`); } };

const T = { crm_contacts: [], pilots: [], pilot_permissions: [], pilot_checklist_items: [], wave1_conversations: [], wave1_messages: [], wave1_appointments: [], wave1_org_settings: [], jobs: [] };
let seq = 0;
const matchRow = (row, filters) => filters.every(([col, cond]) => {
  const m = /^(eq|gte|in)\.(.*)$/.exec(cond); if (!m) return true;
  const [, op, v] = m;
  if (op === 'eq') return String(row[col]) === v;
  if (op === 'gte') return String(row[col]) >= v;
  if (op === 'in') return v.replace(/[()]/g, '').split(',').includes(String(row[col]));
  return true;
});
// Cal.com stand-in: records calls; behaviour switchable per test. Never touches the network.
const cal = { calls: [], slots: [], bookingStatus: 'accepted', mode: 'ok', bookings: {} };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.cal.com') {
    cal.calls.push({ method: init.method, path: u.pathname, version: init.headers['cal-api-version'], auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null });
    const J = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b });
    if (cal.mode === 'timeout' && init.method === 'POST') { const err = new Error('aborted'); err.name = 'AbortError'; throw err; }
    if (cal.mode === 'server_error' && init.method === 'POST') return J({}, 503);
    if (cal.mode === 'reject' && init.method === 'POST') return J({ error: { message: 'slot unavailable' } }, 400);
    if (u.pathname === '/v2/slots') return J({ status: 'success', data: { [u.searchParams.get('start')]: cal.slots.map((s) => ({ start: s })) } });
    if (u.pathname === '/v2/bookings' && init.method === 'POST') { const b = JSON.parse(init.body); const bk = { uid: `bk_${b.start}`, status: cal.bookingStatus, start: b.start, end: new Date(new Date(b.start).getTime() + 1800000).toISOString() }; cal.bookings[bk.uid] = bk; return J({ status: 'success', data: bk }, 201); }
    const m = /^\/v2\/bookings\/([^/]+)(\/cancel)?$/.exec(u.pathname);
    if (m && init.method === 'GET') return J({ status: 'success', data: cal.bookings[decodeURIComponent(m[1])] });
    if (m && m[2]) { cal.bookings[decodeURIComponent(m[1])].status = 'cancelled'; return J({ status: 'success', data: {} }); }
    return J({}, 404);
  } const table = u.pathname.split('/rest/v1/')[1];
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

// --- Cal.com scheduling + appointments
T.wave1_appointments.length = 0; // earlier results tests seeded rows; start clean
process.env.CALCOM_API_KEY = 'cal_test_key';
const FUT = (h) => new Date(Date.now() + 3 * 86400_000 + h * 3600_000);
const hr = (d) => { const x = new Date(d); x.setUTCMinutes(0, 0, 0); return x; };
const slotA = hr(FUT(0)).toISOString(), slotB = hr(FUT(2)).toISOString();
T.crm_contacts.push({ id: 'ct1', organization_id: ORG, name: 'Pat Lee', email: 'pat@x.test', phone_e164: '+12035550100' }, { id: 'ct2', organization_id: 'org-B', name: 'Zed', email: 'z@x.test' }, { id: 'ct3', organization_id: ORG, name: 'No Email' });
T.wave1_conversations.push({ id: 'cvA', organization_id: ORG, contact_id: 'ct1', channel: 'sms', appointment_confirmed: false });
T.wave1_org_settings.push({ organization_id: ORG, timezone: 'America/New_York', calcom_event_type_id: 777 });
cal.slots = [slotA, slotB];
r = await call('availability', { method: 'GET', body: { organization_id: ORG }, query: { start: slotA.slice(0, 10), end: slotA.slice(0, 10) } });
check('availability comes from the scheduling source, with the pinned API version and bearer key', r.code === 200 && r.body.slots.includes(slotA) && cal.calls.at(-1).version === '2024-09-04' && cal.calls.at(-1).auth === 'Bearer cal_test_key');
delete process.env.CALCOM_API_KEY;
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotA } });
check('booking with Cal.com not connected is refused, not faked', r.code === 409 && /not connected/.test(r.body.error) && T.wave1_appointments.length === 0);
process.env.CALCOM_API_KEY = 'cal_test_key';
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct2', start_at: slotA } });
check("cannot book for another organization's contact", r.code === 404);
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct3', start_at: slotA } });
check('a contact with no email cannot be booked through Cal.com', r.code === 409 && T.wave1_appointments.length === 0);
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: new Date(Date.now() - 3600_000).toISOString() } });
check('a time in the past is refused', r.code === 400);
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: hr(FUT(5)).toISOString() } });
check('a time outside the scheduling source availability is refused', r.code === 409 && /availability/.test(r.body.error) && T.wave1_appointments.length === 0);
cal.bookingStatus = 'pending';
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotA } });
const pend = T.wave1_appointments.find((a) => a.start_at === slotA);
check('a PENDING Cal.com booking is stored as requested, NOT confirmed, and does not stop follow-up', r.code === 200 && r.body.confirmed === false && pend.status === 'requested' && pend.confirmed_at === null && T.wave1_conversations.find((c) => c.id === 'cvA').appointment_confirmed === false);
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotA } });
check('the same slot cannot be booked twice (duplicate prevention)', r.code === 409);
cal.bookings[pend.provider_booking_id].status = 'accepted';
r = await call('appointments', { body: { organization_id: ORG, action: 'sync', id: pend.id } });
check('sync: confirmed only once Cal.com itself reports accepted; then follow-up automation stops', r.code === 200 && pend.status === 'confirmed' && !!pend.confirmed_at && T.wave1_conversations.find((c) => c.id === 'cvA').appointment_confirmed === true);
cal.bookingStatus = 'accepted';
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotB } });
check('an accepted booking is confirmed immediately with the provider booking id and end time', r.code === 200 && r.body.confirmed === true && T.wave1_appointments.find((a) => a.start_at === slotB).provider_booking_id === `bk_${slotB}`);
const slotC = hr(FUT(30)).toISOString(); cal.slots.push(slotC); cal.mode = 'timeout';
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotC } });
cal.mode = 'ok';
const amb = T.wave1_appointments.find((a) => a.start_at === slotC);
check('AMBIGUOUS write (timeout): nothing is confirmed, the row says to check Cal.com, and it is not retried automatically', r.code === 202 && amb.status === 'requested' && /AMBIGUOUS/.test(amb.notes) && cal.calls.filter((c) => c.method === 'POST' && c.body?.start === slotC).length === 1);
const slotD = hr(FUT(50)).toISOString(); cal.slots.push(slotD); cal.mode = 'reject';
r = await call('appointments', { body: { organization_id: ORG, action: 'book', contact_id: 'ct1', start_at: slotD } });
cal.mode = 'ok';
check('a refused booking is recorded as cancelled and reported, never left looking booked', r.code === 422 && T.wave1_appointments.find((a) => a.start_at === slotD).status === 'cancelled');
cal.mode = 'server_error'; const before = T.wave1_appointments.find((a) => a.start_at === slotB).status;
r = await call('appointments', { body: { organization_id: ORG, action: 'cancel', id: T.wave1_appointments.find((a) => a.start_at === slotB).id } });
cal.mode = 'ok';
check('if Cal.com cannot cancel, the appointment is NOT marked cancelled locally', r.code !== 200 && T.wave1_appointments.find((a) => a.start_at === slotB).status === before);
r = await call('appointments', { body: { organization_id: ORG, action: 'cancel', id: T.wave1_appointments.find((a) => a.start_at === slotB).id } });
check('a cancellation Cal.com accepted is recorded', r.code === 200 && T.wave1_appointments.find((a) => a.start_at === slotB).status === 'cancelled');
r = await call('appointments', { body: { organization_id: ORG, action: 'request-manual', contact_id: 'ct1', start_at: slotB, notes: 'called in' } });
const man = r.body.appointment;
check('a staff-entered request is REQUESTED only', r.code === 200 && man.status === 'requested' && !man.confirmed_at);
r = await call('appointments', { body: { organization_id: ORG, action: 'confirm', id: man.id } });
check('staff confirmation needs a note on how the customer confirmed', r.code === 400);
r = await call('appointments', { body: { organization_id: ORG, action: 'confirm', id: man.id, confirmation_note: 'Customer confirmed by phone 10/2 2pm' } });
check('staff confirmation is recorded with who/when/how', r.code === 200 && man.status === 'confirmed' && /staff@|staff1/.test(man.notes) && !!man.confirmed_at);
r = await call('appointments', { body: { organization_id: ORG, action: 'confirm', id: T.wave1_appointments.find((a) => a.start_at === slotA).id, confirmation_note: 'x' } });
check('a Cal.com booking cannot be confirmed by hand — only by the scheduling source', r.code === 409);
r = await call('appointments', { body: { organization_id: 'org-B', action: 'cancel', id: man.id } });
check("org B cannot cancel org A's appointment", r.code === 404);
check('Cal.com is never contacted by requests that never reach it (validation happens first)', cal.calls.filter((c) => c.method === 'POST' && c.path === '/v2/bookings').length === 4);

console.log(`\n${pass}/${pass + fail} API logic checks passed (in-memory PostgREST stand-in — not a real database, not deployed)`);
process.exit(fail ? 1 : 0);
