// Commission ledger + payouts: real handlers (api/client.js, api/stripe.js) against REAL PostgreSQL + PostgREST (local, disposable).
// Stripe is a LOCAL STAND-IN (accounts, account links, transfers with idempotency, injectable failures). No Stripe account, no network, NO REAL MONEY.
// Plan rates and prices below are TEST VALUES ONLY — they are not Nova's commission rates or prices.
import http from 'node:http';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
// ---- Stripe stand-in
const S = { transfers: new Map(), idem: new Map(), accounts: 0, calls: [], failNext: null };
const srv = http.createServer((req, res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
  const form = new URLSearchParams(d); const idem = req.headers['idempotency-key']; S.calls.push({ url: req.url, idem, form });
  const json = (code, o) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  if (req.url.endsWith('/checkout/sessions')) return json(200, { id: `cs_${S.calls.length}`, url: `https://checkout.stripe.test/${S.calls.length}` });
  if (req.url.endsWith('/accounts')) { if (idem && S.idem.has(idem)) return json(200, S.idem.get(idem)); const o = { id: `acct_test_${++S.accounts}` }; if (idem) S.idem.set(idem, o); return json(200, o); }
  if (req.url.endsWith('/account_links')) return json(200, { url: `https://connect.stripe.test/onboard/${form.get('account')}` });
  if (req.url.endsWith('/transfers')) {
    if (S.failNext === 'decline') { S.failNext = null; return json(400, { error: { message: 'Insufficient funds in platform balance' } }); }
    if (S.failNext === 'drop') { S.failNext = null; return req.socket.destroy(); }
    if (idem && S.idem.has(idem)) return json(200, S.idem.get(idem));
    const o = { id: `tr_test_${S.transfers.size + 1}`, amount: Number(form.get('amount')), currency: form.get('currency'), destination: form.get('destination'), metadata: { sales_payout_id: form.get('metadata[sales_payout_id]') } };
    S.transfers.set(o.id, o); if (idem) S.idem.set(idem, o); return json(200, o);
  }
  json(404, {});
}); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const WHSEC = 'whsec_local_test_secret';
Object.assign(process.env, env.appEnv, { APP_BASE_URL: 'https://app.test', SALES_EMAIL_MODE: 'dry_run', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: `http://127.0.0.1:${srv.address().port}/v1` });
delete process.env.STRIPE_SECRET_KEY; delete process.env.SALES_PAYOUTS_MODE;
const { default: handler } = await import('../api/client.js');
const { default: stripeHandler } = await import('../api/stripe.js');
const call = makeCaller(handler);
const P = (op, o = {}) => call({ resource: 'proposals', op, ...o });
const L = (op, o = {}) => call({ resource: 'leads', op, ...o });
const CP = (op, o = {}) => call({ resource: 'clientproposal', op, ...o });
const PAY = (op, o = {}) => call({ resource: 'salespay', op, ...o });
const CM = (op, o = {}) => call({ resource: 'commissions', op, ...o });
const webhook = async (event, { secret = WHSEC } = {}) => { const ts = Math.floor(Date.now() / 1000); const raw = Buffer.from(JSON.stringify(event)); const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex'); const req = Object.assign(Readable.from([raw]), { method: 'POST', query: {}, headers: { 'stripe-signature': `t=${ts},v1=${sig}`, 'x-forwarded-for': '203.0.113.9' } }); const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; await stripeHandler(req, res); return res; };
try {
  const org = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: org, name: 'Isaac Owner' });
  const fin = await env.createUser({ email: 'fin@nova.test', role: 'nova_finance', orgId: org, name: 'Fin Ance' });
  const mgr = await env.createUser({ email: 'mgr@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Mia Manager' });
  const mgr2 = await env.createUser({ email: 'mgr2@nova.test', role: 'nova_sales_manager', orgId: org, name: 'Other Manager' });
  const repA = await env.createUser({ email: 'a@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Alpha' });
  const repB = await env.createUser({ email: 'b@nova.test', role: 'nova_sales', orgId: org, name: 'Rep Bravo' });
  await env.sql("insert into sales_reps (user_id, organization_id, display_name, status, manager_user_id) values ($1,$3,'Rep Alpha','active',$2), ($4,$3,'Rep Bravo','active',$5)", [repA.id, mgr.id, org, repB.id, mgr2.id]);
  await env.sql("update products set sales_readiness='available_for_sale', sales_info_reviewed=true, sales_info='{\"what_it_is\":\"t\"}', pricing_approved=true, pricing_config='{\"unit_price_cents\":50000,\"billing\":\"one_time\"}' where slug='nova-audit-digital'");
  await env.reload();
  const auditId = (await env.sql("select id from products where slug='nova-audit-digital'")).rows[0].id;

  // ---- close a sale through the real flow. pay: 'manual' (owner-recorded) | 'none' (owner accepts unpaid terms) | 'stripe'
  let n = 0; const scope = 'After-hours call handling and a written follow-up routine, based on what we found in discovery.';
  const closeSale = async (rep, { pay = 'manual', ownerVerifier = owner } = {}) => {
    n++;
    const c = await L('create', { token: rep.token, body: { business_name: `Comm Biz ${n} ${Date.now()}`, website: `https://commbiz${n}${Date.now()}.test`, phone: `20366${String(5000 + n).padStart(5, '0')}`, city: 'Waterbury', contact_name: `Client ${n}`, contact_email: `c${n}@commbiz${n}.test` } });
    const id = c.body.deal_id; await L('log-activity', { token: rep.token, body: { deal_id: id, kind: 'call', body: 'Called owner' } });
    for (const [to, x] of [['contacted', {}], ['qualified', { qualification: { summary: 'Owner-operated shop that answers its own phone.', decision_maker: 'yes' } }], ['discovery_scheduled', { discovery_at: new Date(Date.now() + 86400000).toISOString() }], ['discovery_completed', { discovery: { how_customers_reach_them: 'Phone calls and walk-ins', what_happens_to_missed_inquiries: 'Voicemail', current_follow_up_process: 'None written', findings: 'After-hours calls go unanswered with no callback routine.' } }]]) await L('move', { token: rep.token, body: { deal_id: id, to, ...x } });
    const pr = await P('create', { token: rep.token, body: { deal_id: id, items: [{ product_id: auditId, quantity: 1 }], scope_summary: scope } });
    const prop = pr.body.proposal; const sent = await P('send', { token: rep.token, body: { proposal_id: prop.id } }); const token = sent.body.dev_link.split('/proposal/')[1];
    const v = (await CP('view', { method: 'GET', query: { token } })).body; await CP('sign', { body: { token, typed_name: `Client ${n} Signer`, consent: true, content_hash: v.content_hash } });
    if (pay === 'manual') await PAY('record-manual', { token: owner.token, body: { proposal_id: prop.id, amount_cents: 50000, method: 'check', evidence: `Check #${1000 + n} deposited and confirmed` } });
    await P('submit-for-verification', { token: rep.token, body: { deal_id: id, evidence: 'Client signed via link and paid' } });
    const q = await P('queue', { method: 'GET', token: owner.token }); const ver = q.body.verifications.find((x) => x.deal_id === id);
    return { dealId: id, propId: prop.id, token, verId: ver.id, verify: (extra = {}) => P('verify', { token: ownerVerifier.token, body: { verification_id: ver.id, decision: 'approve', notes: 'Checked signature and payment state in Nova', ...(pay === 'none' ? { accept_unpaid_terms: true, unpaid_reason: 'Owner agreed net-14 invoice terms' } : {}), ...extra } }) };
  };
  const entryOf = async (dealId) => (await env.sql("select * from sales_commission_entries where deal_id=$1 and kind='sale'", [dealId])).rows[0];
  const plan = (bp, hold = 7) => ({ rules: [{ product_slug: '*', type: 'percent', percent_bp: bp }, { product_slug: 'lead-capture', type: 'flat', flat_cents: 5000 }], conditions: { require_payment_received: true, holdback_days: hold }, note: 'TEST PLAN' });

  // ================================================================== no plan → nothing is invented
  const saleA = await closeSale(repA); await saleA.verify();
  let r = await CM('earnings', { method: 'GET', token: repA.token });
  check('with NO approved plan, no commission is estimated or earned, and the rep is told plainly', r.status === 200 && r.body.entries.length === 0 && r.body.plan === null && /has not approved a commission plan/.test(r.body.plan_note));
  check('a verified sale with no plan created no ledger entry', (await entryOf(saleA.dealId)) === undefined);

  // ================================================================== plan approval
  r = await CM('plan', { method: 'GET', token: repA.token });
  check('a rep cannot see the plan management screen', r.status === 403);
  r = await CM('save-plan', { token: fin.token, body: { plan: plan(1000) } });
  check('finance cannot write a plan (owner only)', r.status === 403);
  r = await CM('save-plan', { token: mgr.token, body: { plan: plan(1000) } });
  check('a manager cannot write a plan', r.status === 403);
  r = await CM('save-plan', { token: owner.token, body: { plan: { rules: [{ product_slug: '*', type: 'percent', percent_bp: 99999 }] } } });
  check('an invalid plan is refused with a reason', r.status === 422);
  r = await CM('save-plan', { token: owner.token, body: { plan: plan(1000) } });
  const cfg1 = r.body.config;
  check('a valid plan is saved as PENDING approval — not in force', r.status === 200 && cfg1.status === 'pending_approval');
  r = await CM('earnings', { method: 'GET', token: repA.token });
  check('a pending plan is invisible to reps (still no plan)', r.body.plan === null);
  r = await CM('approve-plan', { token: owner.token, body: { config_id: cfg1.id } });
  check('approval needs explicit confirmation', r.status === 422);
  r = await CM('approve-plan', { token: owner.token, body: { config_id: cfg1.id, confirm: true } });
  check('owner approves plan v1', r.status === 200);
  r = await CM('create-for-deal', { token: owner.token, body: { deal_id: saleA.dealId, reason: 'x' } });
  check('an earlier verified sale gets a commission only by an explicit, reasoned owner action', r.status === 422);
  r = await CM('create-for-deal', { token: fin.token, body: { deal_id: saleA.dealId, reason: 'Verified before a plan existed; owner decision' } });
  check('finance cannot back-create entries', r.status === 403);
  r = await CM('create-for-deal', { token: owner.token, body: { deal_id: saleA.dealId, reason: 'Verified before a plan existed; owner decision' } });
  const eA = await entryOf(saleA.dealId);
  check('owner back-creates it: locked to plan v1, 10% of 50,000 = 5,000, paid deal → waiting on the hold-back', r.status === 200 && eA.amount_cents === 5000 && eA.plan_snapshot.plan_version === 1 && ['pending_conditions', 'eligible'].includes(eA.status));

  // ================================================================== lifecycle: estimated → pending → eligible
  const saleB = await closeSale(repA, { pay: 'none' });
  r = await CM('earnings', { method: 'GET', token: repA.token });
  const estB = r.body.entries.find((e) => e.deal_id === saleB.dealId);
  check('submitting a sale creates an ESTIMATED entry, reported as "not earnings"', estB.status === 'estimated' && estB.amount_cents === 5000 && r.body.summary.estimated_not_earned_cents === 5000 && /NOT earnings/.test(r.body.labels.estimated));
  await saleB.verify();
  let eB = await entryOf(saleB.dealId);
  check('owner verification moves it to Pending Conditions (unpaid → waiting for client payment)', eB.status === 'pending_conditions');
  r = await CM('approve-entries', { token: fin.token, body: { entry_ids: [eB.id] } });
  check('finance cannot approve an entry that is not Eligible', r.body.results[0].ok === false && /Only Eligible/.test(r.body.results[0].error));
  await PAY('record-manual', { token: owner.token, body: { proposal_id: saleB.propId, amount_cents: 50000, method: 'wire', evidence: 'Wire ref 8841 received in the Nova account' } });
  eB = await entryOf(saleB.dealId);
  check('client payment received → still Pending: the 7-day hold-back applies', eB.status === 'pending_conditions' && new Date(eB.eligible_after) > new Date());
  r = await CM('sweep', { method: 'POST', token: owner.token });
  check('a sweep before the hold-back ends changes nothing', (await entryOf(saleB.dealId)).status === 'pending_conditions');
  await env.sql("update sales_payments set paid_at = now() - interval '8 days' where deal_id=$1", [saleB.dealId]);
  r = await CM('sweep', { method: 'POST', token: owner.token });
  eB = await entryOf(saleB.dealId);
  check('after the hold-back the entry becomes Eligible, and the rep is notified', eB.status === 'eligible' && r.body.became_eligible >= 1 && (await env.sql("select count(*) from sales_notifications where kind='commission_eligible' and user_id=$1", [repA.id])).rows[0].count !== '0');

  // ---- plan v2 must not touch deals already locked to v1
  r = await CM('save-plan', { token: owner.token, body: { plan: plan(2000, 0) } }); await CM('approve-plan', { token: owner.token, body: { config_id: r.body.config.id, confirm: true } });
  check('approving v2 retires v1 (one approved plan at a time)', (await env.sql("select count(*) from sales_config where key='commission_plan' and status='approved'")).rows[0].count === '1');
  check('an existing entry keeps its v1 snapshot and amount', (await entryOf(saleB.dealId)).amount_cents === 5000 && (await entryOf(saleB.dealId)).plan_snapshot.plan_version === 1);
  const saleC = await closeSale(repB); await saleC.verify();
  const eC = await entryOf(saleC.dealId);
  check('a NEW sale is locked to v2: 20% of 50,000 = 10,000, no hold-back → Eligible immediately', eC.amount_cents === 10000 && eC.plan_snapshot.plan_version === 2 && eC.status === 'eligible');

  // ================================================================== approval
  r = await CM('approve-entries', { token: repA.token, body: { entry_ids: [eB.id] } });
  check('a rep cannot approve commissions', r.status === 403);
  r = await CM('approve-entries', { token: mgr.token, body: { entry_ids: [eB.id] } });
  check('a manager cannot approve commissions', r.status === 403);
  r = await CM('ledger', { method: 'GET', token: repA.token });
  check('a rep cannot open the finance ledger', r.status === 403);
  r = await CM('approve-entries', { token: fin.token, body: { entry_ids: [eB.id, eC.id, eA.id] } });
  check('finance approves the Eligible entries (Owner Approved)', r.status === 200 && r.body.results.filter((x) => x.ok).length >= 2);
  r = await CM('approve-entries', { token: fin.token, body: { entry_ids: [eB.id] } });
  check('approving twice is refused', r.body.results[0].ok === false);
  let dbErr = null; try { await env.sql("update sales_commission_entries set amount_cents=999999 where id=$1", [eB.id]); } catch (e) { dbErr = e.message; }
  check('the amount is frozen in the database', /frozen/.test(dbErr || ''), dbErr);
  dbErr = null; try { await env.sql("update sales_commission_entries set status='paid' where id=$1", [eB.id]); } catch (e) { dbErr = e.message; }
  check('a status cannot jump (Owner Approved → Paid) in the database', /illegal commission status change/.test(dbErr || ''), dbErr);
  dbErr = null; try { await env.sql("delete from sales_commission_entries where id=$1", [eB.id]); } catch (e) { dbErr = e.message; }
  check('ledger entries cannot be deleted', /never deleted/.test(dbErr || ''), dbErr);
  check('every change wrote an immutable event', Number((await env.sql("select count(*) from sales_commission_events where entry_id=$1", [eB.id])).rows[0].count) >= 4);

  // ================================================================== batch: owner-approved concrete batch; externally recorded (no provider)
  r = await CM('create-batch', { token: fin.token, body: { mode: 'external_record', entry_ids: [eB.id, saleA.dealId] } });
  check('a batch may only contain Owner-Approved entries', r.status === 409 || r.status === 500);
  const approvedIds = (await env.sql("select id from sales_commission_entries where status='owner_approved' order by amount_cents")).rows.map((x) => x.id);
  r = await CM('create-batch', { token: fin.token, body: { mode: 'provider', entry_ids: approvedIds } });
  check('provider mode is refused while provider payouts are not enabled', r.status === 409 && /not enabled/.test(r.body.error));
  r = await CM('create-batch', { token: fin.token, body: { mode: 'external_record', entry_ids: approvedIds } });
  const batch = r.body.batch; const total = batch.total_cents;
  check('finance creates a DRAFT batch; nothing is scheduled yet', r.status === 200 && batch.status === 'draft' && (await env.sql("select count(*) from sales_payouts")).rows[0].count === '0');
  r = await CM('approve-batch', { token: fin.token, body: { batch_id: batch.id, confirm_total_cents: total, confirm_count: approvedIds.length } });
  check('finance cannot approve a batch (owner only)', r.status === 403);
  r = await CM('approve-batch', { token: owner.token, body: { batch_id: batch.id, confirm_total_cents: total + 1, confirm_count: approvedIds.length } });
  check('the owner must confirm the exact total and count', r.status === 422 && r.body.total_cents === total);
  r = await CM('approve-batch', { token: owner.token, body: { batch_id: batch.id, confirm_total_cents: total, confirm_count: approvedIds.length } });
  check('owner approves the concrete batch: payouts Scheduled, entries Scheduled, hash recorded', r.status === 200 && r.body.approval_hash.length === 64 && (await env.sql("select count(*) from sales_payouts where status='scheduled'")).rows[0].count === String(approvedIds.length) && (await env.sql("select count(*) from sales_commission_entries where status='scheduled'")).rows[0].count === String(approvedIds.length));
  r = await CM('approve-batch', { token: owner.token, body: { batch_id: batch.id, confirm_total_cents: total, confirm_count: approvedIds.length } });
  check('approving the same batch again is refused (no duplicate payouts)', r.status === 409 && (await env.sql("select count(*) from sales_payouts")).rows[0].count === String(approvedIds.length));
  const pay1 = (await env.sql("select p.id, p.rep_user_id from sales_payouts p order by p.amount_cents limit 1")).rows[0];
  r = await CM('record-external', { token: repA.token, body: { payout_id: pay1.id, method: 'check', evidence: 'Check #5521 mailed and cashed 2026-09-26' } });
  check('a rep cannot record a payout', r.status === 403);
  r = await CM('record-external', { token: fin.token, body: { payout_id: pay1.id, method: 'check', evidence: 'Check #5521 mailed and cashed 2026-09-26' } });
  check('finance cannot mark money as paid (owner only)', r.status === 403);
  r = await CM('record-external', { token: owner.token, body: { payout_id: pay1.id, method: 'check', evidence: 'ok' } });
  check('the owner must attach evidence', r.status === 422);
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: batch.id } });
  check('an external batch cannot be "executed" — no button manufactures success', r.status === 409);
  r = await CM('record-external', { token: owner.token, body: { payout_id: pay1.id, method: 'check', reference: 'CHK-5521', evidence: 'Check #5521 mailed and cashed 2026-09-26' } });
  const paidEntry = (await env.sql("select e.status from sales_commission_entries e join sales_payouts p on p.entry_id=e.id where p.id=$1", [pay1.id])).rows[0];
  check('owner records it: payout Paid + entry Paid, labelled NOT provider-confirmed', r.status === 200 && /not a provider confirmation/i.test(r.body.note) && paidEntry.status === 'paid');
  r = await CM('record-external', { token: owner.token, body: { payout_id: pay1.id, method: 'check', evidence: 'Check #5521 mailed and cashed 2026-09-26' } });
  check('the same payout cannot be recorded twice', r.status === 409);
  dbErr = null; try { await env.sql("update sales_payouts set status='failed' where id=$1", [pay1.id]); } catch (e) { dbErr = e.message; }
  check('a paid payout is immutable', /immutable/.test(dbErr || ''), dbErr);
  r = await CM('earnings', { method: 'GET', token: repA.token });
  check('the rep sees Paid with the honest label "recorded by Nova (not provider-confirmed)"', r.body.payouts.some((p) => p.status === 'paid' && /not provider-confirmed/.test(p.confirmation)) && r.body.summary.paid_cents > 0);
  r = await CM('batches', { method: 'GET', token: fin.token });
  check('the batch list shows per-payout status and confirmation source', r.status === 200 && r.body[0].payouts.length === approvedIds.length);
  // owner's own commission can never be approved into a payout by that same owner
  const ownerDeal = (await env.sql("select id from crm_deals limit 1")).rows[0].id;
  await env.sql("insert into sales_commission_entries (kind, rep_user_id, deal_id, plan_snapshot, basis_cents, amount_cents, status) values ('sale',$1,$2,'{}',1000,100,'owner_approved')", [owner.id, ownerDeal]).catch(() => null);
  const ownEntry = (await env.sql("select id from sales_commission_entries where rep_user_id=$1", [owner.id])).rows[0];
  if (ownEntry) { const b2 = await CM('create-batch', { token: fin.token, body: { mode: 'external_record', entry_ids: [ownEntry.id] } }); r = await CM('approve-batch', { token: owner.token, body: { batch_id: b2.body.batch.id, confirm_total_cents: 100, confirm_count: 1 } }); check("the owner cannot approve a payout that includes their OWN commission", r.status === 403); }

  // ================================================================== provider payouts (local stand-in)
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_only'; process.env.SALES_PAYOUTS_MODE = 'provider';
  r = await CM('payout-onboarding-link', { token: repB.token, body: {} });
  check('the rep gets a provider-HOSTED onboarding link (Nova collects no bank/ID/tax data)', r.status === 200 && r.body.url.startsWith('https://connect.stripe.test/onboard/acct_test_') && /never sees your bank/.test(r.body.note));
  const acctId = (await env.sql("select provider_account_id from sales_payout_accounts where rep_user_id=$1", [repB.id])).rows[0].provider_account_id;
  r = await CM('payout-onboarding-link', { token: repB.token, body: {} });
  check('asking again reuses the same provider account (idempotent)', S.accounts === 1 && (await env.sql("select count(*) from sales_payout_accounts")).rows[0].count === '1');
  const saleD = await closeSale(repB); await saleD.verify(); const eD = await entryOf(saleD.dealId);
  await CM('approve-entries', { token: fin.token, body: { entry_ids: [eD.id] } });
  r = await CM('create-batch', { token: fin.token, body: { mode: 'provider', entry_ids: [eD.id] } });
  check('a provider batch is refused until the rep\'s payout account is VERIFIED', r.status === 409 && /no verified payout account/.test(r.body.error));
  let w = await webhook({ id: 'evt_acct_1', type: 'account.updated', data: { object: { id: acctId, details_submitted: true, payouts_enabled: true } } });
  check('a verified account.updated callback marks the payout account verified', w.code === 200 && (await env.sql("select status from sales_payout_accounts where rep_user_id=$1", [repB.id])).rows[0].status === 'verified');
  r = await CM('create-batch', { token: fin.token, body: { mode: 'provider', entry_ids: [eD.id] } }); const pb = r.body.batch;
  r = await CM('approve-batch', { token: owner.token, body: { batch_id: pb.id, confirm_total_cents: pb.total_cents, confirm_count: 1 } });
  r = await CM('execute-batch', { token: fin.token, body: { batch_id: pb.id } });
  check('finance cannot execute a payout batch', r.status === 403);
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: pb.id } });
  const po = (await env.sql("select * from sales_payouts where batch_id=$1", [pb.id])).rows[0];
  check('execute sends ONE transfer with an idempotency key, and the payout is PROCESSING — not Paid', r.status === 200 && r.body.results[0].result === 'submitted_awaiting_confirmation' && po.status === 'processing' && !!po.provider_transfer_id && S.transfers.size === 1 && (await entryOf(saleD.dealId)).status === 'scheduled');
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: pb.id } });
  check('executing again does not send a second transfer', S.transfers.size === 1 && r.body.results[0].result === 'already_processing');
  const evTransfer = (id, amount = po.amount_cents) => ({ id, type: 'transfer.created', data: { object: { id: po.provider_transfer_id, amount, currency: 'usd', metadata: { sales_payout_id: po.id } } } });
  w = await webhook(evTransfer('evt_tr_bad', po.amount_cents + 1));
  check('a callback with the WRONG amount does not mark it paid and alerts the owner', (await env.sql("select status from sales_payouts where id=$1", [po.id])).rows[0].status === 'processing' && (await env.sql("select count(*) from sales_notifications where kind='payout_mismatch'")).rows[0].count !== '0');
  w = await webhook(evTransfer('evt_tr_1'), { secret: 'whsec_wrong' });
  check('a forged callback is rejected', w.code === 400 && (await env.sql("select status from sales_payouts where id=$1", [po.id])).rows[0].status === 'processing');
  w = await webhook(evTransfer('evt_tr_1'));
  check('the verified callback marks the payout Paid, the entry Paid, and completes the batch', (await env.sql("select status, provider_event_id from sales_payouts where id=$1", [po.id])).rows[0].status === 'paid' && (await entryOf(saleD.dealId)).status === 'paid' && (await env.sql("select status from sales_payout_batches where id=$1", [pb.id])).rows[0].status === 'completed');
  const evCount = (await env.sql("select count(*) from sales_commission_events")).rows[0].count;
  w = await webhook(evTransfer('evt_tr_1'));
  check('a duplicate callback changes nothing', w.code === 200 && (await env.sql("select count(*) from sales_commission_events")).rows[0].count === evCount);
  r = await CM('earnings', { method: 'GET', token: repB.token });
  check('the rep sees "Confirmed by the payment provider"', r.body.payouts[0].confirmation === 'Confirmed by the payment provider' && r.body.payout_account.status === 'verified');

  // ---- failures
  const saleE = await closeSale(repB); await saleE.verify(); const eE = await entryOf(saleE.dealId);
  await CM('approve-entries', { token: fin.token, body: { entry_ids: [eE.id] } });
  let b3 = (await CM('create-batch', { token: fin.token, body: { mode: 'provider', entry_ids: [eE.id] } })).body.batch;
  await CM('approve-batch', { token: owner.token, body: { batch_id: b3.id, confirm_total_cents: b3.total_cents, confirm_count: 1 } });
  S.failNext = 'decline';
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: b3.id } });
  check('a definite provider decline marks the payout and entry FAILED and alerts the owner', r.body.results[0].result === 'failed' && (await entryOf(saleE.dealId)).status === 'failed' && (await env.sql("select count(*) from sales_notifications where kind='payout_failed'")).rows[0].count !== '0');
  r = await CM('retry-failed', { token: fin.token, body: { entry_id: eE.id } });
  check('finance cannot retry a failed payout (owner decision)', r.status === 403);
  r = await CM('retry-failed', { token: owner.token, body: { entry_id: eE.id } });
  check('the owner returns it to Owner Approved for a NEW batch', r.status === 200 && (await entryOf(saleE.dealId)).status === 'owner_approved');
  b3 = (await CM('create-batch', { token: fin.token, body: { mode: 'provider', entry_ids: [eE.id] } })).body.batch;
  await CM('approve-batch', { token: owner.token, body: { batch_id: b3.id, confirm_total_cents: b3.total_cents, confirm_count: 1 } });
  S.failNext = 'drop'; const before = S.transfers.size;
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: b3.id } });
  const po3 = (await env.sql("select * from sales_payouts where batch_id=$1", [b3.id])).rows[0];
  check('an UNKNOWN outcome (connection dropped) is flagged for reconciliation, not marked failed or paid', r.body.results[0].result === 'outcome_unknown_retry_is_safe' && po3.needs_reconciliation === true && po3.status === 'scheduled');
  r = await CM('execute-batch', { token: owner.token, body: { batch_id: b3.id } });
  check('retrying uses the SAME idempotency key so the provider cannot pay twice', r.body.results[0].result === 'submitted_awaiting_confirmation' && S.transfers.size === before + 1 && S.calls.filter((c) => c.idem === po3.idempotency_key).length === 2);

  // ================================================================== reversals
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
  const saleF = await closeSale(repA, { pay: 'none' }); const pF = await CP('pay', { body: { token: saleF.token } });
  const sessF = (await env.sql("select id, provider_session_id from sales_payments where proposal_id=$1", [saleF.propId])).rows[0];
  await webhook({ id: 'evt_pay_F', type: 'checkout.session.completed', data: { object: { id: sessF.provider_session_id, payment_status: 'paid', amount_total: 50000, currency: 'usd', payment_intent: 'pi_F', metadata: { sales_payment_id: sessF.id } } } }).catch(() => null);
  check('a client pays through the hosted checkout and the verified event marks it paid', pF.status === 200 && (await env.sql('select status from sales_payments where id=$1', [sessF.id])).rows[0].status === 'paid');
  const saleG = await closeSale(repA, { pay: 'manual' }); await saleG.verify(); let eG = await entryOf(saleG.dealId);
  await env.sql("update sales_payments set paid_at = now() - interval '9 days', provider_payment_intent='pi_G' where deal_id=$1", [saleG.dealId]);
  await CM('sweep', { method: 'POST', token: owner.token }); eG = await entryOf(saleG.dealId);
  check('(setup) sale G is Eligible', ['eligible'].includes(eG.status), eG.status);
  w = await webhook({ id: 'evt_refund_G', type: 'charge.refunded', data: { object: { id: 'ch_G', payment_intent: 'pi_G' } } });
  eG = await entryOf(saleG.dealId);
  check('a verified REFUND before payout reverses the unpaid commission and tells the rep', eG.status === 'reversed' && (await env.sql("select count(*) from sales_notifications where kind='commission_reversed'")).rows[0].count !== '0');
  await env.sql("update sales_payments set provider_payment_intent='pi_D' where deal_id=$1", [saleD.dealId]);
  w = await webhook({ id: 'evt_refund_D', type: 'charge.refunded', data: { object: { id: 'ch_D', payment_intent: 'pi_D' } } });
  const adj = (await env.sql("select * from sales_commission_entries where kind='adjustment'")).rows[0];
  check('a refund AFTER the commission was paid creates a negative ADJUSTMENT for the owner to decide — never a silent clawback', !!adj && adj.amount_cents === -(await entryOf(saleD.dealId)).amount_cents && adj.status === 'pending_conditions' && (await entryOf(saleD.dealId)).status === 'paid');
  r = await CM('resolve-adjustment', { token: fin.token, body: { entry_id: adj.id, resolution: 'waive', note: 'Waived: client re-paid by another route' } });
  check('finance cannot resolve a clawback', r.status === 403);
  r = await CM('resolve-adjustment', { token: owner.token, body: { entry_id: adj.id, resolution: 'waive', note: 'short' } });
  check('resolving needs a documented decision', r.status === 422);
  r = await CM('resolve-adjustment', { token: owner.token, body: { entry_id: adj.id, resolution: 'waive', note: 'Waived: client re-paid by another route, evidence in file' } });
  check('owner resolves the adjustment with evidence', r.status === 200 && (await env.sql("select status from sales_commission_entries where id=$1", [adj.id])).rows[0].status === 'cancelled');

  // ================================================================== visibility, reports, safety switches
  r = await CM('earnings', { method: 'GET', token: repB.token });
  check("a rep's earnings contain only that rep's entries", r.body.entries.every((e) => e.rep_user_id === repB.id));
  r = await CM('team-ledger', { method: 'GET', token: mgr.token });
  check("a manager's team ledger is scoped to their own reps", r.status === 200 && r.body.entries.length > 0 && r.body.entries.every((e) => e.rep_user_id === repA.id));
  r = await CM('team-ledger', { method: 'GET', token: mgr2.token });
  check("the other manager sees only their rep", r.body.entries.every((e) => e.rep_user_id === repB.id));
  r = await CM('ledger', { method: 'GET', token: fin.token });
  check('finance sees the whole ledger with status labels', r.status === 200 && r.body.entries.length >= 5 && r.body.entries.every((e) => e.status_label));
  r = await CM('report', { method: 'GET', token: fin.token });
  check('the report separates estimated / pending / eligible / paid and counts failures & open adjustments', r.status === 200 && 'estimated_not_earned_cents' in r.body.totals && typeof r.body.payout_failures === 'number' && typeof r.body.open_adjustments === 'number');
  r = await CM('export-csv', { method: 'GET', token: fin.token });
  check('CSV export works for finance', r.status === 200 && String(r.body).startsWith('entry_id,kind,rep,deal_id,status'));
  r = await CM('export-csv', { method: 'GET', token: repA.token });
  check('reps cannot export the ledger', r.status === 403);
  const dEnt = await env.rest(repA.token, 'sales_commission_entries?select=id'); const dPo = await env.rest(repA.token, 'sales_payouts?select=id'); const dAc = await env.rest(repA.token, 'sales_payout_accounts?select=id');
  check('ledger, payouts and payout accounts are not readable straight through PostgREST', [dEnt, dPo, dAc].every((x) => (Array.isArray(x.data) ? x.data.length === 0 : x.status >= 400)));
  process.env.STRIPE_SECRET_KEY = 'sk_live_pretend'; delete process.env.SALES_ALLOW_LIVE_STRIPE;
  r = await CM('payout-onboarding-link', { token: repA.token, body: {} });
  check('a LIVE Stripe key is refused for payouts unless the owner explicitly enabled live mode', r.status === 409);
  const cl = await CP('pay', { body: { token: saleG.token } });
  check('...and for client charges', cl.status === 409 && /LIVE Stripe key/.test(cl.body.error));
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { srv.close(); await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
