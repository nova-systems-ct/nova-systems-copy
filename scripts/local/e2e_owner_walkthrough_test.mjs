// The path Isaac uses, through visible controls only, against the running LOCAL STAGING stack (real local Supabase).
//   1. Homepage → "Request your audit" → Nova's form → choose a real time → sign → confirmed booking (saved).
//   2. Owner login → product home shows the five actions → each opens a working screen:
//      Start an audit (form opens), Set up channels (readiness with blockers), Test a call (exact blockers, no simulation),
//      Send a test inquiry (real form path → customer page → time → sign → confirmed), Outcomes (requests list shows it).
// Credentials come from the git-ignored accounts file and are never printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(env.APP_BASE_URL)) throw new Error('local only');
const APP = env.APP_BASE_URL;
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = path.join(os.tmpdir(), 'nova-walkthrough-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }).catch(() => {});
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();

async function bookOnCustomerPage(p, who) {
  await seen(p.getByRole('heading', { name: 'Choose a time' }));
  const first = p.locator('section[aria-label="Choose a time"] button').first();
  const slot = await first.innerText().catch(() => '');
  await first.click();
  await seen(p.getByLabel(/full legal name/i));
  await p.getByLabel(/full legal name/i).fill(who); await p.getByRole('checkbox').check();
  await p.getByRole('button', { name: 'Sign agreement' }).click();
  return { slot, confirmed: await seen(p.getByText(/Your booking is confirmed/), 20000) };
}

const browser = await pw.chromium.launch({ headless: true });
try {
  // ------------------------------------------------------------ 1. a visitor, from the homepage
  const v = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await v.goto(`${APP}/`);
  check('the homepage explains Nova Audit, Nova Agents and customer acquisition', await seen(v.getByText(/Inspect your real customer journey and records/)) && await seen(v.getByText(/Agents that perform approved actions across your channels/)) && await seen(v.getByText(/How Nova helps you win more of the customers who already reach out/)));
  check('the homepage puts the audit request and the demo up front', await seen(v.getByRole('link', { name: /REQUEST YOUR AUDIT/ })) && await seen(v.getByRole('link', { name: /WATCH THE 5-MINUTE DEMO/ })));
  await shot(v, '01-home-phone');
  await v.getByRole('link', { name: /REQUEST YOUR AUDIT/ }).first().click();
  await v.waitForURL(/\/book$/, { timeout: 15000 });
  const email = `walkthrough+${Date.now()}@nova-local.test`;
  await v.getByLabel('Your name').fill('LOCAL TEST Walkthrough Visitor'); await v.getByLabel('Business name').fill('LOCAL TEST Roofing');
  await v.getByLabel('Email').fill(email); await v.waitForTimeout(2200);
  await v.getByRole('button', { name: /Continue to choose a time/ }).click();
  await v.waitForURL(/\/service\//, { timeout: 20000 }).catch(() => {});
  const b1 = await bookOnCustomerPage(v, 'LOCAL TEST Walkthrough Visitor');
  check(`a visitor goes from the homepage to a confirmed booking through Nova's own form (${b1.slot})`, b1.confirmed);
  await shot(v, '02-visitor-confirmed');
  const rec = (await db.query("select j.state, j.source_channel, bk.status booking, a.status agreement, c.email from ops_jobs j join crm_contacts c on c.id=j.contact_id left join ops_bookings bk on bk.job_id=j.id and bk.status='confirmed' left join ops_agreements a on a.job_id=j.id where c.email=$1", [email])).rows[0];
  check("the inquiry, the confirmed booking and the signed agreement are saved in Nova's records", rec?.state === 'confirmed' && rec.source_channel === 'form' && rec.booking === 'confirmed' && rec.agreement === 'signed', JSON.stringify(rec));
  const mail = (await db.query("select status from sales_notifications where kind='customer_booking_link' and email=$1", [email])).rows[0];
  check('the visitor is sent their private link by email through the controlled path (dry run here: recorded, not sent)', mail?.status === 'dry_run', JSON.stringify(mail));

  // ------------------------------------------------------------ 2. the owner, from the dashboard
  const o = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; o.on('pageerror', (e) => errors.push(e.message));
  await o.goto(`${APP}/login`);
  await o.getByLabel('Email').fill(acct.OWNER_EMAIL); await o.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await o.getByRole('button', { name: /SIGN IN/ }).click();
  await o.waitForURL(/\/dashboard/, { timeout: 20000 });
  check('the owner lands on the product: "Run your business on Nova" with the five actions', await seen(o.getByRole('heading', { name: 'Run your business on Nova' })) && await seen(o.getByRole('link', { name: /Start an audit/ })) && await seen(o.getByRole('link', { name: /^Install Systems/ })) && await seen(o.getByRole('link', { name: /Open call test/ })) && await seen(o.getByRole('link', { name: /Send a test inquiry/ })) && await seen(o.getByRole('link', { name: /^Requests/ })));
  check('the misleading "migration hasn\'t been run" banner is gone from the owner home', !(await o.getByText(/Stage 5 database migration/).count()));
  await shot(o, '03-owner-home');

  await o.getByRole('link', { name: /Start an audit/ }).click();
  check('"Start an audit" opens the new-audit form with online and in-person options', await seen(o.getByText(/Online \+ in-person audit/)) || await seen(o.locator('option', { hasText: 'Online + in-person audit' })));
  await shot(o, '04-start-audit');

  await o.goto(`${APP}/dashboard/ops/test`);
  await o.goto(`${APP}/dashboard`); await o.getByRole('link', { name: /^Install Systems/ }).click();
  await seen(o.getByRole('button', { name: 'Install Systems' }));
  await o.getByRole('button', { name: 'Install Systems' }).click();
  // Wait for this run's own result message, then reload so the page shows the plan the run produced (not the previous one).
  await seen(o.getByText(/Installed\. Every required component is done|Installed what was possible|Some steps failed/), 60000);
  await o.reload(); await seen(o.getByRole('button', { name: 'Install Systems' }));
  const planDone = await seen(o.getByText(/Installation plan v\d+ · (installed|partial|activated)/), 30000);
  const installText = await o.locator('body').innerText();
  check('"Install Systems" prepares a plan from the audit, runs it in stages, and shows each result', planDone && /From the audit/.test(installText) && /Controlled test: inquiry to quote/.test(installText) && /TEST inquiry saved, qualified and quoted/.test(installText), installText.slice(0, 200));
  check('the plan is prepared from the real audit of Nova (7 findings), not a test fixture', installText.includes('latest audit of Nova Systems (own business)') && (installText.match(/Fix: /g) || []).length >= 7, (installText.match(/latest audit of [^.]*/) || [''])[0]);
  check('blocked components show the exact next action (e.g. escalation contact, phone channel)', /Next: /.test(installText));
  await shot(o, '05a-install-systems');
  await o.getByRole('button', { name: 'Install Systems' }).click(); await o.waitForTimeout(4000);
  const plans = (await db.query("select count(*)::int n from ops_install_manifests m join organizations g on g.id=m.organization_id where g.kind='nova_internal' and m.status <> 'superseded'")).rows[0].n;
  const testJobs = (await db.query("select count(*)::int n, count(*) filter (where j.state='cancelled')::int c from ops_jobs j join crm_contacts c on c.id=j.contact_id join organizations g on g.id=j.organization_id where g.kind='nova_internal' and c.source='install_test'")).rows[0];
  check('running it again does not create a second plan, and each controlled test request is cancelled after the check', plans === 1 && testJobs.n >= 1 && testJobs.n === testJobs.c, JSON.stringify({ plans, testJobs }));
  await o.goto(`${APP}/dashboard/ops/test`);
  check('"Set up channels" shows every channel with its status and the exact blocker', await seen(o.getByText('Agents and connected channels')) && await seen(o.getByText('Phone provider (Twilio) credentials')));
  await o.getByRole('link', { name: 'Test center' }).first().click().catch(() => {});
  await o.goto(`${APP}/dashboard`); await o.getByRole('link', { name: /Open call test/ }).click();
  check('"Test a call" states plainly why a real call is not possible here (no simulated call)', await seen(o.getByText(/A real test call is not possible in this environment yet/)));
  await shot(o, '05-test-center');

  await o.goto(`${APP}/dashboard`); await o.getByRole('link', { name: /Send a test inquiry/ }).click();
  await seen(o.getByRole('button', { name: 'Send test inquiry' }));
  await o.getByLabel('What the test customer writes').fill('I would like an audit consultation this week.');
  await o.getByRole('button', { name: 'Send test inquiry' }).click();
  check('the owner sends a test inquiry through the real form path; the worker qualifies and quotes it', await seen(o.getByText(/qualified and quoted from an approved price/)));
  const [cust] = await Promise.all([o.context().waitForEvent('page'), o.getByRole('link', { name: "Open the customer's page" }).click()]);
  const b2 = await bookOnCustomerPage(cust, 'TEST Owner Walkthrough');
  check(`the test inquiry reaches a confirmed booking on the customer page (${b2.slot})`, b2.confirmed);
  await o.goto(`${APP}/dashboard/ops/requests`);
  check('the test request appears in Requests, marked TEST', await seen(o.getByText(/TEST Inquiry \(owner test\)/)));
  await shot(o, '06-requests');
  await o.goto(`${APP}/dashboard`);
  check('Outcomes on the owner home count the confirmed work', await seen(o.getByText(/ready for work/)));
  check('no page errors during the owner walkthrough', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (e) { fail++; console.log('FAIL — run crashed:', e.stack || e); }
finally { await browser.close(); await db.end(); }
console.log(`\n${pass} passed, ${fail} failed — owner and visitor walkthrough on LOCAL STAGING. Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
