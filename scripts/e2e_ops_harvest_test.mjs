// Nova Harvest acceptance on a real disposable database through the real handlers and worker:
//   missed call → eligible follow-up → reply → booking; staff-answered calls get nothing; no-consent callers are blocked;
//   import with mixed permission/suppression → only approved, eligible records selected; opt-out and replies after
//   enqueue stop queued sends; spacing and budget respected. Twilio/Stripe are local stand-ins ("simulated provider").
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, inboundSms, signedTwilio, TW_TOKEN, WH_SECRET, PUBLIC_BASE, BIZ_NUMBER } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, WORKER_ID: 'harvest-test-worker' });
const client = makeCaller((await import('../api/client.js')).default);
const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
const W = await import('../worker/index.mjs');
const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
const ctx = { url: env.base, serviceKey: env.serviceKey, mode: 'postgres', store };
const runDue = async (max = 60) => { let n = 0; while (n < max && await W.processOneJob(store, ctx)) n++; return n; };
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;
const sentTo = (n) => prov.twilio.messages.filter((m) => m.to === n);

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_campaigns?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const op = (o, body, method = 'POST', query = {}) => client({ resource: 'ops', op: o, method, body, token: owner.token, query });
  process.env.OPS_SEND_ALLOWLIST = '+12035550101,+12035550102,+12035550104,+12035550107,+12035550109,+12035550110';
  await env.sql(`update wave1_org_settings set templates='{"missed_call":"Hi, this is TEST Shine Detailing — sorry we missed your call. How can we help? Reply STOP to opt out."}' where organization_id=$1`, [biz]);

  // contacts with recorded consent (e.g. earlier web-form checkbox), one opted out, one unknown
  const mk = async (phone, name, extra = '') => (await one(`insert into crm_contacts (organization_id, name, phone, phone_e164, source, is_test${extra ? ', sms_consent, sms_consent_source, sms_consent_at' : ''}) values ($1,$2,$3,$3,'TEST import',true${extra ? ", true, 'TEST web form checkbox', now() - interval '30 days'" : ''}) returning id`, [biz, name, phone])).id;
  const consented = await mk('+12035550101', 'TEST Alex', 'consent');
  await mk('+12035550102', 'TEST Blair', 'consent');
  await env.sql("insert into crm_contacts (organization_id, name, phone, phone_e164, source, is_test, suppressed, suppressed_at, suppression_source) values ($1,'TEST Casey','+12035550103','+12035550103','TEST import',true,true,now(),'sms_stop_keyword')", [biz]);
  await mk('+12035550104', 'TEST Drew', 'consent');
  await mk('+12035550107', 'TEST Emery', 'consent');
  await mk('+12035550109', 'TEST Frankie', 'consent');

  // ================================================================ missed call → follow-up → reply → booking
  const call = (from, status, sid, dial = null) => signedTwilio(client, 'call-status', { From: from, To: BIZ_NUMBER, CallSid: sid, CallStatus: dial ? 'completed' : status, ...(dial ? { DialCallStatus: dial } : {}) });
  let r = await call('+12035550101', 'completed', 'CA_ANSWERED', 'completed');
  await runDue();
  check('a call answered by staff (forwarded leg completed) creates no follow-up', sentTo('+12035550101').length === 0 && !(await one("select 1 from jobs where job_type='wave1_missed_call_followup'")));
  r = await call('+12035550101', 'completed', 'CA_MISSED_1', 'no-answer');
  r = await call('+12035550101', 'completed', 'CA_MISSED_1', 'no-answer'); // provider retry of the same callback
  await runDue();
  check('a missed forwarded call (DialCallStatus no-answer) sends exactly ONE follow-up, despite a duplicate callback', sentTo('+12035550101').length === 1 && /sorry we missed your call/.test(sentTo('+12035550101')[0].body), JSON.stringify(sentTo('+12035550101')));
  r = await call('+12035550199', 'no-answer', 'CA_MISSED_UNKNOWN');
  await runDue();
  const unk = await one("select status, blocked_reason from wave1_messages where organization_id=$1 and purpose='missed_call' and idempotency_key like 'missed_call:CA_MISSED_UNKNOWN%'", [biz]);
  check('a missed call from a number with no recorded consent is NOT texted (default policy), and the reason is recorded', unk?.status === 'blocked' && unk.blocked_reason === 'no_recorded_consent' && sentTo('+12035550199').length === 0, JSON.stringify(unk));
  await inboundSms(client, '+12035550101', 'Yes please — need a full detail');
  await runDue();
  const offer = sentTo('+12035550101').pop().body;
  check('the reply continues into the booking engine (approved price + real times)', /Full detail: \$180\.00/.test(offer) && /1\)/.test(offer), offer);
  await inboundSms(client, '+12035550101', '1');
  await runDue();
  const job = await one("select * from ops_jobs where organization_id=$1 and contact_id=$2", [biz, consented]);
  check('missed call → reply → slot held and agreement link sent (journey continues)', job.state === 'awaiting_agreement' && /\/service\//.test(sentTo('+12035550101').pop().body));

  // ================================================================ import → preview → approval → spaced sends
  const rows = [
    { name: 'TEST Alex', phone: '(203) 555-0101', last_date: '2026-06-01' },
    { name: 'TEST Blair', phone: '203-555-0102', last_date: '2026-05-15' },
    { name: 'TEST Casey', phone: '203 555 0103', last_date: '2026-05-15' },
    { name: 'TEST Drew', phone: '2035550104', last_date: '2026-04-15' },
    { name: 'TEST Unknown', phone: '2035550105', last_date: '2026-04-15' },
    { name: 'TEST Dup', phone: '+1 203 555 0102', last_date: '2026-04-15' },
    { name: 'TEST Old', phone: '2035550107', last_date: '2018-01-01' },
    { name: 'TEST Bad', phone: '12', last_date: '2026-04-15' },
    { name: 'TEST Frankie', phone: '203.555.0109', last_date: '2026-07-01' },
  ];
  r = await op('campaigns', { organization_id: biz, action: 'create', name: 'TEST spring reactivation', message: 'Hi {{first_name}}, it has been a while — want us to schedule your next visit?', rows });
  check('copy without opt-out wording and business identification is refused', r.status === 400 && /STOP/.test(r.body.error));
  r = await op('campaigns', { organization_id: biz, action: 'create', name: 'TEST spring reactivation', message: 'Hi {{first_name}}, this is {{business_name}}. Want us to schedule your next visit? Reply STOP to opt out.', rows, batch_size: 2, min_gap_seconds: 30, max_gap_seconds: 90 });
  const camp = r.body.campaign;
  const pv = r.body.preview.by_reason;
  check('preview: only recorded, sourced consent is eligible (Alex, Blair, Drew, Frankie)', r.body.preview.eligible === 4, JSON.stringify(r.body.preview));
  check('preview: opted-out, unknown permission, duplicate, stale and invalid rows are blocked with reasons', pv.opted_out === 1 && pv.no_recorded_consent === 1 && pv.duplicate_in_file === 1 && pv.stale_record === 1 && pv.invalid_phone === 1, JSON.stringify(pv));
  check('importing created no consent for anyone', !(await one("select 1 from crm_contacts where organization_id=$1 and phone_e164='+12035550105'", [biz])));
  r = await op('campaigns', { organization_id: biz, action: 'start', campaign_id: camp.id });
  check('an unapproved campaign cannot start', r.status === 409);
  r = await op('campaigns', { organization_id: biz, action: 'approve', campaign_id: camp.id, attestation: 'ok' });
  check('approval requires a written permission attestation', r.status === 400);
  r = await op('campaigns', { organization_id: biz, action: 'approve', campaign_id: camp.id, attestation: 'TEST: these customers opted in to texts on our booking form.' });
  check('owner approval freezes audience size, copy hash, schedule and budget', r.status === 200 && r.body.campaign.approval_snapshot.eligible_count === 4 && /^[0-9a-f]{64}$/.test(r.body.campaign.approval_snapshot.copy_sha256));
  r = await op('campaigns', { organization_id: biz, action: 'start', campaign_id: camp.id });
  check('starting schedules only the eligible recipients', r.status === 200 && r.body.scheduled === 4, JSON.stringify(r.body));
  const sched = await all("select phone_e164, scheduled_at from ops_campaign_recipients where campaign_id=$1 and send_status='scheduled' order by scheduled_at", [camp.id]);
  const gaps = sched.slice(1).map((s, i) => (new Date(s.scheduled_at) - new Date(sched[i].scheduled_at)) / 1000);
  check('sends are spaced 30–90 s apart, with a pause after each batch', gaps[0] >= 30 && gaps[0] <= 90 && gaps[1] >= 600, JSON.stringify(gaps));
  // Blair opts out AFTER enqueue; Drew replies AFTER start
  await inboundSms(client, '+12035550102', 'STOP');
  await inboundSms(client, '+12035550104', 'who is this?');
  const before = { blair: sentTo('+12035550102').length, drew: sentTo('+12035550104').length, alex: sentTo('+12035550101').length };
  await env.sql("update jobs set scheduled_at = now() where job_type='ops_campaign_send' and status='pending'"); // TEST: advance the clock
  await runDue();
  const recs = Object.fromEntries((await all('select phone_e164, send_status, stop_reason from ops_campaign_recipients where campaign_id=$1', [camp.id])).map((x) => [x.phone_e164, x]));
  check('STOP after enqueue: no queued message is sent', sentTo('+12035550102').length === before.blair && recs['+12035550102'].send_status === 'stopped' && recs['+12035550102'].stop_reason === 'opted_out', JSON.stringify(recs['+12035550102']));
  check('a reply after the campaign started stops that recipient\'s message', recs['+12035550104'].send_status === 'stopped' && recs['+12035550104'].stop_reason === 'replied' && !sentTo('+12035550104').some((m) => /schedule your next visit/.test(m.body)), JSON.stringify(recs['+12035550104'])); // his own question is still answered by the assistant (a reply, not the campaign)
  check('a customer with an active request (mid-booking) is not sent a reactivation message', recs['+12035550101'].send_status === 'stopped' && recs['+12035550101'].stop_reason === 'active_request' && sentTo('+12035550101').length === before.alex, JSON.stringify(recs['+12035550101']));
  check('the eligible, silent recipient receives the approved copy with the business identified and opt-out text', recs['+12035550109'].send_status === 'provider_accepted' && /this is TEST Shine Detailing/.test(sentTo('+12035550109').pop()?.body || '') && /STOP/.test(sentTo('+12035550109').pop()?.body || ''), JSON.stringify(recs['+12035550109']));
  check('the campaign completes once every scheduled recipient is processed', (await one('select status from ops_campaigns where id=$1', [camp.id])).status === 'completed');
  check('blocked records were never contacted at all', sentTo('+12035550103').length === 0 && sentTo('+12035550105').length === 0 && sentTo('+12035550107').filter((m) => /visit/.test(m.body)).length === 0);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Harvest (real handlers + worker + local PostgreSQL; Twilio is a local stand-in: "simulated provider")`);
process.exitCode = fail ? 1 : 0;
// Force-exit once results are printed: embedded-postgres child pipes on Windows can otherwise keep a finished
// (or crashed) suite alive until the aggregate runner's timeout (seen 2026-10-13 in a clean-checkout run).
process.exit(process.exitCode ?? 0);
