// Nova Sentry + AI voice receptionist + weekly scheduler, on a real disposable database through real handlers/worker.
// Sentry: missing worker → incident + paced alert; recovery → resolved with evidence; stopped worker detected; dead
//   letters detected; acknowledge/resolve permissions; a crashed job is re-run after its lease expires WITHOUT a
//   duplicate customer message.
// Voice: Twilio-signed calls driven through <Gather> turns: disclosure, approved price, real times, hold, explicit
//   consent before texting the link, card numbers refused, transfer to a person, forged calls rejected, fallback.
// Scheduler: Sunday 18:00 in the business's zone (incl. the DST change week); generated once; notification gated.
// Twilio/Stripe/Resend are local stand-ins ("simulated provider"); nothing leaves this machine.
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, inboundSms, signedTwilio, TW_TOKEN, WH_SECRET, PUBLIC_BASE, BIZ_NUMBER } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, WORKER_ID: 'sentry-test-worker', OPS_ALERT_EMAIL: 'oncall@nova.test', OPS_SEND_ALLOWLIST: '+12035550120,+12035550121,+12035550130' });
const client = makeCaller((await import('../api/client.js')).default);
const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
const W = await import('../worker/index.mjs');
const { runSentry } = await import('../api/_ops/sentry.js');
const { scoreboardTick } = await import('../api/_ops/reports.js');
const R = await import('../api/_ops/rules.js');
const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
const ctx = { url: env.base, serviceKey: env.serviceKey, mode: 'postgres', store };
const runDue = async (max = 40) => { let n = 0; while (n < max && await W.processOneJob(store, ctx)) n++; return n; };
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;
const sentTo = (n) => prov.twilio.messages.filter((m) => m.to === n);

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_incidents?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const op = (o, body, token = owner.token, method = 'POST', query = {}) => client({ resource: 'ops', op: o, method, body, token, query });
  const clientOwner = await env.createUser({ email: 'pat@shine.test', role: 'client_owner', orgId: biz });

  // ================================================================ Sentry: worker absent → incident + one paced alert
  let s = await runSentry();
  let inc = await one("select * from ops_incidents where organization_id is null and check_key='worker_heartbeat' and status<>'resolved'");
  check('no worker heartbeat → a CRITICAL incident is opened', inc?.severity === 'critical' && inc.status === 'open', JSON.stringify(s.summary));
  check('unconfigured providers are reported "not_configured", not healthy', (await one("select status from ops_health_checks where check_key='calendar_connectivity' order by checked_at desc")).status === 'not_configured');
  const alertMails = () => env.stubs.outbox.filter((m) => /Nova Sentry/.test(m.subject || ''));
  check('the on-call is alerted by email (attempt recorded, not treated as resolution)', alertMails().length >= 1 && inc.alerts_sent >= 1 && inc.status === 'open');
  const mailsBefore = alertMails().length;
  await runSentry();
  inc = await one('select * from ops_incidents where id=$1', [inc.id]);
  check('a repeat failure increments the same incident and does NOT re-alert within 15 minutes (no storm)', inc.occurrences === 2 && alertMails().length === mailsBefore && (await one("select count(*)::int n from ops_incidents where check_key='worker_heartbeat' and status<>'resolved'")).n === 1);
  await W.heartbeat(ctx, { force: true });
  await runSentry();
  inc = await one('select * from ops_incidents where id=$1', [inc.id]);
  check('the worker comes back → incident RESOLVED with recovery evidence', inc.status === 'resolved' && inc.recovery_evidence?.status === 'healthy', JSON.stringify(inc.recovery_evidence));
  await W.heartbeat(ctx, { stopped: true });
  await runSentry();
  check('stopping the worker is detected again (new incident)', !!(await one("select id from ops_incidents where check_key='worker_heartbeat' and status='open' and id<>$1", [inc.id])));
  await store.enqueue({ job_type: 'no_such_job_type_test', payload: {}, max_attempts: 1 });
  await runDue(5);
  await env.sql("insert into jobs (job_type, payload, scheduled_at) values ('demo_echo','{}', now() - interval '20 minutes')");
  await runSentry();
  check('a dead-lettered job is detected (degraded)', (await one("select status from ops_health_checks where check_key='dead_letter_jobs' order by checked_at desc")).status === 'degraded');
  check('a job waiting 20 minutes with no worker is a FAILING queue delay', (await one("select status from ops_health_checks where check_key='queue_delay' order by checked_at desc")).status === 'failing');
  await runDue(5);
  const openInc = await one("select id from ops_incidents where check_key='worker_heartbeat' and status='open'");
  let r = await op('incidents', null, clientOwner.token, 'GET');
  check('a client owner cannot see platform incidents', r.status === 403);
  r = await op('incidents', { incident_id: openInc.id, action: 'acknowledge', note: 'TEST: on it' }, clientOwner.token);
  check('a client owner cannot acknowledge a platform incident', r.status === 403);
  r = await op('incidents', { incident_id: openInc.id, action: 'acknowledge', note: 'TEST: on it' });
  check('Nova staff acknowledge the incident (alerts stop; it stays open until resolved)', r.status === 200 && r.body.status === 'acknowledged');
  r = await op('incidents', { incident_id: openInc.id, action: 'resolve', resolution: 'x' });
  check('resolving requires describing what was done', r.status === 400);
  r = await op('incidents', { incident_id: openInc.id, action: 'resolve', resolution: 'TEST: restarted the worker service' });
  check('…then it resolves with the record of who did what', r.status === 200 && r.body.status === 'resolved');

  // ================================================================ crash mid-job → lease expires → re-run without duplicate effects
  await W.heartbeat(ctx, { force: true });
  await inboundSms(client, '+12035550120', 'hello, do you have time Friday?');
  const turn = await store.claimNext({ workerId: 'crashed-worker', jobTypes: ['ops_conversation_turn'], leaseSeconds: 60 });
  check('(setup) a worker claimed the conversation turn and then "crashed" (never completed it)', turn?.status === 'leased');
  check('while the lease is live, no other worker can take the job', !(await store.claimNext({ workerId: 'other', jobTypes: ['ops_conversation_turn'] })));
  await env.sql("update jobs set leased_until = now() - interval '1 second' where id=$1", [turn.id]); // TEST: the lease runs out
  await runDue(5);
  check('after the lease expires the job is re-claimed and the customer gets exactly one reply', sentTo('+12035550120').length === 1 && (await one('select status from jobs where id=$1', [turn.id])).status === 'completed');
  await env.sql("update jobs set status='pending', leased_by=null, leased_until=null where id=$1", [turn.id]); // TEST: duplicate delivery of the same job
  await runDue(5);
  check('a duplicate execution of the same turn sends nothing more (idempotent)', sentTo('+12035550120').length === 1 && /already_answered/.test(JSON.stringify((await one('select result from jobs where id=$1', [turn.id])).result)));

  // ================================================================ voice receptionist
  const voice = (o, params) => signedTwilio(client, o, { To: BIZ_NUMBER, AccountSid: 'AC_TEST', ...params }, { resource: 'ops' });
  r = await voice('voice-inbound', { From: '+12035550121', CallSid: 'CA_VOICE_FALLBACK' });
  check('without an active voice configuration the call falls back to human forwarding (not called "AI")', r.status === 200 && /<Dial/.test(r.body) && !/automated/i.test(r.body), r.body);
  r = await op('voice-settings', { organization_id: biz, status: 'active', disclosure_script: 'Hello.' });
  check('the voice assistant cannot be activated without an automated-assistant disclosure', r.status === 400);
  r = await op('voice-settings', { organization_id: biz, status: 'active', recording_enabled: true, disclosure_script: 'You are speaking with an automated assistant.' });
  check('call recording cannot be switched on (consent process not approved)', r.status === 400);
  r = await op('voice-settings', { organization_id: biz, status: 'active', disclosure_script: 'You are speaking with an automated assistant for TEST Shine Detailing.' });
  check('the owner activates the voice assistant with a disclosure', r.status === 200);
  const forgedCall = await client({ resource: 'ops', op: 'voice-inbound', body: { From: '+12035550121', To: BIZ_NUMBER, CallSid: 'CA_FORGED' }, headers: { 'x-twilio-signature': 'nope' } });
  check('a forged voice webhook is rejected', forgedCall.status === 403);
  r = await voice('voice-inbound', { From: '+12035550121', CallSid: 'CA_VOICE_1' });
  check('the call opens with the automated-assistant disclosure and listens (speech + keypad)', /automated assistant/.test(r.body) && /<Gather input="speech dtmf"/.test(r.body) && /op=voice-turn/.test(r.body), r.body);
  r = await voice('voice-turn', { From: '+12035550121', CallSid: 'CA_VOICE_1', SpeechResult: 'my card number is 4242 4242 4242 4242' });
  check('a spoken card number is refused and not kept', /do not share card numbers/.test(r.body) && !JSON.stringify((await one("select turns from voice_call_sessions where provider_call_sid='CA_VOICE_1'")).turns).includes('4242'));
  r = await voice('voice-turn', { From: '+12035550121', CallSid: 'CA_VOICE_1', SpeechResult: 'I need a full detail please' });
  check('speech is matched to an approved service; the approved price and real times are read out', /\$180\.00/.test(r.body) && /1\)/.test(r.body) && /<Gather/.test(r.body), r.body);
  r = await voice('voice-turn', { From: '+12035550121', CallSid: 'CA_VOICE_1', Digits: '1' });
  const vjob = await one("select j.* from ops_jobs j join voice_call_sessions v on v.job_id=j.id where v.provider_call_sid='CA_VOICE_1'");
  check('choosing a time holds it, then ASKS permission before texting the link', /May I text you a secure link/.test(r.body) && (await one("select status from ops_bookings where job_id=$1", [vjob.id])).status === 'held', r.body);
  const smsBefore = sentTo('+12035550121').length;
  r = await voice('voice-turn', { From: '+12035550121', CallSid: 'CA_VOICE_1', Digits: '1' });
  check('after the caller agrees, the secure agreement/deposit link is texted and the call ends politely', /texted you a secure link/.test(r.body) && /<Hangup/.test(r.body) && sentTo('+12035550121').length === smsBefore + 1 && /\/service\//.test(sentTo('+12035550121').pop().body), r.body);
  check('the voice booking is the same persisted journey (job awaiting the agreement)', (await one('select state from ops_jobs where id=$1', [vjob.id])).state === 'awaiting_agreement');
  r = await voice('voice-inbound', { From: '+12035550130', CallSid: 'CA_VOICE_2' });
  r = await voice('voice-turn', { From: '+12035550130', CallSid: 'CA_VOICE_2', Digits: '0' });
  check('pressing 0 transfers to a real person (escalation number)', /<Dial/.test(r.body) && /\+12035550111/.test(r.body), r.body);
  r = await voice('voice-inbound', { From: '+12035550130', CallSid: 'CA_VOICE_3' });
  r = await voice('voice-turn', { From: '+12035550130', CallSid: 'CA_VOICE_3', SpeechResult: 'this is a ripoff I want to speak to a manager' });
  check('anger or a request for a person escalates to the human transfer', /<Dial/.test(r.body));

  // ================================================================ Sunday scheduler (business time zone, DST)
  // A fixed Sunday (Oct 11 2026, 18:00 EDT). Deriving it from the real clock made the test fail on Sunday evenings:
  // "next Sunday" then fell in the same week as the fixed DST check below (Nov 1), which it pre-generated and blocked.
  const sunday = new Date('2026-10-11T22:00:00Z');
  check('(fixture) the chosen Sunday is a Sunday 18:00 in New York', R.nextSundayEvening(new Date(sunday.getTime() - 3600_000), 'America/New_York').getTime() === sunday.getTime());
  let out = await scoreboardTick({ now: new Date(sunday.getTime() + 30 * 60_000) });
  const mine = out.find((o) => o.orgId === biz);
  check('at Sunday 18:30 local the week\'s report is generated once', !!mine?.report_id, JSON.stringify(out));
  check('without an opted-in owner number the SMS is recorded as BLOCKED (never "sent")', mine.notification === 'blocked');
  out = await scoreboardTick({ now: new Date(sunday.getTime() + 90 * 60_000) });
  check('a later tick does not generate it again', out.find((o) => o.orgId === biz).skipped === 'already_generated');
  r = await op('settings', { organization_id: biz, scoreboard_phone: '+12035550130' });
  check('an owner number without the owner\'s text consent is refused', r.status === 400);
  r = await op('settings', { organization_id: biz, scoreboard_phone: '+12035550130', scoreboard_sms_consent: true });
  const dstEnd = new Date('2026-11-01T23:30:00Z'); // Sunday Nov 1 2026, 18:30 EST (first Sunday after DST ends)
  out = await scoreboardTick({ now: dstEnd });
  const dstRep = await one('select * from ops_weekly_reports where organization_id=$1 and week_end=$2', [biz, '2026-11-01T23:00:00Z']);
  check('the DST-change week ends Sunday 18:00 EST (23:00Z) and starts 18:00 EDT the week before (22:00Z)', dstRep && new Date(dstRep.week_start).toISOString() === '2026-10-25T22:00:00.000Z', JSON.stringify(out));
  const weeklyMsg = await one("select status, blocked_reason, created_at from wave1_messages where organization_id=$1 and purpose='weekly_report' order by created_at desc limit 1", [biz]);
  check('with consent the weekly SMS goes out with a sign-in link to the full report', dstRep.notification_status === 'provider_accepted' && /\/dashboard\/ops\/reports\//.test(sentTo('+12035550130').pop()?.body || ''), `${dstRep.notification_status} (${dstRep.notification_detail}) ${JSON.stringify(weeklyMsg)} settings: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Sentry, AI voice receptionist and weekly scheduler (real handlers + worker + local PostgreSQL; providers are local stand-ins: "simulated provider")`);
process.exitCode = fail ? 1 : 0;
// Force-exit once results are printed: embedded-postgres child pipes on Windows can otherwise keep a finished
// (or crashed) suite alive until the aggregate runner's timeout (seen 2026-10-13 in a clean-checkout run).
// Let Node exit on its own once handles close. Calling process.exit() while fetch keep-alive connections are still
// closing aborts Node 24 on Windows (libuv assertion in src/win/async.c, exit 0xC0000409) and can drop the printed
// result — the cause of the intermittent 'no result line' crashes (reproduced 40/40, fixed 0/40 on 2026-10-17).
// The unref'd timer is only a last resort if something keeps the process alive.
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
