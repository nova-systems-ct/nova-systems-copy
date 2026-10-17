// Nova loyalty ledger (master prompt §10 Apple Wallet loyalty and rewards) on a real disposable database through the
// real handlers: no program → no points; reward economics come only from the owner and stored-value rewards are
// refused; approval freezes the exact rules; completing a job earns once; a daily earn limit stops abuse; a full
// refund (signed Stripe event) reverses the points; redemption only at the threshold, never twice for one tap, never
// with expired points; expiry is first-in-first-out; the ledger is append-only; staff without rights are refused;
// a Wallet pass is reported as blocked until Apple credentials exist.
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, stripeWebhook, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
clearProviderEnv();
const prov = await startProviderStandIns();
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET });
const client = makeCaller((await import('../api/client.js')).default);
const stripeHandler = (await import('../api/stripe.js')).default;
const L = await import('../api/_ops/loyalty.js');
const one = async (q, p) => (await env.sql(q, p)).rows[0];

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'loyalty_ledger?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  const staff = await env.createUser({ email: 'viewer@cafe.test', role: 'client_viewer', orgId: biz });
  const Y = (body, token = owner.token) => client({ resource: 'ops', op: 'loyalty', method: 'POST', body: { organization_id: biz, ...body }, token });
  const G = (query = {}) => client({ resource: 'ops', op: 'loyalty', method: 'GET', query: { organization_id: biz, ...query }, token: owner.token });
  const contact = (await one("insert into crm_contacts (organization_id, name, phone, phone_e164, source, is_test) values ($1,'TEST Loyal Lee','+12035550141','+12035550141','web form',true) returning id", [biz])).id;
  // a confirmed job ready to be completed (the booking journey itself is covered by the core journey suite)
  const mkJob = async (total = 18000) => (await one("insert into ops_jobs (organization_id, contact_id, source_channel, state, fulfillment_status, total_cents, deposit_cents, currency, price_snapshot, is_test) values ($1,$2,'form','confirmed','ready',$3,5000,'usd',$4,true) returning id", [biz, contact, total, { service_name: 'Full detail' }])).id;
  const complete = (jobId) => client({ resource: 'ops', op: 'job-action', method: 'POST', body: { organization_id: biz, job_id: jobId, action: 'complete', notes: 'TEST done' }, token: owner.token });

  let j1 = await mkJob();
  let r = await complete(j1);
  check('with no approved program, completing a job posts no points', r.status === 200 && !(await one('select 1 from loyalty_ledger')));

  const rules = { earn_type: 'per_completed_job', earn_points: 10, reward_threshold: 30, reward_description: 'One free interior wipe-down', expiry_days: 90, max_earns_per_day: 2, terms_text: 'Earn 10 points per completed detail. 30 points = one free interior wipe-down. Points expire after 90 days.' };
  r = await Y({ action: 'create-program', name: 'TEST Shine Rewards', rules: { ...rules, reward_description: '$25 gift card' } });
  check('a cash or gift-card reward is refused as a stored-value liability', r.status === 400 && /stored-value/.test(r.body.error), JSON.stringify(r.body));
  r = await Y({ action: 'create-program', name: 'TEST Shine Rewards', rules: { reward_description: 'Something nice' } });
  check('there are no default economics: points, threshold, limits and terms must be set by the owner', r.status === 400 && /points earned/.test(r.body.error) && /terms/.test(r.body.error));
  r = await Y({ action: 'create-program', name: 'TEST Shine Rewards', rules }, staff.token);
  check('staff without configuration rights cannot create a program', r.status === 403);
  r = await Y({ action: 'create-program', name: 'TEST Shine Rewards', rules });
  const prog = r.body.program;
  check('the owner creates a draft program with exactly the rules entered', r.status === 200 && prog.status === 'draft' && prog.rules.earn_points === 10);
  j1 = await mkJob(); r = await complete(j1);
  check('a draft program earns nothing', !(await one('select 1 from loyalty_ledger')));
  r = await Y({ action: 'approve-program', program_id: prog.id });
  check('approval freezes the rules (hash recorded)', r.status === 200 && r.body.program.status === 'approved' && /^[0-9a-f]{64}$/.test(r.body.program.rules_sha256));

  // ---------------------------------------------------------------- earn, limit, refund reversal
  const ja = await mkJob(); await complete(ja);
  const jb = await mkJob(); await complete(jb);
  const acc = await one('select * from loyalty_accounts where contact_id=$1', [contact]);
  check('each completed job earns once (10 points), with an expiry date', acc?.balance === 20 && (await one("select count(*)::int n from loyalty_ledger where kind='earn' and expires_at is not null")).n === 2);
  const jc = await mkJob(); await complete(jc);
  check('the daily earn limit (2) stops a third earn the same day, and says so on the job', (await one('select balance from loyalty_accounts where id=$1', [acc.id])).balance === 20 && !!(await one("select 1 from ops_transitions where entity_id=$1 and reason like 'loyalty: daily earn limit%'", [jc])));
  await L.earnForJob({ orgId: biz, job: await one('select * from ops_jobs where id=$1', [ja]), actor: { id: 'test' } });
  check('posting the same job again does not earn twice', (await one('select balance from loyalty_accounts where id=$1', [acc.id])).balance === 20);

  const dep = (await one("insert into ops_deposits (organization_id, job_id, amount_cents, currency, status, account_mode, paid_at) values ($1,$2,5000,'usd','paid','nova_test_platform', now()) returning id", [biz, jb])).id;
  const refund = (id) => stripeWebhook(stripeHandler, { id, type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_TEST', amount_refunded: 5000, metadata: { ops_deposit_id: dep, organization_id: biz } } } });
  r = await refund('evt_loyalty_refund_1'); await refund('evt_loyalty_refund_2');
  check('a full refund (signed Stripe event) reverses the points that job earned, once', r.status === 200 && (await one('select balance from loyalty_accounts where id=$1', [acc.id])).balance === 10 && (await one("select count(*)::int n from loyalty_ledger where kind='reverse'")).n === 1, JSON.stringify(r.body));

  // ---------------------------------------------------------------- redemption
  r = await Y({ action: 'redeem', account_id: acc.id, request_id: 'tap-0001-abcdef' });
  check('a reward cannot be redeemed below the threshold', r.status === 409 && /Not enough points/.test(r.body.error), JSON.stringify(r.body));
  await env.sql("update loyalty_ledger set id = id where false"); // no-op: the ledger is only ever appended to
  await L.adjust({ orgId: biz, accountId: acc.id, points: 25, reason: 'TEST: goodwill points for a late appointment', actor: { id: owner.id } });
  r = await Y({ action: 'adjust', account_id: acc.id, points: 5, reason: 'trying to add points' }, staff.token);
  check('manual adjustments need configuration rights and a reason', r.status === 403);
  const tap = 'tap-0002-abcdef';
  const [x1, x2] = await Promise.all([Y({ action: 'redeem', account_id: acc.id, request_id: tap }), Y({ action: 'redeem', account_id: acc.id, request_id: tap })]);
  const bal = (await one('select balance from loyalty_accounts where id=$1', [acc.id])).balance;
  check('at the threshold the reward is redeemed once, even when the same tap arrives twice at the same moment', x1.status === 200 && x2.status === 200 && bal === 5 && (await one("select count(*)::int n from loyalty_ledger where kind='redeem'")).n === 1 && /interior wipe-down/.test(x1.body.reward), JSON.stringify([x1.body, x2.body, bal]));
  const [y1, y2] = await Promise.all([Y({ action: 'redeem', account_id: acc.id, request_id: 'tap-0003-aaaaaa' }), Y({ action: 'redeem', account_id: acc.id, request_id: 'tap-0004-bbbbbb' })]);
  check('two different redemptions racing on 5 points both fail; the balance never goes below zero by redemption', y1.status === 409 && y2.status === 409 && (await one('select balance from loyalty_accounts where id=$1', [acc.id])).balance === 5);

  // ---------------------------------------------------------------- expiry (FIFO), append-only, wallet
  const lots = L.computeLots((await env.sql('select * from loyalty_ledger where account_id=$1', [acc.id])).rows);
  check('remaining points are tracked per lot, oldest consumed first', lots.reduce((a, l) => a + Math.max(l.remaining, 0), 0) === 5, JSON.stringify(lots));
  await env.sql("alter table loyalty_ledger disable trigger loyalty_ledger_immutable; update loyalty_ledger set expires_at = now() - interval '1 day' where kind in ('earn','adjust'); alter table loyalty_ledger enable trigger loyalty_ledger_immutable"); // TEST: move time past expiry
  r = await L.expireDue();
  const after = await one('select balance from loyalty_accounts where id=$1', [acc.id]);
  // FIFO: the two earned lots were spent first (redemption), so only the remaining 5 granted points expire
  check('points granted by hand carry the program expiry; expired points are removed first-in-first-out', lots.every((l) => l.expires_at) && r.lots_expired === 1 && after.balance === 0, JSON.stringify([r, after, lots]));
  check('expiring again changes nothing', (await L.expireDue()).lots_expired === 0);
  let blocked = false; try { await env.sql("update loyalty_ledger set points = 999 where kind='earn'"); } catch { blocked = true; }
  let blockedDel = false; try { await env.sql('delete from loyalty_ledger'); } catch { blockedDel = true; }
  check('the ledger is append-only: entries cannot be edited or deleted', blocked && blockedDel);
  r = await G();
  check('the business sees its program, accounts and that a Wallet pass cannot be issued yet (Apple credentials missing)', r.status === 200 && r.body.programs.length === 1 && r.body.accounts.length === 1 && r.body.wallet.can_issue === false && r.body.wallet.missing.includes('APPLE_PASS_TYPE_ID'));
  r = await G({ account_id: acc.id });
  check('an account shows its full history with balance after each entry', r.status === 200 && r.body.ledger.length >= 6 && r.body.ledger.every((e) => Number.isInteger(e.balance_after)));
  r = await client({ resource: 'ops', op: 'loyalty', method: 'GET', query: { organization_id: biz }, token: (await env.createUser({ email: 'x@other.test', role: 'client_owner', orgId: (await one("insert into organizations (name, slug, kind) values ('TEST Other','other2','client') returning id")).id })).token });
  check('another organization cannot read this program', r.status === 403);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova loyalty ledger (real handlers + local PostgreSQL; Stripe is a local stand-in)`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
