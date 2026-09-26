// ACCEPTANCE JOURNEYS (master prompt §15) — one continuous, connected run against REAL PostgreSQL + PostgREST (local, disposable).
//   Journey A  Candidate:  application → review → owner acceptance → secure invitation → account → ALL ten Academy programs (quizzes, practicals,
//                          critical-question program) → certificates → agreements signed + countersigned → owner activation
//   Journey B  Rep:        assigned lead → pipeline → discovery → proposal → client signature → payment (verified event) → submission →
//                          owner verification → fulfillment handoff → commission → approval → payout batch → recorded payout
//   Journey C  Owner:      HQ dashboard, ledger, audit trail, reports all reflect what actually happened
//   Journey D  Negatives:  isolation, escalation, forgery, duplicates, retries, discounts, suspension, answer-key/document exposure
// Supabase Auth/Storage, Resend and Stripe are LOCAL STAND-INS. Every "customer", "client" and "payment" here is a Nova-owned TEST RECORD.
// Plan rates and prices are TEST VALUES, not Nova's. Nothing here touches production, sends email, or moves money.
import http from 'node:http';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
const stripeCalls = []; const srv = http.createServer((req, res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { stripeCalls.push({ url: req.url, body: new URLSearchParams(d) }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ id: `cs_j_${stripeCalls.length}`, url: `https://checkout.stripe.test/j/${stripeCalls.length}` })); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const WHSEC = 'whsec_journeys_local';
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_SECRET_KEY: 'sk_test_local_only', STRIPE_API_BASE: `http://127.0.0.1:${srv.address().port}/v1` });
delete process.env.SALES_PAYOUTS_MODE;
const { default: handler } = await import('../api/client.js');
const { default: academyHandler } = await import('../api/academy.js');
const { default: stripeHandler } = await import('../api/stripe.js');
const { default: teamHandler } = await import('../api/team.js');
const call = makeCaller(handler); const acad = makeCaller(academyHandler); const teamApi = makeCaller(teamHandler);
const R = (resource) => (op, o = {}) => call({ resource, op, ...o });
const apply = R('apply'), hiring = R('hiring'), docs = R('documents'), team = R('salesteam'), leads = R('leads'), cat = R('catalog'), prop = R('proposals'), cprop = R('clientproposal'), pay = R('salespay'), comm = R('commissions'), notif = R('notifications');
const A = (action, o = {}) => acad({ action, ...o });
const webhook = async (event) => { const ts = Math.floor(Date.now() / 1000); const raw = Buffer.from(JSON.stringify(event)); const sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${raw}`).digest('hex'); const req = Object.assign(Readable.from([raw]), { method: 'POST', query: {}, headers: { 'stripe-signature': `t=${ts},v1=${sig}`, 'x-forwarded-for': '203.0.113.50' } }); const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json() { return this; }, end() { return this; } }; await stripeHandler(req, res); return res; };
const AGREEMENT = (t) => `${t}. TEST agreement text for an automated acceptance run — not legal advice and not a Nova agreement. `.repeat(6);
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const fin = await env.createUser({ email: 'fin@nova.test', role: 'nova_finance', orgId: org, name: 'Fin Ance' });
  const clientOrg = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Client','acme','client') returning id")).rows[0].id;
  const clientUser = await env.createUser({ email: 'client@acme.test', role: 'client_owner', orgId: clientOrg, name: 'Acme Owner' });
  await env.sql("insert into clients (full_name, email, organization_id) values ('Acme Owner','client@acme.test',$1)", [org]);
  await env.sql("insert into leads (name, email, organization_id) values ('Real Inbound Lead','lead@real.test',$1)", [org]);
  await env.reload();
  // Nova-owned TEST catalog values (not real prices)
  await env.sql("update products set sales_readiness='available_for_sale', sales_info_reviewed=true, sales_info='{\"what_it_is\":\"test\"}', pricing_approved=true, pricing_config='{\"unit_price_cents\":50000,\"billing\":\"one_time\"}' where slug='nova-audit-digital'");
  const auditId = (await env.sql("select id from products where slug='nova-audit-digital'")).rows[0].id;
  const waveId = (await env.sql("select id from products where slug='nova-wave-one'")).rows[0].id;

  // ==================================================================================================================
  // JOURNEY A — CANDIDATE
  // ==================================================================================================================
  const profile = { name: 'Jane Applicant', phone: '(203) 555-0142', city: 'Waterbury, CT', timezone: 'America/New_York', hours_per_week: 20, availability_days: ['mon', 'tue', 'thu'], preferred_hours: 'Evenings', experience: 'Two years of retail and customer service; I enjoy helping owners solve problems.', channels: ['telephone', 'email'], motivation: 'I like working with small business owners and I want structured training before I talk to anyone.', scenario_no_data: 'I would say I cannot know yet; I would ask about their calls, follow-up and website, and offer a diagnostic first without promising a number.', scenario_objection: 'I would ask how new customers currently find and contact them, and what happens to those who do not get an answer.', ack_privacy: true, ack_truthful: true, ack_no_guarantee: true, ack_conduct: true };
  let r = await apply('start', { body: { email: 'jane@applicant.test' } });
  const link = (await env.sql("select body from sales_notifications where kind='apply_link' and email='jane@applicant.test'")).rows[0].body.match(/http[^\s]+/)[0];
  const jane = env.stubServer.consumeMagicLink(link);
  r = await apply('submit', { token: jane.access_token, body: { profile } });
  const ref = r.body.reference_code;
  check('A1 — an applicant applies on the public form, gets a reference code, and only their own status', r.status === 200 && /^NOVA-/.test(ref));
  const app = (await env.sql("select id from applications where email_normalized='jane@applicant.test'")).rows[0].id;
  r = await hiring('assign', { token: owner.token, body: { id: app, reviewer_id: mgr.id } });
  r = await hiring('evaluate', { token: mgr.token, body: { id: app, kind: 'review', scores: { communication: 4, curiosity: 5, honesty_ethics: 5 }, recommendation: 'advance', notes: 'Diagnostics-first instincts. Private reviewer note.' } });
  r = await hiring('decide', { token: owner.token, body: { id: app, decision: 'accept', reason: 'Strong scenario answers; honest about limits.' } });
  check('A2 — reviewer assesses; ONLY the owner accepts (server-side)', r.status === 200 && (await env.sql('select status from applications where id=$1', [app])).rows[0].status === 'accepted');
  r = await hiring('invite', { token: owner.token, body: { id: app } });
  const joinToken = r.body.dev_link.split('/join/')[1];
  check('A3 — secure single-use invitation (dry run: link returned to the owner only, nothing emailed)', r.status === 200 && env.stubs.outbox.length === 0);
  r = await apply('accept-invitation', { body: { token: joinToken, password: 'A-very-long-passphrase-1' } });
  const jane2 = await (await fetch(`${env.base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jane@applicant.test', password: 'A-very-long-passphrase-1' }) })).json();
  const cand = { id: (await env.sql("select id from auth.users where email='jane@applicant.test'")).rows[0].id, token: jane2.access_token };
  await env.reload();
  const repRow = (await env.sql('select id, status from sales_reps where user_id=$1', [cand.id])).rows[0];
  check('A4 — invitation accepted: a CANDIDATE account (not a rep) with 10 enrollments', r.status === 200 && repRow.status === 'candidate' && (await env.sql('select role from organization_members where staff_user_id=$1', [cand.id])).rows[0].role === 'nova_sales_candidate' && (await env.sql('select count(*) from academy_enrollments where staff_user_id=$1', [cand.id])).rows[0].count === '10');
  await team('set-manager', { token: owner.token, body: { rep_id: repRow.id, manager_user_id: mgr.id } });
  // candidate boundaries
  r = await leads('home', { method: 'GET', token: cand.token });
  const c1 = r.status === 403;
  r = await cat('products', { method: 'GET', token: cand.token });
  const c2 = r.status === 403;
  r = await comm('earnings', { method: 'GET', token: cand.token });
  const c3 = r.status === 403;
  const dLeads = await env.rest(cand.token, 'leads?select=id'); const dClients = await env.rest(cand.token, 'clients?select=id'); const dDeals = await env.rest(cand.token, 'crm_deals?select=id');
  check('A5 — a candidate has NO leads, catalog, earnings, or real client data (API and database)', c1 && c2 && c3 && [dLeads, dClients, dDeals].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  r = await team('activate', { token: cand.token, body: { rep_id: repRow.id, confirm: true } });
  check('A6 — a candidate cannot activate themselves', r.status === 403);

  // ---- Academy: all ten programs
  const programsList = (await env.sql('select id, slug, requires_practical, critical_compliance from academy_programs order by order_index')).rows;
  const key = async (pid) => (await env.sql('select order_index, correct_index from academy_quiz_questions where program_id=$1 order by order_index', [pid])).rows;
  const answers = async (pid) => (await key(pid)).map((q) => ({ question_order: q.order_index, choice_index: q.correct_index }));
  let completedPrograms = 0; const certs = [];
  for (const pg of programsList) {
    const lessons = (await env.sql('select order_index from academy_lessons where program_id=$1 order by order_index', [pg.id])).rows;
    for (const l of lessons) await A('complete-lesson', { token: cand.token, body: { program_id: pg.id, lesson_order: l.order_index } });
    const ex = (await env.sql('select id from academy_exercises where program_id=$1 order by order_index limit 1', [pg.id])).rows[0];
    if (ex) await A('submit-exercise', { token: cand.token, body: { exercise_id: ex.id, response: 'My own attempt at this exercise, written before looking at the model answer.' } });
    r = await A('submit-quiz', { token: cand.token, body: { program_id: pg.id, answers: await answers(pg.id) } });
    if (pg.requires_practical) {
      const prompt = (await A('program-detail', { method: 'GET', token: cand.token, query: { id: pg.id } })).body.program;
      await A('submit-practical', { token: cand.token, body: { program_id: pg.id, response: `${pg.slug} practical write-up: I prepared a true observation, asked diagnostic questions first, answered one objection honestly without promises, asked for one small next step, and logged it factually. `.repeat(3) } });
      const q = await A('practical-queue', { method: 'GET', token: mgr.token });
      const sub = q.body.find((x) => x.program && x.learner.id === cand.id); const scores = Object.fromEntries((sub.rubric || prompt.practical_rubric).map((c) => [c.key, 4]));
      await A('review-practical', { token: mgr.token, body: { submission_id: sub.id, decision: 'approve', feedback: 'Diagnosis-first, no promises, clear next step. Approved.', rubric_scores: scores } });
    }
    const st = (await env.sql('select status from academy_enrollments where staff_user_id=$1 and program_id=$2', [cand.id, pg.id])).rows[0].status;
    if (st === 'completed') { completedPrograms++; const c = await A('issue-certificate', { token: cand.token, body: { program_id: pg.id } }); if (c.status === 200) certs.push(c.body.certificate); }
  }
  check('A7 — all ten programs completed through real lessons, server-graded quizzes and reviewer-approved practicals (6 and 7)', completedPrograms === 10);
  check('A8 — ten certificates issued, each with a unique ID, only after requirements; provisional policy is labelled', certs.length === 10 && new Set(certs.map((c) => c.certificate_number)).size === 10 && certs.every((c) => c.policy_provisional === true));
  const v = await A('verify-certificate', { method: 'GET', query: { code: certs[0].verification_code } });
  check('A9 — public verification returns minimal PII and the not-accredited disclaimer', v.status === 200 && v.body.holder_name === 'Jane A.' && /not an accredited/.test(v.body.disclaimer) && !/applicant\.test/.test(JSON.stringify(v.body)));
  r = await team('my-checklist', { method: 'GET', token: cand.token });
  check('A10 — ALL training done, and still NOT activated: the checklist shows what is outstanding', r.body.status === 'candidate' && r.body.items.find((i) => i.key === 'training_complete').done && !r.body.ready);

  // ---- agreements
  const publish = async (key) => { const s = await docs('save-version', { token: owner.token, body: { template_key: key, body: AGREEMENT(key) } }); await docs('approve-version', { token: owner.token, body: { version_id: s.body.version.id, confirm_reviewed: true } }); };
  for (const k of ['working_agreement', 'compensation_schedule', 'confidentiality', 'acceptable_use']) await publish(k);
  const signed = [];
  for (const k of ['working_agreement', 'compensation_schedule', 'confidentiality', 'acceptable_use']) {
    const s = await docs('send', { token: owner.token, body: { template_key: k, user_ids: [cand.id] } }); const id = s.body.results[0].request_id;
    const view = await docs('view', { method: 'GET', token: cand.token, query: { id } });
    const sg = await docs('sign', { token: cand.token, body: { request_id: id, typed_name: 'Jane Applicant', consent: true, content_hash: view.body.content_hash } }); signed.push({ k, id, ok: sg.status === 200 });
  }
  for (const s of signed.filter((x) => ['working_agreement', 'compensation_schedule'].includes(x.k))) await docs('countersign', { token: owner.token, body: { request_id: s.id, typed_name: 'Isaac Nova' } });
  const integrity = await docs('verify', { method: 'GET', token: owner.token, query: { id: signed[0].id } });
  check('A11 — four agreements signed with e-sign consent, server timestamps, hash-chained trail; two countersigned by the owner', signed.every((s) => s.ok) && integrity.body.intact === true);
  const dl = await docs('download', { method: 'GET', token: cand.token, query: { id: signed[0].id } });
  check('A12 — the signer downloads a signed PDF copy', dl.status === 200 && Buffer.from(dl.body).toString('latin1').startsWith('%PDF-'));

  // ---- activation (explicit owner action)
  r = await team('activate', { token: owner.token, body: { rep_id: repRow.id, confirm: true } });
  check('A13 — activation is refused until operational setup is verified (with evidence)', r.status === 409 && r.body.outstanding.some((o) => o.key === 'operational_setup'));
  for (const k of ['crm_access_verified', 'toolkit_walkthrough', 'communication_channel']) await team('mark-setup', { token: owner.token, body: { rep_id: repRow.id, item_key: k, evidence: 'Verified live with the rep on a call with the manager' } });
  r = await team('activate', { token: owner.token, body: { rep_id: repRow.id, confirm: true } });
  const act = (await env.sql('select r.status, m.role from sales_reps r join organization_members m on m.staff_user_id=r.user_id where r.user_id=$1', [cand.id])).rows[0];
  check('A14 — the OWNER activates: status active, role nova_sales, approval snapshot stored', r.status === 200 && act.status === 'active' && act.role === 'nova_sales' && (await env.sql('select count(*) from sales_activation_approvals where rep_id=$1', [repRow.id])).rows[0].count === '1');
  const rep = { id: cand.id, token: (await (await fetch(`${env.base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jane@applicant.test', password: 'A-very-long-passphrase-1' }) })).json()).access_token };
  await env.reload();
  r = await leads('home', { method: 'GET', token: rep.token });
  check('A15 — the activated rep now has a workspace (and still sees no other rep\'s data)', r.status === 200 && r.body.counts.open === 0);

  // ==================================================================================================================
  // JOURNEY B — REPRESENTATIVE
  // ==================================================================================================================
  r = await comm('plan', { method: 'GET', token: fin.token });
  check('B0 — before the owner approves a commission plan, none exists (no invented rates)', r.body.approved === null);
  r = await comm('save-plan', { token: owner.token, body: { plan: { rules: [{ product_slug: '*', type: 'percent', percent_bp: 1000 }], conditions: { require_payment_received: true, holdback_days: 0 } } } });
  await comm('approve-plan', { token: owner.token, body: { config_id: r.body.config.id, confirm: true } }); // TEST PLAN
  r = await leads('owner-create', { token: owner.token, body: { business_name: 'Journey Test Plumbing', website: 'https://journeytestplumbing.test', phone: '203-555-0300', city: 'Waterbury', contact_name: 'Pat Owner', contact_email: 'pat@journeytestplumbing.test', assign_to: rep.id } });
  const deal = r.body.deal_id;
  check('B1 — the owner assigns a lead; the rep sees it, and the assignment is recorded with history', r.status === 200 && (await leads('list', { method: 'GET', token: rep.token })).body.some((d) => d.id === deal) && (await env.sql('select count(*) from sales_lead_assignments where deal_id=$1', [deal])).rows[0].count === '1');
  const move = (to, extra = {}) => leads('move', { token: rep.token, body: { deal_id: deal, to, ...extra } });
  await leads('log-activity', { token: rep.token, body: { deal_id: deal, kind: 'call', body: 'Called and spoke with the owner about how calls are handled', outcome: 'spoke_with_contact' } });
  await move('contacted'); await move('qualified', { qualification: { summary: 'Owner-operated plumbing shop; the owner answers his own phone in the van.', decision_maker: 'yes' } });
  await move('discovery_scheduled', { discovery_at: new Date(Date.now() + 86400000).toISOString() });
  r = await move('discovery_completed', { discovery: { how_customers_reach_them: 'Mostly phone calls and some walk-ins', what_happens_to_missed_inquiries: 'Voicemail, called back next morning', current_follow_up_process: 'None written down', findings: 'After-hours calls go to voicemail with no callback routine.' } });
  check('B2 — pipeline New → Contacted → Qualified → Discovery Scheduled → Discovery Completed, each with its entry rule and recorded history', r.status === 200 && (await env.sql('select count(*) from sales_deal_stage_events where deal_id=$1', [deal])).rows[0].count === '5');
  r = await prop('create', { token: rep.token, body: { deal_id: deal, items: [{ product_id: waveId, quantity: 1 }], scope_summary: 'Set up after-hours call handling and a written follow-up routine, based on discovery.' } });
  check('B3 — an offering that is not Available for Sale cannot be proposed', r.status === 422);
  r = await prop('create', { token: rep.token, body: { deal_id: deal, items: [{ product_id: auditId, quantity: 1 }], scope_summary: 'Review how calls and inquiries are handled and write up findings with evidence, based on what we learned in discovery.' } });
  const proposal = r.body.proposal;
  r = await prop('send', { token: rep.token, body: { proposal_id: proposal.id } });
  const ptoken = r.body.dev_link.split('/proposal/')[1];
  check('B4 — proposal priced from the approved catalog, sent (dry run: link shown to the rep only); lead → Awaiting Signature/Payment', r.status === 200 && proposal.total_cents === 50000 && env.stubs.outbox.length === 0 && (await env.sql('select stage from crm_deals where id=$1', [deal])).rows[0].stage === 'awaiting_signature_payment');
  const pv = (await cprop('view', { method: 'GET', query: { token: ptoken } })).body;
  r = await cprop('sign', { body: { token: ptoken, typed_name: 'Pat Owner', consent: true, content_hash: pv.content_hash } });
  check('B5 — the CLIENT signs through a personal link (server-stamped, hash-recorded)', r.status === 200 && (await env.sql('select signed_agreement_at from crm_deals where id=$1', [deal])).rows[0].signed_agreement_at !== null);
  r = await cprop('pay', { body: { token: ptoken } });
  const sess = (await env.sql('select id, provider_session_id, amount_cents from sales_payments where proposal_id=$1', [proposal.id])).rows[0];
  check('B6 — payment link created on the provider-hosted page for exactly the proposal amount', r.status === 200 && sess.amount_cents === 50000 && stripeCalls.some((c) => c.body.get('line_items[0][price_data][unit_amount]') === '50000'));
  r = await prop('submit-for-verification', { token: rep.token, body: { deal_id: deal, evidence: 'Client signed through the link and is paying online today.' } });
  const d1 = (await env.sql('select stage, rep_reported_close_at, owner_verified_at, payment_received_at, fulfillment_started_at from crm_deals where id=$1', [deal])).rows[0];
  check('B7 — the rep REPORTS a close; that is not a verified sale, not a payment, not fulfillment', r.status === 200 && d1.stage === 'submitted_for_verification' && d1.rep_reported_close_at && !d1.owner_verified_at && !d1.payment_received_at && !d1.fulfillment_started_at);
  const paidEvent = { id: 'evt_journey_pay', type: 'checkout.session.completed', data: { object: { id: sess.provider_session_id, payment_status: 'paid', amount_total: 50000, currency: 'usd', payment_intent: 'pi_journey', metadata: { sales_payment_id: sess.id } } } };
  let w = await webhook(paidEvent); const dup = await webhook(paidEvent);
  check('B8 — the verified provider event marks it paid; a DUPLICATE delivery is harmless', w.code === 200 && dup.code === 200 && (await env.sql("select status from sales_payments where id=$1", [sess.id])).rows[0].status === 'paid' && (await env.sql("select count(*) from sales_provider_events where event_id='evt_journey_pay'")).rows[0].count === '1');
  const ver = (await prop('queue', { method: 'GET', token: owner.token })).body.verifications[0];
  r = await prop('verify', { token: owner.token, body: { verification_id: ver.id, decision: 'approve', notes: 'Signature and payment confirmed in Nova (provider event)' } });
  check('B9 — the OWNER verifies: Won, handoff creates the customer org + order + follow-up task (once)', r.status === 200 && r.body.handoff.orders_created === 1 && r.body.handoff.customer_org_created && (await env.sql("select stage from crm_deals where id=$1", [deal])).rows[0].stage === 'won');
  let eC = (await env.sql("select * from sales_commission_entries where deal_id=$1", [deal])).rows[0];
  check('B10 — commission entry follows the APPROVED plan (10% of 50,000 = 5,000), snapshot v1, and is Eligible because payment is confirmed', eC.amount_cents === 5000 && eC.plan_snapshot.plan_version === 1 && eC.status === 'eligible');
  r = await comm('approve-entries', { token: fin.token, body: { entry_ids: [eC.id] } });
  r = await comm('create-batch', { token: fin.token, body: { mode: 'external_record', entry_ids: [eC.id] } });
  const batch = r.body.batch;
  r = await comm('approve-batch', { token: owner.token, body: { batch_id: batch.id, confirm_total_cents: 5000, confirm_count: 1 } });
  const payout = (await env.sql('select id from sales_payouts where batch_id=$1', [batch.id])).rows[0];
  r = await comm('record-external', { token: owner.token, body: { payout_id: payout.id, method: 'ach', reference: 'ACH-TEST-1', evidence: 'ACH test reference 1 recorded from the Nova bank test statement' } });
  r = await comm('earnings', { method: 'GET', token: rep.token });
  check('B11 — finance approves → owner approves the concrete batch → owner records the payment; the rep sees Paid labelled "not provider-confirmed"', r.body.summary.paid_cents === 5000 && r.body.payouts[0].confirmation.includes('not provider-confirmed') && r.body.summary.estimated_not_earned_cents === 0);

  // ==================================================================================================================
  // JOURNEY C — OWNER
  // ==================================================================================================================
  const dash = (await team('dashboard', { method: 'GET', token: owner.token })).body;
  check('C1 — the HQ dashboard reflects the real journey: applicant accepted, invitation accepted, 1 active rep, 1 verified sale', dash.applicants.by_status.accepted === 1 && dash.applicants.invitations.accepted === 1 && dash.reps.by_status.active === 1 && dash.reps.per_rep[0].verified_sales === 1 && dash.pipeline.by_stage.won === 1);
  check('C2 — money is separated: pipeline is not revenue; collected is provider-confirmed; commissions Paid = 5,000', dash.money.verified_sales_cents === 50000 && dash.money.collected_provider_confirmed_cents === 50000 && dash.money.collected_owner_recorded_cents === 0 && dash.commissions.paid_cents === 5000);
  const rd = (await team('rep', { method: 'GET', token: owner.token, query: { id: repRow.id } })).body;
  check('C3 — the per-rep record shows training, documents, leads, checklist, status history and the ledger', rd.training.length === 10 && Object.keys(rd.documents).length === 4 && rd.leads.total === 1 && rd.ledger.summary.paid_cents === 5000 && rd.checklist.items.length === 7);
  const auditActions = (await env.sql('select distinct action from sales_audit_log')).rows.map((x) => x.action);
  check('C4 — the durable audit trail recorded the decisions (acceptance, invitation, activation, signatures, sale verification, commission, payout)', ['invitation_created', 'activated', 'signed', 'sale_verified', 'commission_paid', 'payout_recorded_external', 'proposal_sent'].every((a) => auditActions.includes(a)), auditActions.join());
  const ledger = (await comm('ledger', { method: 'GET', token: fin.token, query: { entry_id: eC.id } })).body;
  check('C5 — every ledger step is an immutable event, in order', ledger.events.map((e) => e.to_status).join() === 'estimated,pending_conditions,eligible,owner_approved,scheduled,paid', ledger.events.map((e) => e.to_status).join());
  const rep2 = (await comm('report', { method: 'GET', token: fin.token })).body;
  check('C6 — the finance report separates statuses and counts exceptions', rep2.totals.paid_cents === 5000 && rep2.payout_failures === 0 && rep2.open_adjustments === 0);
  r = await comm('export-csv', { method: 'GET', token: fin.token });
  check('C7 — the ledger exports to CSV', r.status === 200 && String(r.body).includes('NaN') === false && String(r.body).split('\n').length >= 2);

  // ==================================================================================================================
  // JOURNEY D — NEGATIVE CASES
  // ==================================================================================================================
  // -- isolation
  const other = await env.createUser({ email: 'rep2@nova.test', role: 'nova_sales', orgId: org, name: 'Other Rep' });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$2,'Other Rep','active',$3)", [other.id, org, mgr2.id]); await env.reload();
  r = await leads('get', { method: 'GET', token: other.token, query: { id: deal } });
  check("D1 — REP ISOLATION: another rep cannot open this rep's lead (404)", r.status === 404);
  r = await prop('for-deal', { method: 'GET', token: other.token, query: { deal_id: deal } });
  check("D2 — ...nor its proposals, payments or verification", r.status === 404);
  r = await comm('earnings', { method: 'GET', token: other.token });
  check("D3 — ...nor its earnings (each rep sees only their own ledger)", r.body.entries.length === 0);
  r = await team('rep', { method: 'GET', token: mgr2.token, query: { id: repRow.id } });
  check("D4 — a manager cannot open another manager's rep", r.status === 403);
  const dCl = await env.rest(clientUser.token, 'crm_deals?select=id'); const dInv = await env.rest(clientUser.token, 'sales_commission_entries?select=id'); const dLd = await env.rest(clientUser.token, 'leads?select=id');
  check('D5 — CLIENT ISOLATION: a client-org user reads none of Nova\'s deals, commissions or leads', [dCl, dInv, dLd].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  r = await leads('home', { method: 'GET', token: clientUser.token });
  check('D6 — ...and has no sales workspace', r.status === 403);
  const anonProp = await env.rest(null, 'crm_proposals?select=client_token_hash'); const anonKey = await env.rest(null, 'academy_quiz_questions?select=correct_index'); const anonDoc = await env.rest(null, 'sales_document_requests?select=signature_hash');
  check('D7 — the ANONYMOUS role reads no proposal tokens, no quiz answers, no signed documents', [anonProp, anonKey, anonDoc].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  const repKey = await env.rest(rep.token, 'academy_quiz_questions?select=correct_index'); const repDocs = await env.rest(other.token, 'sales_document_requests?select=id');
  check("D8 — a signed-in rep cannot read the answer key, and cannot read another person's signed documents", [repKey, repDocs].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  const detail = await A('program-detail', { method: 'GET', token: rep.token, query: { id: programsList[0].id } });
  const quizResult = await A('submit-quiz', { token: other.token, body: { program_id: programsList[0].id, answers: [] } });
  check('D9 — quiz answers and explanations never appear in API responses', !/"correct_index"/.test(JSON.stringify(detail.body)) && quizResult.status !== 200);
  // -- escalation / self-promotion
  const esc = await env.rest(rep.token, `organization_members?staff_user_id=eq.${rep.id}`, { method: 'PATCH', body: { role: 'nova_super_admin' } });
  check('D10 — a rep cannot promote themselves through the database API', (await env.sql('select role from organization_members where staff_user_id=$1', [rep.id])).rows[0].role === 'nova_sales');
  const grant = await env.rest(rep.token, 'role_permissions', { method: 'POST', body: { role: 'nova_sales', permission_id: (await env.sql("select id from permissions where key='sales.owner'")).rows[0].id } });
  check('D11 — ...nor grant a role the owner-only permission', (await env.sql("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role='nova_sales' and p.key='sales.owner'")).rows[0].count === '0');
  r = await teamApi({ op: 'update-role', token: rep.token, body: { staff_user_id: rep.id, role: 'nova_super_admin' } });
  check('D12 — nor through the team API', [401, 403].includes(r.status) && (await env.sql('select role from organization_members where staff_user_id=$1', [rep.id])).rows[0].role === 'nova_sales');
  for (const [res, op, body] of [['salesteam', 'activate', { rep_id: repRow.id, confirm: true }], ['hiring', 'decide', { id: app, decision: 'accept', reason: 'self approve attempt' }], ['commissions', 'save-plan', { plan: { rules: [{ product_slug: '*', type: 'percent', percent_bp: 10000 }] } }], ['proposals', 'verify', { verification_id: 'x', decision: 'approve', notes: 'self verify attempt here' }], ['catalog', 'set-pricing', { product_id: auditId, unit_price_cents: 100, billing: 'one_time', confirm: true }], ['salespay', 'record-manual', { proposal_id: proposal.id, amount_cents: 50000, method: 'cash', evidence: 'forged payment evidence text' }], ['commissions', 'approve-batch', { batch_id: batch.id }]]) {
    const x = await call({ resource: res, op, token: rep.token, body });
    check(`D13 — a rep is refused owner-only "${res}.${op}"`, x.status === 403, `${x.status}`);
  }
  // -- forged close / payment / signature
  const deal2 = (await leads('owner-create', { token: owner.token, body: { business_name: 'Forgery Test Co', website: 'https://forgerytest.test', phone: '203-555-0400', city: 'Hartford', contact_name: 'Fay Ker', contact_email: 'fay@forgerytest.test', assign_to: rep.id } })).body.deal_id;
  await leads('log-activity', { token: rep.token, body: { deal_id: deal2, kind: 'call', body: 'Called owner about handling of calls' } });
  r = await leads('move', { token: rep.token, body: { deal_id: deal2, to: 'won' } });
  check('D14 — FORGED CLOSE: a rep cannot move a card to Won', r.status === 422 && (await env.sql('select stage from crm_deals where id=$1', [deal2])).rows[0].stage === 'new');
  r = await prop('submit-for-verification', { token: rep.token, body: { deal_id: deal2, evidence: 'I closed it, honest, trust me, it is done and signed for sure.' } });
  check('D15 — ...nor submit a lead that never reached a proposal', r.status === 409);
  const forged = { id: 'evt_forged', type: 'checkout.session.completed', data: { object: { id: sess.provider_session_id, payment_status: 'paid', amount_total: 1, currency: 'usd', metadata: { sales_payment_id: sess.id } } } };
  const ts = Math.floor(Date.now() / 1000); const raw = Buffer.from(JSON.stringify(forged)); const badSig = crypto.createHmac('sha256', 'wrong-secret').update(`${ts}.${raw}`).digest('hex');
  const fr = Object.assign(Readable.from([raw]), { method: 'POST', query: {}, headers: { 'stripe-signature': `t=${ts},v1=${badSig}`, 'x-forwarded-for': '203.0.113.51' } }); const fres = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json() { return this; }, end() { return this; } }; await stripeHandler(fr, fres);
  check('D16 — FORGED PAYMENT: a webhook with a bad signature is rejected and recorded nowhere', fres.code === 400 && (await env.sql("select count(*) from sales_provider_events where event_id='evt_forged'")).rows[0].count === '0');
  { let e = null; try { await env.sql("update crm_proposals set signer_name='Forged Signer' where id=$1", [proposal.id]); } catch (x) { e = x.message; } check('D17 — FORGED SIGNATURE: a signed proposal cannot be edited even with database access', /immutable|cannot be edited/.test(e || ''), e); }
  { let e = null; try { await env.sql("update sales_commission_entries set amount_cents=999999 where id=$1", [eC.id]); } catch (x) { e = x.message; } check('D18 — FORGED COMMISSION: amounts are frozen at the database', /frozen/.test(e || ''), e); }
  { let e = null; try { await env.sql("update sales_payouts set status='failed' where id=$1", [payout.id]); } catch (x) { e = x.message; } check('D19 — a paid payout cannot be altered', /immutable/.test(e || ''), e); }
  r = await comm('record-external', { token: owner.token, body: { payout_id: payout.id, method: 'ach', evidence: 'Recording the same payout a second time by mistake' } });
  check('D20 — RETRIED PAYOUT: recording it again is refused (no double payment)', r.status === 409 && (await env.sql("select count(*) from sales_payouts where entry_id=$1", [eC.id])).rows[0].count === '1');
  r = await comm('approve-batch', { token: owner.token, body: { batch_id: batch.id, confirm_total_cents: 5000, confirm_count: 1 } });
  check('D21 — ...and re-approving the batch creates no second payout', r.status === 409 && (await env.sql("select count(*) from sales_payouts")).rows[0].count === '1');
  // -- unapproved discount
  await leads('log-activity', { token: rep.token, body: { deal_id: deal2, kind: 'call', body: 'Second call, discussed scope with the owner' } });
  for (const [to, x] of [['contacted', {}], ['qualified', { qualification: { summary: 'Owner-run shop with a single phone line.', decision_maker: 'yes' } }], ['discovery_scheduled', { discovery_at: new Date(Date.now() + 86400000).toISOString() }], ['discovery_completed', { discovery: { how_customers_reach_them: 'Phone calls and walk-ins', what_happens_to_missed_inquiries: 'Voicemail only', current_follow_up_process: 'None at all', findings: 'Calls after hours are not answered and there is no callback routine.' } }]]) await leads('move', { token: rep.token, body: { deal_id: deal2, to, ...x } });
  r = await prop('create', { token: rep.token, body: { deal_id: deal2, items: [{ product_id: auditId, quantity: 1 }], scope_summary: 'Review how calls and inquiries are handled and write up findings with evidence, per discovery.', discount_cents: 10000, discount_reason: 'Client asked for a lower price on the first engagement' } });
  const dprop = r.body.proposal;
  r = await prop('send', { token: rep.token, body: { proposal_id: dprop.id } });
  check('D22 — UNAPPROVED DISCOUNT: the proposal cannot be sent until the owner approves the discount', r.status === 409 && dprop.discount_status === 'requested');
  r = await prop('decide-discount', { token: rep.token, body: { proposal_id: dprop.id, decision: 'approve', note: 'approving my own discount' } });
  check('D23 — ...and the rep cannot approve it themselves', r.status === 403);
  // -- guarantees / prohibited claims
  r = await prop('update-draft', { token: rep.token, body: { deal_id: deal2, proposal_id: dprop.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: 'We guarantee this will double your leads within a month of starting.' } });
  check('D24 — a proposal promising results is refused', r.status === 422 && r.body.claims.length > 0);
  // -- suspension
  r = await team('suspend', { token: owner.token, body: { rep_id: repRow.id, reason: 'Acceptance-test suspension check' } });
  const s1 = await leads('home', { method: 'GET', token: rep.token }); const s2 = await comm('earnings', { method: 'GET', token: rep.token }); const s3 = await prop('send', { token: rep.token, body: { proposal_id: dprop.id } });
  check('D25 — SUSPENDED REP: locked out of leads, earnings and proposals immediately', r.status === 200 && [s1, s2, s3].every((x) => x.status === 403));
  check('D26 — ...but history is kept (leads, ledger, signed documents, enrollments)', (await env.sql('select count(*) from crm_deals where assigned_rep_id=$1', [rep.id])).rows[0].count !== '0' && (await env.sql('select count(*) from sales_commission_entries where rep_user_id=$1', [rep.id])).rows[0].count === '1' && (await env.sql("select count(*) from sales_document_requests where signer_user_id=$1 and status='signed'", [rep.id])).rows[0].count === '4');
  r = await leads('reassign-from-rep', { token: owner.token, body: { from_user_id: rep.id, to_user_id: other.id, reason: 'Rep suspended during acceptance test' } });
  check('D27 — the owner reassigns the suspended rep\'s open leads; the verified sale stays credited to them', r.status === 200 && (await env.sql("select count(*) from crm_deals where assigned_rep_id=$1 and stage='won'", [rep.id])).rows[0].count === '1');
  r = await docs('view', { method: 'GET', token: rep.token, query: { id: signed[0].id } });
  check('D28 — a suspended account cannot open or sign documents', r.status === 403);
  // -- exposure of private documents / applications
  r = await hiring('get', { method: 'GET', token: other.token, query: { id: app } });
  check('D29 — an ordinary rep cannot read anyone\'s application or reviewer notes', r.status === 403);
  const me = await apply('me', { method: 'GET', token: jane.access_token });
  check('D30 — the applicant\'s own view never contains reviewer notes or scores', me.status === 200 && !JSON.stringify(me.body).includes('Private reviewer note') && !/evaluation/i.test(JSON.stringify(me.body)));
  // -- suspended → reactivation is an owner decision
  r = await team('reactivate', { token: mgr.token, body: { rep_id: repRow.id, reason: 'manager trying to reactivate' } });
  check('D32 — a manager cannot reactivate a suspended rep', r.status === 403);
  r = await notif('run-maintenance', { token: owner.token, body: {} });
  check('D33 — the maintenance sweep runs cleanly at the end of the journey', r.status === 200);
  console.log(`\nJourney records persisted in the disposable database: ${(await env.sql('select count(*) from crm_deals')).rows[0].count} deals, ${(await env.sql('select count(*) from sales_commission_events')).rows[0].count} ledger events, ${(await env.sql('select count(*) from sales_audit_log')).rows[0].count} audit records, ${(await env.sql('select count(*) from sales_document_events')).rows[0].count} document events.`);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { srv.close(); await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
