// Client payments for sold proposals. The AMOUNT always comes from the proposal (never from a request); "paid" is set only by a
// verified provider event (Stripe webhook, signature checked in api/stripe.js) or by an OWNER recording evidence-backed manual payment.
// A redirect back from the payment page proves nothing and changes nothing.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { stripeRequest } from '../_stripe.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm, visibleRepUserIds, notify, notifyOwners, appBase } from './core.js';

const env = () => process.env;
export const stripeKey = () => env().STRIPE_SECRET_KEY || null;
export function stripeAllowed() {
  const k = stripeKey(); if (!k) return { ok: false, reason: 'The payment provider is not configured.' };
  if (k.startsWith('sk_live') && env().SALES_ALLOW_LIVE_STRIPE !== 'yes') return { ok: false, reason: 'A LIVE Stripe key is present but live charges are blocked in this environment (set SALES_ALLOW_LIVE_STRIPE=yes only when the owner has approved going live).' };
  return { ok: true };
}

// ---- hooks so the commission ledger can react without this file depending on it
const hooks = { paymentReceived: [], paymentReversed: [], providerEvent: [], saleSubmitted: [], saleVerified: [], saleRejected: [] };
export const registerSalesHook = (name, fn) => { hooks[name].push(fn); };
export const runHooks = async (name, arg) => { for (const fn of hooks[name]) await fn(arg); };

export async function createCheckoutForProposal({ proposal, deal, token }) {
  const allowed = stripeAllowed(); if (!allowed.ok) return { error: allowed.reason, status: 409 };
  const due = proposal.payment_due_cents; if (!Number.isInteger(due) || due <= 0) return { error: 'This proposal has no payment due.', status: 409 };
  let pay = await dbOne(`sales_payments?proposal_id=eq.${enc(proposal.id)}&status=in.(pending,paid)&select=*`);
  if (pay?.status === 'paid') return { error: 'This proposal is already paid.', status: 409 };
  if (pay?.checkout_url) return { url: pay.checkout_url, payment: pay, reused: true };
  if (!pay) { const ins = await dbInsert('sales_payments', { deal_id: deal.id, proposal_id: proposal.id, amount_cents: due, currency: proposal.currency || 'USD', method: 'stripe_checkout', status: 'pending' }); pay = ins.row || (await dbOne(`sales_payments?proposal_id=eq.${enc(proposal.id)}&status=eq.pending&select=*`)); }
  const base = appBase();
  const session = await stripeRequest(stripeKey(), 'POST', 'checkout/sessions', {
    mode: 'payment', 'payment_method_types': ['card'], client_reference_id: pay.id,
    line_items: [{ quantity: 1, price_data: { currency: String(pay.currency || 'USD').toLowerCase(), unit_amount: pay.amount_cents, product_data: { name: `Nova Systems — ${proposal.title || 'Proposal'} (v${proposal.version})` } } }],
    metadata: { sales_payment_id: pay.id, deal_id: deal.id, proposal_id: proposal.id },
    payment_intent_data: { metadata: { sales_payment_id: pay.id } },
    success_url: `${base}/proposal/${token}?payment=return`, cancel_url: `${base}/proposal/${token}?payment=cancelled`,
  }, { idempotencyKey: `sales-pay:${pay.id}` });
  const [row] = await dbPatch('sales_payments', `id=eq.${enc(pay.id)}&status=eq.pending`, { provider_session_id: session.id, checkout_url: session.url });
  if (!deal.invoice_issued_at) await dbPatch('crm_deals', `id=eq.${enc(deal.id)}&invoice_issued_at=is.null`, { invoice_issued_at: nowIso() });
  return { url: session.url, payment: row };
}

async function markPaid(payment, { eventId = null, paymentIntent = null, manual = null } = {}) {
  const [row] = await dbPatch('sales_payments', `id=eq.${enc(payment.id)}&status=eq.pending`, { status: 'paid', paid_at: nowIso(), provider_event_id: eventId, provider_payment_intent: paymentIntent, ...(manual || {}) });
  if (!row) return null;
  await dbPatch('crm_deals', `id=eq.${enc(payment.deal_id)}&payment_received_at=is.null`, { payment_received_at: nowIso() });
  await audit(manual ? { id: manual.recorded_by, roles: ['nova_super_admin'] } : { id: null, kind: 'stripe_webhook' }, 'sales_payment', payment.id, 'payment_received', { deal: payment.deal_id, amount_cents: payment.amount_cents, source: manual ? 'owner_recorded' : 'verified_provider_event', event: eventId });
  await runHooks('paymentReceived', { dealId: payment.deal_id, paymentId: payment.id });
  const deal = await dbOne(`crm_deals?id=eq.${enc(payment.deal_id)}&select=assigned_rep_id`);
  const msg = `A payment of ${(payment.amount_cents / 100).toFixed(2)} ${payment.currency} was ${manual ? 'recorded by Nova' : 'confirmed by the payment provider'}.`;
  if (deal?.assigned_rep_id) await notify({ userId: deal.assigned_rep_id, kind: 'payment_received', subject: 'Client payment received', body: msg, link: '/rep/leads', channels: ['in_app'], idempotencyKey: `payrec:${payment.id}` });
  await notifyOwners({ kind: 'payment_received', subject: 'Client payment received', body: msg, link: '/dashboard/sales-team/verification', channels: ['in_app'], idempotencyKey: `payrecown:${payment.id}` });
  return row;
}

