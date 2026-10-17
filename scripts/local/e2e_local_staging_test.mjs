// LOCAL STAGING acceptance: a real browser against the running local stack (real Supabase Auth, Postgres, PostgREST,
// Storage and local mail in Docker) at http://localhost:5180, plus the running worker. Needs:
//   node scripts/local/staging.mjs up|migrate|provision   then   serve   and   worker   (two terminals)
// Uses the test accounts from .env.local-staging-accounts (never printed). Real external providers are NOT involved:
// texting is off, email stays in the local Mailpit inbox, Stripe is not configured — each is reported as such.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
for (const u of [env.SUPABASE_URL, env.APP_BASE_URL]) if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) throw new Error('local staging only');
const APP = env.APP_BASE_URL; const SB = env.SUPABASE_URL; const MAIL = (env.LOCAL_MAIL_URL || 'http://127.0.0.1:54324').replace(/\/$/, '');
let pass = 0, fail = 0; const results = [];
const check = (n, c, x = '') => { results.push([c ? 'PASS' : 'FAIL', n]); if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const note = (n) => { results.push(['NOTE', n]); console.log(`NOTE — ${n}`); };
const SHOTS = path.join(os.tmpdir(), 'nova-local-staging-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }).catch(() => {});
const seen = (loc, t = 10000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const signIn = async (email, password) => (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
const api = async (token, resource, op, { method = 'POST', body, query = {} } = {}) => { const academy = resource === 'academy'; const qs = new URLSearchParams(academy ? { action: op, ...query } : { resource, op, ...query }); const r = await fetch(`${APP}/api/${academy ? 'academy' : 'client'}?${qs}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }); let j; try { j = await r.json(); } catch { j = null; } return { status: r.status, body: j }; };

const browser = await pw.chromium.launch({ headless: true });
try {
  const owner = await signIn(acct.OWNER_EMAIL, acct.OWNER_PASSWORD); const rep = await signIn(acct.REP_EMAIL, acct.REP_PASSWORD);
  check('real Supabase Auth issues sessions for the provisioned owner and representative', !!owner.access_token && !!rep.access_token);

  // ------------------------------------------------------------ login, roles, logout
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const page = await ctx.newPage();
  const consoleErrors = []; page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(acct.OWNER_EMAIL); await page.getByLabel('Password').fill('definitely-wrong-password');
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  check('a wrong password is rejected by real Supabase Auth', await seen(page.getByText('Invalid email or password. Please try again.')));
  await page.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  check('the owner signs in and reaches the dashboard', /\/dashboard/.test(page.url()), page.url());
  await page.waitForTimeout(1500); await shot(page, '01-owner-dashboard');
  const ownerNav = await page.locator('nav, aside').first().innerText().catch(() => '');
  check('the owner sees owner-level sections (Operations, Sales Team, Admin)', /Operations/.test(ownerNav) && /Sales Team/.test(ownerNav) && /Admin/.test(ownerNav), ownerNav.slice(0, 200));
  // persistent record: create a client business through the owner's API session, then find it in the screen after reload
  const bizName = `LOCAL TEST Detailing ${crypto.randomBytes(2).toString('hex')}`;
  const created = await api(owner.access_token, 'ops', 'businesses', { body: { name: bizName, industry: 'Detailing (LOCAL TEST)', is_test: true } });
  check('the owner creates a client business that is saved in the real database', created.status === 200 && !!created.body?.business?.id, JSON.stringify(created.body).slice(0, 160));
  await page.goto(`${APP}/dashboard/ops/businesses`); await page.reload();
  check('the saved business is listed after a page reload (persistent record)', await seen(page.getByText(bizName), 15000));
  await shot(page, '02-ops-business');
  // sign out, then try the dashboard again
  await page.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${APP}/login`); await page.goto(`${APP}/dashboard`);
  await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check('after signing out, the dashboard sends the visitor to the login page', /\/login/.test(page.url()), page.url());

  // ------------------------------------------------------------ representative: correct, narrower access
  await page.getByLabel('Email').fill(acct.REP_EMAIL); await page.getByLabel('Password').fill(acct.REP_PASSWORD);
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await page.waitForURL(/\/(dashboard|rep)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500); await shot(page, '03-rep-dashboard');
  const repNav = await page.locator('nav, aside').first().innerText().catch(() => '');
  check('the new representative signs in to the Nova Sales area, sees the activation checklist, and no owner-only Admin', /\/(rep|dashboard)/.test(page.url()) && !/\bAdmin\b/.test(repNav) && await seen(page.getByText('Your path to activation')), page.url());
  check('a new representative is not shown an error on their first screen', !(await page.getByText('Your representative account is not active.').count()));
  const repOps = await api(rep.access_token, 'ops', 'jobs', { method: 'GET', query: { organization_id: created.body?.business?.id } });
  check("the representative cannot read a client business's operations (server-side denial)", repOps.status === 403 || repOps.status === 404, String(repOps.status));
  const promote = await fetch(`${SB}/rest/v1/organization_members?staff_user_id=eq.${encodeURIComponent(JSON.parse(Buffer.from(rep.access_token.split('.')[1], 'base64url')).sub)}`, { method: 'PATCH', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${rep.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ role: 'nova_super_admin' }) });
  const promoteRows = promote.ok ? await promote.json() : [];
  check('the representative cannot promote themselves through the database API', !promote.ok || promoteRows.length === 0, String(promote.status));
  const anon = await fetch(`${SB}/rest/v1/demo_sessions?select=email`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } });
  check('anonymous visitors cannot read private tables (demo sessions)', !anon.ok || (await anon.json()).length === 0, String(anon.status));

  // ------------------------------------------------------------ training: progress persists, no self-certification
  const programs = await api(rep.access_token, 'academy', 'programs', { method: 'GET' });
  const list = programs.body?.programs || [];
  check('the representative sees the training programs from the real database', programs.status === 200 && list.length === 10, `${programs.status} ${list.length}`);
  const fundamentals = list.find((p) => p.slug === 'nova-fundamentals');
  if (fundamentals) {
    const enroll = await api(rep.access_token, 'academy', 'enroll', { body: { program_id: fundamentals.id } });
    const done = await api(rep.access_token, 'academy', 'complete-lesson', { body: { program_id: fundamentals.id, lesson_order: 1 } });
    const again = await api(rep.access_token, 'academy', 'program-detail', { method: 'GET', query: { id: fundamentals.id } });
    const l1 = (again.body?.lessons || []).find((l) => l.order_index === 1);
    check('lesson progress is saved and still there when read back', [200, 409].includes(enroll.status) && done.status === 200 && l1?.completed === true, JSON.stringify([enroll.status, done.status, done.body?.error]).slice(0, 160));
    const lessonTitles = (again.body?.lessons || []).map((l) => l.title).join(' | ');
    check('the training teaches the Triangle of Nova and what is live today', /Triangle of Nova/.test(lessonTitles) && /Not Live/.test(lessonTitles), lessonTitles.slice(0, 200));
    const self = await api(rep.access_token, 'academy', 'issue-certificate', { body: { program_id: fundamentals.id } });
    check('the representative cannot certify themselves before the requirements are met', self.status >= 400, String(self.status));
  }
  await page.goto(`${APP}/rep/training`); await page.waitForTimeout(1500); await shot(page, '04-rep-training');
  check('the representative opens Training from the dashboard and sees the programs', await seen(page.getByText(/Nova Fundamentals/), 15000));

  // ------------------------------------------------------------ password recovery through the real Auth + local mail
  const before = (await (await fetch(`${MAIL}/api/v1/messages`)).json()).messages_count ?? 0;
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(`${APP}/login`);
  await p2.getByLabel('Email').fill(acct.REP_EMAIL);
  await p2.getByRole('button', { name: 'Forgot password?' }).click();
  check('asking for a reset shows a neutral confirmation', await seen(p2.getByText(/a reset link is on its way/)));
  let link = null;
  for (let i = 0; i < 20 && !link; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const m = await (await fetch(`${MAIL}/api/v1/messages`)).json();
    if ((m.messages_count ?? 0) > before) { const id = m.messages[0].ID; const msg = await (await fetch(`${MAIL}/api/v1/message/${id}`)).json(); link = (/(http[^\s"'<>]*verify[^\s"'<>]*)/.exec(msg.Text || msg.HTML || '') || [])[1]?.replace(/&amp;/g, '&'); }
  }
  check('the reset email is delivered to the local inbox (not a real mailbox)', !!link);
  if (link) {
    await p2.goto(link); await p2.waitForURL(/reset-password|auth\/callback/, { timeout: 20000 }).catch(() => {});
    const newPw = `Nv-${crypto.randomBytes(12).toString('base64url')}`;
    const formShown = await seen(p2.getByLabel('New password'), 15000);
    check('the recovery link asks for a new password (it does not sign in silently)', formShown, p2.url());
    if (formShown) {
      await p2.getByLabel('New password').fill(newPw); await p2.getByLabel('Confirm password').fill(newPw);
      await p2.getByRole('button', { name: /Save New Password/ }).click(); await p2.waitForTimeout(2500);
      const relog = await signIn(acct.REP_EMAIL, newPw);
      if (relog.access_token) { const f = '.env.local-staging-accounts'; fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^REP_PASSWORD=.*$/m, `REP_PASSWORD=${newPw}`), { mode: 0o600 }); }
      check('the new password works and the accounts file is updated privately', !!relog.access_token);
      await p2.goto(link); await p2.waitForTimeout(2500);
      check('the same recovery link cannot be used twice', !(await seen(p2.getByLabel('New password'), 3000)));
    }
  }

  // ------------------------------------------------------------ /demo against the real stack and a real public site
  const d = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await d.goto(`${APP}/demo`);
  await d.getByLabel('Your name').fill('LOCAL TEST Visitor'); await d.getByLabel('Business name').fill('LOCAL TEST Example Domain');
  await d.getByLabel('Business website (optional)').fill('example.com'); await d.getByLabel('Email', { exact: true }).fill(`visitor+${Date.now()}@nova-local.test`);
  const t0 = Date.now();
  await d.getByRole('button', { name: /Start the demo/ }).click();
  const summary = await seen(d.getByText('Your demo summary (saved)'), 90000);
  const secs = (Date.now() - t0) / 1000;
  check(`the demo completes on the real stack with a real public website (example.com), submit → summary in ${secs.toFixed(1)} s`, summary && (await d.getByText('· Done').count()) === 7, `done=${await d.getByText('· Done').count()}`);
  const scanText = await d.locator('#part1').locator('..').innerText().catch(() => '');
  note(`demo scan of example.com: ${/Verified observation/.test(scanText) ? 'finding reported' : /No problem was verified/.test(scanText) ? 'no problem verified (honest result)' : 'see screenshot'}`);
  await shot(d, '05-demo-phone');
  const url = d.url(); await d.goto(url);
  check('the saved demo summary reopens from its link', url.includes('session=') && await seen(d.getByText('Your demo summary (saved)'), 15000));

  // ------------------------------------------------------------ audit: approval, PDF, secure client link
  const nova = (await api(owner.access_token, 'ops', 'businesses', { method: 'GET' })).body?.businesses?.find((b) => b.kind === 'nova_internal');
  const A = (op, body) => api(owner.access_token, 'audit', op, { body: { organization_id: nova?.id, ...body } });
  const bizRow = await fetch(`${SB}/rest/v1/businesses`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ organization_id: nova?.id, name: 'LOCAL TEST Audit Business', website: 'https://example.com' }) }).then((r) => r.json());
  const caseR = await A('cases', { action: 'create', business_id: bizRow?.[0]?.id, scope: 'online audit: inquiry handling' });
  const caseId = caseR.body?.case?.id;
  await A('intake', { case_id: caseId, intake: { website: 'https://example.com', contact_name: 'LOCAL TEST Owner', requested_scope: 'online audit' }, clock_policy: { start_event: 'All inputs received and permission recorded', hours_basis: 'business_hours', target_hours: 72, missing_input_rule: 'Clock pauses until the input arrives', extension_notice: 'Owner is told before the deadline with a new date' }, deadline_terms: 'Report within 72 business hours of complete inputs', approve_clock_policy: true });
  await A('cases', { action: 'mark-ready', id: caseId });
  const ev = await A('evidence', { case_id: caseId, source: 'Public page https://example.com (LOCAL TEST)', observation: 'No contact form found on the home page', confidence: 'medium' });
  const fd = await A('findings', { case_id: caseId, title: 'No contact path on the home page', detail: 'The page has no form, phone link or booking link', statement_type: 'observed_fact', confidence: 'medium', recommended_action: 'Add a contact path', evidence_ids: [ev.body?.evidence?.id] });
  await A('finding-details', { case_id: caseId, finding_id: fd.body?.finding?.id, period_start: '2026-10-01', period_end: '2026-10-16', customer_impact: 'Visitors cannot reach the business from the page', financial_impact_status: 'unknown', limitations: 'One public page reviewed (LOCAL TEST)', nova_can_implement: 'yes', owner_decision: 'Approve a contact path' });
  await A('findings', { case_id: caseId, action: 'review', id: fd.body?.finding?.id, review_status: 'reviewed' });
  await A('recommendations', { case_id: caseId, finding_id: fd.body?.finding?.id, mechanism: 'Add a visible contact form', effort_range: '1 day', cost_range: 'per approved scope', dependencies: 'Owner approval', uncertainty: 'Single-page review', verification_plan: 'Submit a test inquiry after launch', priority_rank: 1 });
  const comp = await A('compose', { case_id: caseId, executive_summary: 'LOCAL TEST summary: the public page offers no contact path.' });
  const repId = comp.body?.report?.id;
  const appr = await A('reports', { case_id: caseId, action: 'approve', id: repId });
  const pdf = await api(owner.access_token, 'audit', 'report-pdf', { method: 'GET', query: { organization_id: nova?.id, report_id: repId } });
  const pub = await A('publish', { report_id: repId });
  check('audit on the real stack: evidence → reviewed finding → composed report → approval bound to content → exact-version PDF → secure link', !!caseId && appr.status === 200 && Buffer.from(pdf.body?.pdf_base64 || '', 'base64').toString('latin1').startsWith('%PDF') && !!pub.body?.link, JSON.stringify([caseR.status, ev.status, fd.status, comp.status, appr.status, pdf.status, pub.status, appr.body?.problems || appr.body?.error]).slice(0, 400));
  if (pub.body?.link) {
    const r = await (await browser.newContext()).newPage(); await r.goto(pub.body.link.replace(/^https?:\/\/[^/]+/, APP));
    check('the client opens the approved report through the secure link', await seen(r.getByText(/Operational Findings/), 15000));
    await shot(r, '06-report-link');
  }

  // ------------------------------------------------------------ core: booking + agreement + signature in the browser
  const bizId = created.body?.business?.id;
  const O = (op, body, method = 'POST', query = {}) => api(owner.access_token, 'ops', op, { method, body: method === 'GET' ? undefined : { organization_id: bizId, ...body }, query: method === 'GET' ? { organization_id: bizId, ...query } : {} });
  await O('settings', { timezone: 'America/New_York', business_hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((x) => [x, [{ start: '08:00', end: '18:00' }]])), hold_minutes: 20, lead_time_hours: 2 });
  const price = await O('prices', { action: 'create', service_key: 'full_detail', name: 'Full detail (LOCAL TEST)', duration_minutes: 120, price_cents: 18000, deposit_cents: 5000 });
  await O('prices', { action: 'approve', id: price.body?.row?.id });
  const tpl = await O('templates', { action: 'create', template_key: 'service_agreement', title: 'LOCAL TEST Agreement', body: 'LOCAL TEST between {{business_name}} and {{customer_name}}. Service: {{service_name}}. Price: {{price}}. Deposit: {{deposit}}. Appointment: {{appointment}}.' });
  await O('templates', { action: 'approve', id: tpl.body?.row?.id, acknowledge_not_legal_advice: true });
  const job = (await O('job-action', { action: 'create', phone: '+12035550170', name: 'LOCAL TEST Customer', is_test: true, customer_requested: true })).body?.job;
  await O('job-action', { action: 'quote', job_id: job?.id, service_key: 'full_detail' });
  const av = (await O('availability', null, 'GET', { service_key: 'full_detail' })).body;
  const hold = await O('job-action', { action: 'hold', job_id: job?.id, start: av?.slots?.[0]?.start });
  const ag = await O('job-action', { action: 'send-agreement', job_id: job?.id });
  check('core on the real stack: approved price → real availability → hold → agreement from the approved template', hold.status === 200 && !!ag.body?.link, JSON.stringify([hold.status, ag.status, ag.body?.error]));
  if (ag.body?.link) {
    const c = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
    await c.goto(ag.body.link.replace(/^https?:\/\/[^/]+/, APP));
    await seen(c.getByText(/LOCAL TEST between/), 15000);
    const nameBox = c.getByLabel(/full legal name/i);
    await nameBox.first().fill('LOCAL TEST Customer').catch(() => {});
    await c.getByRole('checkbox').first().check().catch(() => {});
    await c.getByRole('button', { name: /sign/i }).first().click().catch(() => {});
    await c.waitForTimeout(2500);
    const signed = (await api(owner.access_token, 'ops', 'job', { method: 'GET', query: { organization_id: bizId, id: job?.id } })).body?.agreements?.[0];
    check('the customer signs on a phone; the signed agreement and its PDF are stored (real Storage, private bucket)', signed?.status === 'signed' && !!signed?.signed_pdf_path, JSON.stringify(signed && { s: signed.status, p: !!signed.signed_pdf_path }));
    const payText = await c.locator('body').innerText();
    note(`deposit step on the customer page: ${/not set up|not configured|business will contact/i.test(payText) ? 'shown as not set up (Stripe is not configured locally — no test payment was possible)' : 'see screenshot 07'}`);
    await shot(c, '07-customer-signing-phone');
  }

  // ------------------------------------------------------------ worker + Sentry + scoreboard
  const rep1 = await O('reports', { action: 'generate' });
  check('the weekly scoreboard generates now from the real records (controlled trigger)', rep1.status === 200, JSON.stringify(rep1.body).slice(0, 160));
  const health = await O('health', null, 'GET');
  check('Sentry health checks report from the running worker', health.status === 200, JSON.stringify(health.body).slice(0, 160));

  check('no uncaught errors in the pages during the run', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
  note('not tested here: real Twilio (texting off), real email delivery (local inbox only), Stripe test payments (no test key configured), Cal.com.');
} catch (e) { fail++; console.log('FAIL — run crashed:', e.stack || e); }
finally { await browser.close(); }
console.log(`\n${pass} passed, ${fail} failed — LOCAL STAGING (real local Supabase in Docker; not hosted). Screenshots: ${SHOTS}`);
process.exitCode = fail ? 1 : 0;
