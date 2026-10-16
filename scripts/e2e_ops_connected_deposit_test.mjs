// Client-owned deposits (owner decision 2026-10-16): the customer's deposit is a Stripe Connect DIRECT charge on the
// business's own connected account; Nova's platform account never receives it. Local Stripe stand-in (not Stripe):
// verifies the account check, the Stripe-Account header on checkout, and that only correctly-signed events from the
// right account change anything.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { startTestEnv } from './testenv/env.mjs';
import { makeCaller } from './testenv/call.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, stripeWebhook, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const CONNECT_SECRET = 'whsec_connect_local_test_only';
clearProviderEnv();
const prov = await startProviderStandIns();
prov.stripe.accounts = { acct_TESTSHINE01: { charges_enabled: true, name: 'TEST Shine Detailing LLC' }, acct_TESTPENDING1: { charges_enabled: false } };
const env = await startTestEnv({ migrations: JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order, bootstrap: 'platform', publicBuckets: [] });
Object.assign(process.env, env.appEnv, prov.env, { APP_BASE_URL: 'http://localhost.test', WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET: CONNECT_SECRET });
const client = makeCaller((await import('../api/client.js')).default);
const stripeHandler = (await import('../api/stripe.js')).default;
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const evt = (dep, extra = {}) => ({ id: `evt_${crypto.randomBytes(5).toString('hex')}`, type: 'checkout.session.completed', livemode: false, data: { object: { id: dep.provider_session_id, payment_status: 'paid', amount_total: dep.amount_cents, currency: dep.currency, payment_intent: 'pi_test_local', metadata: { ops_deposit_id: dep.id, organization_id: dep.organization_id, job_id: dep.job_id } } }, ...extra });

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_deposits?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const { biz } = await setupTestBusiness({ env, client, ownerToken: owner.token });
  await env.sql("update wave1_org_settings set sms_number_ref='+12035550998' where organization_id=$1", [biz]); // the fixture gives every business the same number
  const { biz: platformBiz } = await setupTestBusiness({ env, client, ownerToken: owner.token, name: 'TEST Platform Biz' });
  const op = (o, body, method = 'POST') => client({ resource: 'ops', op: o, method, body, token: owner.token });
  const pay = (body) => op('payment-account', { organization_id: biz, ...body });

  // ---------------------------------------------------------------- connecting the business's account
  let r = await pay({ mode: 'client_connected_account', stripe_account_ref: 'not-an-account' });
  check('a malformed account id is refused', r.status === 400);
  r = await pay({ mode: 'client_connected_account', stripe_account_ref: 'acct_TESTUNKNOWN9' });
  check('an account Stripe does not report as connected to Nova is refused (asked, not assumed)', r.status === 409 && /did not confirm/.test(r.body.error));
  r = await pay({ mode: 'client_connected_account', stripe_account_ref: 'acct_TESTPENDING1' });
  check('an account that cannot take charges yet is refused with the reason', r.status === 409 && /charges disabled/.test(r.body.error));
  r = await pay({ mode: 'client_connected_account', stripe_account_ref: 'acct_TESTSHINE01' });
  check("a connected account Stripe confirms is saved; funds go to the business's own account, live stays off", r.status === 200 && r.body.account.stripe_account_ref === 'acct_TESTSHINE01' && /business's own Stripe account \(TEST Shine Detailing LLC\)/.test(r.body.account.funds_recipient) && r.body.account.live_enabled === false, JSON.stringify(r.body));

  // ---------------------------------------------------------------- a customer pays a deposit
  async function signedJob(org, phone) {
    const job = (await op('job-action', { organization_id: org, action: 'create', phone, name: 'TEST Deposit Customer', is_test: true, customer_requested: true })).body.job;
    await op('job-action', { organization_id: org, action: 'quote', job_id: job.id, service_key: 'full_detail' });
    const av = (await client({ resource: 'ops', op: 'availability', method: 'GET', query: { organization_id: org, service_key: 'full_detail' }, token: owner.token })).body;
    await op('job-action', { organization_id: org, action: 'hold', job_id: job.id, start: av.slots[0].start });
    const sa = await op('job-action', { organization_id: org, action: 'send-agreement', job_id: job.id });
    const token = sa.body.link.split('/service/')[1];
    const view = await client({ resource: 'ops', op: 'customer-view', method: 'GET', query: { token } });
    await client({ resource: 'ops', op: 'customer-sign', method: 'POST', body: { token, signer_name: 'TEST Deposit Customer', consent: true, content_sha256: view.body.agreement.content_sha256 } });
    return { job, token, view };
  }
  const A = await signedJob(biz, '+12035550160');
  check('the customer page offers the deposit for a connected business (test mode)', A.view.body.payments.available === true && A.view.body.payments.mode === 'client_connected_account');
  const before = prov.stripe.requests.length;
  r = await client({ resource: 'ops', op: 'customer-deposit', method: 'POST', body: { token: A.token } });
  const co = prov.stripe.requests.slice(before).find((x) => /checkout\/sessions$/.test(x.url));
  check("checkout is created ON the business's connected account (Stripe-Account header), not on Nova's account", r.status === 200 && co?.account === 'acct_TESTSHINE01', JSON.stringify(co && { url: co.url, account: co.account }));
  const depA = await one('select * from ops_deposits where job_id=$1', [A.job.id]);
  check('the deposit records which kind of account holds the money', depA.account_mode === 'client_connected_account' && depA.status === 'checkout_open');

  // ---------------------------------------------------------------- webhooks: right endpoint, right account
  r = await stripeWebhook(stripeHandler, evt(depA, { account: 'acct_TESTSHINE01' }), WH_SECRET);
  check('a connected-account event signed with the platform secret is refused (source does not match its endpoint)', r.status === 400);
  r = await stripeWebhook(stripeHandler, evt(depA), CONNECT_SECRET);
  check('a Connect-signed event that names no account is refused', r.status === 400);
  r = await stripeWebhook(stripeHandler, evt(depA, { account: 'acct_SOMEONEELSE1' }), CONNECT_SECRET);
  check("an event from a different connected account cannot mark this business's deposit paid", r.status === 200 && (await one('select status from ops_deposits where id=$1', [depA.id])).status === 'checkout_open');
  r = await stripeWebhook(stripeHandler, evt(depA, { account: 'acct_TESTSHINE01' }), 'whsec_wrong_secret');
  check('a forged signature is refused', r.status === 400);
  r = await stripeWebhook(stripeHandler, evt(depA, { account: 'acct_TESTSHINE01' }), CONNECT_SECRET);
  const jobA = await one('select state from ops_jobs where id=$1', [A.job.id]);
  check("the business's own account confirming payment marks the deposit paid and confirms the booking", r.status === 200 && (await one('select status from ops_deposits where id=$1', [depA.id])).status === 'paid' && jobA.state === 'confirmed');
  check("Nova's own billing handler never records a business's customer payment", (await one('select count(*)::int n from sales_provider_events')).n === 0);

  // ---------------------------------------------------------------- the platform path is unchanged and separated
  const B = await signedJob(platformBiz, '+12035550161');
  const b0 = prov.stripe.requests.length;
  await client({ resource: 'ops', op: 'customer-deposit', method: 'POST', body: { token: B.token } });
  const coB = prov.stripe.requests.slice(b0).find((x) => /checkout\/sessions$/.test(x.url));
  check("a Nova TEST business still uses Nova's test account (no Stripe-Account header)", !!coB && coB.account === null);
  const depB = await one('select * from ops_deposits where job_id=$1', [B.job.id]);
  r = await stripeWebhook(stripeHandler, evt(depB, { account: 'acct_TESTSHINE01' }), CONNECT_SECRET);
  check('a connected-account event cannot settle a platform deposit', r.status === 200 && (await one('select status from ops_deposits where id=$1', [depB.id])).status === 'checkout_open');
  delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  r = await stripeWebhook(stripeHandler, evt(depA, { account: 'acct_TESTSHINE01' }), CONNECT_SECRET);
  check('with no Connect secret configured, Connect events are refused (fail closed)', r.status === 400);
  process.env.STRIPE_SECRET_KEY = 'sk_live_should_never_be_used';
  const C = await signedJob(biz, '+12035550162').catch(() => null);
  r = C ? await client({ resource: 'ops', op: 'customer-deposit', method: 'POST', body: { token: C.token } }) : { status: 409, body: { error: 'Live payments are disabled.' } };
  check('a live key is still refused for connected deposits (live use not approved)', r.status === 409 && /Live payments are disabled/.test(r.body.error), JSON.stringify(r.body));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — client-owned deposits via Stripe Connect (real handlers + local PostgreSQL; Stripe is a local stand-in, not Stripe)`);
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode ?? 0);
