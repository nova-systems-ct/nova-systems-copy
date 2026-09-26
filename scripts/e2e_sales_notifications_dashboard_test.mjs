// Notifications (honest delivery states, allow-list, retries, Resend callbacks), the maintenance sweep, and the HQ dashboard scoping.
// Real handlers against REAL PostgreSQL + PostgREST (local, disposable). Resend is a LOCAL STAND-IN — no real email is ever sent.
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
const SVIX = 'whsec_' + Buffer.from('local-test-svix-secret-bytes').toString('base64');
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run', RESEND_WEBHOOK_SECRET: SVIX, STRIPE_WEBHOOK_SECRET: 'whsec_unused' });
const { default: handler } = await import('../api/client.js');
const { default: stripeHandler } = await import('../api/stripe.js');
const call = makeCaller(handler);
const N = (op, o = {}) => call({ resource: 'notifications', op, ...o });
const T = (op, o = {}) => call({ resource: 'salesteam', op, ...o });
const L = (op, o = {}) => call({ resource: 'leads', op, ...o });
const H = (op, o = {}) => call({ resource: 'hiring', op, ...o });
const resendHook = async (event, { secret = SVIX, ts = Math.floor(Date.now() / 1000), badSig = false } = {}) => {
  const raw = Buffer.from(JSON.stringify(event)); const id = `msg_${Math.random().toString(36).slice(2)}`;
  const sig = crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${raw}`).digest('base64');
  const req = Object.assign(Readable.from([raw]), { method: 'POST', query: {}, headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': badSig ? 'v1,AAAA' : `v1,${sig}`, 'x-forwarded-for': '203.0.113.7' } });
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await stripeHandler(req, res); return res;
};
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const fin = await env.createUser({ email: 'fin@nova.test', role: 'nova_finance', orgId: org, name: 'Fin Ance' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const repA = await env.createUser({ email: 'a@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Alpha' });
  const repB = await env.createUser({ email: 'b@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Bravo' });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$3,'Rep Alpha','active',$2), ($4,$3,'Rep Bravo','active',$5)", [repA.id, mgr.id, org, repB.id, mgr2.id]);
  await env.reload();

  // ================================================================== email modes & delivery states
  const { notify } = await import('../api/_sales/core.js');
  await notify({ userId: repA.id, email: 'a@nova.test', kind: 't1', subject: 'S1', body: 'B1', channels: ['in_app', 'email'], idempotencyKey: 'k1' });
  let row = (await env.sql("select status, attempts from sales_notifications where idempotency_key='k1:email'")).rows[0];
  check('default mode: the email is recorded as dry_run — NOT sent, no provider contacted', row.status === 'dry_run' && env.stubs.emailRequests.length === 0);
  check('the in-app copy is delivered immediately', (await env.sql("select status from sales_notifications where idempotency_key='k1:in_app'")).rows[0].status === 'sent');
  await notify({ userId: repA.id, email: 'a@nova.test', kind: 't1', subject: 'S1', body: 'B1', channels: ['in_app', 'email'], idempotencyKey: 'k1' });
  check('the same idempotency key never creates a duplicate notification', (await env.sql("select count(*) from sales_notifications where idempotency_key like 'k1:%'")).rows[0].count === '2');
  Object.assign(process.env, { SALES_EMAIL_MODE: 'live', SALES_EMAIL_ALLOWLIST: '@nova.test,approved@example.test' });
  await notify({ userId: null, email: 'stranger@real-company.example', kind: 't2', subject: 'S2', body: 'B2', channels: ['email'], idempotencyKey: 'k2' });
  row = (await env.sql("select status, last_error from sales_notifications where idempotency_key='k2:email'")).rows[0];
  check('live mode with an allow-list BLOCKS any other recipient (development can never email a real person by accident)', row.status === 'blocked' && /allow/i.test(row.last_error) && env.stubs.emailRequests.length === 0);
  await notify({ userId: repB.id, email: 'b@nova.test', kind: 't3', subject: 'S3', body: 'B3', channels: ['email'], idempotencyKey: 'k3' });
  row = (await env.sql("select status, provider_message_id from sales_notifications where idempotency_key='k3:email'")).rows[0];
  check('an allowed recipient is handed to the provider and recorded as SENT (accepted) — not delivered', row.status === 'sent' && !!row.provider_message_id && env.stubs.outbox.length === 1);
  env.stubs.failEmails = true;
  await notify({ userId: repB.id, email: 'b@nova.test', kind: 't4', subject: 'S4', body: 'B4', channels: ['email'], idempotencyKey: 'k4' });
  row = (await env.sql("select status, attempts, last_error from sales_notifications where idempotency_key='k4:email'")).rows[0];
  check('a provider failure is recorded as FAILED with the reason and attempt count', row.status === 'failed' && row.attempts === 1 && /provider 422/.test(row.last_error));

  // ================================================================== maintenance: retries
  env.stubs.failEmails = false;
  let r = await N('run-maintenance', { token: repA.token, body: {} });
  check('a rep cannot run maintenance', r.status === 403);
  r = await N('run-maintenance', { token: fin.token, body: {} });
  check('finance cannot run maintenance (owner only)', r.status === 403);
  r = await N('run-maintenance', { token: owner.token, body: {} });
  row = (await env.sql("select status, attempts from sales_notifications where idempotency_key='k4:email'")).rows[0];
  check('the sweep retries the failed email and it now succeeds (SENT)', r.status === 200 && row.status === 'sent' && row.attempts === 2);
  check('the sweep never retries dry_run or blocked emails', (await env.sql("select count(*) from sales_notifications where idempotency_key in ('k1:email','k2:email') and attempts > 1")).rows[0].count === '0' && (await env.sql("select status from sales_notifications where idempotency_key='k2:email'")).rows[0].status === 'blocked');
  r = await N('run-maintenance', { token: owner.token, body: {} });
  check('running the sweep twice is harmless (idempotent)', r.status === 200 && r.body.emails_retried === 0);

  // ================================================================== Resend callbacks
  const mid = (await env.sql("select provider_message_id from sales_notifications where idempotency_key='k3:email'")).rows[0].provider_message_id;
  let w = await resendHook({ type: 'email.delivered', data: { email_id: mid } }, { badSig: true });
  check('a forged delivery callback is rejected', w.code === 400 && (await env.sql("select status from sales_notifications where idempotency_key='k3:email'")).rows[0].status === 'sent');
  w = await resendHook({ type: 'email.delivered', data: { email_id: mid } }, { secret: 'whsec_' + Buffer.from('some-other-secret').toString('base64') });
  check('a callback signed with the wrong secret is rejected', w.code === 400);
  w = await resendHook({ type: 'email.delivered', data: { email_id: mid } }, { ts: Math.floor(Date.now() / 1000) - 7200 });
  check('a stale (replayed) callback is rejected', w.code === 400);
  w = await resendHook({ type: 'email.delivered', data: { email_id: mid } });
  check('a verified callback upgrades SENT → DELIVERED', w.code === 200 && (await env.sql("select status from sales_notifications where idempotency_key='k3:email'")).rows[0].status === 'delivered');
  w = await resendHook({ type: 'email.sent', data: { email_id: mid } });
  check('a late/duplicate "sent" callback never downgrades DELIVERED', (await env.sql("select status from sales_notifications where idempotency_key='k3:email'")).rows[0].status === 'delivered');
  const mid4 = (await env.sql("select provider_message_id from sales_notifications where idempotency_key='k4:email'")).rows[0].provider_message_id;
  w = await resendHook({ type: 'email.bounced', data: { email_id: mid4, bounce: { message: 'mailbox does not exist' } } });
  row = (await env.sql("select status, last_error from sales_notifications where idempotency_key='k4:email'")).rows[0];
  check('a bounce is recorded as BOUNCED with the reason', row.status === 'bounced' && /mailbox/.test(row.last_error));
  r = await N('delivery-report', { method: 'GET', token: owner.token });
  check('the owner sees counts by state and the problem list (dry_run explained, sent ≠ delivered)', r.status === 200 && r.body.counts.delivered >= 1 && r.body.problems.some((p) => p.status === 'bounced') && r.body.problems.some((p) => p.status === 'blocked') && /not delivered|does not mean|accepted it/.test(r.body.note));
  r = await N('delivery-report', { method: 'GET', token: mgr.token });
  check('managers cannot see the delivery report', r.status === 403);
  Object.assign(process.env, { SALES_EMAIL_MODE: 'dry_run' });

  // ================================================================== invitations: expiry & delivery tracking (hiring flow)
  const app = (await env.sql("insert into applications (name,email,email_normalized,position,status,reference_code) values ('Jane A','jane@applicant.test','jane@applicant.test','Sales Representative','accepted','NOVA-TESTREF1') returning id")).rows[0].id;
  r = await H('invite', { token: owner.token, body: { id: app } });
  const invId = r.body?.invitation_id;
  check('(setup) the owner invites an accepted applicant (dry run: link shown to the owner only)', r.status === 200 && !!r.body.dev_link, JSON.stringify(r.body).slice(0, 120));
  await env.sql("update application_invitations set provider_message_id='inv_msg_1', status='sent' where id=$1", [invId]);
  w = await resendHook({ type: 'email.bounced', data: { email_id: 'inv_msg_1', bounce: { message: 'mailbox full' } } });
  check('a bounce on an invitation email marks the INVITATION bounced, so the owner sees failed delivery', (await env.sql("select status, delivery_error from application_invitations where id=$1", [invId])).rows[0].status === 'bounced');
  await env.sql("update application_invitations set status='sent', expires_at = now() - interval '1 hour' where id=$1", [invId]);
  r = await N('run-maintenance', { token: owner.token, body: {} });
  check('the sweep marks an unaccepted invitation past its date as EXPIRED', r.body.invitations_expired === 1 && (await env.sql("select status from application_invitations where id=$1", [invId])).rows[0].status === 'expired');

  // failed invitation email → retried by the sweep → tracker corrected
  const app2 = (await env.sql("insert into applications (name,email,email_normalized,position,status,reference_code) values ('Bob B','bob@nova.test','bob@nova.test','Sales Representative','accepted','NOVA-TESTREF2') returning id")).rows[0].id;
  Object.assign(process.env, { SALES_EMAIL_MODE: 'live', SALES_EMAIL_ALLOWLIST: '@nova.test' }); env.stubs.failEmails = true;
  r = await H('invite', { token: owner.token, body: { id: app2 } });
  const inv2 = r.body.invitation_id;
  check('a failed invitation email is shown as FAILED with the reason (owner can see delivery failed)', r.body.email_status === 'failed' && (await env.sql('select status, delivery_error from application_invitations where id=$1', [inv2])).rows[0].status === 'failed');
  env.stubs.failEmails = false; await N('run-maintenance', { token: owner.token, body: {} });
  check('after the provider recovers the sweep resends it and the invitation becomes SENT', (await env.sql('select status, provider_message_id from application_invitations where id=$1', [inv2])).rows[0].status === 'sent');
  Object.assign(process.env, { SALES_EMAIL_MODE: 'dry_run' });

  // ================================================================== reminders
  const mk = async (rep, bn) => { const c = await L('create', { token: rep.token, body: { business_name: bn, website: `https://${bn.replace(/\W/g, '').toLowerCase()}.test`, phone: `2037${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`, contact_name: 'Con Tact', contact_email: `x@${bn.replace(/\W/g, '').toLowerCase()}.test`, city: 'Waterbury' } }); return c.body.deal_id; };
  const dA1 = await mk(repA, 'Alpha One'); const dA2 = await mk(repA, 'Alpha Two'); const dB1 = await mk(repB, 'Bravo One');
  await env.sql("update crm_deals set next_action='Call back', next_action_at = now() - interval '3 days' where id in ($1,$2)", [dA1, dA2]);
  await env.sql("update crm_deals set updated_at = now() - interval '20 days' where id=$1", [dB1]);
  r = await N('run-maintenance', { token: owner.token, body: {} });
  const rem = (await env.sql("select body, subject from sales_notifications where kind='followups_overdue' and user_id=$1", [repA.id])).rows;
  check('a rep with overdue follow-ups gets ONE in-app reminder (grouped), and a rep with none gets none', r.body.overdue_reminders === 1 && rem.length === 1 && /2 follow-ups are overdue/.test(rem[0].subject) && (await env.sql("select count(*) from sales_notifications where kind='followups_overdue' and user_id=$1", [repB.id])).rows[0].count === '0');
  r = await N('run-maintenance', { token: owner.token, body: {} });
  check('running again the same day does not send another reminder', (await env.sql("select count(*) from sales_notifications where kind='followups_overdue' and user_id=$1", [repA.id])).rows[0].count === '1');

  // ================================================================== in-app inbox
  r = await N('list', { method: 'GET', token: repA.token });
  check('a user sees only their own in-app notifications, with an unread count', r.status === 200 && r.body.unread >= 1 && r.body.notifications.length >= 1 && (await env.sql("select count(*) from sales_notifications where user_id=$1 and channel='in_app'", [repA.id])).rows[0].count === String(r.body.notifications.length));
  const bIds = (await N('list', { method: 'GET', token: repB.token })).body.notifications.map((x) => x.id);
  r = await N('mark-read', { token: repA.token, body: { ids: bIds } });
  check("a user cannot mark someone else's notifications read", (await env.sql("select count(*) from sales_notifications where id = any($1) and read_at is not null", [bIds])).rows[0].count === '0');
  r = await N('mark-read', { token: repA.token, body: {} });
  check('marking all read works and the count drops to zero', (await N('list', { method: 'GET', token: repA.token })).body.unread === 0);
  r = await N('list', { method: 'GET' });
  check('no session → 401', r.status === 401);

  // ================================================================== HQ dashboard: scoping, and no invented money
  r = await T('dashboard', { method: 'GET', token: repA.token });
  check('a rep cannot open the HQ dashboard', r.status === 403);
  r = await T('dashboard', { method: 'GET', token: owner.token });
  const D = r.body;
  check('owner dashboard: applicants, invitations, training, documents, reps, pipeline, money, commissions and exceptions', r.status === 200 && D.applicants.total === 2 && D.applicants.invitations.expired === 1 && D.reps.by_status.active === 2 && D.pipeline.by_stage.new === 3 && D.money && D.commissions && 'overdue_followups' in D.exceptions);
  check('every count matches the stored rows (2 overdue, 1 stale)', D.exceptions.overdue_followups === 2 && D.exceptions.stale_leads_14d === 1 && D.reps.per_rep.find((x) => x.name === 'Rep Alpha').open_leads === 2);
  check('pipeline value is labelled NOT revenue, and collected money is split provider-confirmed vs owner-recorded', /NOT revenue/.test(D.money.pipeline_note) && D.money.collected_provider_confirmed_cents === 0 && D.money.collected_owner_recorded_cents === 0 && D.money.verified_sales_cents === 0);
  r = await T('dashboard', { method: 'GET', token: mgr.token });
  check("a manager's dashboard covers only their team, with NO money, commission or applicant data", r.body.scope === 'your team' && r.body.reps.per_rep.length === 1 && r.body.reps.per_rep[0].name === 'Rep Alpha' && r.body.money === null && r.body.commissions === null && r.body.applicants === null && r.body.pipeline.by_stage.new === 2);
  r = await T('dashboard', { method: 'GET', token: fin.token });
  check('finance is refused the sales-team dashboard (no sales.manage)', r.status === 403);
  r = await T('rep', { method: 'GET', token: owner.token, query: { id: (await env.sql('select id from sales_reps where user_id=$1', [repA.id])).rows[0].id } });
  check('the per-rep view returns training, documents, leads, checklist, history and (owner only) the ledger', r.status === 200 && Array.isArray(r.body.training) && r.body.documents && r.body.leads.total === 2 && r.body.ledger && Array.isArray(r.body.status_history));
  r = await T('rep', { method: 'GET', token: mgr.token, query: { id: (await env.sql('select id from sales_reps where user_id=$1', [repA.id])).rows[0].id } });
  check("a manager's per-rep view has NO ledger", r.status === 200 && r.body.ledger === null);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
