// Card payments for client businesses (Nova system 17).
//
// Each business connects its OWN Stripe account. A customer pays a deposit or balance invoice on
// Stripe's hosted page, and the charge is made directly on the business's account (the
// `Stripe-Account` header), so the money goes to the business and Nova never holds it. A payment
// is recorded only from Stripe's signed event, through the same recordPayment the owner uses, and
// it is labelled 'provider_verified'. The journey then moves on by itself; an invoice counts as
// paid only when the money covers it in full (that rule lives in recordPayment and advance).
//
// Nothing here runs unless Isaac switches it on (NOVA_CARD_PAYMENTS=on) after setting up Stripe
// Connect. A live Stripe key additionally needs NOVA_CARD_PAYMENTS_LIVE=yes.
//
// Account type: 'standard' by default. With Standard accounts Stripe sets and collects its own
// processing fees from each business, which Stripe's Connect pricing lists as no fees for the
// platform. 'express' (NOVA_CONNECT_ACCOUNT_TYPE=express) gives a simpler dashboard, but the
// platform pays Stripe per active account and per payout, so it needs Isaac's yes on that cost.
import { stripeRequest } from './_stripe.js';
import { recordPayment, recordStep } from './_journey.js';

const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const NOT_AVAILABLE = 'Paying by card is not available for this business yet. The business will confirm other ways to pay.';

export function cardPaymentsSwitch(env = process.env) {
  const key = env.STRIPE_SECRET_KEY || '';
  if (!key) return { on: false, reason: 'Stripe is not set up for Nova yet.' };
  if (env.NOVA_CARD_PAYMENTS !== 'on') return { on: false, reason: 'Card payments are switched off. Nova switches them on once Stripe Connect is set up.' };
  if (key.startsWith('sk_live') && env.NOVA_CARD_PAYMENTS_LIVE !== 'yes') return { on: false, reason: 'A live Stripe key is present, but live card payments have not been approved yet.' };
  return { on: true, mode: key.startsWith('sk_live') ? 'live' : 'test' };
}

const accountType = (env) => (env.NOVA_CONNECT_ACCOUNT_TYPE === 'express' ? 'express' : 'standard');
const defaultStripe = (env) => (method, path, body, opts) => stripeRequest(env.STRIPE_SECRET_KEY, method, path, body, opts);
export const appBase = (env = process.env) => (env.APP_BASE_URL || 'https://nova-systems.app').replace(/\/$/, '');

// What the owner sees. The account id stays on the server.
function view(acct, sw) {
  if (!acct) return { connected: false, ready: false, switch_on: sw.on, mode: sw.mode || null, note: sw.on ? 'Not connected yet.' : sw.reason };
  return {
    connected: true, account_type: acct.account_type, ready: acct.charges_enabled === true && sw.on,
    charges_enabled: acct.charges_enabled === true, payouts_enabled: acct.payouts_enabled === true, details_submitted: acct.details_submitted === true,
    switch_on: sw.on, mode: sw.mode || null,
    note: !sw.on ? sw.reason : acct.charges_enabled ? 'Customers can pay invoices by card. The money goes to your own Stripe account.' : 'Finish the Stripe sign-up to take card payments.',
  };
}

export async function paymentStatus(db, orgId, { env = process.env } = {}) {
  return view(await one(db, 'business_payment_accounts', { organization_id: orgId }), cardPaymentsSwitch(env));
}

