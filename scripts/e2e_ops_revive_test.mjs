// Nova Revive (stalled-record recovery) acceptance on a real disposable database through the real handlers and worker:
// stalled requests are found in the business's own records under explicit rules (kind, age window, attempt limit,
// consent, suppression, booked since); the owner approves rules + audience + copy; every send re-checks that the
// record is still stalled and untouched; a reply continues THE SAME request with its service (or goes to a person, or
// is closed on "no"); outcomes are counted from real records and kept apart from new-customer acquisition.
// Twilio is a local stand-in ("simulated provider").
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, inboundSms, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, WORKER_ID: 'revive-test-worker' });
const client = makeCaller((await import('../api/client.js')).default);
const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
const W = await import('../worker/index.mjs');
const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
const ctx = { url: env.base, serviceKey: env.serviceKey, mode: 'postgres', store };
const runDue = async (max = 80) => { let n = 0; while (n < max && await W.processOneJob(store, ctx)) n++; return n; };
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;
const sentTo = (n) => prov.twilio.messages.filter((m) => m.to === n);
const last = (n) => sentTo(n).at(-1)?.body || '';

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_campaign_recipients?select=revive_reason&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const op = (o, body, method = 'POST', query = {}) => client({ resource: 'ops', op: o, method, body, token: owner.token, query });
  const P = (n) => `+120355501${n}`;
  process.env.OPS_SEND_ALLOWLIST = Array.from({ length: 13 }, (_, i) => P(21 + i)).join(',');

  // Real-shaped records in an isolated disposable database: contacts are not flagged as test so the production rule
  // (test records are never revived) is exercised by one record that IS flagged.
  const person = async (n, name, { consent = true, suppressed = false, test = false } = {}) => (await one(`insert into crm_contacts (organization_id, name, phone, phone_e164, source, is_test, sms_consent, sms_consent_source, sms_consent_at, suppressed) values ($1,$2,$3,$3,'web form',$4,$5,$6,$7,$8) returning id`, [biz, name, P(n), test, consent, consent ? 'web_form_checkbox' : null, consent ? new Date(Date.now() - 40 * 86400_000).toISOString() : null, suppressed])).id;
  const snap = { service_key: 'full_detail', service_name: 'Full detail', duration_minutes: 180, buffer_minutes: 30, total_cents: 18000, deposit_cents: 5000, currency: 'usd' };
  const job = async (contact, state, daysAgo, { fulfillment = 'not_ready', quoted = true, conversation = null } = {}) => (await one(`insert into ops_jobs (organization_id, contact_id, conversation_id, source_channel, state, fulfillment_status, qualification, price_snapshot, total_cents, deposit_cents, currency, created_at, updated_at) values ($1,$2,$3,'form',$4,$5,$6,$7,$8,$9,'usd', now() - make_interval(days => $10::int + 1), now() - make_interval(days => $10::int)) returning id`, [biz, contact, conversation, state, fulfillment, quoted ? { service_key: 'full_detail' } : {}, quoted ? snap : null, quoted ? 18000 : null, quoted ? 5000 : null, daysAgo])).id;

  const quinn = await person(21, 'Quinn Revive');
  const quinnForm = (await one("insert into wave1_conversations (organization_id, contact_id, channel) values ($1,$2,'form') returning id", [biz, quinn])).id;
  const quinnJob = await job(quinn, 'quoted', 5, { conversation: quinnForm });             // abandoned quote (came from the web form)
  const riley = await person(22, 'Riley Revive'); const rileyJob = await job(riley, 'new', 10, { quoted: false }); // incomplete inquiry
  const sam = await person(23, 'Sam Revive'); const samJob = await job(sam, 'awaiting_agreement', 4);       // unfinished booking
  const taylor = await person(24, 'Taylor Revive'); const taylorJob = await job(taylor, 'confirmed', 7, { fulfillment: 'no_show' }); // missed appointment
  await job(await person(25, 'Uma Recent'), 'quoted', 1);                                   // too recent: not a candidate
  await job(await person(26, 'Val Old'), 'quoted', 200);                                    // outside the age window
  await job(await person(27, 'Wren NoConsent', { consent: false }), 'quoted', 5);           // no recorded consent
  await job(await person(28, 'Xan Stopped', { suppressed: true }), 'quoted', 5);            // opted out
  const yael = await person(29, 'Yael Contacted'); await job(yael, 'quoted', 5);            // already messaged inside the window
  const earlier = (await one("insert into ops_campaigns (organization_id, name, purpose, message_template, status) values ($1,'Earlier','past_customer_reactivation','x','cancelled') returning id", [biz])).id;
  await env.sql("insert into ops_campaign_recipients (organization_id, campaign_id, contact_id, phone_e164, eligibility, send_status, sent_at) values ($1,$2,$3,$4,'eligible','provider_accepted', now() - interval '3 days')", [biz, earlier, yael, P(29)]);
  const zed = await person(30, 'Zed Booked'); await job(zed, 'quoted', 6); await env.sql("insert into ops_jobs (organization_id, contact_id, source_channel, state, created_at, updated_at) values ($1,$2,'sms','confirmed', now() - interval '2 days', now() - interval '2 days')", [biz, zed]); // booked since
  await job(await person(31, 'Ari Test', { test: true }), 'quoted', 5);                     // test record: never revived
  const bo = await person(32, 'Bo Touched'); const boJob = await job(bo, 'quoted', 5);      // will change after start
  const cy = await person(33, 'Cy Booked'); const cyJob = await job(cy, 'quoted', 5);       // will book after start

  // ---------------------------------------------------------------- preview and rules
  const campaignsBefore = (await one('select count(*)::int n from ops_campaigns where organization_id=$1', [biz])).n;
  let r = await op('campaigns', null, 'GET', { organization_id: biz, view: 'stalled-preview' });
  check('the preview finds stalled records under the proposed rules and saves nothing', r.status === 200 && r.body.preview.total_rows === 11 && r.body.preview.eligible === 6 && (await one('select count(*)::int n from ops_campaigns where organization_id=$1', [biz])).n === campaignsBefore, JSON.stringify(r.body));
  r = await op('campaigns', null, 'GET', { organization_id: biz, view: 'stalled-preview', rules: JSON.stringify({ reasons: [] }) });
  check('rules without any kind of stalled record are refused', r.status === 400);
  r = await op('campaigns', null, 'GET', { organization_id: biz, view: 'stalled-preview', rules: JSON.stringify({ reasons: ['missed_appointment'] }) });
  check('rules narrow the audience (missed appointments only)', r.status === 200 && r.body.preview.total_rows === 1 && r.body.preview.eligible === 1, JSON.stringify(r.body.preview));

  const msg = 'Hi {{first_name}}, this is {{business_name}} following up on {{service_name}}. Would you still like to book? Reply YES for open times, or STOP to opt out.';
  r = await op('campaigns', { organization_id: biz, action: 'create', purpose: 'stalled_recovery', name: 'TEST stalled', message: 'Hi {{first_name}}, I personally remember you! {{business_name}}. Reply STOP to opt out.' });
  check('copy that claims a personal relationship is refused', r.status === 400 && /personal/.test(r.body.error), JSON.stringify(r.body));
  r = await op('campaigns', { organization_id: biz, action: 'create', purpose: 'stalled_recovery', name: 'TEST stalled', message: msg, batch_size: 25, min_gap_seconds: 5, max_gap_seconds: 5 });
  const camp = r.body.campaign; const pv = r.body.preview?.by_reason || {};
  check('a draft stalled-recovery campaign is created with the proposed rules recorded', r.status === 200 && camp.status === 'draft' && camp.purpose === 'stalled_recovery' && camp.rules.attempt_limit === 1, JSON.stringify(r.body).slice(0, 300));
  check('blocked with reasons: outside age window, no consent, opted out, attempt limit, booked since', pv.outside_age_window === 1 && pv.no_recorded_consent === 1 && pv.opted_out === 1 && pv.attempt_limit_reached === 1 && pv.booked_since === 1 && pv.eligible === 6, JSON.stringify(pv));
  const recs0 = Object.fromEntries((await all('select phone_e164, revive_reason, source_job_id from ops_campaign_recipients where campaign_id=$1', [camp.id])).map((x) => [x.phone_e164, x]));
  check('each person carries the stalled record and its kind', recs0[P(21)]?.revive_reason === 'abandoned_quote' && recs0[P(21)].source_job_id === quinnJob && recs0[P(22)]?.revive_reason === 'incomplete_inquiry' && recs0[P(23)]?.revive_reason === 'unfinished_booking' && recs0[P(24)]?.revive_reason === 'missed_appointment', JSON.stringify(recs0));
  check('records younger than the minimum age and test records are not candidates at all', !recs0[P(25)] && !recs0[P(31)]);

  r = await op('campaigns', { organization_id: biz, action: 'approve', campaign_id: camp.id, attestation: 'These customers ticked the text-message consent box on our booking form.' });
  check('owner approval freezes the rules with the audience and copy', r.status === 200 && r.body.campaign.approval_snapshot.rules?.max_age_days === 90 && r.body.campaign.approval_snapshot.eligible_count === 6);
  r = await op('campaigns', { organization_id: biz, action: 'start', campaign_id: camp.id });
  check('starting schedules the six eligible people', r.status === 200 && r.body.scheduled === 6, JSON.stringify(r.body));

  // after start: Bo's request is touched by staff, Cy books
  await env.sql("update ops_jobs set updated_at = now() + interval '1 second' where id=$1", [boJob]);
  await env.sql("update ops_jobs set state='confirmed', updated_at = now() + interval '1 second' where id=$1", [cyJob]);
  await env.sql("update jobs set scheduled_at = now() where job_type='ops_campaign_send' and status='pending'"); // TEST: advance the clock
  await runDue();
  const recs = Object.fromEntries((await all('select phone_e164, send_status, stop_reason, sent_at from ops_campaign_recipients where campaign_id=$1', [camp.id])).map((x) => [x.phone_e164, x]));
  check('a record changed after the campaign started is not messaged', recs[P(32)].send_status === 'stopped' && recs[P(32)].stop_reason === 'recent_activity' && sentTo(P(32)).length === 0, JSON.stringify(recs[P(32)]));
  check('a person who booked after the campaign started is not messaged', recs[P(33)].send_status === 'stopped' && recs[P(33)].stop_reason === 'booked' && sentTo(P(33)).length === 0, JSON.stringify(recs[P(33)]));
  check('the stalled request is not mistaken for a conflicting active request: four messages leave', ['21', '22', '23', '24'].every((n) => recs[P(n)].send_status === 'provider_accepted' && recs[P(n)].sent_at), JSON.stringify(recs));
  check('the message names the business and the service they asked about (or "your request" when none was chosen)', /this is TEST Shine Detailing following up on Full detail/.test(last(P(21))) && /following up on your request/.test(last(P(22))) && /STOP/.test(last(P(21))), last(P(21)) + ' | ' + last(P(22)));

  // ---------------------------------------------------------------- replies continue the same request
  await inboundSms(client, P(21), 'Yes');
  await runDue();
  check('a "yes" to an abandoned quote offers real open times at the current approved price', /Full detail: \$180\.00/.test(last(P(21))) && /1\)/.test(last(P(21))), last(P(21)));
  const qj = await all('select id, state, conversation_id from ops_jobs where contact_id=$1', [quinn]);
  const smsConv = (await one("select id from wave1_conversations where contact_id=$1 and channel='sms'", [quinn])).id;
  check('the reply continues the SAME request (no second, context-free request), now on the conversation the customer answered', qj.length === 1 && qj[0].id === quinnJob && qj[0].conversation_id === smsConv, JSON.stringify(qj));
  check('the hand-over is recorded on the request', !!(await one("select 1 from ops_transitions where entity_id=$1 and reason like 'customer replied to a Revive follow-up%'", [quinnJob])));
  await inboundSms(client, P(21), '1');
  await runDue();
  check('…and the customer can pick a time: held, agreement link sent, same request', (await one('select state from ops_jobs where id=$1', [quinnJob])).state === 'awaiting_agreement' && /\/service\//.test(last(P(21))), last(P(21)));

  await inboundSms(client, P(23), 'yes I still want it');
  await runDue();
  check('a reply about an unfinished booking goes to a person with the request attached', (await one('select state, escalation_reason from ops_jobs where id=$1', [samJob])).escalation_reason === 'revive_reply_unfinished_booking' && /A person from TEST Shine Detailing/.test(last(P(23))), last(P(23)));

  await inboundSms(client, P(22), 'No thanks');
  await runDue();
  const rj = await one('select state, lost_reason from ops_jobs where id=$1', [rileyJob]);
  check('"no thanks" closes the request with the reason and promises no further follow-up', rj.state === 'lost' && rj.lost_reason === 'declined_followup' && /won't follow up/.test(last(P(22))), JSON.stringify(rj) + last(P(22)));

  await inboundSms(client, P(24), 'yes please');
  await runDue();
  const tj = await all('select id, state from ops_jobs where contact_id=$1 order by created_at', [taylor]);
  const link = tj.length === 2 ? await one("select evidence from ops_transitions where entity_id=$1 and reason like 'new request after a Revive follow-up%'", [tj[1].id]) : null;
  check('after a missed appointment, a reply starts a new request linked to the missed one and offers the same service', tj.length === 2 && tj[0].id === taylorJob && link?.evidence?.previous_job_id === taylorJob && /Full detail: \$180\.00/.test(last(P(24))), JSON.stringify(tj) + last(P(24)));

  // ---------------------------------------------------------------- outcomes
  r = await op('campaign', null, 'GET', { organization_id: biz, id: camp.id });
  const o = r.body.outcomes;
  check('outcomes are counted from real records: 4 sent, 4 replied, 2 back in booking, 0 booked', o.sent === 4 && o.dry_run_not_sent === 0 && o.replied === 4 && o.qualified === 2 && o.booked === 0 && o.stopped === 2, JSON.stringify(o));
  check('recovered work is reported apart from new-customer acquisition', /separately from new-customer acquisition/.test(o.note));

  // ---------------------------------------------------------------- the attempt limit holds for the next campaign
  await env.sql("update ops_jobs set updated_at = now() - interval '5 days' where organization_id=$1 and state in ('quoted','new','awaiting_agreement','escalated')", [biz]);
  r = await op('campaigns', null, 'GET', { organization_id: biz, view: 'stalled-preview' });
  // Quinn (now an unfinished booking) and Taylor (new quote) were messaged by the first campaign, Yael by the earlier one
  check('people messaged inside the window are blocked by the attempt limit in the next campaign', r.status === 200 && r.body.preview.by_reason.attempt_limit_reached === 3, JSON.stringify(r.body.preview));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Revive stalled-record recovery (real handlers + worker + local PostgreSQL; Twilio is a local stand-in: "simulated provider")`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