// ------------------------------------------------------------------------------------------------ Stripe events
// Called from api/stripe.js AFTER the signature was verified. Returns { handled, duplicate?, error? }. An error means "ask Stripe to retry" (HTTP 500).
export async function handleStripeEvent(event) {
  const type = event.type; const obj = event.data?.object || {};
  const mine = obj.metadata?.sales_payment_id || obj.client_reference_id;
  const interesting = /^(checkout\.session\.|payment_intent\.|charge\.|account\.updated|transfer\.|payout\.)/.test(type);
  if (!interesting) return { handled: false };
  const ins = await dbInsert('sales_provider_events', { provider: 'stripe', event_id: event.id, event_type: type });
  if (ins.conflict) {
    const prev = await dbOne(`sales_provider_events?provider=eq.stripe&event_id=eq.${enc(event.id)}&select=*`);
    if (prev?.status === 'processed' || prev?.status === 'ignored') return { handled: true, duplicate: true };
  }
  const eventRowId = ins.row?.id || (await dbOne(`sales_provider_events?provider=eq.stripe&event_id=eq.${enc(event.id)}&select=id`))?.id;
  const finish = (status, error = null) => dbPatch('sales_provider_events', `id=eq.${enc(eventRowId)}`, { status, error, processed_at: nowIso(), attempts: 1 });
  try {
    let status = 'ignored';
    const payment = mine ? await dbOne(`sales_payments?id=eq.${enc(String(mine).slice(0, 60))}&select=*`).catch(() => null) : null;
    if (payment) {
      if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
        if (obj.payment_status && obj.payment_status !== 'paid') { status = 'ignored'; }
        else if (obj.amount_total !== payment.amount_cents || String(obj.currency || '').toUpperCase() !== String(payment.currency).toUpperCase()) {
          await notifyOwners({ kind: 'payment_mismatch', subject: 'Payment amount mismatch — needs review', body: `Stripe reported ${obj.amount_total} ${obj.currency} for a payment expected to be ${payment.amount_cents} ${payment.currency}. It was NOT marked paid.`, link: '/dashboard/sales-team/verification', channels: ['in_app', 'email'], idempotencyKey: `paymismatch:${event.id}` });
          await finish('failed', 'amount or currency mismatch'); return { handled: true };
        } else if (await markPaid(payment, { eventId: event.id, paymentIntent: obj.payment_intent || null })) status = 'processed'; else status = 'ignored';
      } else if (['checkout.session.expired', 'checkout.session.async_payment_failed', 'payment_intent.payment_failed'].includes(type)) {
        const [row] = await dbPatch('sales_payments', `id=eq.${enc(payment.id)}&status=eq.pending`, { status: type === 'checkout.session.expired' ? 'cancelled' : 'failed', provider_event_id: event.id, ...(type === 'checkout.session.expired' ? { checkout_url: null, provider_session_id: null } : {}) });
        status = row ? 'processed' : 'ignored';
      }
    }
    if (['charge.refunded', 'charge.dispute.created', 'charge.dispute.funds_withdrawn'].includes(type)) {
      const pi = obj.payment_intent || obj.charge?.payment_intent; const p = pi ? await dbOne(`sales_payments?provider_payment_intent=eq.${enc(pi)}&select=*`) : null;
      if (p && p.status === 'paid') {
        const to = type === 'charge.refunded' ? 'refunded' : 'disputed';
        const [row] = await dbPatch('sales_payments', `id=eq.${enc(p.id)}&status=eq.paid`, { status: to, provider_event_id: event.id });
        if (row) { await audit({ id: null, kind: 'stripe_webhook' }, 'sales_payment', p.id, `payment_${to}`, { deal: p.deal_id, event: event.id }); await runHooks('paymentReversed', { dealId: p.deal_id, paymentId: p.id, reason: to }); await notifyOwners({ kind: 'payment_reversed', subject: `A client payment was ${to}`, body: `The payment for a sold proposal was ${to}. Related commission entries were flagged.`, link: '/dashboard/sales-team/commissions', channels: ['in_app', 'email'], idempotencyKey: `payrev:${event.id}` }); status = 'processed'; }
      }
    }
    if (hooks.providerEvent.length) { for (const fn of hooks.providerEvent) { const r = await fn(event); if (r?.processed) status = 'processed'; } }
    await finish(status); return { handled: true };
  } catch (e) {
    console.error('[sales:stripe-event] processing failed:', type, e.message);
    await finish('failed', String(e.message).slice(0, 300)).catch(() => {});
    return { handled: true, error: e.message };
  }
}

