// Nova Core calendar acceptance on a real disposable database through the real handlers:
//   Nova calendar: confirm → reschedule (taken slot refused, overlap refused, free slot moves the confirmed booking, old one
//   cancelled with reason, customer told by text) → cross-organization denial.
//   Cal.com path against a LOCAL STAND-IN of Cal.com's v2 API (not Cal.com itself): a provider error is reported as an error
//   (not "no open times"); an accepted booking is confirmed with the provider's uid; a rejected booking stays held and raises
//   an incident; reschedule uses the provider's reschedule call; an ambiguous provider reply leaves the original appointment
//   standing; cancelling a job cancels the provider booking. This is NOT evidence about Cal.com itself.
import fs from 'node:fs';
import http from 'node:http';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

// ---------------------------------------------------------------- local Cal.com stand-in
const cal = { mode: 'ok', calls: [], n: 0 };
const calSrv = http.createServer((req, res) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
    const url = new URL(req.url, 'http://x'); const body = d ? JSON.parse(d) : null;
    cal.calls.push({ method: req.method, path: url.pathname, version: req.headers['cal-api-version'], body });
    const out = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (cal.mode === 'auth') return out(401, { message: 'invalid api key' });
    if (req.method === 'GET' && url.pathname === '/slots') {
      const days = {}; const t0 = Date.now() - (Date.now() % 1800_000) + 1800_000;
      for (let t = t0; t < t0 + 21 * 86400_000; t += 1800_000) { const k = new Date(t).toISOString().slice(0, 10); (days[k] ||= []).push({ start: new Date(t).toISOString() }); }
      return out(200, { status: 'success', data: days });
    }
    if (req.method !== 'POST') return out(404, {});
    if (cal.mode === 'error500') return out(500, { message: 'upstream' });
    if (cal.mode === 'reject') return out(400, { message: 'slot unavailable' });
    if (url.pathname === '/bookings') return out(201, { status: 'success', data: { uid: `cal_${++cal.n}`, status: 'accepted', start: body.start } });
    if (/\/reschedule$/.test(url.pathname)) return out(201, { status: 'success', data: { uid: `cal_${++cal.n}`, status: 'accepted', start: body.start, rescheduledFromUid: url.pathname.split('/')[2] } });
    if (/\/cancel$/.test(url.pathname)) return out(200, { status: 'success', data: { status: 'cancelled' } });
    return out(404, {});
  });
});
await new Promise((r) => calSrv.listen(0, '127.0.0.1', r));

clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
const CUST = '+12035550150';
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, OPS_SEND_ALLOWLIST: CUST, WORKER_ID: 'calendar-test-worker' });
const client = makeCaller((await import('../api/client.js')).default);
const S = await import('../api/_ops/service.js');
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_bookings?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const otherOrg = (await one("insert into organizations (name, slug, kind) values ('TEST Other','other','client') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const outsider = await env.createUser({ email: 'x@other.test', role: 'client_owner', orgId: otherOrg });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const op = (o, body, token = owner.token) => client({ resource: 'ops', op: o, method: 'POST', body, token });
  const get = (o, query) => client({ resource: 'ops', op: o, method: 'GET', query, token: owner.token });
  const act = (action, extra, token) => op('job-action', { organization_id: biz, action, ...extra }, token);
  const slots = async () => (await get('availability', { organization_id: biz, service_key: 'full_detail', limit: 12 })).body;

  // A confirmed job: quote → hold → agreement sent → confirmed (the real confirmation function).
  async function confirmedJob(phone) {
    const slotStart = (await slots()).slots[0].start;
    const job = (await act('create', { phone, name: 'TEST Calendar Customer', is_test: true, customer_requested: true })).body.job;
    await act('quote', { job_id: job.id, service_key: 'full_detail' });
    const h = await act('hold', { job_id: job.id, start: slotStart });
    const sa = await act('send-agreement', { job_id: job.id });
    const j = await one('select * from ops_jobs where id=$1', [job.id]);
    await S.confirmJob({ orgId: biz, job: j, actor: { type: 'user', id: owner.id }, reason: 'TEST confirmation' });
    return { job: await one('select * from ops_jobs where id=$1', [job.id]), hold: h, sent: sa };
  }

  // ---------------------------------------------------------------- Nova calendar
  let av = await slots();
  check('Nova calendar offers open times for an approved service', av.ok === true && av.slots.length >= 6, JSON.stringify(av).slice(0, 200));
  const A = await confirmedJob(CUST);
  const bA = await one("select * from ops_bookings where job_id=$1 and status='confirmed'", [A.job.id]);
  check('the job is confirmed with one confirmed booking in the Nova calendar', A.job.state === 'confirmed' && !!bA && bA.provider_status === 'nova_confirmed');
  const B = (await act('create', { phone: '+12035550151', name: 'TEST Other Customer', is_test: true })).body.job;
  await act('quote', { job_id: B.id, service_key: 'full_detail' });
  av = await slots();
  const bHold = await act('hold', { job_id: B.id, start: av.slots[0].start });
  let r = await act('reschedule', { job_id: A.job.id, start: av.slots[0].start, reason: 'customer asked' });
  check("moving onto another customer's held time is refused; the original booking stands", bHold.status === 200 && r.status === 409 && r.body.reason === 'slot_taken' && (await one("select count(*)::int n from ops_bookings where job_id=$1 and status='confirmed'", [A.job.id])).n === 1, JSON.stringify(r.body));
  r = await act('reschedule', { job_id: A.job.id, start: new Date(new Date(bA.start_at).getTime() + 3600_000).toISOString(), reason: 'customer asked' });
  check('a new time overlapping the current appointment is refused with an explanation', r.status === 409 && r.body.reason === 'overlaps_current_booking');
  r = await act('reschedule', { job_id: A.job.id, start: new Date(Date.now() - 3600_000).toISOString(), reason: 'customer asked' });
  check('a time in the past is refused', r.status === 400);
  r = await act('reschedule', { job_id: A.job.id, start: av.slots.at(-1).start, reason: 'x' }, outsider.token);
  check('another organization cannot reschedule this job', r.status === 403 || r.status === 404);
  const target = av.slots.at(-1).start;
  r = await act('reschedule', { job_id: A.job.id, start: target, reason: 'customer asked for a later day', notify_customer: true });
  const active = await all("select * from ops_bookings where job_id=$1 and status in ('held','confirmed')", [A.job.id]);
  const oldRow = await one('select * from ops_bookings where id=$1', [bA.id]);
  check('a free time moves the confirmed booking: exactly one active booking, confirmed, at the new time', r.status === 200 && active.length === 1 && active[0].status === 'confirmed' && new Date(active[0].start_at).toISOString() === new Date(target).toISOString(), JSON.stringify(r.body).slice(0, 200));
  check('the old booking is cancelled with the reason, and the move is recorded with both times', oldRow.status === 'cancelled' && /rescheduled: customer asked/.test(oldRow.cancel_reason) && !!(await one("select 1 from ops_transitions where entity='booking' and entity_id=$1 and evidence->>'from_booking_id'=$2", [active[0].id, bA.id])));
  check('the job stays confirmed; staff are told the agreement names the old time', (await one('select state from ops_jobs where id=$1', [A.job.id])).state === 'confirmed' && /original time/.test(r.body.agreement_note || ''));
  const txt = prov.twilio.messages.filter((m) => m.to === CUST).at(-1);
  check('the customer is texted the new time (transactional; owner-controlled test number)', r.body.customer_notice?.status === 'provider_accepted' && /has moved to/.test(txt?.body || ''), JSON.stringify(r.body.customer_notice));
  const again = await act('reschedule', { job_id: A.job.id, start: target, reason: 'duplicate click' });
  check('repeating the same move changes nothing (no second booking)', again.status === 200 && again.body.unchanged === true && (await one("select count(*)::int n from ops_bookings where job_id=$1 and status in ('held','confirmed')", [A.job.id])).n === 1);

  // ---------------------------------------------------------------- Cal.com path (local stand-in)
  Object.assign(process.env, { CALCOM_API_KEY: 'cal_test_local_only', CALCOM_API_BASE: `http://127.0.0.1:${calSrv.address().port}` });
  await env.sql(`update ops_business_settings set calendar_provider='calcom', calcom_event_types='{"full_detail":777}' where organization_id=$1`, [biz]);
  cal.mode = 'auth';
  av = await slots();
  check('a calendar provider error is reported as an error, not as "no open times"', av.ok === false && av.reason === 'calendar_provider_error' && /auth/.test(av.detail || ''), JSON.stringify(av).slice(0, 200));
  cal.mode = 'ok';
  av = await slots();
  check('with the provider answering, only times free in BOTH Nova and the provider are offered', av.ok === true && av.slots.length > 0 && cal.calls.some((c) => c.path === '/slots'));
  const C = await confirmedJob('+12035550152');
  const bC = await one("select * from ops_bookings where job_id=$1 and status in ('held','confirmed') order by created_at desc", [C.job.id]);
  check('a booking the provider accepted is CONFIRMED with the provider booking id (was left "held" before this fix)', bC?.status === 'confirmed' && /^cal_/.test(bC.provider_booking_id || '') && bC.provider === 'calcom', JSON.stringify(bC).slice(0, 200));
  cal.mode = 'reject';
  const D = await confirmedJob('+12035550153');
  const bD = await one("select * from ops_bookings where job_id=$1 order by created_at desc", [D.job.id]);
  check('a booking the provider rejected stays held, is marked failed, and raises an incident for a person', bD.status === 'held' && /^failed:/.test(bD.provider_status || '') && !!(await one("select 1 from ops_incidents where check_key=$1 and status <> 'resolved'", [`escalation:${D.job.id}`])), JSON.stringify(bD).slice(0, 200));
  cal.mode = 'ok';
  r = await act('reschedule', { job_id: C.job.id, start: (await slots()).slots.at(-1).start, reason: 'customer asked' });
  const rc = cal.calls.filter((c) => /\/reschedule$/.test(c.path)).at(-1);
  const activeC = await all("select * from ops_bookings where job_id=$1 and status in ('held','confirmed')", [C.job.id]);
  check("reschedule uses the provider's reschedule call for the old booking and stores the new provider id", r.status === 200 && rc?.path === `/bookings/${bC.provider_booking_id}/reschedule` && rc.version === '2026-02-25' && activeC.length === 1 && activeC[0].status === 'confirmed' && activeC[0].provider_booking_id !== bC.provider_booking_id, JSON.stringify(r.body).slice(0, 200));
  const before = activeC[0];
  const far = (await slots()).slots.find((x) => Math.abs(new Date(x.start) - new Date(before.start_at)) >= 5 * 3600_000).start;
  cal.mode = 'error500';
  r = await act('reschedule', { job_id: C.job.id, start: far, reason: 'customer asked again' });
  const afterC = await all("select * from ops_bookings where job_id=$1 and status in ('held','confirmed')", [C.job.id]);
  check('an ambiguous provider reply leaves the original appointment standing, releases the new hold and asks a person to check', r.status === 409 && r.body.reason === 'calendar_outcome_unknown' && afterC.length === 1 && afterC[0].id === before.id && afterC[0].status === 'confirmed' && !!(await one("select 1 from ops_incidents where check_key=$1", [`escalation:${C.job.id}`])), JSON.stringify(r.body));
  cal.mode = 'ok';
  r = await act('cancel', { job_id: C.job.id, reason: 'TEST customer cancelled' });
  check("cancelling the job cancels the provider's booking too", r.status === 200 && r.body.calendar?.[0]?.status === 'cancelled' && cal.calls.some((c) => c.path === `/bookings/${before.provider_booking_id}/cancel`), JSON.stringify(r.body.calendar));
  const E = await confirmedJob('+12035550154');
  cal.mode = 'reject';
  r = await act('cancel', { job_id: E.job.id, reason: 'TEST cancel while provider refuses' });
  check('a provider cancel failure is shown and raises an incident (Nova does not claim the calendar is clear)', r.status === 200 && r.body.calendar?.[0]?.status === 'cancel_failed' && !!(await one("select 1 from ops_incidents where check_key like 'calendar_cancel_failed:%'")), JSON.stringify(r.body.calendar));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); await new Promise((r) => calSrv.close(r)); }
console.log(`\n${pass} passed, ${fail} failed — Nova Core calendar: reschedule, cancel, Cal.com path (local stand-in; not Cal.com itself)`);
process.exitCode = fail ? 1 : 0;
// Let Node exit on its own once handles close. Calling process.exit() while fetch keep-alive connections are still
// closing aborts Node 24 on Windows (libuv assertion in src/win/async.c, exit 0xC0000409) and can drop the printed
// result — the cause of the intermittent 'no result line' crashes (reproduced 40/40, fixed 0/40 on 2026-10-17).
// The unref'd timer is only a last resort if something keeps the process alive.
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
