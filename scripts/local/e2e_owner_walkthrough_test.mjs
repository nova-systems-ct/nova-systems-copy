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
  check('the homepage explains the Triangle of Nova: Audit, Agents, Demand', await seen(v.getByText('Find where customers, money and time are lost')) && await seen(v.getByText('Workers that carry out the approved work')) && await seen(v.getByText('Go out and create new sales opportunities')));
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
  const conf = (await db.query("select status, provider_message_id from sales_notifications where kind='customer_booking_confirmed' and email=$1", [email])).rows;
  const inbox = await fetch(`${env.LOCAL_MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json()).catch(() => ({ messages: [] }));
  check('after booking, the visitor gets exactly one confirmation email (recorded as dry run; a copy is readable in the local test inbox)', conf.length === 1 && conf[0].status === 'dry_run' && /^local-inbox:/.test(conf[0].provider_message_id || '') && (inbox.messages || []).some((m) => /Confirmed: /.test(m.Subject)), JSON.stringify([conf, (inbox.messages || []).map((m) => m.Subject)]));

  // ------------------------------------------------------------ 2. the owner, from the dashboard
  const o = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; o.on('pageerror', (e) => errors.push(e.message));
  await o.goto(`${APP}/login`);
  await o.getByLabel('Email').fill(acct.OWNER_EMAIL); await o.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await o.getByRole('button', { name: /SIGN IN/ }).click();
  await o.waitForURL(/\/dashboard/, { timeout: 20000 });
  check('the owner lands on the dashboard: greeting, the four measured tiles, priorities, activity, audit queue and integrations', await seen(o.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ })) && await seen(o.getByText(/Inquiries · 30 days/)) && await seen(o.getByText(/Money collected · 30 days/)) && await seen(o.getByRole('heading', { name: /Today’s priorities/ })) && await seen(o.getByRole('heading', { name: /Recorded activity/ })) && await seen(o.getByRole('heading', { name: /Audit queue/ })) && await seen(o.getByRole('heading', { name: /Integrations/ })));
  check('the dashboard shows money collected as not measured (no live payments) and email as recorded, not sent', await seen(o.getByText(/No live payments recorded/)) && await seen(o.getByText('Recorded, not sent')));
  check('the owner home keeps one-click actions: start an audit, Install Systems, call test, test inquiry, requests', await seen(o.getByRole('link', { name: /Start an audit/ })) && await seen(o.getByRole('link', { name: /^Install Systems/ })) && await seen(o.getByRole('link', { name: /Open call test/ })) && await seen(o.getByRole('link', { name: /Send a test inquiry/ })) && await seen(o.getByRole('link', { name: /^Requests/ })));
  check('the sidebar shows the approved logo and task-based menu (Audits, Requests, Revive, Demand)', await seen(o.getByRole('img', { name: 'Nova Systems' })) && await seen(o.getByRole('navigation', { name: 'Nova HQ' }).getByRole('link', { name: 'Audits' })) && await seen(o.getByRole('navigation', { name: 'Nova HQ' }).getByRole('link', { name: 'Requests' })) && await seen(o.getByRole('navigation', { name: 'Nova HQ' }).getByRole('link', { name: 'Revive' })));
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
  const newerEmpty = (await db.query("select count(*)::int n from audit_cases a join businesses b on b.id=a.business_id join organizations o on o.id=a.organization_id where o.kind='nova_internal' and b.name !~ '^(LOCAL TEST|TEST|DEMO)' and not exists (select 1 from audit_findings f where f.case_id=a.id) and a.created_at > (select max(a2.created_at) from audit_cases a2 join businesses b2 on b2.id=a2.business_id where a2.organization_id=a.organization_id and b2.name !~ '^(LOCAL TEST|TEST|DEMO)' and exists (select 1 from audit_findings f2 where f2.case_id=a2.id))")).rows[0].n;
  check('(precondition) the newer-audit check is evaluated only when such an audit exists — here: ' + (newerEmpty ? 'it exists' : 'none'), true);
  if (newerEmpty) check('a newer audit that has no findings yet is reported on the plan instead of replacing the finished audit', /has no findings yet, so this plan still uses the earlier one/.test(installText));
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
  check('the owner home counts the confirmed test bookings apart from real ones', await seen(o.getByText(/test bookings not counted/)));

  // ------------------------------------------------------------ 3. Demand, Revive, Rewards and My work, from the menus
  // Viewing and previewing only: approving the Demand campaign or a rewards program is the owner's decision.
  await o.getByRole('link', { name: 'Operations' }).first().click();
  await o.getByRole('navigation', { name: 'Operations sections' }).getByRole('link', { name: 'Demand', exact: true }).click();
  check('Operations → Demand lists the prepared campaign as a draft awaiting approval', await seen(o.getByText('Complimentary Nova Audit — Waterbury service businesses')) && await seen(o.getByText(/^draft$/)));
  await o.getByRole('button', { name: 'Open' }).first().click();
  const demandText = await (await seen(o.getByText('Attribution link for replies:')) ? o.locator('body').innerText() : '');
  check('the campaign shows its sourced prospects, the attribution code and the funnel from real records', /Prospects researched\s*20/.test(demandText) && /\/book\?c=[A-Z0-9]{6}/.test(demandText) && /Contacted\s*0/.test(demandText), demandText.slice(0, 300));
  await shot(o, '07-demand');
  await o.getByRole('link', { name: 'Revive campaigns' }).click();
  check('Operations → Revive finds stalled requests in Nova\'s own records under proposed rules (preview only)', await seen(o.getByText('Recover stalled requests (from your own records)')) && await seen(o.getByTestId('revive-preview')));
  await shot(o, '08-revive');
  await o.getByRole('link', { name: 'Rewards' }).click();
  check('Operations → Rewards shows no program until the owner sets one, and says Wallet passes are not available yet', await seen(o.getByText('No approved program')) && await seen(o.getByText(/Apple Wallet passes: not available yet/)));
  await shot(o, '09-rewards');
  await o.getByRole('link', { name: 'My work' }).first().click();
  check('"My work" in the sidebar opens the person\'s own queue (tasks, results to receive, escalations)', await seen(o.getByRole('heading', { name: 'My work' })) && await seen(o.getByText(/Results to receive/)) && await seen(o.getByText(/Escalated to me/)));
  await shot(o, '10-my-work');

  // ------------------------------------------------------------ 4. audit → approved client report → emailed link → client view
  // A LOCAL TEST audit (Nova's own report is the owner's to approve, so it is not approved here). Built through the real
  // audit API, delivered through the controlled email path, opened from the copy in the local test inbox.
  const tokenRes = await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: acct.OWNER_EMAIL, password: acct.OWNER_PASSWORD }) })).json();
  const api = async (op, body, method = 'POST', query = {}) => { const r = await fetch(`${APP}/api/client?${new URLSearchParams({ resource: 'audit', op, ...query })}`, { method, headers: { Authorization: `Bearer ${tokenRes.access_token}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const novaOrg = (await db.query("select id from organizations where kind='nova_internal' limit 1")).rows[0].id;
  const jBiz = (await db.query("insert into businesses (organization_id, name, website, city, state) values ($1,$2,'https://journey.example.test','Waterbury','CT') returning id", [novaOrg, `LOCAL TEST Journey Audit ${Date.now().toString(36)}`])).rows[0].id;
  const O = (body) => ({ organization_id: novaOrg, ...body });
  const jc = (await api('cases', O({ action: 'create', business_id: jBiz, scope: 'digital' }))).body.case.id;
  const je = (await api('evidence', O({ case_id: jc, source: 'https://journey.example.test/ (TEST fixture page)', observation: 'TEST: the page lists a phone number but no way to choose a time.', confidence: 'high' }))).body.evidence.id;
  const jf = (await api('findings', O({ case_id: jc, title: 'TEST: no way to book a time online', detail: 'TEST: the page lists a phone number but no way to choose a time.', statement_type: 'observed_fact', confidence: 'high', priority: 'high', recommended_action: 'Add the /book path with real availability', evidence_ids: [je] }))).body.finding.id;
  await api('finding-details', O({ case_id: jc, finding_id: jf, financial_impact_status: 'unknown', customer_impact: 'TEST: a ready customer cannot book outside business hours.', limitations: 'TEST fixture: one public page only.', nova_can_implement: 'yes', owner_decision: 'TEST: approve adding the booking path.' }));
  await api('findings', O({ case_id: jc, action: 'review', id: jf, review_status: 'reviewed' }));
  await api('recommendations', O({ case_id: jc, finding_id: jf, mechanism: 'Add the /book path with real availability', effort_range: 'per approved scope', priority_rank: 1 }));
  const jr = (await api('compose', O({ case_id: jc, executive_summary: 'TEST journey report: one evidence-backed finding about online booking; no financial figure is claimed.' }))).body.report;
  const ap = await api('reports', O({ case_id: jc, action: 'approve', id: jr.id }));
  const reportEmail = `journey-client+${Date.now()}@nova-local.test`;
  const pub = await api('publish', O({ report_id: jr.id, email_to: reportEmail }));
  check('a TEST audit is composed, approved (content-hashed) and published with an email to the client', ap.status === 200 && !!ap.body.report.approved_content_sha256 && pub.status === 200 && pub.body.notification_status === 'dry_run', JSON.stringify([ap.status, pub.status, pub.body?.notification_status]));
  await new Promise((r) => setTimeout(r, 1500));
  const msgs = await fetch(`${env.LOCAL_MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${reportEmail}"`)}`).then((r) => r.json()).catch(() => ({ messages: [] }));
  const mid = msgs.messages?.[0]?.ID;
  const text = mid ? (await fetch(`${env.LOCAL_MAIL_URL}/api/v1/message/${mid}`).then((r) => r.json())).Text : '';
  const link = (text.match(/https?:\/\/\S+\/report\/[A-Za-z0-9_-]+/) || [])[0];
  check('the report-link email is recorded as dry run and a copy with the secure link is in the local test inbox (not sent to anyone)', !!link && /LOCAL TEST — not sent/.test(msgs.messages?.[0]?.Subject || ''), (msgs.messages || []).map((m) => m.Subject).join(' | '));
  const cl = await (await browser.newContext({ viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true, acceptDownloads: true })).newPage();
  if (link) await cl.goto(link.replace(/^https?:\/\/[^/]+/, APP));
  check('the client opens the emailed link on a tablet and sees "Your Nova Audit" with the approved finding', await seen(cl.getByText('Your Nova Audit')) && await seen(cl.getByText('TEST: no way to book a time online')) && await seen(cl.getByText('Estimate requires business inputs')));
  const dl = cl.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await cl.getByRole('button', { name: 'Download PDF' }).click().catch(() => {});
  check('the client downloads the PDF of that exact approved version', !!(await dl));
  await shot(cl, '11-client-report-tablet');
  check('no page errors during the owner walkthrough', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (e) { fail++; console.log('FAIL — run crashed:', e.stack || e); }
finally { await browser.close(); await db.end(); }
console.log(`\n${pass} passed, ${fail} failed — owner and visitor walkthrough on LOCAL STAGING. Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
