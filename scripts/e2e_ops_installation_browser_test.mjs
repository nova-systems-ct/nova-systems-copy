// Actual app + disposable DB. Stripe is a loopback stand-in; no real account is connected or charged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import packaged from '@sparticuz/chromium';
import { startHarness } from './testenv/devharness.mjs';
import { makeCaller } from './testenv/call.mjs';
import { clearProviderEnv, startProviderStandIns, setupTestBusiness, WH_SECRET } from './testenv/opsFixture.mjs';
let harness, providers, browser;
try {
  clearProviderEnv();
  providers = await startProviderStandIns();
  harness = await startHarness({ manifest: true, vitePort: 5225, apiPort: 8825 });
  Object.assign(process.env, providers.env, { STRIPE_SECRET_KEY: 'sk_test_install_browser', STRIPE_WEBHOOK_SECRET: WH_SECRET, WAVE1_SEND_ENABLED: 'false' });
  const { env, base } = harness;
  const nova = (await env.sql("insert into organizations(name,slug,kind) values('TEST Nova','install-browser-nova','nova_internal') returning id")).rows[0].id;
  const admin = await env.createUser({ email: 'admin@install.test', role: 'nova_super_admin', orgId: nova });
  const client = makeCaller((await import('../api/client.js')).default);
  const { biz } = await setupTestBusiness({ env, client, ownerToken: admin.token, name: 'TEST Installation Business' });
  const owner = await env.createUser({ email: 'owner@install.test', role: 'client_owner', orgId: biz });
  await env.sql('update ops_price_rules set deposit_cents=0 where organization_id=$1', [biz]);
  await env.sql("insert into worker_runtime_heartbeats(worker_id,host) values('browser-fixture','loopback-test')");
  providers.stripe.accounts.acct_BrowserTestOnly = { charges_enabled: true, name: 'TEST Business' };
  browser = await chromium.launch({ executablePath: await packaged.executablePath(), args: packaged.args, headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel('Email', { exact: true }).fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto(`${base}/dashboard/ops/settings`);
  await page.getByLabel(/Connected Stripe account ID/).fill('acct_BrowserTestOnly', { timeout: 10000 });
  await page.getByRole('button', { name: 'Verify test connection', exact: true }).click();
  await page.getByText('Connection verified for testing. Live payments remain disabled.', { exact: true }).waitFor();
  const account = (await env.sql('select mode,stripe_account_ref,live_enabled from ops_payment_accounts where organization_id=$1', [biz])).rows[0];
  assert.equal(account.stripe_account_ref, 'acct_BrowserTestOnly'); assert.equal(account.live_enabled, false);
  await page.goto(`${base}/dashboard/ops/install`);
  await page.getByRole('button', { name: 'Choose Nova Agents: inquiries and booking', exact: true }).click();
  await page.getByText('Nova Agents: inquiries and booking chosen. Press Install Systems to install it.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Install Systems', exact: true }).click();
  await page.getByRole('button', { name: 'Activate', exact: true }).waitFor({ timeout: 20000 });
  assert.equal((await env.sql('select status from ops_installed_modules where organization_id=$1 and module_key=$2', [biz, 'agents_booking'])).rows[0].status, 'installed');
  await env.sql("update ops_price_rules set price_cents=price_cents+100 where organization_id=$1 and service_key='full_detail'", [biz]);
  await page.reload();
  await page.getByText(/The configuration or audit changed/).waitFor();
  assert(await page.getByRole('button', { name: 'Activate', exact: true }).isDisabled(), 'A visibly stale plan cannot be activated from the screen');
  await page.getByRole('button', { name: 'Install Systems', exact: true }).click();
  await page.getByRole('button', { name: 'Activate', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByText('Activation recorded after fresh checks. Messaging and live payments keep their separate controls.', { exact: true }).waitFor();
  const plans = (await env.sql('select version,status from ops_install_manifests where organization_id=$1 order by version', [biz])).rows;
  assert.deepEqual(plans.map(p => p.status), ['superseded', 'activated']);
  fs.mkdirSync('docs/qa/install-safety-2026-11-06', { recursive: true });
  for (const [name, width, height] of [['desktop', 1366, 1000], ['ipad', 820, 1180], ['phone', 390, 844]]) {
    await page.setViewportSize({ width, height });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${name} must fit without sideways scrolling`);
    await page.screenshot({ path: `docs/qa/install-safety-2026-11-06/${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  assert.equal(providers.twilio.messages.length, 0); assert.equal(env.stubs.outbox.length, 0);
  assert(providers.stripe.requests.every(r => r.method === 'GET'), 'Setup never creates a checkout or charge');
  console.log('PASS — owner verifies a test-only payment destination, installs the booking worker, sees stale setup blocked, retests and activates; desktop/iPad/phone fit; no provider messages or charges. Local provider stand-ins only.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { if (browser) await browser.close(); if (harness) await harness.stop(); if (providers) await providers.stop(); }
process.exit(process.exitCode ?? 0);