// Creates the business's Stripe account once (the idempotency key makes a retry return the same
// account), then returns a one-time Stripe sign-up link. Stripe collects the bank, identity and
// tax details on its own page; Nova never sees them.
export async function startOnboarding(db, { orgId, businessName, env = process.env, stripe = defaultStripe(env) }) {
  const sw = cardPaymentsSwitch(env);
  if (!sw.on) throw fail('card_payments_off', sw.reason);
  let acct = await one(db, 'business_payment_accounts', { organization_id: orgId });
  if (!acct) {
    const type = accountType(env);
    const created = await stripe('POST', 'accounts', {
      type, country: 'US', metadata: { organization_id: orgId },
      ...(businessName ? { business_profile: { name: businessName } } : {}),
      ...(type === 'express' ? { capabilities: { card_payments: { requested: true }, transfers: { requested: true } } } : {}),
    }, { idempotencyKey: `biz-acct:${orgId}` });
    try {
      acct = await db.insert('business_payment_accounts', { organization_id: orgId, provider: 'stripe', account_id: created.id, account_type: type, livemode: sw.mode === 'live', charges_enabled: created.charges_enabled === true, payouts_enabled: created.payouts_enabled === true, details_submitted: created.details_submitted === true });
    } catch (err) {
      if (err.status !== 409) throw err;
      acct = await one(db, 'business_payment_accounts', { organization_id: orgId });
    }
  }
  const back = `${appBase(env)}/dashboard/business?payments=`;
  const link = await stripe('POST', 'account_links', { account: acct.account_id, type: 'account_onboarding', refresh_url: `${back}refresh`, return_url: `${back}return` });
  return { url: link.url, status: view(acct, sw) };
}

// Reads the account from Stripe and saves whether it can take payments yet.
export async function refreshAccount(db, { orgId, env = process.env, stripe = defaultStripe(env) }) {
  const sw = cardPaymentsSwitch(env);
  const acct = await one(db, 'business_payment_accounts', { organization_id: orgId });
  if (!acct) return view(null, sw);
  if (!sw.on) return view(acct, sw);
  const a = await stripe('GET', `accounts/${encodeURIComponent(acct.account_id)}`);
  const patch = { charges_enabled: a.charges_enabled === true, payouts_enabled: a.payouts_enabled === true, details_submitted: a.details_submitted === true, updated_at: new Date().toISOString() };
  const rows = await db.update('business_payment_accounts', { id: acct.id, organization_id: orgId }, patch);
  return view(rows[0] || { ...acct, ...patch }, sw);
}

export async function canPayOnline(db, orgId, { env = process.env } = {}) {
  if (!cardPaymentsSwitch(env).on) return false;
  const acct = await one(db, 'business_payment_accounts', { organization_id: orgId });
  return acct?.charges_enabled === true;
}

// What is still owed on the invoice the journey is waiting on, from the saved records only.
export async function amountDue(db, j) {
  if (j.stage === 'balance_due') return j.total_cents - j.paid_cents;
  if (j.stage !== 'deposit_due') return 0;
  const svc = await one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id });
  return Math.min(svc?.deposit_cents || 0, j.total_cents) - j.paid_cents;
}

async function openInvoice(db, j) {
  const kind = j.stage === 'deposit_due' ? 'deposit_invoice' : j.stage === 'balance_due' ? 'balance_invoice' : null;
  if (!kind) return null;
  const inv = (await db.select('journey_documents', { journey_id: j.id, kind })).pop();
  return inv && inv.status === 'issued' ? inv : null;
}

