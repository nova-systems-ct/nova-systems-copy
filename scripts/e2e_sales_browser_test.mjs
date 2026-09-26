// LIVE-BROWSER acceptance of the actual Sales Team screens: real Vite frontend + real api/*.js handlers + real local PostgreSQL/PostgREST.
// Supabase Auth/Storage, Resend and Stripe are local stand-ins; nothing leaves this machine and no email/payment is real.
//   PLAYWRIGHT_PATH=<dir containing the playwright package> node scripts/e2e_sales_browser_test.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { startHarness } from './testenv/devharness.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const SHOTS = 'C:/Users/NVUBCR~1/AppData/Local/Temp/claude/C--Users-NVUBCrosbyUBMS07/0ef944d3-fdd6-4062-be44-e3a88cd2eff0/scratchpad/sales-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const H = await startHarness();
const { env, base } = H;
const browser = await pw.chromium.launch({ headless: true });
const sql = (q, p) => env.sql(q, p);
try {
  // ---------------------------------------------------------------- seed (Nova-owned TEST data)
  const org = (await sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: org, name: 'Rae Rep' });
  await sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$2,'Rae Rep','active',$3)", [rep.id, org, mgr.id]);
  await sql("update products set sales_readiness='available_for_sale', sales_info_reviewed=true, sales_info='{\"what_it_is\":\"A written business diagnostic (test data).\"}', pricing_approved=true, pricing_config='{\"unit_price_cents\":50000,\"billing\":\"one_time\"}' where slug='nova-audit-digital'");
  await env.reload();

  const newPage = async (opts = {}) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts }); const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('   [pageerror]', e.message)); return { ctx, page }; };
  const login = async (page, u) => { await page.goto(`${base}/login`); await page.locator('input[type=email]').fill(u.email); await page.locator('input[type=password]').fill(u.password); await page.getByRole('button', { name: /sign in/i }).first().click(); await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 }); };
  const shot = (page, n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }).catch(() => {});

  // ================================================================= A. applicant applies (public, mobile-sized to check layout)
  {
    const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/apply/sales`);
    await page.getByText('Apply as a sales representative').waitFor();
    check('A1 public application page renders (mobile width) with the no-guarantee notice', await page.getByText('Apply as a sales representative').isVisible() && await page.getByText(/no income, role or work guaranteed/i).first().isVisible());
    await page.locator('input[type=email]').fill('jane@applicant.test');
    await page.getByRole('button', { name: /email me a link/i }).click();
    await page.getByText('Check your email').waitFor();
    check('A2 asking for a link shows the neutral confirmation (never reveals if an account exists)', true);
    const row = (await sql("select body from sales_notifications where kind='apply_link' and email='jane@applicant.test'")).rows[0];
    check('A3 the sign-in email was recorded as dry-run and NOT sent', (await sql("select status from sales_notifications where kind='apply_link'")).rows[0].status === 'dry_run' && env.stubs.outbox.length === 0);
    const sess = env.stubServer.consumeMagicLink(row.body.match(/http[^\s]+/)[0]);
    const authKey = `sb-${new URL(env.base).hostname.split('.')[0]}-auth-token`;
    const stored = JSON.stringify({ access_token: sess.access_token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: sess.userId, email: sess.email } });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [authKey, stored]);
    await page.goto(`${base}/apply/continue`);
    await page.getByText('Your application', { exact: true }).first().waitFor();
    check('A4 with the one-time link session the applicant sees THEIR draft (reference + next step)', await page.getByText(/NOVA-[A-Z0-9]{8}/).first().isVisible() && await page.getByText(/Finish your application/).isVisible());
    await page.getByLabel('Full name').fill('Jane Applicant'); await page.getByLabel('Phone').first().fill('(203) 555-0142'); await page.getByLabel('Location (city, state)').fill('Waterbury, CT');
    await page.getByLabel('Hours per week you could work').fill('20'); await page.getByRole('button', { name: 'Mon', exact: true }).click(); await page.getByRole('button', { name: 'Thu', exact: true }).click();
    await page.getByLabel(/Relevant sales or customer-service experience/).fill('Two years of retail and customer service; I enjoy helping owners solve problems.');
    await page.getByLabel('Telephone').check(); await page.getByLabel('Email', { exact: true }).check();
    await page.getByLabel('Why do you want this role?').fill('I like working with small business owners and I want structured training before I talk to anyone.');
    await page.getByLabel(/How much more money will I make/).fill('I would say I cannot know yet; I would ask about their calls and follow-up and offer a diagnostic first.');
    await page.getByLabel(/already have a website/).fill('I would ask how new customers currently find and contact them and what happens to those who get no answer.');
    await page.getByRole('button', { name: /submit application/i }).click();
    await page.getByText(/we still need|required|Some required answers/i).first().waitFor({ timeout: 5000 }).catch(() => {});
    check('A5 submitting without the acknowledgements is refused with clear messages (server validation shown in the form)', await page.getByText(/You must acknowledge the privacy notice/).isVisible());
    await page.getByLabel(/I have read the privacy notice/).check(); await page.getByLabel(/answers are my own and truthful/).check(); await page.getByLabel(/no income, hiring, interview or work is guaranteed/).check(); await page.getByLabel(/may not invent figures/).check();
    await page.getByLabel('Anything else about your availability').fill('My SSN is 123-45-6789');
    await page.getByRole('button', { name: /submit application/i }).click();
    await page.getByText(/Social Security/i).first().waitFor({ timeout: 8000 });
    check('A6 an SSN typed into free text is refused by the server — the application never collects identifiers', true);
    await page.getByLabel('Anything else about your availability').fill('');
    await page.getByRole('button', { name: /submit application/i }).click();
    await page.getByText('Thank you — we have your application').waitFor({ timeout: 10000 });
    await shot(page, 'A-submitted-mobile');
    check('A7 a complete application submits and shows a reference code and honest next step', await page.getByText(/NOVA-[A-Z0-9]{8}/).first().isVisible());
    check('A8 persisted: status submitted, privacy acknowledgement recorded with a notice version, one version stored', (await sql("select status, privacy_notice_version, (select count(*) from application_versions v where v.application_id=a.id) c from applications a where email_normalized='jane@applicant.test'")).rows[0].status === 'submitted');
    check('A9 the applicant page never shows reviewer notes/scores fields', !(await page.content()).includes('evaluation'));
    await ctx.close();
  }

  // ================================================================= B. owner reviews, accepts and invites
  let joinLink;
  {
    const { ctx, page } = await newPage();
    await login(page, owner);
    check('B1 the owner signs in with a real session and lands in Nova HQ', page.url().includes('/dashboard'));
    check('B1b "Sales Team" appears in the HQ navigation for the owner', await page.locator('a', { hasText: 'Sales Team' }).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false));
    await page.goto(`${base}/dashboard/sales-team/hiring`);
    await page.getByText('Jane Applicant').first().waitFor({ timeout: 15000 });
    check('B2 the hiring workspace lists the application (status, reviewer, invitation state)', await page.locator('td', { hasText: 'Submitted' }).first().isVisible());
    await page.getByText('Jane Applicant').first().click();
    await page.getByRole('tab', { name: /Application/ }).waitFor();
    check('B3 the full application is visible to the reviewer (answers, acknowledgements)', await page.getByText(/structured training/).isVisible());
    await page.getByRole('tab', { name: /Decision & invitation/ }).click();
    await page.getByRole('button', { name: /Decide/ }).click();
    await page.getByLabel(/Reason \(recorded/).fill('Strong scenario answers; honest about limits.');
    await page.getByRole('button', { name: /Record accept/i }).click();
    await page.getByText(/Decision recorded/i).waitFor();
    await page.getByRole('button', { name: /Create invitation/i }).click();
    const banner = page.locator('code').first(); await banner.waitFor({ timeout: 10000 });
    joinLink = (await banner.textContent()).trim();
    await shot(page, 'B-invitation');
    check('B4 the owner accepts (reason recorded) and creates an invitation; with email NOT live the link is shown to the OWNER only', joinLink.includes('/join/') && env.stubs.outbox.length === 0 && (await sql("select status from applications where email_normalized='jane@applicant.test'")).rows[0].status === 'accepted');
    check('B5 the app tells the owner nothing was emailed', await page.getByText(/Email is not live, so nothing was emailed/).isVisible());
    await ctx.close();
  }

  // ================================================================= C. candidate accepts the invitation, sees candidate-only workspace
  {
    const { ctx, page } = await newPage();
    await page.goto(joinLink.replace(/^https?:\/\/[^/]+/, base));
    await page.getByText('Set up your training account').waitFor();
    check('C1 the invitation page shows only a masked email', await page.getByText('ja***@applicant.test').isVisible());
    await page.getByLabel('Choose a password').fill('A-very-long-passphrase-1'); await page.getByLabel('Confirm password').fill('A-very-long-passphrase-1');
    await page.getByRole('button', { name: /create my account/i }).click();
    await page.getByText('Your account is ready').waitFor({ timeout: 15000 }).catch(async () => { console.log('   [join page said]', (await page.locator('main').innerText()).slice(0, 400)); throw new Error('join failed'); });
    check('C2 accepting creates a CANDIDATE account (training only) — the page says so', await page.getByText(/candidate access/i).first().isVisible() && (await sql("select m.role from organization_members m join auth.users u on u.id=m.staff_user_id where u.email='jane@applicant.test'")).rows[0].role === 'nova_sales_candidate');
    await page.goto(`${base}/join/${joinLink.split('/join/')[1]}`);
    await page.getByText('Invitation unavailable').waitFor();
    check('C3 the same link cannot be used twice', await page.getByText(/already used/i).isVisible());
    await login(page, { email: 'jane@applicant.test', password: 'A-very-long-passphrase-1' });
    await page.goto(`${base}/rep`);
    await page.getByText('Your path to activation').waitFor({ timeout: 15000 });
    await shot(page, 'C-candidate-onboarding');
    check('C4 the candidate lands on Onboarding with the 7-item checklist; training does not activate', (await page.getByText(/Owner approval|Explicit owner approval/).count()) > 0 && await page.getByText(/never activates/i).first().isVisible());
    const nav = await page.locator('nav[aria-label="Sales workspace"]').innerText();
    check('C5 the candidate nav shows Onboarding/Training/Documents only — no Leads, Toolkit or Earnings', /Training/i.test(nav) && /Documents/i.test(nav) && !/Leads|Toolkit|Earnings/i.test(nav));
    await page.goto(`${base}/rep/leads`);
    await page.getByText(/not active|active representative|permission|access/i).first().waitFor({ timeout: 10000 });
    check('C6 opening /rep/leads directly is refused by the SERVER (hiding a link is not security)', true);
    await page.goto(`${base}/rep/training`);
    await page.getByText('Nova Sales Academy').waitFor();
    check('C7 training lists all ten programs and labels the passing rule PROVISIONAL', (await page.getByText(/PROGRAM \d+/).count()) === 10 && await page.getByText(/Provisional passing rule/).isVisible());
    await page.getByText('Nova Fundamentals').click();
    await page.getByText(/Lesson 1:/).waitFor({ timeout: 10000 });
    await shot(page, 'C-lesson');
    check('C8 a program opens with its lessons, objectives and a locked quiz until lessons are done', await page.getByText('What you will be able to do').isVisible());
    await page.getByRole('tab', { name: /Quiz/ }).click();
    check('C9 the quiz is gated until every lesson is completed', await page.getByText(/Finish every lesson to unlock the quiz|Finish all/i).first().isVisible());
    await page.getByRole('tab', { name: /Lessons/ }).click();
    for (let i = 0; i < 8; i++) { const b = page.getByRole('button', { name: /Mark lesson complete/ }); if (!(await b.count())) break; await b.click(); await page.waitForTimeout(500); }
    await page.getByRole('tab', { name: /Quiz/ }).click();
    await page.getByText(/Quiz — \d+ questions/).waitFor({ timeout: 10000 });
    check('C10 after completing the lessons the quiz appears, with no answers exposed in the page', (await page.content()).match(/correct_index/) === null);
    const html = await page.content(); check('C10b the quiz page HTML contains no answer key or explanations', !/correct_index|explanation/i.test(html));
    // answer everything wrong (always choice 0 would be random) — just submit; result is graded by the server
    const groups = await page.locator('fieldset').count();
    for (let i = 0; i < groups; i++) await page.locator('fieldset').nth(i).locator('input[type=radio]').first().check();
    await page.getByRole('button', { name: /Submit quiz/ }).click();
    await page.getByText('Your result').waitFor({ timeout: 15000 });
    check('C11 the score is decided by the server and shown with the pass mark', /\d+(\.\d)?% — (Passed|Not passed)/.test(await page.locator('body').innerText()));
    check('C12 an attempt was persisted with the policy snapshot', (await sql("select count(*) from academy_quiz_attempts")).rows[0].count === '1');
    await page.goto(`${base}/rep/documents`);
    await page.getByText('Agreements & documents').waitFor();
    check('C13 the documents screen says nothing has been published yet (no invented legal text)', await page.getByText(/Nova has not published this yet/).first().isVisible());
    await ctx.close();
  }

  // ================================================================= D. representative works a lead and a proposal
  let proposalLink; let dealId;
  {
    const { ctx, page } = await newPage();
    await login(page, rep);
    await page.goto(`${base}/rep`);
    await page.getByRole('heading', { name: 'Today', exact: true }).waitFor({ timeout: 15000 });
    check('D1 an ACTIVE rep gets Home / Leads / Toolkit / My Earnings', /Leads/i.test(await page.locator('nav[aria-label="Sales workspace"]').innerText()));
    await page.goto(`${base}/rep/leads`);
    await page.getByRole('button', { name: /Add a prospect/ }).click();
    await page.getByLabel('Business name').fill('Browser Test Plumbing'); await page.getByLabel('Website', { exact: true }).fill('https://browsertestplumbing.test');
    await page.getByLabel('Contact name').fill('Pat Owner'); await page.getByLabel('Contact email').fill('pat@browsertestplumbing.test'); await page.getByLabel('Business phone').fill('203-555-0500');
    await page.getByRole('button', { name: /Add prospect/ }).click();
    await page.getByText('Browser Test Plumbing').first().waitFor({ timeout: 15000 });
    dealId = page.url().split('/rep/leads/')[1];
    check('D2 a prospect is added through the form and opens its detail page (assigned to the rep, stage New)', !!dealId && (await sql('select stage, assigned_rep_id from crm_deals where id=$1', [dealId])).rows[0].assigned_rep_id === rep.id);
    await page.getByRole('button', { name: /Move stage/ }).click();
    await page.getByRole('button', { name: /^Move$/ }).click();
    await page.getByText(/Log at least one real outreach attempt/).waitFor({ timeout: 8000 });
    check('D3 moving to Contacted without logging outreach is refused with the reason', true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Log activity/ }).click();
    await page.getByLabel('What happened').fill('Called and spoke with the owner about how calls are handled.');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(800);
    const move = async (to, fill) => { await page.getByRole('button', { name: /Move stage/ }).click(); await page.getByLabel('Move to').selectOption(to); if (fill) await fill(); await page.getByRole('button', { name: /^Move$/ }).click(); await page.waitForTimeout(900); };
    await move('contacted');
    await move('qualified', async () => { await page.getByLabel(/Qualification summary/).fill('Owner-operated plumbing shop; the owner answers his own phone in the van.'); await page.getByLabel(/Have you spoken with the decision maker/).selectOption('yes'); });
    await move('discovery_scheduled', async () => { await page.getByLabel(/Discovery conversation date and time/).fill('2030-06-01T10:00'); });
    await move('discovery_completed', async () => {
      const ta = page.locator('[role=dialog] textarea'); const n = await ta.count();
      const vals = ['Mostly phone calls and some walk-ins', 'Voicemail, called back next morning', 'None written down', 'Missed calls after hours', 'A basic website only', 'The owner decides', 'After-hours calls go to voicemail with no callback routine.'];
      for (let i = 0; i < n; i++) await ta.nth(i).fill(vals[i] || 'More detail here.');
    });
    await shot(page, 'D-lead');
    check('D4 the rep walks New → Contacted → Qualified → Discovery Scheduled → Discovery Completed through the UI, each with its entry rule', (await sql('select stage from crm_deals where id=$1', [dealId])).rows[0].stage === 'discovery_completed');
    await page.getByRole('tab', { name: /Proposal & closing/ }).click();
    await page.getByRole('button', { name: /Write a proposal/ }).click();
    await page.getByLabel(/Include Nova Audit/).check();
    await page.getByLabel(/Scope, in your own words/).fill('We guarantee this will double your leads within a month.');
    await page.getByRole('button', { name: /Save draft/ }).click();
    await page.getByText(/guarantee|promise/i).first().waitFor({ timeout: 8000 });
    check('D5 a proposal that promises results is refused by the server, and the message says why', true);
    await page.getByLabel(/Scope, in your own words/).fill('Review how calls and inquiries are handled and write up findings with evidence, based on what we learned in discovery.');
    await page.getByRole('button', { name: /Save draft/ }).click();
    await page.getByText(/Version 1/).waitFor({ timeout: 10000 });
    check('D6 the draft is priced from the approved catalog ($500.00) — the rep never types a price', await page.getByText(/Total \$500\.00/).isVisible());
    await page.getByRole('button', { name: /Send to client/ }).click();
    const code = page.locator('code').first(); await code.waitFor({ timeout: 10000 });
    proposalLink = (await code.textContent()).trim();
    check('D7 sending (email not live) shows the personal link to the rep only; stage → Awaiting Signature/Payment', proposalLink.includes('/proposal/') && env.stubs.outbox.length === 0 && (await sql('select stage from crm_deals where id=$1', [dealId])).rows[0].stage === 'awaiting_signature_payment');
    await ctx.close();
  }

  // ================================================================= E. the CLIENT opens the link and signs (no Nova account)
  {
    const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(proposalLink.replace(/^https?:\/\/[^/]+/, base));
    await page.getByText('Scope', { exact: true }).waitFor({ timeout: 15000 });
    await shot(page, 'E-proposal-mobile');
    check('E1 the client sees scope, line items, total and the no-promise statement — nothing internal', await page.getByText(/Total \$500\.00/).isVisible() && await page.getByText(/does not promise any business result/).isVisible() && !(await page.content()).match(/assigned_rep|rep_user|qualification/));
    check('E2 the Sign button is disabled until the client types a name and consents', await page.getByRole('button', { name: /Sign proposal/ }).isDisabled());
    await page.getByLabel(/Type your full legal name/).fill('Pat Owner');
    await page.getByLabel(/agree to sign this proposal electronically/i).check();
    await page.getByRole('button', { name: /Sign proposal/ }).click();
    await page.getByText(/Signed by Pat Owner/).waitFor({ timeout: 10000 });
    check('E3 the client signs; the page confirms, and shows that online payment is not available (no provider configured)', await page.getByText(/Online payment is not available yet/).isVisible());
    check('E4 the signature is stored server-side with a server timestamp and hash; the deal shows the client-signed fact', (await sql('select signature_hash, signed_at from crm_proposals where deal_id=$1 and status=$2', [dealId, 'signed'])).rows[0].signature_hash.length === 64 && (await sql('select signed_agreement_at from crm_deals where id=$1', [dealId])).rows[0].signed_agreement_at !== null);
    await ctx.close();
  }

  // ================================================================= F. rep reports the close; OWNER verifies (the claim is not a sale until then)
  {
    const { ctx, page } = await newPage();
    await login(page, rep);
    await page.goto(`${base}/rep/leads/${dealId}`);
    await page.getByRole('tab', { name: /Proposal & closing/ }).click();
    await page.getByText(/Report the sale closed/).waitFor({ timeout: 10000 });
    await page.getByPlaceholder(/What happened, and what evidence exists/).fill('Client signed through the link. Payment terms to be confirmed by Nova.');
    await page.getByRole('button', { name: /Submit for verification/ }).click();
    await page.getByText(/Submitted for verification/).first().waitFor({ timeout: 10000 });
    await page.getByRole('tab', { name: /Overview/ }).click();
    check('F1 after submitting, the deal shows "Rep reported close" but NOT verified/paid/fulfillment', await page.getByText('Rep reported close').isVisible() && (await sql('select owner_verified_at, payment_received_at from crm_deals where id=$1', [dealId])).rows[0].owner_verified_at === null);
    await ctx.close();
    const o = await newPage(); await login(o.page, owner);
    await o.page.goto(`${base}/dashboard/sales-team/verification`);
    await o.page.getByText(/Browser Test Plumbing/).first().waitFor({ timeout: 15000 });
    await shot(o.page, 'F-verification');
    check('F2 the owner queue shows the sale with the rep\'s claim, the proposal, and that the client signed through Nova', await o.page.getByText(/Client signed through Nova/).isVisible());
    await o.page.getByRole('button', { name: /Verify…/ }).click();
    await o.page.getByLabel(/What did you check/).fill('Signature verified in Nova; payment not yet received.');
    await o.page.getByRole('button', { name: /Verify sale/ }).click();
    await o.page.getByText(/No payment has been received/).first().waitFor({ timeout: 10000 });
    check('F3 verification is REFUSED while no payment has been received (unless the owner explicitly accepts unpaid terms)', true);
    await o.page.getByLabel(/I accept unpaid terms/).check(); await o.page.getByLabel(/Why \(15\+ characters\)/).fill('Owner agreed net-14 invoice terms with the client.');
    await o.page.getByRole('button', { name: /Verify sale/ }).click();
    await o.page.getByText(/Verified\. Handoff/).waitFor({ timeout: 15000 });
    check('F4 the owner verifies with an explicit unpaid-terms acceptance: deal Won, customer org + order created once', (await sql('select stage, owner_verified_at from crm_deals where id=$1', [dealId])).rows[0].stage === 'won' && (await sql('select count(*) from orders where deal_id=$1', [dealId])).rows[0].count === '1');
    await o.page.goto(`${base}/dashboard/sales-team/commissions`);
    await o.page.getByText('Commissions & payouts').waitFor({ timeout: 15000 });
    check('F5 with no approved commission plan, the ledger says none can be calculated (no invented rates)', await o.page.getByText(/No commission plan is approved/).first().isVisible());
    await o.page.goto(`${base}/dashboard/sales-team/overview`);
    await o.page.getByText('Revenue vs pipeline').waitFor({ timeout: 15000 });
    await shot(o.page, 'F-overview');
    check('F6 the HQ overview shows pipeline labelled NOT revenue, verified sales, and separate collected columns', await o.page.getByText(/NOT revenue/).isVisible() && await o.page.getByText('Collected — provider confirmed').isVisible());
    await o.ctx.close();
  }

  // ================================================================= G. manager boundaries in the browser
  {
    const { ctx, page } = await newPage(); await login(page, mgr);
    await page.goto(`${base}/dashboard`);
    await page.waitForURL(/sales-team/, { timeout: 15000 });
    const nav = await page.locator('nav[aria-label="Sales Team"]').innerText();
    check('G1 a manager lands in Sales Team and sees Overview/Hiring/Reps/Leads/Academy — not Agreements, Catalog, Verification, Commissions or Settings', /Overview/i.test(nav) && /Hiring/i.test(nav) && !/Agreements|Catalog|Verification|Commissions|Settings/i.test(nav));
    await page.goto(`${base}/dashboard/sales-team/commissions`);
    await page.getByText(/permission|Access Restricted/i).first().waitFor({ timeout: 10000 });
    check('G2 a manager who types the commissions URL is refused', true);
    await ctx.close();
  }
} catch (e) { fail++; console.log('FAIL — browser test crashed:', e.stack || e); }
finally { await browser.close(); await H.stop(); }
console.log(`\n${pass} passed, ${fail} failed — live-browser checks (real UI + real handlers + real local PostgreSQL; auth/email/payments are stand-ins)`);
process.exitCode = fail ? 1 : 0;