// ------------------------------------------------------------------------------------------------ authenticated ops
export const handlePayments = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['record-manual', 'mark-refunded'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'sales.owner' : 'sales.manage'); if (!caller) return;
  if (!rateLimit(req, res, 60, 60_000)) return;

  if (op === 'list') {
    const scope = await visibleRepUserIds(caller);
    const rows = await dbGet('sales_payments?order=created_at.desc&limit=300&select=id,deal_id,proposal_id,amount_cents,currency,method,status,paid_at,created_at,manual_method,evidence,provider_event_id,crm_deals(assigned_rep_id,business_id)');
    const out = rows.filter((r) => !scope || scope.includes(r.crm_deals?.assigned_rep_id)).map((r) => ({ ...r, confirmation: r.method === 'manual_owner' ? 'Recorded by the owner from evidence — NOT provider-confirmed' : r.provider_event_id ? 'Confirmed by a verified provider event' : 'Awaiting provider confirmation' }));
    return res.status(200).json(out);
  }
  if (op === 'record-manual') {
    if (!need('POST')) return;
    const proposal = await dbOne(`crm_proposals?id=eq.${enc(sanitize(b.proposal_id, 60))}&select=*`); if (!proposal) return bad(res, 404, 'Proposal not found');
    if (proposal.status !== 'signed') return bad(res, 409, 'A payment can only be recorded against a proposal the client has signed.');
    const deal = await dbOne(`crm_deals?id=eq.${enc(proposal.deal_id)}&select=*`);
    if (deal.assigned_rep_id === caller.id) return bad(res, 403, 'You cannot record payment for a sale you are credited on.');
    const method = ['check', 'ach', 'cash', 'wire', 'other'].includes(b.method) ? b.method : null; if (!method) return bad(res, 422, 'Choose how it was paid.');
    const evidence = sanitize(b.evidence, 500); if (evidence.length < 15) return bad(res, 422, 'Record the evidence (reference number, deposit date, who confirmed it) — at least 15 characters.');
    if (Number(b.amount_cents) !== proposal.payment_due_cents) return bad(res, 422, `The amount must equal the amount due (${proposal.payment_due_cents} cents).`);
    const existing = await dbOne(`sales_payments?proposal_id=eq.${enc(proposal.id)}&status=in.(pending,paid)&select=*`);
    if (existing?.status === 'paid') return bad(res, 409, 'This proposal is already paid.');
    if (existing?.method === 'stripe_checkout') await dbPatch('sales_payments', `id=eq.${enc(existing.id)}&status=eq.pending`, { status: 'cancelled', checkout_url: null, provider_session_id: null });
    const ins = await dbInsert('sales_payments', { deal_id: deal.id, proposal_id: proposal.id, amount_cents: proposal.payment_due_cents, currency: proposal.currency, method: 'manual_owner', status: 'pending', manual_method: method, evidence, recorded_by: caller.id, created_by: caller.id });
    if (!ins.row) return bad(res, 409, 'A payment is already being recorded for this proposal.');
    const paid = await markPaid(ins.row, { manual: { recorded_by: caller.id, manual_method: method, evidence } });
    return res.status(200).json({ ok: true, payment: paid, note: 'Recorded from your evidence. This is not a provider confirmation.' });
  }
  if (op === 'mark-refunded') {
    if (!need('POST')) return;
    const p = await dbOne(`sales_payments?id=eq.${enc(sanitize(b.payment_id, 60))}&select=*`); if (!p) return bad(res, 404, 'Payment not found');
    const evidence = sanitize(b.evidence, 500); if (evidence.length < 15) return bad(res, 422, 'Record the evidence for the refund.');
    const [row] = await dbPatch('sales_payments', `id=eq.${enc(p.id)}&status=eq.paid`, { status: 'refunded' }); if (!row) return bad(res, 409, 'Only a paid payment can be refunded.');
    await audit(caller, 'sales_payment', p.id, 'payment_refunded', { evidence, deal: p.deal_id }); await runHooks('paymentReversed', { dealId: p.deal_id, paymentId: p.id, reason: 'refunded' });
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown payments operation: ${op}`);
});
