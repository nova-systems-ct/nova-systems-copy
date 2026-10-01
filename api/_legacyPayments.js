// Legacy (non-Sales-Team) payments: client_invoices and /onboard clients.
//
// Security repair 2026-09-30 (audit F-05). Every amount is computed from the stored record, never
// from a request body, and "Paid" is written only when a signature-verified Stripe event matches
// the stored record exactly: same mode (live/test), succeeded/paid status, currency, amount, record
// id and organization. Owner-recorded external payments stay possible but are labelled separately
// (payment_source = 'owner_recorded', with evidence) — see api/client.js record-payment.
import { stripeRequest } from './_stripe.js';
import { stripeAllowed } from './_sales/payments.js';
import { ONBOARD_TIERS, dollarsToCents } from './_onboardTiers.js';
import { sendEmail } from './_email.js';

const sb = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const H = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const enc = encodeURIComponent;
export const appBase = () => (process.env.APP_BASE_URL || 'https://nova-systems.app').replace(/\/$/, '');
export const expectedLiveMode = () => String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live');

async function getOne(path) {
  const { url, key } = sb();
  const r = await fetch(`${url}/rest/v1/${path}${path.includes('limit=') ? '' : '&limit=1'}`, { headers: H(key) });
  return r.ok ? ((await r.json())[0] || null) : null;
}

// PATCH that tolerates the repair migration not being applied yet: if the extra audit columns are
// rejected, retry with the core status fields only, so a verified payment is never lost.
async function patchWithFallback(path, full, core) {
  const { url, key } = sb();
  let r = await fetch(`${url}/rest/v1/${path}`, { method: 'PATCH', headers: { ...H(key), Prefer: 'return=representation' }, body: JSON.stringify(full) });
  if (!r.ok && r.status === 400) r = await fetch(`${url}/rest/v1/${path}`, { method: 'PATCH', headers: { ...H(key), Prefer: 'return=representation' }, body: JSON.stringify(core) });
  return r.ok ? r.json() : [];
}

export const invoiceAmountCents = (inv) => (Number.isFinite(Number(inv?.total)) && Number(inv.total) > 0 ? dollarsToCents(inv.total) : null);

export function onboardAmountCents(client) {
  const tier = Object.values(ONBOARD_TIERS).find((t) => t.name === client?.tier_name);
  if (!tier || Number(client?.tier_price) !== tier.price) return null; // stored plan must match a published tier exactly
  return dollarsToCents(tier.price);
}

export async function loadInvoice(invoiceId, orgId) {
  if (!invoiceId || !orgId) return null;
  return getOne(`client_invoices?id=eq.${enc(invoiceId)}&organization_id=eq.${enc(orgId)}&select=*`);
}
export async function loadInvoiceClient(inv) {
  if (!inv?.client_id) return null;
  return getOne(`clients?id=eq.${enc(inv.client_id)}&organization_id=eq.${enc(inv.organization_id)}&select=id,full_name,business_name,email`);
}

