// Proposals → client signature → payment → submission → owner verification → fulfillment handoff, plus discount/price/custom-scope controls.
// Runs the REAL handlers (api/client.js, api/stripe.js) against REAL PostgreSQL + PostgREST (local, disposable).
// Stripe is a LOCAL STAND-IN server (no Stripe account, no network, no charges). Webhook signatures are computed with a test secret.
import http from 'node:http';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
// ---- local Stripe stand-in
const stripeReqs = [];
const stripeSrv = http.createServer((req, res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { stripeReqs.push({ url: req.url, auth: req.headers.authorization, idem: req.headers['idempotency-key'], body: new URLSearchParams(d) }); res.setHeader('Content-Type', 'application/json'); if (req.url.endsWith('/checkout/sessions')) { const id = `cs_test_${stripeReqs.length}`; res.end(JSON.stringify({ id, url: `https://checkout.stripe.test/pay/${id}` })); } else { res.statusCode = 404; res.end('{}'); } }); });
await new Promise((r) => stripeSrv.listen(0, '127.0.0.1', r));
const STRIPE_BASE = `http://127.0.0.1:${stripeSrv.address().port}/v1`;
const WHSEC = 'whsec_local_test_secret';
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run', STRIPE_WEBHOOK_SECRET: WHSEC });
delete process.env.STRIPE_SECRET_KEY;
const { default: handler } = await import('../api/client.js');
const { default: stripeHandler } = await import('../api/stripe.js');
const { handoffFulfillment } = await import('../api/_sales/proposals.js');
const call = makeCaller(handler);
const P = (op, o = {}) => call({ resource: 'proposals', op, ...o });
const L = (op, o = {}) => call({ resource: 'leads', op, ...o });
const CP = (op, o = {}) => call({ resource: 'clientproposal', op, ...o });
const PAY = (op, o = {}) => call({ resource: 'salespay', op, ...o });

