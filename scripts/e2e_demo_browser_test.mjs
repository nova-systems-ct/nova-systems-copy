// Website demo in a real browser: real Vite frontend + real api handlers + local PostgreSQL (harness). The visitor's
// website is a made-up *.example.test site served by an in-test stand-in (DNS/fetch patched for that suffix only).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import dns from 'node:dns/promises';
import { createRequire } from 'node:module';
import { startHarness } from './testenv/devharness.mjs';
import { startProviderStandIns, clearProviderEnv } from './testenv/opsFixture.mjs';
import { makeCaller } from './testenv/call.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = path.join(process.env.NOVA_TEST_SHOTS_DIR || path.join(os.tmpdir(), 'nova-test-shots'), 'demo');
fs.mkdirSync(SHOTS, { recursive: true });

const realFetch = globalThis.fetch; const realLookup = dns.lookup;
dns.lookup = async (h, o) => (/\.example\.test$/.test(h) ? [{ address: '93.184.216.34', family: 4 }] : realLookup(h, o));
const PAGES = { '/': '<html><head><title>TEST Broken Plumbing</title><meta name="viewport" content="width=device-width"></head><body><a href="tel:+12035550123">Call</a><a href="/contact">Contact us</a></body></html>' };
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  if (!/\.example\.test$/.test(u.hostname)) return realFetch(input, init);
  const body = PAGES[u.pathname];
  return body ? new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('<html>Not found</html>', { status: 404, headers: { 'content-type': 'text/html' } });
};

