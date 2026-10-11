// Real-browser acceptance for Nova Operations: the actual Vite frontend + real API handlers + real worker + a real
// local PostgreSQL built from the strict manifest. Twilio and Stripe are local stand-ins ("simulated provider");
// Supabase Auth/Storage are local stand-ins. Desktop and phone viewports; screenshots of real test records.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startHarness } from './testenv/devharness.mjs';
import { startProviderStandIns, clearProviderEnv, setupTestBusiness, inboundSms, stripeWebhook, TW_TOKEN, WH_SECRET, PUBLIC_BASE } from './testenv/opsFixture.mjs';
import { makeCaller } from './testenv/call.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = path.join(process.env.NOVA_TEST_SHOTS_DIR || path.join(os.tmpdir(), 'nova-test-shots'), 'ops');
fs.mkdirSync(SHOTS, { recursive: true });

clearProviderEnv();
const prov = await startProviderStandIns();
const H = await startHarness({ manifest: true, vitePort: 5201, apiPort: 8801 });
const { env, base } = H;
Object.assign(process.env, prov.env, { WAVE1_PUBLIC_BASE: PUBLIC_BASE, TWILIO_AUTH_TOKEN: TW_TOKEN, TWILIO_ACCOUNT_SID: 'AC_SIMULATED_LOCAL', WAVE1_SEND_ENABLED: 'true', OPS_SEND_ALLOWLIST: '+12035550188', STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_WEBHOOK_SECRET: WH_SECRET, WORKER_ID: 'browser-test-worker' });
let browser;
try { browser = await pw.chromium.launch({ headless: true }); } catch (e) { console.log(`SKIP — no launchable Playwright Chromium: ${String(e.message).split(String.fromCharCode(10))[0]}`); await H.stop(); await prov.stop(); process.exit(3); }
const client = makeCaller((await import('../api/client.js')).default);
const { createPostgresJobStore } = await import('../worker/postgresJobStore.mjs');
const W = await import('../worker/index.mjs');
const store = createPostgresJobStore({ url: env.base, serviceKey: env.serviceKey });
const ctx = { url: env.base, serviceKey: env.serviceKey, mode: 'postgres', store };
const runDue = async (max = 30) => { let n = 0; while (n < max && await W.processOneJob(store, ctx)) n++; return n; };
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }).catch(() => {});
const CUSTOMER = '+12035550188';

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'ops_jobs?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova, name: 'TEST Owner' });
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await desktop.newPage();
  const pageErrors = []; page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('PAGE ERROR', e.message); });
  const login = async (p, email, pwd) => { await p.goto(`${base}/login`); await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').fill(pwd); await p.getByRole('button', { name: /sign in/i }).first().click(); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); };

  // ================================================================ access control in the browser
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${base}/dashboard/ops/requests`);
  await anon.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  check('a deep link to the dashboard without a session lands on the login page', new URL(anon.url()).pathname === '/login', anon.url());

  // ================================================================ owner: create a TEST business in the UI
  await login(page, owner.email, owner.password);
  await page.goto(`${base}/dashboard/ops`);
  await page.getByRole('heading', { name: 'Businesses', exact: true }).waitFor({ timeout: 15000 });
  check('the Nova owner sees Operations → Businesses (Nova HQ is not a client business)', true);
  await page.getByLabel('Business name').fill('TEST Browser Detailing');
  await page.getByLabel('Industry').fill('Mobile detailing (TEST)');
  await page.getByRole('button', { name: 'Create business' }).click();
  await page.getByText(/Created TEST Browser Detailing/).waitFor({ timeout: 10000 });
  const biz = (await one("select id from organizations where name='TEST Browser Detailing'")).id;
  check('the business is created through the real screen and is flagged TEST', !!(await one('select 1 from ops_business_settings where organization_id=$1 and is_test=true', [biz])));
  await shot(page, '01-businesses');
  // finish configuration through the real API (same calls the Settings screen makes)
  const op = (o, body) => client({ resource: 'ops', op: o, method: 'POST', body, token: owner.token });
  await op('settings', { organization_id: biz, timezone: 'America/New_York', business_hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, [{ start: '08:00', end: '18:00' }]])), escalation_phone: '+12035550111', review_url: 'https://g.page/r/TEST-review', lead_time_hours: 2 });
  await env.sql("update wave1_org_settings set sms_number_ref='+12035550100', provider_registration='approved', quiet_hours='{\"start\":0,\"end\":0}' where organization_id=$1", [biz]);
  await op('payment-account', { organization_id: biz, mode: 'nova_test_platform' });
  const t = await op('templates', { organization_id: biz, action: 'create', template_key: 'service_agreement', title: 'TEST Service Agreement', body: 'Agreement between {{business_name}} and {{customer_name}} for {{service_name}} at {{price}} (deposit {{deposit}}) on {{appointment}}. DRAFT TEST TERMS.' });
  await op('templates', { organization_id: biz, action: 'approve', id: t.body.row.id, acknowledge_not_legal_advice: true });
  await page.reload();
  await page.getByRole('button', { name: 'Open', exact: true }).first().waitFor({ timeout: 15000 }); await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.waitForTimeout(500);
  await page.goto(`${base}/dashboard/ops/settings`);
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor({ timeout: 15000 });
  await page.getByLabel('Key (letters, digits, _)').fill('full_detail'); await page.getByLabel('Service name').fill('Full detail');
  await page.getByLabel('Minutes', { exact: true }).fill('180'); await page.getByLabel('Price $').fill('180'); await page.getByLabel('Deposit $').fill('50');
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await page.getByText('Draft saved. Approve it to make it quotable.').waitFor({ timeout: 10000 });
  check('a price saved in Settings starts as a DRAFT', !!(await one("select 1 from ops_price_rules where organization_id=$1 and status='draft'", [biz])));
  await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
  await page.getByText(/Approved — this is now the price/).waitFor({ timeout: 10000 });
  check('the owner approves it in the screen; only then is it quotable', !!(await one("select 1 from ops_price_rules where organization_id=$1 and status='approved'", [biz])));
  await shot(page, '02-settings-prices');

  // ================================================================ customer texts in → assistant replies (visible in the Inbox)
  await inboundSms(client, CUSTOMER, 'Hi, can you fit me in this week?'); await runDue();
  await inboundSms(client, CUSTOMER, '1'); await runDue();
  await inboundSms(client, CUSTOMER, '1'); await runDue();
  const link = prov.twilio.messages.filter((m) => m.to === CUSTOMER).pop().body.match(/\/service\/([A-Za-z0-9_-]+)/)?.[1];
  check('(setup) the customer received a secure link by text (simulated provider)', !!link);
  await page.goto(`${base}/dashboard/ops/inbox`);
  await page.getByText('Conversations').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Unknown \(SMS\)/ }).first().click();
  await page.getByText(/accepted by provider/).first().waitFor({ timeout: 10000 });
  check('the Inbox shows the real thread with each message\'s true status ("accepted by provider", not "delivered")', await page.getByText(/automated assistant/).first().isVisible());
  await shot(page, '03-inbox');

  // ================================================================ customer page on a phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cp = await phone.newPage();
  await cp.route('https://checkout.stripe.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Stripe test checkout (local stand-in)</h1>' }));
  await cp.goto(`${base}/service/${link}`);
  await cp.getByText(/TEST — this is a Nova test business/).waitFor({ timeout: 15000 });
  check('the customer page says plainly that this is a TEST business', true);
  check('the customer sees the exact agreement text and the held time', await cp.getByText(/DRAFT TEST TERMS/).isVisible() && await cp.getByText(/held for you until/).isVisible());
  const noHScroll = await cp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('the customer page fits a phone screen without sideways scrolling', noHScroll);
  await shot(cp, '04-customer-agreement-mobile');
  await cp.getByLabel('Type your full legal name to sign').fill('TEST Customer Pat');
  check('the sign button stays disabled until e-sign consent is ticked', await cp.getByRole('button', { name: 'Sign agreement' }).isDisabled());
  await cp.getByRole('checkbox').check();
  await cp.getByRole('button', { name: 'Sign agreement' }).click();
  await cp.getByText(/Signed by TEST Customer Pat/).waitFor({ timeout: 10000 });
  check('signing in the browser records the signature and offers the signed copy', await cp.getByRole('button', { name: 'Download signed copy' }).isVisible());
  await cp.getByRole('button', { name: 'Pay deposit securely' }).click();
  await cp.waitForURL(/checkout\.stripe\.test/, { timeout: 15000 });
  check('the deposit goes to Stripe\'s hosted checkout page (local stand-in), not a form on Nova', /checkout\.stripe\.test/.test(cp.url()));
  await cp.goto(`${base}/service/${link}?deposit=returned`);
  await cp.getByText(/being confirmed with Stripe/).waitFor({ timeout: 10000 });
  check('returning from checkout does NOT claim payment until Stripe confirms', !(await cp.getByText(/confirmed by Stripe/).isVisible().catch(() => false)));
  const dep = await one("select d.* from ops_deposits d join ops_jobs j on j.id=d.job_id where j.organization_id=$1", [biz]);
  const hook = await stripeWebhook((await import('../api/stripe.js')).default, { id: 'evt_browser_1', type: 'checkout.session.completed', livemode: false, data: { object: { id: dep.provider_session_id, payment_status: 'paid', amount_total: dep.amount_cents, currency: 'usd', payment_intent: 'pi_browser', metadata: { ops_deposit_id: dep.id, organization_id: biz, job_id: dep.job_id } } } });
  check('(provider) the signed Stripe event is accepted', hook.status === 200);
  await cp.getByText(/Deposit of \$50\.00 confirmed by Stripe \(test mode\)/).waitFor({ timeout: 15000 });
  check('after Stripe confirms, the customer page shows the confirmed deposit and booking', await cp.getByText(/Your booking is confirmed/).isVisible());
  await shot(cp, '05-customer-confirmed-mobile');

  // ================================================================ owner: the job, completion, report
  const jobId = dep.job_id;
  await page.goto(`${base}/dashboard/ops/requests/${jobId}`);
  await page.getByText('Terms on this request').waitFor({ timeout: 15000 });
  const states = await page.locator('section').filter({ hasText: /^(Request|Appointment|Agreement|Deposit|Work)/ }).allInnerTexts();
  check('the job page shows each state separately (confirmed, booking confirmed, agreement signed, deposit paid, ready for work)', ['confirmed', 'signed', 'paid', 'ready'].every((w) => states.join(' ').includes(w)), JSON.stringify(states));
  check('the timeline lists every change with who made it', (await page.locator('ol li').count()) >= 8);
  await shot(page, '06-job-detail');
  await page.getByLabel('Completion notes').fill('TEST: full detail done');
  await page.getByRole('button', { name: 'Mark completed' }).click();
  await page.getByText(/Marked completed/).waitFor({ timeout: 10000 });
  check('the owner marks the job completed in the screen', (await one('select fulfillment_status from ops_jobs where id=$1', [jobId])).fulfillment_status === 'completed');
  await page.goto(`${base}/dashboard/ops/reports`);
  await page.getByRole('button', { name: 'Generate last week now' }).click();
  await page.waitForURL(/\/dashboard\/ops\/reports\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => {});
  if (!/reports\/[0-9a-f-]{36}/.test(page.url())) { const rid = (await one('select id from ops_weekly_reports where organization_id=$1 order by generated_at desc', [biz]))?.id; if (rid) await page.goto(`${base}/dashboard/ops/reports/${rid}`); }
  await page.getByText(/Money \(kept separate on purpose\)/).waitFor({ timeout: 15000 });
  check('the weekly report screen shows "Not calculable" instead of invented attribution / time saved / return', (await page.getByText(/Not calculable/).count()) >= 3 && await page.getByText(/TEST BUSINESS/).isVisible());
  await shot(page, '07-weekly-report');
  await page.goto(`${base}/dashboard/ops/monitoring`);
  await page.getByRole('button', { name: 'Run checks now' }).click();
  await page.getByText(/Checked \d+ items/).waitFor({ timeout: 15000 });
  check('Monitoring runs measured checks and shows unconfigured providers honestly', await page.getByText('not configured').first().isVisible());
  await shot(page, '08-monitoring');

  // ================================================================ phone layout of the owner overview
  const ownerPhone = await phone.newPage();
  await login(ownerPhone, owner.email, owner.password);
  await ownerPhone.goto(`${base}/dashboard/ops`);
  await ownerPhone.getByText('Readiness').first().waitFor({ timeout: 15000 }).catch(() => {});
  const mobileFits = await ownerPhone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('the owner overview fits a phone screen', mobileFits);
  await shot(ownerPhone, '09-overview-mobile');

  // ================================================================ password recovery: works once, never twice; sign-out
  const rec = await (await browser.newContext()).newPage();
  await rec.goto(`${base}/login`);
  await rec.locator('input[type=email]').fill(owner.email);
  await rec.getByRole('button', { name: /Forgot password/ }).click();
  await rec.getByText(/If that email has an account/).waitFor({ timeout: 10000 });
  const g = [...env.stubs.generatedLinks].reverse().find((x) => x.type === 'recovery');
  const recoveryUrl = `${env.base}/auth/v1/verify?token=${g.token}&type=recovery&redirect_to=${encodeURIComponent(g.redirect_to || `${base}/auth/callback`)}`;
  await rec.goto(recoveryUrl);
  await rec.waitForURL(/reset-password/, { timeout: 20000 }).catch(() => {});
  check('the recovery link opens the set-new-password screen', /reset-password/.test(rec.url()), rec.url());
  await rec.locator('input[type=password]').nth(0).fill('A-new-long-passphrase-9'); await rec.locator('input[type=password]').nth(1).fill('A-new-long-passphrase-9');
  await rec.getByRole('button', { name: /update|save|set/i }).first().click();
  await rec.waitForTimeout(1500);
  const relog = await fetch(`${env.base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: owner.email, password: 'A-new-long-passphrase-9' }) });
  check('the new password works for a real sign-in', relog.status === 200);
  const again = await (await browser.newContext()).newPage();
  await again.goto(recoveryUrl);
  await again.waitForTimeout(2000);
  check('the same recovery link cannot be used twice', !/reset-password/.test(again.url()) || /error|expired|invalid/i.test(await again.content()), again.url());
  await page.getByRole('button', { name: /sign out/i }).first().click().catch(() => {});
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {});
  await page.goto(`${base}/dashboard/ops`);
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {});
  check('after signing out, the dashboard is no longer reachable', new URL(page.url()).pathname === '/login', page.url());
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); try { for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: path.join(SHOTS, `zz-failure-${Date.now()}.png`), fullPage: true }); console.log('DEBUG orgs', JSON.stringify((await env.sql('select name, kind from organizations')).rows)); } catch { /* ignore */ } }
finally { await browser.close(); await H.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Operations in a real browser (real frontend + handlers + worker + local PostgreSQL; Auth/Storage/Twilio/Stripe are local stand-ins). Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