// webhook helper: raw body + signature
const webhook = async (event, { secret = WHSEC, ts = Math.floor(Date.now() / 1000), sign = true } = {}) => {
  const raw = Buffer.from(JSON.stringify(event)); const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw.toString('utf8')}`).digest('hex');
  const req = Object.assign(Readable.from([raw]), { method: 'POST', query: {}, headers: { 'stripe-signature': sign ? `t=${ts},v1=${sig}` : 'bogus', 'x-forwarded-for': '203.0.113.9' } });
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await stripeHandler(req, res); return res;
};
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const repA = await env.createUser({ email: 'a@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Alpha' });
  const repB = await env.createUser({ email: 'b@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Bravo' });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$3,'Rep Alpha','active',$2), ($4,$3,'Rep Bravo','active',$2)", [repA.id, mgr.id, org, repB.id]);
  // Offerings — TEST VALUES ONLY (these are not Nova prices): audit available for sale at 50,000 cents; wave one left as Draft.
  await env.sql("update products set sales_readiness='available_for_sale', sales_info_reviewed=true, sales_info='{\"what_it_is\":\"test\"}', pricing_approved=true, pricing_config='{\"unit_price_cents\":50000,\"billing\":\"one_time\"}' where slug='nova-audit-digital'");
  await env.sql("update products set sales_readiness='available_for_sale', pricing_approved=true, pricing_config='{\"unit_price_cents\":20000,\"billing\":\"monthly\"}' where slug='lead-capture'");
  await env.reload();
  const prod = async (slug) => (await env.sql('select id from products where slug=$1', [slug])).rows[0].id;
  const auditId = await prod('nova-audit-digital'), captureId = await prod('lead-capture'), waveId = await prod('nova-wave-one');

  // ---- helper: a lead taken to Discovery Completed through the real API
  let n = 0;
  const leadAt = async (rep, stop = 'discovery_completed', o = {}) => {
    n++; const c = await L('create', { token: rep.token, body: { business_name: `Test Biz ${n} ${Date.now()}`, website: `https://testbiz${n}${Date.now()}.test`, phone: `20355${String(5000 + n).padStart(5, '0')}`, city: 'Waterbury', contact_name: `Contact ${n}`, contact_email: `contact${n}@testbiz${n}.test`, ...o } });
    const id = c.body.deal_id; const go = (to, extra = {}) => L('move', { token: rep.token, body: { deal_id: id, to, ...extra } });
    await L('log-activity', { token: rep.token, body: { deal_id: id, kind: 'call', body: 'Called and spoke with the owner' } });
    const order = [['contacted', {}], ['qualified', { qualification: { summary: 'Owner-operated shop, answers phones personally.', decision_maker: 'yes' } }], ['discovery_scheduled', { discovery_at: new Date(Date.now() + 86400000).toISOString() }], ['discovery_completed', { discovery: { how_customers_reach_them: 'Phone and walk-ins', what_happens_to_missed_inquiries: 'Voicemail', current_follow_up_process: 'None written', findings: 'After-hours calls go to voicemail with no callback routine.' } }]];
    for (const [to, extra] of order) { await go(to, extra); if (to === stop) break; }
    return id;
  };
  const scope = 'Set up after-hours call handling and a written follow-up routine for the shop, based on what we found in discovery.';
  const draft = (dealId, extra = {}) => P('create', { token: repA.token, body: { deal_id: dealId, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope, title: 'Nova Audit proposal', ...extra } });

  // ================================================================== creating proposals
  const early = await leadAt(repA, 'qualified');
  let r = await draft(early);
  check('a proposal cannot be written before discovery is completed', r.status === 409);
  const deal1 = await leadAt(repA);
  r = await P('create', { token: repA.token, body: { deal_id: deal1, items: [{ product_id: waveId, quantity: 1 }], scope_summary: scope } });
  check('a Draft (not-for-sale) offering cannot be put in a proposal', r.status === 422 && /not available/i.test(r.body.error));
  r = await draft(deal1, { scope_summary: 'short' });
  check('the scope must be written in the rep\'s own words (not empty)', r.status === 422);
  r = await draft(deal1, { scope_summary: 'We guarantee this will double your leads within 30 days of installation.' });
  check('promises/guarantees/invented figures are refused', r.status === 422 && r.body.claims.length >= 1);
  r = await P('create', { token: repB.token, body: { deal_id: deal1, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope } });
  check("another rep cannot draft a proposal on this rep's lead", r.status === 404);
  r = await draft(deal1, { items: [{ product_id: auditId, quantity: 1, unit_price_cents: 1 }], total_cents: 1 });
  const prop1 = r.body.proposal;
  check('proposal drafted: price comes from the approved catalog (client-supplied price/total ignored); stage → Proposal', r.status === 200 && prop1.total_cents === 50000 && prop1.line_items[0].price_source === 'catalog' && r.body.blockers.length === 0 && (await env.sql('select stage from crm_deals where id=$1', [deal1])).rows[0].stage === 'proposal');

  // ---- discount control
  r = await P('update-draft', { token: repA.token, body: { deal_id: deal1, proposal_id: prop1.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope, discount_cents: 5000, discount_reason: 'x' } });
  check('a discount needs a reason', r.status === 422);
  r = await P('update-draft', { token: repA.token, body: { deal_id: deal1, proposal_id: prop1.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope, discount_cents: 5000, discount_reason: 'Owner is comparing two providers and asked for a lower start price' } });
  check('a discount request blocks sending and is flagged to the owner', r.status === 200 && r.body.proposal.discount_status === 'requested' && r.body.blockers.length === 1 && (await env.sql("select count(*) from sales_notifications where kind='discount_requested'")).rows[0].count === '1');
  r = await P('send', { token: repA.token, body: { proposal_id: prop1.id } });
  check('an unapproved discount cannot be sent', r.status === 409);
  r = await P('decide-discount', { token: repA.token, body: { proposal_id: prop1.id, decision: 'approve', note: 'approving my own' } });
  check('a rep cannot approve their own discount', r.status === 403);
  r = await P('decide-discount', { token: mgr.token, body: { proposal_id: prop1.id, decision: 'approve', note: 'manager approving' } });
  check('a manager cannot approve a discount (owner only)', r.status === 403);
  r = await P('decide-discount', { token: owner.token, body: { proposal_id: prop1.id, decision: 'deny', note: 'No discount on the first audit' } });
  r = await P('send', { token: repA.token, body: { proposal_id: prop1.id } });
  check('a denied discount still blocks sending', r.status === 409 && /denied/i.test(r.body.error));
  r = await P('update-draft', { token: repA.token, body: { deal_id: deal1, proposal_id: prop1.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope, discount_cents: 0 } });
  check('removing the discount clears the block', r.status === 200 && r.body.blockers.length === 0 && r.body.proposal.total_cents === 50000);
  r = await P('update-draft', { token: repA.token, body: { deal_id: deal1, proposal_id: prop1.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope, discount_cents: 5000, discount_reason: 'Owner asked again after seeing the scope in detail' } });
  await P('decide-discount', { token: owner.token, body: { proposal_id: prop1.id, decision: 'approve', note: 'Approved once, for this client only' } });
  r = await P('for-deal', { method: 'GET', token: repA.token, query: { deal_id: deal1 } });
  check('after owner approval the discount stands with total 45,000 and no blockers', r.body.proposals[0].discount_status === 'approved' && r.body.proposals[0].total_cents === 45000 && r.body.proposals[0].blockers.length === 0);

  // ================================================================== sending
  r = await P('send', { token: repB.token, body: { proposal_id: prop1.id } });
  check("another rep cannot send it", r.status === 404);
  r = await P('send', { token: repA.token, body: { proposal_id: prop1.id } });
  const link1 = r.body.dev_link; const token1 = link1?.split('/proposal/')[1];
  check('send: stage → Awaiting Signature/Payment; email recorded as dry_run (NOT sent); link shown only to the rep', r.status === 200 && r.body.email_status === 'dry_run' && !!token1 && env.stubs.emailRequests.length === 0 && (await env.sql('select stage from crm_deals where id=$1', [deal1])).rows[0].stage === 'awaiting_signature_payment');
  check('only a HASH of the client token is stored', (await env.sql('select client_token_hash from crm_proposals where id=$1', [prop1.id])).rows[0].client_token_hash !== token1);
  let dbErr = null; try { await env.sql('update crm_proposals set total_cents=1 where id=$1', [prop1.id]); } catch (e) { dbErr = e.message; }
  check('a sent proposal cannot be edited in the database', /cannot be edited/.test(dbErr || ''), dbErr);
  r = await P('update-draft', { token: repA.token, body: { deal_id: deal1, proposal_id: prop1.id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope } });
  check('...nor through the API', r.status === 409);

  // ================================================================== client side
  r = await CP('view', { method: 'GET', query: { token: 'not-a-real-token-not-a-real-token' } });
  check('a wrong link gives a generic 404', r.status === 404);
  r = await CP('sign', { body: { token: token1, typed_name: 'Contact One', consent: true, content_hash: 'x' } });
  check('cannot sign without opening the proposal first', r.status === 409);
  r = await CP('view', { method: 'GET', query: { token: token1 } });
  const view = r.body;
  check('the client sees prices, discount, total, consent text — and nothing internal', r.status === 200 && view.proposal.total_cents === 45000 && view.proposal.discount_cents === 5000 && !!view.consent.text && !/assigned|owner_user|created_by|rep_user|qualification/.test(JSON.stringify(view)) && view.status === 'viewed');
  check('opening it notifies the rep', (await env.sql("select count(*) from sales_notifications where kind='proposal_viewed'")).rows[0].count === '1');
  r = await CP('sign', { body: { token: token1, typed_name: 'Contact One', consent: false, content_hash: view.content_hash } });
  check('consent is required', r.status === 422);
  r = await CP('sign', { body: { token: token1, typed_name: 'Contact One', consent: true, content_hash: 'tampered' } });
  check('a stale/forged content hash is refused', r.status === 409);
  r = await CP('sign', { body: { token: token1, typed_name: 'CO', consent: true, content_hash: view.content_hash } });
  check('a full name is required', r.status === 422);
  r = await CP('pay', { body: { token: token1 } });
  check('cannot pay before signing', r.status === 409);
  r = await CP('sign', { body: { token: token1, typed_name: 'Contact One', consent: true, content_hash: view.content_hash, signed_at: '1999-01-01' } });
  const sd = (await env.sql('select signed_at, signer_name, signature_hash, signer_ip from crm_proposals where id=$1', [prop1.id])).rows[0];
  check('signing recorded with a SERVER time, signer, IP and signature hash; deal.signed_agreement_at set', r.status === 200 && new Date(sd.signed_at).getFullYear() >= 2026 && sd.signer_name === 'Contact One' && sd.signature_hash.length === 64 && (await env.sql('select signed_agreement_at from crm_deals where id=$1', [deal1])).rows[0].signed_agreement_at !== null);
  r = await CP('sign', { body: { token: token1, typed_name: 'Contact One', consent: true, content_hash: view.content_hash } });
  check('cannot sign twice', r.status === 409);
  dbErr = null; try { await env.sql("update crm_proposals set signer_name='X' where id=$1", [prop1.id]); } catch (e) { dbErr = e.message; }
  check('a signed proposal is immutable', /immutable|cannot be edited/.test(dbErr || ''), dbErr);
  check('the rep is told, and the owner is told', (await env.sql("select count(*) from sales_notifications where kind='proposal_signed'")).rows[0].count !== '0');

  // ================================================================== payment (no provider first)
  r = await CP('pay', { body: { token: token1 } });
  check('with no payment provider configured, online payment is honestly unavailable', r.status === 409 && /not available/i.test(r.body.error));
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_only'; process.env.STRIPE_API_BASE = STRIPE_BASE;
  r = await CP('pay', { body: { token: token1 } });
  const req0 = stripeReqs[stripeReqs.length - 1];
  check('pay creates ONE pending payment for exactly the proposal amount and a hosted checkout link', r.status === 200 && r.body.checkout_url.startsWith('https://checkout.stripe.test/') && req0.body.get('line_items[0][price_data][unit_amount]') === '45000' && !!req0.idem && req0.body.get('metadata[proposal_id]') === prop1.id);
  const r2 = await CP('pay', { body: { token: token1 } });
  check('asking again returns the same link (no second charge object)', r2.body.checkout_url === r.body.checkout_url && (await env.sql("select count(*) from sales_payments where proposal_id=$1", [prop1.id])).rows[0].count === '1');
  check('invoice_issued_at is set, payment_received_at is NOT', (await env.sql('select invoice_issued_at, payment_received_at from crm_deals where id=$1', [deal1])).rows[0].invoice_issued_at !== null && (await env.sql('select payment_received_at from crm_deals where id=$1', [deal1])).rows[0].payment_received_at === null);
  r = await CP('view', { method: 'GET', query: { token: token1, payment: 'return' } });
  check('returning from the payment page proves nothing: still unpaid', r.body.payment.status === 'pending');

  // ---- rep submits (a CLAIM) — nothing else changes
  r = await P('submit-for-verification', { token: repA.token, body: { deal_id: deal1, evidence: 'x' } });
  check('submitting needs a note', r.status === 422);
  r = await P('submit-for-verification', { token: repB.token, body: { deal_id: deal1, evidence: 'Client signed on the link and is paying online' } });
  check("another rep cannot submit someone else's sale", r.status === 404);
  r = await P('submit-for-verification', { token: repA.token, body: { deal_id: deal1, evidence: 'Client signed through the link and is paying online today.' } });
  const d1 = (await env.sql('select stage, rep_reported_close_at, owner_verified_at, signed_agreement_at, payment_received_at, fulfillment_started_at from crm_deals where id=$1', [deal1])).rows[0];
  check('rep-reported close is recorded, and it is NOT a verified sale, NOT payment, NOT fulfillment', r.status === 200 && d1.stage === 'submitted_for_verification' && d1.rep_reported_close_at && !d1.owner_verified_at && !d1.payment_received_at && !d1.fulfillment_started_at);
  r = await L('move', { token: repA.token, body: { deal_id: deal1, to: 'won' } });
  check('the rep cannot mark it Won', r.status === 422);
  r = await P('verify', { token: repA.token, body: { verification_id: 'x', decision: 'approve', notes: 'approving myself' } });
  check('the rep cannot verify', r.status === 403);
  r = await P('verify', { token: mgr.token, body: { verification_id: 'x', decision: 'approve', notes: 'manager approving' } });
  check('a manager cannot verify (owner only)', r.status === 403);
  r = await P('queue', { method: 'GET', token: owner.token });
  const ver1 = r.body.verifications.find((v) => v.deal_id === deal1);
  check('the owner queue shows the submission with the proposal, signature and payment state', !!ver1 && ver1.proposal.status === 'signed' && ver1.payments[0].status === 'pending' && ver1.business);
  r = await P('verify', { token: owner.token, body: { verification_id: ver1.id, decision: 'approve', notes: 'Signature and scope checked against the proposal' } });
  check('approval is refused while no payment has been received (unless explicitly accepted with a reason)', r.status === 409 && r.body.payment_received === false);

  // ================================================================== Stripe webhook
  const sess = (await env.sql('select id, provider_session_id from sales_payments where proposal_id=$1', [prop1.id])).rows[0];
  const evt = (id, type, obj) => ({ id, type, data: { object: obj } });
  const paid = (extra = {}) => ({ id: sess.provider_session_id, object: 'checkout.session', payment_status: 'paid', amount_total: 45000, currency: 'usd', payment_intent: 'pi_test_1', metadata: { sales_payment_id: sess.id, deal_id: deal1, proposal_id: prop1.id }, client_reference_id: sess.id, ...extra });
  let w = await webhook(evt('evt_1', 'checkout.session.completed', paid()), { sign: false });
  check('an unsigned/forged webhook is rejected', w.code === 400);
  w = await webhook(evt('evt_1', 'checkout.session.completed', paid()), { secret: 'whsec_wrong' });
  check('a webhook signed with the wrong secret is rejected', w.code === 400);
  w = await webhook(evt('evt_1', 'checkout.session.completed', paid()), { ts: Math.floor(Date.now() / 1000) - 3600 });
  check('a replayed old webhook (stale timestamp) is rejected', w.code === 400);
  check('none of those marked anything paid', (await env.sql("select status from sales_payments where id=$1", [sess.id])).rows[0].status === 'pending');
  w = await webhook(evt('evt_bad', 'checkout.session.completed', paid({ amount_total: 100 })));
  check('a verified event with the WRONG amount is NOT accepted as payment and alerts the owner', w.code === 200 && (await env.sql("select status from sales_payments where id=$1", [sess.id])).rows[0].status === 'pending' && (await env.sql("select status from sales_provider_events where event_id='evt_bad'")).rows[0].status === 'failed' && (await env.sql("select count(*) from sales_notifications where kind='payment_mismatch'")).rows[0].count !== '0');
  w = await webhook(evt('evt_1', 'checkout.session.completed', paid()));
  check('the genuine verified event marks the payment paid and sets payment_received_at', w.code === 200 && (await env.sql("select status, provider_event_id from sales_payments where id=$1", [sess.id])).rows[0].provider_event_id === 'evt_1' && (await env.sql('select payment_received_at from crm_deals where id=$1', [deal1])).rows[0].payment_received_at !== null);
  const notesBefore = (await env.sql("select count(*) from sales_notifications where kind='payment_received'")).rows[0].count;
  w = await webhook(evt('evt_1', 'checkout.session.completed', paid()));
  check('a DUPLICATE delivery of the same event changes nothing (idempotent)', w.code === 200 && (await env.sql("select count(*) from sales_notifications where kind='payment_received'")).rows[0].count === notesBefore && (await env.sql("select count(*) from sales_provider_events where event_id='evt_1'")).rows[0].count === '1');
  w = await webhook(evt('evt_2', 'checkout.session.completed', paid()));
  check('a DIFFERENT event id for an already-paid payment is safely ignored', w.code === 200 && (await env.sql("select count(*) from sales_payments where proposal_id=$1", [prop1.id])).rows[0].count === '1');

  // ================================================================== owner verification & fulfillment handoff
  r = await P('verify', { token: owner.token, body: { verification_id: ver1.id, decision: 'approve', notes: 'ok' } });
  check('the owner must record what they checked', r.status === 422);
  r = await P('verify', { token: owner.token, body: { verification_id: ver1.id, decision: 'approve', notes: 'Signature verified in Nova; payment confirmed by Stripe event evt_1' } });
  check('owner approves: stage Won, owner_verified_at set, handoff created', r.status === 200 && r.body.handoff.customer_org_created && r.body.handoff.orders_created === 1 && r.body.handoff.task_created);
  const dd = (await env.sql('select stage, owner_verified_at, owner_verified_by, fulfillment_started_at from crm_deals where id=$1', [deal1])).rows[0];
  check('verified ≠ fulfillment: fulfillment has NOT started yet', dd.stage === 'won' && dd.owner_verified_by === owner.id && dd.fulfillment_started_at === null);
  const ord = (await env.sql("select o.status, o.price_cents, o.organization_id, org.kind from orders o join organizations org on org.id=o.organization_id where o.deal_id=$1", [deal1])).rows;
  check('one order for the CUSTOMER organization (not Nova\'s), status accepted, price from the proposal', ord.length === 1 && ord[0].kind === 'client' && ord[0].status === 'accepted' && ord[0].price_cents === 50000);
  const dealRow = (await env.sql('select * from crm_deals where id=$1', [deal1])).rows[0]; const propRow = (await env.sql('select * from crm_proposals where id=$1', [prop1.id])).rows[0];
  const again = await handoffFulfillment({ deal: dealRow, proposal: propRow, actor: { id: owner.id } });
  check('re-running the handoff creates NO duplicates (org, order, task)', !again.customer_org_created && again.orders_created === 0 && !again.task_created && (await env.sql("select count(*) from orders where deal_id=$1", [deal1])).rows[0].count === '1' && (await env.sql("select count(*) from organizations where kind='client'")).rows[0].count === '1');
  await env.sql('delete from orders where deal_id=$1', [deal1]); // simulate a failed handoff
  r = await P('retry-handoff', { token: owner.token, body: { deal_id: deal1 } });
  check('a failed handoff can be retried by the owner without duplicating the customer org', r.status === 200 && r.body.handoff.orders_created === 1 && !r.body.handoff.customer_org_created && (await env.sql("select count(*) from organizations where kind='client'")).rows[0].count === '1');
  r = await P('retry-handoff', { token: repA.token, body: { deal_id: deal1 } });
  check('a rep cannot trigger a handoff', r.status === 403);
  r = await P('verify', { token: owner.token, body: { verification_id: ver1.id, decision: 'approve', notes: 'approving twice by mistake' } });
  check('a decided submission cannot be decided again', r.status === 409);
  r = await P('mark-fulfillment-started', { token: repA.token, body: { deal_id: deal1 } });
  check('a rep cannot start fulfillment', r.status === 403);
  r = await P('mark-fulfillment-started', { token: owner.token, body: { deal_id: deal1 } });
  check('the owner marks fulfillment started; the order moves to in_progress with an event', r.status === 200 && (await env.sql("select status from orders where deal_id=$1", [deal1])).rows[0].status === 'in_progress');
  const won = await L('create', { token: repB.token, body: { business_name: 'Somebody Else', contact_name: 'X Y', contact_phone: '2035557777' } });
  check('a verified sale releases its prospect claim (only Won/Lost do)', won.status === 200);

  // ---- refund → flagged
  w = await webhook(evt('evt_3', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_test_1' }));
  check('a verified refund event marks the payment refunded and alerts the owner', w.code === 200 && (await env.sql("select status from sales_payments where id=$1", [sess.id])).rows[0].status === 'refunded' && (await env.sql("select count(*) from sales_notifications where kind='payment_reversed'")).rows[0].count !== '0');
  r = await PAY('list', { method: 'GET', token: owner.token });
  check('the payments list labels provider-confirmed vs owner-recorded', r.status === 200 && r.body.some((p) => /provider event/.test(p.confirmation)));

  // ================================================================== manual payment (owner only, evidence required)
  const deal2 = await leadAt(repA);
  r = await draft(deal2, { items: [{ product_id: captureId, quantity: 2 }] });
  const prop2 = r.body.proposal;
  check('a second offering is priced by quantity (2 × 20,000 = 40,000)', prop2.total_cents === 40000);
  r = await P('send', { token: repA.token, body: { proposal_id: prop2.id } });
  const token2 = r.body.dev_link.split('/proposal/')[1];
  const v2 = (await CP('view', { method: 'GET', query: { token: token2 } })).body;
  await CP('sign', { body: { token: token2, typed_name: 'Contact Two', consent: true, content_hash: v2.content_hash } });
  r = await PAY('record-manual', { token: repA.token, body: { proposal_id: prop2.id, amount_cents: 40000, method: 'check', evidence: 'Check #1042 deposited 2026-09-26' } });
  check('a rep cannot record a payment', r.status === 403);
  r = await PAY('record-manual', { token: mgr.token, body: { proposal_id: prop2.id, amount_cents: 40000, method: 'check', evidence: 'Check #1042 deposited 2026-09-26' } });
  check('a manager cannot record a payment', r.status === 403);
  r = await PAY('record-manual', { token: owner.token, body: { proposal_id: prop2.id, amount_cents: 999, method: 'check', evidence: 'Check #1042 deposited 2026-09-26' } });
  check('the recorded amount must equal the amount due', r.status === 422);
  r = await PAY('record-manual', { token: owner.token, body: { proposal_id: prop2.id, amount_cents: 40000, method: 'check', evidence: 'ok' } });
  check('evidence is mandatory', r.status === 422);
  r = await PAY('record-manual', { token: owner.token, body: { proposal_id: prop2.id, amount_cents: 40000, method: 'check', evidence: 'Check #1042 deposited 2026-09-26' } });
  check('owner records it: paid, labelled NOT provider-confirmed', r.status === 200 && /not a provider confirmation/i.test(r.body.note));
  r = await PAY('record-manual', { token: owner.token, body: { proposal_id: prop2.id, amount_cents: 40000, method: 'check', evidence: 'Check #1042 deposited 2026-09-26' } });
  check('recording the same payment twice is refused', r.status === 409);
  r = await PAY('list', { method: 'GET', token: owner.token });
  check('the list shows it as owner-recorded evidence, not provider-confirmed', r.body.find((p) => p.method === 'manual_owner').confirmation.includes('NOT provider-confirmed'));
  await P('submit-for-verification', { token: repA.token, body: { deal_id: deal2, evidence: 'Client signed via link; paid by check' } });
  r = await P('queue', { method: 'GET', token: owner.token }); const ver2 = r.body.verifications.find((v) => v.deal_id === deal2);
  r = await P('verify', { token: owner.token, body: { verification_id: ver2.id, decision: 'reject', notes: 'Payment amount does not match the invoice, please re-check' } });
  check('rejecting sends the lead back to Awaiting Signature/Payment and tells the rep', r.status === 200 && (await env.sql('select stage, rep_reported_close_at from crm_deals where id=$1', [deal2])).rows[0].stage === 'awaiting_signature_payment' && (await env.sql("select count(*) from sales_notifications where kind='sale_rejected'")).rows[0].count === '1');

  // ================================================================== offline evidence, decline, expiry, recall
  const deal3 = await leadAt(repA);
  r = await draft(deal3); const prop3 = r.body.proposal;
  await P('send', { token: repA.token, body: { proposal_id: prop3.id } });
  r = await P('submit-for-verification', { token: repA.token, body: { deal_id: deal3, evidence: 'He said yes' } });
  check('a claimed close with NO client signature needs detailed evidence (40+ chars)', r.status === 422);
  r = await P('submit-for-verification', { token: repA.token, body: { deal_id: deal3, evidence: 'Signed a paper copy in the shop on Friday; photo of the signed page is saved in the shared folder under his business name.' } });
  r = await P('queue', { method: 'GET', token: owner.token }); const ver3 = r.body.verifications.find((v) => v.deal_id === deal3);
  check('the queue marks it rep-supplied evidence', ver3.evidence_kind === 'rep_supplied');
  r = await P('verify', { token: owner.token, body: { verification_id: ver3.id, decision: 'approve', notes: 'Looked at the photo of the signed page and called the client', accept_unpaid_terms: true, unpaid_reason: 'Invoice terms: net 14 agreed by owner' } });
  check('approving rep-supplied evidence needs the owner to confirm they checked it personally', r.status === 422);
  r = await P('verify', { token: owner.token, body: { verification_id: ver3.id, decision: 'approve', notes: 'Looked at the photo of the signed page and called the client', confirm_offline_evidence: true, accept_unpaid_terms: true, unpaid_reason: 'Invoice terms: net 14 agreed by owner' } });
  check('with confirmation + explicit unpaid-terms acceptance the sale verifies, but payment stays UNRECEIVED', r.status === 200 && (await env.sql('select stage, payment_received_at from crm_deals where id=$1', [deal3])).rows[0].payment_received_at === null && (await env.sql("select snapshot from sales_deal_verifications where id=$1", [ver3.id])).rows[0].snapshot.at_decision.unpaid_terms_accepted === true);

  const deal4 = await leadAt(repA);
  r = await draft(deal4); const prop4 = r.body.proposal;
  r = await P('send', { token: repA.token, body: { proposal_id: prop4.id } }); const token4 = r.body.dev_link.split('/proposal/')[1];
  await CP('view', { method: 'GET', query: { token: token4 } });
  r = await CP('decline', { body: { token: token4, reason: 'Going with someone local' } });
  check('a client can decline; the lead returns to Proposal and the rep is told', r.status === 200 && (await env.sql('select stage from crm_deals where id=$1', [deal4])).rows[0].stage === 'proposal' && (await env.sql("select count(*) from sales_notifications where kind='proposal_declined'")).rows[0].count === '1');
  r = await CP('view', { method: 'GET', query: { token: token4 } });
  check('the declined link is dead', r.status === 404 || r.status === 410);

  const deal5 = await leadAt(repA);
  r = await draft(deal5); const prop5 = r.body.proposal;
  r = await P('send', { token: repA.token, body: { proposal_id: prop5.id, expires_days: 7 } }); const token5 = r.body.dev_link.split('/proposal/')[1];
  await env.sql("update crm_proposals set token_expires_at = now() - interval '1 hour' where id=$1", [prop5.id]);
  r = await CP('view', { method: 'GET', query: { token: token5 } });
  check('an expired proposal link returns 410 and the proposal is marked expired', r.status === 410 && (await env.sql('select status from crm_proposals where id=$1', [prop5.id])).rows[0].status === 'expired');
  r = await P('resend-link', { token: repA.token, body: { proposal_id: prop5.id } });
  check('an expired proposal cannot be re-sent (create a new version)', r.status === 409);

  const deal6 = await leadAt(repA);
  r = await draft(deal6); const prop6 = r.body.proposal;
  r = await P('send', { token: repA.token, body: { proposal_id: prop6.id } }); const token6 = r.body.dev_link.split('/proposal/')[1];
  r = await P('recall', { token: repA.token, body: { proposal_id: prop6.id, reason: 'Wrong contact was on it' } });
  check('recall voids the proposal, kills the link, and returns the lead to Proposal', r.status === 200 && (await CP('view', { method: 'GET', query: { token: token6 } })).status === 404 && (await env.sql('select stage from crm_deals where id=$1', [deal6])).rows[0].stage === 'proposal');
  r = await P('resend-link', { token: repA.token, body: { proposal_id: prop6.id } });
  check('a recalled proposal cannot be re-sent', r.status === 409);

  // ================================================================== custom scope + owner price
  const deal7 = await leadAt(repA);
  r = await P('create', { token: repA.token, body: { deal_id: deal7, items: [{ product_id: waveId, quantity: 1 }], scope_summary: scope } });
  check('still blocked without an owner exception', r.status === 422);
  r = await P('approve-custom-scope', { token: repA.token, body: { deal_id: deal7, product_id: waveId, label: 'pilot: one location, 30 days' } });
  check('a rep cannot approve custom scope', r.status === 403);
  r = await P('approve-custom-scope', { token: owner.token, body: { deal_id: deal7, product_id: waveId, label: 'pilot: one location, 30 days, no results promised' } });
  r = await P('create', { token: repA.token, body: { deal_id: deal7, items: [{ product_id: waveId, quantity: 1 }], scope_summary: scope } });
  const prop7 = r.body.proposal;
  check('with the owner exception it drafts, labelled CUSTOM SCOPE, but has NO price and cannot be sent', r.status === 200 && prop7.line_items[0].label.startsWith('CUSTOM SCOPE') && prop7.total_cents === null && r.body.blockers.some((b) => /no approved price/.test(b)));
  r = await P('send', { token: repA.token, body: { proposal_id: prop7.id } });
  check('sending an unpriced proposal is refused', r.status === 409);
  r = await P('owner-set-price', { token: repA.token, body: { proposal_id: prop7.id, product_id: waveId, unit_price_cents: 10, reason: 'trying to set my own price' } });
  check('a rep cannot set a price', r.status === 403);
  r = await P('owner-set-price', { token: owner.token, body: { proposal_id: prop7.id, product_id: waveId, unit_price_cents: 30000, reason: 'Custom pilot fee agreed with the owner of the business' } });
  check('the owner sets a custom price with a recorded reason; total updates', r.status === 200 && r.body.total_cents === 30000);
  r = await P('send', { token: repA.token, body: { proposal_id: prop7.id } });
  check('now it can be sent', r.status === 200);
  await env.sql("update products set sales_readiness='paused' where id=$1", [auditId]);
  const deal8 = await leadAt(repA);
  r = await draft(deal8);
  check('a paused offering can no longer be proposed', r.status === 422);
  await env.sql("update products set sales_readiness='available_for_sale' where id=$1", [auditId]);

  // ================================================================== boundaries
  const dPr = await env.rest(repA.token, 'crm_proposals?select=id'); const dPay = await env.rest(repA.token, 'sales_payments?select=id'); const dVer = await env.rest(repA.token, 'sales_deal_verifications?select=id');
  check('a rep cannot read proposals, payments or verifications straight through PostgREST', [dPr, dPay, dVer].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  const dTok = await env.rest(null, 'crm_proposals?select=client_token_hash');
  check('and the anonymous role cannot read proposal tokens', Array.isArray(dTok.data) ? dTok.data.length === 0 : dTok.status >= 400);
  r = await P('for-deal', { method: 'GET', token: repB.token, query: { deal_id: deal1 } });
  check("another rep cannot see this lead's proposals/payments", r.status === 404);
  r = await P('for-deal', { method: 'GET', token: repA.token, query: { deal_id: deal1 } });
  check('the rep\'s own view shows all milestones separately and never a token or hash', r.status === 200 && r.body.milestones.owner_verified_at && r.body.milestones.payment_received_at && !/client_token|signature_hash|content_hash/.test(JSON.stringify(r.body)));
  check('audit trail recorded the sale lifecycle', (await env.sql("select count(*) from sales_audit_log where action in ('proposal_sent','proposal_signed','payment_received','sale_submitted_for_verification','sale_verified')")).rows[0].count >= 5);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { stripeSrv.close(); await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
