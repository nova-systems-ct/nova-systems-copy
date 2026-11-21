// Card payments for client businesses (api/_cardPayments.js, system 17). Runs against the same
// in-memory store as the journey tests and a stand-in for Stripe. No real Stripe account, card or
// database is contacted. Prices are TEST FIXTURES, not anyone's real prices.
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startJourney, acceptQuote, completeWork, chooseSlot, recordPayment, handleJourney } from '../api/_journey.js';
import { cardPaymentsSwitch, startOnboarding, refreshAccount, canPayOnline, createPayLink, handleConnectEvent, paymentStatus } from '../api/_cardPayments.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = new Date('2026-11-21T15:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'], business_services: ['organization_id', 'name'], business_payment_accounts: ['organization_id'] };
const UNIQUE2 = { business_payment_accounts: ['account_id'] };

function memoryDb() {
  const t = {};
  const rows = (name) => (t[name] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  const clash = (name, row) => [UNIQUE[name], UNIQUE2[name]].some((u) => u && rows(name).some((r) => u.every((k) => r[k] === row[k])));
  return {
    t,
    select: async (name, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => {
      const [col, dir] = order.split('.');
      return rows(name).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r }));
    },
    insert: async (name, row) => {
      if (clash(name, row)) throw Object.assign(new Error('conflict'), { status: 409 });
      const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(name).length).toISOString(), _n: rows(name).length, ...row };
      rows(name).push(full); return { ...full };
    },
    update: async (name, f, patch) => rows(name).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })),
  };
}

// A stand-in for Stripe that remembers every call.
function fakeStripe({ chargesEnabledAfterSignup = true } = {}) {
  const calls = []; let n = 0;
  const fn = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, opts });
    if (method === 'POST' && path === 'accounts') return { id: `acct_test_${++n}`, charges_enabled: false, payouts_enabled: false, details_submitted: false };
    if (method === 'POST' && path === 'account_links') return { url: `https://connect.stripe.test/setup/${body.account}` };
    if (method === 'GET' && path.startsWith('accounts/')) return { id: decodeURIComponent(path.split('/')[1]), charges_enabled: chargesEnabledAfterSignup, payouts_enabled: chargesEnabledAfterSignup, details_submitted: true };
    if (method === 'POST' && path === 'checkout/sessions') return { id: `cs_test_${++n}`, url: `https://checkout.stripe.test/cs_test_${n}` };
    throw new Error(`unexpected Stripe call ${method} ${path}`);
  };
  return { fn, calls };
}

const ON = { STRIPE_SECRET_KEY: 'sk_test_x', NOVA_CARD_PAYMENTS: 'on', APP_BASE_URL: 'https://preview.example.invalid' };
const fresh = async (db, id) => (await db.select('journeys', { id }))[0];
const actions = async (db, id) => (await db.select('journey_events', { journey_id: id })).map((e) => e.action);
const expectFail = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