// The customer pressed "Pay by card". Returns Stripe's page for exactly what is still owed.
// Pressing it again within the same hour returns the same page, so one click is one payment.
export async function createPayLink(db, j, { env = process.env, stripe = defaultStripe(env), now = new Date() } = {}) {
  if (!cardPaymentsSwitch(env).on) throw fail('card_payments_off', NOT_AVAILABLE);
  const acct = await one(db, 'business_payment_accounts', { organization_id: j.organization_id });
  if (acct?.charges_enabled !== true) throw fail('card_payments_off', NOT_AVAILABLE);
  const inv = await openInvoice(db, j);
  const due = inv ? await amountDue(db, j) : 0;
  if (!inv || !(due > 0)) throw fail('nothing_due', 'There is nothing to pay right now.');
  const svc = await one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id });
  const contact = await one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id });
  const label = `${inv.kind === 'deposit_invoice' ? 'Deposit' : 'Balance'} for ${svc?.name || 'your service'}`;
  const meta = { organization_id: j.organization_id, journey_id: j.id, document_id: inv.id, invoice_kind: inv.kind, amount_due_cents: String(due) };
  const back = `${appBase(env)}/start?org=${j.organization_id}`;
  const hour = Math.floor(now.getTime() / 3_600_000);
  const session = await stripe('POST', 'checkout/sessions', {
    mode: 'payment', client_reference_id: j.id,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: due, product_data: { name: label } } }],
    metadata: meta, payment_intent_data: { description: label, metadata: meta },
    ...(contact?.email ? { customer_email: contact.email } : {}),
    success_url: `${back}&paid=1`, cancel_url: `${back}&paid=0`,
  }, { stripeAccount: acct.account_id, idempotencyKey: `pay:${inv.id}:${due}:${j.paid_cents}:${hour}` });
  await recordStep(db, j, { agent: 'accounting', handed_to: 'customer', action: 'card_payment_page_opened', key: `paylink:${session.id}`, status: 'waiting_customer', detail: { amount_cents: due, invoice: inv.kind } });
  return { url: session.url, amount_cents: due };
}

// One event from Stripe's Connect webhook, already signature-checked by the caller. Records the
// payment once (the payment reference makes a repeated event a no-op). Returns what happened.
export async function handleConnectEvent(db, event, { now = new Date() } = {}) {
  const type = event?.type;
  if (!event?.account) return { handled: false, reason: 'not_a_connected_account_event' };
  const acct = await one(db, 'business_payment_accounts', { account_id: event.account });
  if (!acct) return { handled: false, reason: 'unknown_account' };

  if (type === 'account.updated') {
    const a = event.data?.object || {};
    await db.update('business_payment_accounts', { id: acct.id, organization_id: acct.organization_id }, { charges_enabled: a.charges_enabled === true, payouts_enabled: a.payouts_enabled === true, details_submitted: a.details_submitted === true, updated_at: now.toISOString() });
    return { handled: true, reason: 'account_updated' };
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type)) return { handled: false, reason: 'ignored_event' };

  const s = event.data?.object || {};
  if (event.livemode !== acct.livemode) return { handled: false, reason: 'test_and_live_mixed' };
  if (s.mode !== 'payment' || s.payment_status !== 'paid') return { handled: false, reason: 'not_paid_yet' };
  const md = s.metadata || {};
  // The event must come from the same business the payment page was made for.
  if (md.organization_id !== acct.organization_id) return { handled: false, reason: 'business_mismatch' };
  const j = await one(db, 'journeys', { id: md.journey_id, organization_id: acct.organization_id });
  if (!j) return { handled: false, reason: 'unknown_request' };
  const reference = `stripe:${s.payment_intent || s.id}`;
  const amount = s.amount_total;
  const flag = async (reason) => {
    await recordStep(db, j, { agent: 'accounting', handed_to: 'owner', action: 'card_payment_needs_review', key: `card-review:${reference}`, status: 'waiting_owner', detail: { amount_cents: amount, currency: s.currency, reference, reason } });
    return { handled: true, recorded: false, reason: 'needs_owner_review' };
  };
  if (String(s.currency).toLowerCase() !== 'usd' || !Number.isInteger(amount) || amount <= 0) return flag('Stripe reported a payment in an unexpected currency or amount. Check it in Stripe before doing anything else.');
  try {
    const next = await recordPayment(db, j, { amountCents: amount, source: 'provider_verified', reference }, { now });
    return { handled: true, recorded: true, next };
  } catch (err) {
    // The invoice was already settled (for example, the owner recorded a cash payment first).
    // The money is real, so it is never dropped: the owner is asked to check it and refund.
    if (err.code === 'wrong_stage') return flag('A card payment arrived after this invoice was already settled. Check it in Stripe and refund it if the customer paid twice.');
    throw err;
  }
}