// Creates (or reuses, via Stripe idempotency) a Checkout session for a stored invoice.
export async function createInvoiceCheckout(inv, client) {
  const allowed = stripeAllowed(); if (!allowed.ok) return { error: allowed.reason, status: 409 };
  if (String(inv.status || '').toLowerCase() === 'paid') return { error: 'This invoice is already paid.', status: 409 };
  const cents = invoiceAmountCents(inv); if (!cents) return { error: 'The invoice has no payable total.', status: 409 };
  const session = await stripeRequest(process.env.STRIPE_SECRET_KEY, 'POST', 'checkout/sessions', {
    mode: 'payment',
    success_url: `${appBase()}/?invoice=paid`, cancel_url: `${appBase()}/?invoice=cancelled`,
    customer_email: client?.email || undefined,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Nova Systems — Invoice ${inv.invoice_number || inv.id}` } } }],
    metadata: { invoice_id: inv.id, organization_id: inv.organization_id, expected_amount_cents: String(cents) },
    payment_intent_data: { metadata: { invoice_id: inv.id, organization_id: inv.organization_id } },
  }, { idempotencyKey: `invoice-checkout:${inv.id}:${cents}` });
  return { url: session.url, id: session.id, amount_cents: cents };
}

// Payment intent for a pending /onboard client — amount from the stored plan only.
export async function createOnboardIntent(clientId) {
  const allowed = stripeAllowed(); if (!allowed.ok) return { error: allowed.reason, status: 409 };
  const client = await getOne(`clients?id=eq.${enc(clientId)}&select=id,email,tier_name,tier_price,payment_status,organization_id`);
  if (!client) return { error: 'Not found', status: 404 };
  if (String(client.payment_status || '').toLowerCase() === 'paid') return { error: 'Already paid.', status: 409 };
  const cents = onboardAmountCents(client); if (!cents) return { error: 'This plan cannot be paid online.', status: 409 };
  const intent = await stripeRequest(process.env.STRIPE_SECRET_KEY, 'POST', 'payment_intents', {
    amount: cents, currency: 'usd', description: `Nova Systems — ${client.tier_name}`,
    receipt_email: client.email || undefined, 'automatic_payment_methods[enabled]': 'true',
    metadata: { client_id: client.id, organization_id: client.organization_id || '', expected_amount_cents: String(cents) },
  }, { idempotencyKey: `onboard-intent:${client.id}:${cents}` });
  return { client_secret: intent.client_secret, payment_intent_id: intent.id, amount_cents: cents };
}

// Called ONLY after api/stripe.js verified the signature and the Sales Team handler confirmed this
// event id has not been processed before. Returns { applied, reason }.
export async function applyLegacyStripeEvent(event) {
  const obj = event.data?.object || {};
  const type = event.type;
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded'].includes(type)) return { applied: false, reason: 'not a legacy payment event' };
  if (Boolean(event.livemode) !== expectedLiveMode()) return { applied: false, reason: 'mode mismatch (live/test) — ignored' };
  const isSession = type.startsWith('checkout.session');
  const paidOk = isSession ? obj.payment_status === 'paid' : obj.status === 'succeeded';
  if (!paidOk) return { applied: false, reason: 'payment not in a succeeded state' };
  const currency = String(obj.currency || '').toLowerCase();
  const amount = isSession ? obj.amount_total : (obj.amount_received ?? obj.amount);
  const meta = obj.metadata || {};

  if (meta.invoice_id) {
    const inv = await loadInvoice(String(meta.invoice_id).slice(0, 60), String(meta.organization_id || '').slice(0, 60));
    if (!inv) return { applied: false, reason: 'invoice not found in the stated organization' };
    const expected = invoiceAmountCents(inv);
    if (currency !== 'usd' || amount !== expected) { console.error('[stripe:legacy] invoice amount/currency mismatch — NOT marked paid', { invoice: inv.id, amount, expected, currency }); return { applied: false, reason: 'amount or currency mismatch' }; }
    const now = new Date().toISOString();
    const rows = await patchWithFallback(`client_invoices?id=eq.${enc(inv.id)}&organization_id=eq.${enc(inv.organization_id)}&status=neq.Paid`,
      { status: 'Paid', paid_at: now, stripe_payment_intent: obj.payment_intent || obj.id || null, payment_source: 'stripe', provider_event_id: event.id },
      { status: 'Paid', paid_at: now, stripe_payment_intent: obj.payment_intent || obj.id || null });
    if (rows.length && process.env.ISAAC_ALERT_EMAIL !== 'off') {
      await sendEmail({ to: 'Isaac_0427@icloud.com', subject: `Invoice paid — $${(amount / 100).toFixed(2)}`, text: `Invoice ${inv.invoice_number || inv.id} was paid (confirmed by Stripe event ${event.id}).`, idempotencyKey: `invpaid:${event.id}` });
    }
    return { applied: rows.length > 0, reason: rows.length ? 'invoice marked paid' : 'already paid' };
  }

  if (meta.client_id) {
    const client = await getOne(`clients?id=eq.${enc(String(meta.client_id).slice(0, 60))}&select=id,email,tier_name,tier_price,payment_status,organization_id`);
    if (!client) return { applied: false, reason: 'client not found' };
    const expected = onboardAmountCents(client);
    if (currency !== 'usd' || !expected || amount !== expected) { console.error('[stripe:legacy] onboard amount/currency mismatch — NOT marked paid', { client: client.id, amount, expected, currency }); return { applied: false, reason: 'amount or currency mismatch' }; }
    const now = new Date().toISOString();
    const rows = await patchWithFallback(`clients?id=eq.${enc(client.id)}&payment_status=neq.Paid`,
      { payment_status: 'Paid', status: 'Active', first_payment_date: now, payment_source: 'stripe', provider_event_id: event.id },
      { payment_status: 'Paid', status: 'Active', first_payment_date: now });
    if (rows.length && client.email) {
      await sendEmail({ to: client.email, subject: 'Payment received — Nova Systems', text: `Thank you. Your payment of $${(amount / 100).toFixed(2)} for ${client.tier_name} was confirmed by our payment provider. Nova will contact you to schedule the kickoff.\n\nNova Systems`, idempotencyKey: `onbpaid:${event.id}` });
    }
    return { applied: rows.length > 0, reason: rows.length ? 'client marked paid' : 'already paid' };
  }
  return { applied: false, reason: 'no legacy metadata' };
}