async function seed() {
  const db = memoryDb();
  await db.insert('business_services', { organization_id: CC, name: 'Car detail', description: 'Inside and out.', keywords: ['detail'], price_cents: 19900, price_approved: true, deposit_cents: 5000, terms_text: null, terms_approved: false, active: true });
  await db.insert('business_services', { organization_id: OTHER, name: 'Car detail', keywords: ['detail'], price_cents: 9900, price_approved: true, deposit_cents: 2000, active: true });
  const slot = await db.insert('voice_calendar_slots', { organization_id: CC, service_name: 'Detail', start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z', status: 'open' });
  return { db, slot };
}
async function toDeposit(db) {
  const s = await startJourney(db, { orgId: CC, channel: 'web', eventId: crypto.randomUUID(), name: 'Dana Ruiz', email: 'dana@example.invalid', text: 'I need a car detail', now: NOW });
  const n = await acceptQuote(db, s.journey, { quoteId: s.next.quote.id, typedName: 'Dana Ruiz' }, { now: NOW });
  return { id: s.journey.id, token: s.token, next: n };
}
const paidEvent = (account, j, amount, extra = {}) => ({ id: `evt_${crypto.randomUUID()}`, type: 'checkout.session.completed', account, livemode: false, data: { object: { id: `cs_${crypto.randomUUID().slice(0, 8)}`, mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: amount, payment_intent: `pi_${crypto.randomUUID().slice(0, 12)}`, metadata: { organization_id: j.organization_id, journey_id: j.id }, ...extra } } });

// ============ 1. Off until Isaac switches it on ============================================
{
  check('off with no Stripe key', cardPaymentsSwitch({}).on === false);
  check('off with a Stripe key until NOVA_CARD_PAYMENTS=on', cardPaymentsSwitch({ STRIPE_SECRET_KEY: 'sk_test_x' }).on === false);
  check('a live key stays off until live payments are approved', cardPaymentsSwitch({ STRIPE_SECRET_KEY: 'sk_live_x', NOVA_CARD_PAYMENTS: 'on' }).on === false && cardPaymentsSwitch({ STRIPE_SECRET_KEY: 'sk_live_x', NOVA_CARD_PAYMENTS: 'on', NOVA_CARD_PAYMENTS_LIVE: 'yes' }).mode === 'live');
  const { db } = await seed(); const stripe = fakeStripe();
  check('connecting is refused while switched off, and Stripe is never called', await expectFail(startOnboarding(db, { orgId: CC, env: { STRIPE_SECRET_KEY: 'sk_test_x' }, stripe: stripe.fn }), 'card_payments_off') && stripe.calls.length === 0);
}

// ============ 2. The owner connects the business's own Stripe account ====================
{
  const { db } = await seed(); const stripe = fakeStripe();
  const out = await startOnboarding(db, { orgId: CC, businessName: 'Crystal Clear', env: ON, stripe: stripe.fn });
  const created = stripe.calls.find((c) => c.path === 'accounts');
  check('a Standard account is created by default (Stripe sets its own fees; no platform fee)', created.body.type === 'standard' && !created.body.capabilities && created.body.business_profile.name === 'Crystal Clear');
  check('account creation is idempotent per business', created.opts.idempotencyKey === `biz-acct:${CC}`);
  check('the owner gets Stripe\'s own sign-up page, returning to the Business desk', out.url.startsWith('https://connect.stripe.test/') && stripe.calls.find((c) => c.path === 'account_links').body.return_url === 'https://preview.example.invalid/dashboard/business?payments=return');
  await startOnboarding(db, { orgId: CC, env: ON, stripe: stripe.fn });
  check('connecting again reuses the same account', stripe.calls.filter((c) => c.path === 'accounts').length === 1 && db.t.business_payment_accounts.length === 1);
  check('no card payments before Stripe says the account can take them', !(await canPayOnline(db, CC, { env: ON })) && (await paymentStatus(db, CC, { env: ON })).ready === false);
  const st = await refreshAccount(db, { orgId: CC, env: ON, stripe: stripe.fn });
  check('after sign-up, the status read from Stripe turns card payments on', st.ready === true && await canPayOnline(db, CC, { env: ON }));
  check('the status shown to the owner never includes the Stripe account id', !JSON.stringify(st).includes('acct_'));
  const ex = fakeStripe(); const db2 = (await seed()).db;
  await startOnboarding(db2, { orgId: CC, env: { ...ON, NOVA_CONNECT_ACCOUNT_TYPE: 'express' }, stripe: ex.fn });
  check('Express is used only when chosen, with card payments requested', ex.calls[0].body.type === 'express' && ex.calls[0].body.capabilities.card_payments.requested === true);
}

// ============ 3. A customer pays the deposit by card; the journey moves on by itself ======
{
  const { db, slot } = await seed(); const stripe = fakeStripe();
  await startOnboarding(db, { orgId: CC, env: ON, stripe: stripe.fn }); await refreshAccount(db, { orgId: CC, env: ON, stripe: stripe.fn });
  const acct = db.t.business_payment_accounts[0].account_id;
  const { id, next } = await toDeposit(db);
  check('the deposit is invoiced first', next.stage === 'deposit_due' && next.invoice.amount_cents === 5000);
  const link = await createPayLink(db, await fresh(db, id), { env: ON, stripe: stripe.fn, now: NOW });
  const sess = stripe.calls.find((c) => c.path === 'checkout/sessions');
  check('the payment page is made on the business\'s own account (a direct charge)', sess.opts.stripeAccount === acct);
  check('the page charges exactly the deposit still owed, in dollars', sess.body.line_items[0].price_data.unit_amount === 5000 && sess.body.line_items[0].price_data.currency === 'usd' && link.amount_cents === 5000);
  check('Nova takes no fee from the payment', !('application_fee_amount' in sess.body) && !('application_fee_amount' in (sess.body.payment_intent_data || {})));
  check('the page sends the customer back to the same business\'s page', sess.body.success_url === `https://preview.example.invalid/start?org=${CC}&paid=1`);
  await createPayLink(db, await fresh(db, id), { env: ON, stripe: stripe.fn, now: new Date(NOW.getTime() + 60_000) });
  const keys = stripe.calls.filter((c) => c.path === 'checkout/sessions').map((c) => c.opts.idempotencyKey);
  check('pressing "Pay" twice in the same hour asks Stripe for the same page', keys.length === 2 && keys[0] === keys[1]);

  const j = await fresh(db, id);
  let out = await handleConnectEvent(db, { ...paidEvent('acct_someone_else', j, 5000) });
  check('an event from an unknown Stripe account records nothing', out.handled === false && (await fresh(db, id)).paid_cents === 0);
  out = await handleConnectEvent(db, paidEvent(acct, j, 5000, { payment_status: 'unpaid' }));
  check('a payment Stripe has not finished (for example a bank transfer) is not recorded yet', out.recorded !== true && (await fresh(db, id)).paid_cents === 0);
  out = await handleConnectEvent(db, paidEvent(acct, { ...j, organization_id: OTHER }, 5000));
  check('an event whose request belongs to another business records nothing', out.handled === false && out.reason === 'business_mismatch');
  const ev = paidEvent(acct, j, 5000);
  out = await handleConnectEvent(db, ev, { now: NOW });
  const after = await fresh(db, id);
  check('Stripe\'s confirmed payment is recorded and the journey moves to scheduling by itself', out.recorded === true && after.paid_cents === 5000 && after.stage === 'scheduling' && out.next.reason === 'choose_time');
  const receipt = db.t.journey_documents.find((d) => d.kind === 'receipt');
  check('the receipt says the payment provider confirmed it', receipt.payment_source === 'provider_verified' && receipt.body.includes('Confirmed by the payment provider') && receipt.payment_reference.startsWith('stripe:pi_'));
  check('the deposit invoice is marked paid', db.t.journey_documents.find((d) => d.kind === 'deposit_invoice').status === 'paid');
  await handleConnectEvent(db, ev, { now: NOW });
  check('Stripe sending the same event again does not count the money twice', (await fresh(db, id)).paid_cents === 5000 && db.t.journey_documents.filter((d) => d.kind === 'receipt').length === 1);

  // A card payment arriving after the invoice was settled is kept and sent to the owner.
  out = await handleConnectEvent(db, paidEvent(acct, await fresh(db, id), 5000), { now: NOW });
  check('a second, late card payment is never dropped: the owner is asked to check and refund', out.recorded === false && (await actions(db, id)).includes('card_payment_needs_review') && (await fresh(db, id)).paid_cents === 5000);
  check('nothing to pay while the job is being scheduled', await expectFail(createPayLink(db, await fresh(db, id), { env: ON, stripe: stripe.fn }), 'nothing_due'));

  // The balance, after the work is done.
  await chooseSlot(db, await fresh(db, id), slot.id, { now: NOW });
  await completeWork(db, await fresh(db, id), { note: 'Full interior and exterior detail, photos taken.', by: 'pro' }, { now: NOW });
  const bal = await fresh(db, id);
  check('after the work, only the balance is invoiced', bal.stage === 'balance_due' && bal.total_cents - bal.paid_cents === 14900);
  await createPayLink(db, bal, { env: ON, stripe: stripe.fn, now: NOW });
  check('the balance page charges the balance', stripe.calls.filter((c) => c.path === 'checkout/sessions').pop().body.line_items[0].price_data.unit_amount === 14900);
  out = await handleConnectEvent(db, paidEvent(acct, bal, 10000), { now: NOW });
  check('a payment that does not cover the balance is recorded but the job is not marked paid', out.recorded === true && (await fresh(db, id)).stage === 'balance_due' && (await fresh(db, id)).paid_cents === 15000);
  out = await handleConnectEvent(db, paidEvent(acct, await fresh(db, id), 4900), { now: NOW });
  const done = await fresh(db, id);
  check('once the balance is covered in full the job closes with the owner report', done.stage === 'closed' && done.paid_cents === 19900);
  const report = db.t.journey_documents.find((d) => d.kind === 'owner_report');
  check('the owner report separates provider-confirmed money from entries by a person', report.body.includes('$199.00 confirmed by the payment provider') && report.body.includes('$0.00 entered by a person'));
}

// ============ 4. Guard rails ===============================================================
{
  const { db } = await seed(); const stripe = fakeStripe({ chargesEnabledAfterSignup: false });
  await startOnboarding(db, { orgId: CC, env: ON, stripe: stripe.fn }); await refreshAccount(db, { orgId: CC, env: ON, stripe: stripe.fn });
  const { id } = await toDeposit(db);
  check('no payment page while the business\'s Stripe sign-up is unfinished', await expectFail(createPayLink(db, await fresh(db, id), { env: ON, stripe: stripe.fn }), 'card_payments_off') && !stripe.calls.some((c) => c.path === 'checkout/sessions'));
  db.t.business_payment_accounts[0].charges_enabled = true;
  check('no payment page when card payments are switched off, even with a ready account', await expectFail(createPayLink(db, await fresh(db, id), { env: { STRIPE_SECRET_KEY: 'sk_test_x' }, stripe: stripe.fn }), 'card_payments_off'));
  const acct = db.t.business_payment_accounts[0].account_id; const j = await fresh(db, id);
  let out = await handleConnectEvent(db, paidEvent(acct, j, 5000, { currency: 'eur' }));
  check('a payment in another currency is not counted; the owner is asked to check it', out.recorded === false && (await fresh(db, id)).paid_cents === 0 && (await actions(db, id)).includes('card_payment_needs_review'));
  out = await handleConnectEvent(db, { ...paidEvent(acct, j, 5000), livemode: true });
  check('a live event cannot pay a test-mode request', out.handled === false && (await fresh(db, id)).paid_cents === 0);
  out = await handleConnectEvent(db, { type: 'account.updated', account: acct, data: { object: { id: acct, charges_enabled: false, payouts_enabled: false, details_submitted: true } } });
  check('Stripe telling Nova an account was restricted turns card payments off for it', out.handled && !(await canPayOnline(db, CC, { env: ON })));
  await recordPayment(db, await fresh(db, id), { amountCents: 5000, source: 'owner_recorded', reference: 'cash-1' }, { now: NOW });
  check('a person can still record cash; that stays labelled as entered by a person', db.t.journey_documents.find((d) => d.kind === 'receipt').payment_source === 'owner_recorded');
}

// ============ 5. HTTP: the customer page and the owner's buttons ==========================
{
  const { db } = await seed();
  Object.assign(process.env, ON, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', STRIPE_API_BASE: 'https://stripe.test/v1' });
  const stripeLog = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (u.host === 'stripe.test') {
      const path = u.pathname.replace('/v1/', ''); stripeLog.push({ path, headers: init.headers || {}, body: init.body || '' });
      if (path === 'accounts' && init.method === 'POST') return json(200, { id: 'acct_http_1', charges_enabled: false });
      if (path === 'account_links') return json(200, { url: 'https://connect.stripe.test/setup' });
      if (path.startsWith('accounts/')) return json(200, { id: 'acct_http_1', charges_enabled: true, payouts_enabled: true, details_submitted: true });
      if (path === 'checkout/sessions') return json(200, { id: 'cs_http_1', url: 'https://checkout.stripe.test/cs_http_1' });
      return json(404, { error: { message: 'unknown' } });
    }
    const table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : v.slice(3));
    try {
      if (!init.method) return json(200, await db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
      return json(200, await db.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  const deps = (staff, allowed) => ({ requireStaff: async (_r, res) => { if (!staff) res.status(401).json({ error: 'login' }); return staff ? { id: 'u1', email: 'owner@example.invalid' } : null; }, requireOrgAccess: async (_r, res) => { if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true });
  const call = async (method, op, payload, d = deps(false, false)) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined }, res, op, d); return res; };

  const { id, token } = await toDeposit(db);
  let r = await call('POST', 'status', { journey_id: id, token });
  check('before the business connects Stripe, the customer is not offered card payment', r.code === 200 && r.body.next.invoice && !r.body.next.can_pay_online);
  r = await call('POST', 'pay', { journey_id: id, token });
  check('and asking to pay by card says it is not available', r.code === 409 && r.body.code === 'card_payments_off');
  r = await call('POST', 'card-payments-connect', { organization_id: CC }, deps(true, false));
  check('staff from outside the business cannot connect its Stripe account', r.code === 403 && !stripeLog.length);
  r = await call('POST', 'card-payments-connect', { organization_id: CC }, deps(true, true));
  check('the owner gets the Stripe sign-up link', r.code === 200 && r.body.url === 'https://connect.stripe.test/setup' && r.body.payments.connected === true);
  r = await call('POST', 'card-payments-refresh', { organization_id: CC }, deps(true, true));
  check('after sign-up the owner sees card payments on', r.code === 200 && r.body.payments.ready === true);
  r = await call('GET', 'card-payments', { organization_id: CC }, deps(true, true));
  check('the Money owed tab can read the status', r.code === 200 && r.body.payments.ready === true);
  r = await call('POST', 'status', { journey_id: id, token });
  check('now the customer is offered "Pay by card"', r.body.next.can_pay_online === true && /Pay by card/.test(r.body.next.message));
  r = await call('POST', 'pay', { journey_id: id, token: 'f'.repeat(64) });
  check('a wrong link token cannot open a payment page', r.code === 404);
  r = await call('POST', 'pay', { journey_id: id, token });
  const sess = stripeLog.find((x) => x.path === 'checkout/sessions');
  check('the customer\'s own link opens Stripe\'s page on the business\'s account', r.code === 200 && r.body.url === 'https://checkout.stripe.test/cs_http_1' && sess.headers['Stripe-Account'] === 'acct_http_1' && sess.body.includes('unit_amount%5D=5000'));
}

// ============ 6. The webhook only accepts events signed by Stripe ==========================
{
  const { default: handler } = await import('../api/stripe.js');
  const send = async (body, header, secret) => {
    if (secret === undefined) delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET; else process.env.STRIPE_CONNECT_WEBHOOK_SECRET = secret;
    const req = Readable.from([Buffer.from(body)]); req.headers = { 'stripe-signature': header }; req.query = { action: 'connect-webhook' }; req.method = 'POST';
    const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } };
    await handler(req, res); return res;
  };
  const body = JSON.stringify({ id: 'evt_1', type: 'ping', account: 'acct_none' });
  const sign = (secret, ts = Math.floor(Date.now() / 1000)) => `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;
  check('with no signing secret configured, events are refused', (await send(body, sign('whsec_a'), undefined)).code === 503);
  check('an event with a wrong signature is refused', (await send(body, sign('whsec_wrong'), 'whsec_a')).code === 400);
  check('an old, replayed signature is refused', (await send(body, sign('whsec_a', Math.floor(Date.now() / 1000) - 900), 'whsec_a')).code === 400);
  const ok = await send(body, sign('whsec_a'), 'whsec_a');
  check('a correctly signed event is accepted and handed to the card-payment rules', ok.code === 200 && ok.body.handled === false && ok.body.reason === 'unknown_account');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