clearProviderEnv();
const prov = await startProviderStandIns();
const H = await startHarness({ manifest: true, vitePort: 5207, apiPort: 8807 });
const { env, base } = H;
Object.assign(process.env, prov.env, { OPS_ALERT_EMAIL: 'alerts@nova.test', DEMO_MAX_PER_IP_PER_DAY: '50' });
let browser;
try { browser = await pw.chromium.launch({ headless: true }); } catch (e) { console.log(`SKIP — no launchable Playwright Chromium: ${String(e.message).split(String.fromCharCode(10))[0]}`); await H.stop(); await prov.stop(); process.exit(3); }
const client = makeCaller((await import('../api/client.js')).default);
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }).catch(() => {});

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'demo_sessions?select=id&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova });
  const setup = await client({ resource: 'demo', op: 'setup', method: 'POST', body: {}, token: owner.token });
  check('demo workspace set up by the owner', setup.status === 200 && setup.body.ready === true);

  // ---------------------------------------------------------------- desktop, from the home page
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(`${base}/`);
  await page.getByRole('link', { name: /WATCH THE 5-MINUTE DEMO/ }).click();
  await page.waitForURL(/\/demo$/, { timeout: 15000 });
  check('the home page leads to the demo', /\/demo$/.test(page.url()));
  await page.getByRole('button', { name: /Start the demo/ }).waitFor({ timeout: 15000 });
  const seo = await page.evaluate(() => ({ canonical: document.querySelector('link[rel="canonical"]')?.href, robots: document.querySelector('meta[name="robots"]')?.content || null, desc: document.querySelector('meta[name="description"]')?.content }));
  check('the public demo page is indexable with its own canonical URL on nova-systems.app', seo.canonical === 'https://nova-systems.app/demo' && seo.robots === null, JSON.stringify(seo));
  await page.getByRole('button', { name: /Start the demo/ }).click();
  await page.getByText('Please enter your name.').waitFor({ timeout: 10000 });
  check('an empty form shows which fields are needed', await page.getByText('Please enter a valid email address.').first().isVisible());
  await page.getByLabel('Your name').fill('TEST Visitor');
  await page.getByLabel('Business name').fill('TEST Broken Plumbing');
  await page.getByLabel('Business website (optional)').fill('broken.example.test');
  await page.getByLabel('Email', { exact: true }).fill('visitor@broken.example.test');
  await shot(page, '01-form-desktop');
  const t0 = Date.now();
  await page.getByRole('button', { name: /Start the demo/ }).click();
  await page.getByText('Verified observation').waitFor({ timeout: 30000 });
  const tFinding = (Date.now() - t0) / 1000;
  check(`a verified observation appears, with its source and time (${tFinding.toFixed(1)} s after submitting)`, await page.getByText(/link on the home page leads to a page that answered HTTP 404/).first().isVisible() && await page.getByText(/Source: https:\/\/broken\.example\.test\/contact/).first().isVisible());
  await page.getByText('Your demo summary (saved)').waitFor({ timeout: 60000 });
  const tDone = (Date.now() - t0) / 1000;
  const doneCount = await page.getByText('· Done').count();
  check(`all seven worker steps show "Done" and the summary appears (${tDone.toFixed(1)} s from submit to summary; limit 300 s)`, doneCount === 7 && tDone < 300, `done=${doneCount}`);
  check('the summary invites the full 48–72-hour audit through the existing audit request', await page.getByText(/within 48–72 hours/).first().isVisible() && (await page.getByRole('link', { name: /Request the full Nova Audit/ }).getAttribute('href')) === '/request-audit');
  check('the page says plainly that the worker half was a demo (made-up customer and prices, nothing sent, no money)', await page.getByText(/Nothing was sent to anyone, no real appointment exists, and no money moved/).first().isVisible());
  await shot(page, '02-result-desktop');
  const url = page.url();
  await page.reload(); await page.getByText('Your demo summary (saved)').waitFor({ timeout: 15000 });
  check('the saved summary reopens from the page link after a refresh', url.includes('session=') && await page.getByText(/answered HTTP 404/).first().isVisible());
  check("a visitor's private session page tells search engines not to index it", (await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content)) === 'noindex, nofollow');
  await page.goto(`${base}/`);
  const home = await page.evaluate(() => ({ canonical: document.querySelector('link[rel="canonical"]')?.href, desc: document.querySelector('meta[name="description"]')?.content || '', ld: document.querySelector('script[type="application/ld+json"]')?.textContent || '' }));
  check('the home page describes the operational product (not websites/social media/branding) and declares the organization', home.canonical === 'https://nova-systems.app/' && !/websites|social media|branding/i.test(home.desc) && /"@type":"Organization"/.test(home.ld), JSON.stringify(home).slice(0, 300));
  const sess = await one("select * from demo_sessions where email='visitor@broken.example.test'");
  check('the session, scan, worker steps and summary are stored; the lead is in Nova CRM', sess.status === 'completed' && sess.scan.result === 'issue_found' && sess.worker_steps.length === 7 && !!sess.nova_deal_id);

  // ---------------------------------------------------------------- phone, from the menu, no website
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  await p2.goto(`${base}/`);
  await p2.locator('button.lg\\:hidden').first().click();
  await p2.getByRole('link', { name: /TRY THE 5-MINUTE DEMO/ }).click();
  await p2.waitForURL(/\/demo$/, { timeout: 15000 });
  await p2.getByLabel('Your name').fill('TEST Phone Visitor');
  await p2.getByLabel('Business name').fill('TEST No Website Co');
  await p2.getByLabel('Email', { exact: true }).fill('phone@nosite.example.test');
  await p2.getByRole('button', { name: /Start the demo/ }).click();
  await p2.getByText('Your demo summary (saved)').waitFor({ timeout: 60000 });
  check('on a phone, with no website: the scan says what it could not check, and the workers still run', await p2.getByText(/No website was given, so nothing public was checked/).first().isVisible() && (await p2.getByText('· Done').count()) === 7);
  check('the phone layout has no sideways scrolling', !(await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await shot(p2, '03-result-phone');

  check('no text message or payment was attempted during the browser demos', prov.twilio.messages.length === 0 && prov.stripe.requests.length === 0 && env.stubs.outbox.length === 0);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { globalThis.fetch = realFetch; dns.lookup = realLookup; await browser?.close().catch(() => {}); await H.stop(); await prov.stop(); }
console.log(`\n${pass} passed, ${fail} failed — website demo in a real browser (real frontend + handlers + local PostgreSQL). Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode ?? 0);
