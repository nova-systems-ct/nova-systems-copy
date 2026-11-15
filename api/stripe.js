import crypto from 'crypto';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizeUrl } from './_sanitize.js';
import { stripeRequest } from './_stripe.js';
import { handleStripeEvent as handleSalesStripeEvent } from './_sales/payments.js';
import { requireStaff } from './_auth.js';

// Combined Stripe endpoint — actions: checkout-session, payment-intent,
// verify-payment (?action=...), plus the raw-body webhook (auto-detected via
// the stripe-signature header). bodyParser is disabled so the webhook can
// verify the exact raw payload; JSON actions parse the raw body themselves.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const rawBody = await readRawBody(req);
  if (!rawBody.length) return {};
  try { return JSON.parse(rawBody.toString('utf8')); } catch { return {}; }
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  // Replay protection: reject events signed more than 5 minutes ago (Stripe's recommended tolerance).
  if (!Number.isFinite(Number(timestamp)) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function supabasePatch(SUPABASE_URL, SUPABASE_KEY, table, filter, patch) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server-side copy of the /onboard plans (src/pages/Onboard.jsx TIERS). The browser used to send
// the amount itself, so anyone could pay $1 against a client_id and have the webhook mark that
// client Paid/Active. The price now comes from here; change both places together.
const ONBOARD_TIER_PRICES = {
  'Tier 1 — Website Only': 500,
  'Tier 2 — Social Media Only': 1500,
  'Tier 3 — Website + Social Media': 2500,
  'Tier 4 — Full System + AI Agent': 3500,
  'Tier 5 — Everything': 5000,
  'Partner Program': 1000,
};

// The invoice's own total, in cents, read from the database. Returns null when it cannot be read.
async function invoiceTotalCents(invoiceId) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY || !UUID_RE.test(invoiceId || '')) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/client_invoices?id=eq.${encodeURIComponent(invoiceId)}&select=total&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    const cents = Math.round(Number(rows[0]?.total) * 100);
    return Number.isInteger(cents) && cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

// Marks an invoice Paid only when Stripe reports at least the invoice's full total in USD.
// A short payment (or an unreadable invoice) leaves the invoice untouched and is logged.
async function markInvoicePaidIfCovered(SUPABASE_URL, SUPABASE_KEY, invoiceId, paidCents, currency) {
  const owed = await invoiceTotalCents(invoiceId);
  if (!owed || String(currency || '').toLowerCase() !== 'usd' || !Number.isInteger(paidCents) || paidCents < owed) {
    console.error('[stripe webhook] Payment does not cover invoice — not marking paid', { invoiceId, paidCents, owed });
    return false;
  }
  const r = await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'client_invoices', `id=eq.${encodeURIComponent(invoiceId)}`, {
    status: 'Paid', paid_at: new Date().toISOString(),
  });
  return r.ok;
}

// Decides what a checkout or payment intent may charge. Anything linked to an invoice or a client
// record takes its amount from the server, never from the request body.
async function resolveCharge(req, res, b) {
  const client_id = sanitize(b.client_id, 100);
  const invoice_id = sanitize(b.invoice_id, 100);
  const tier_name = sanitize(b.tier_name, 100);
  if (invoice_id) {
    if (!UUID_RE.test(invoice_id)) { res.status(400).json({ error: 'Invalid invoice reference' }); return null; }
    if (!(await requireStaff(req, res, 'admin.view'))) return null;
    const cents = await invoiceTotalCents(invoice_id);
    if (!cents) { res.status(404).json({ error: 'Invoice not found, or it has no total yet' }); return null; }
    return { cents, client_id: UUID_RE.test(client_id) ? client_id : '', invoice_id, tier_name };
  }
  if (client_id) {
    if (!UUID_RE.test(client_id)) { res.status(400).json({ error: 'Invalid client reference' }); return null; }
    const price = ONBOARD_TIER_PRICES[tier_name];
    if (!price) { res.status(400).json({ error: 'Unknown plan' }); return null; }
    return { cents: price * 100, client_id, invoice_id: '', tier_name };
  }
  const amount = Number(b.tier_price ?? b.amount);
  if (!amount || amount <= 0) { res.status(400).json({ error: 'A valid amount is required' }); return null; }
  return { cents: Math.round(amount * 100), client_id: '', invoice_id: '', tier_name };
}

async function handleWebhook(req, res, rawBody) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  // 2026-09-20 security fix: this used to skip verification entirely when the secret was unset
  // and still process the event — meaning anyone who knew (or guessed) an invoice_id/client_id
  // could POST a forged checkout.session.completed body and get it marked Paid for free, no
  // Stripe involvement required. Absent credentials must fail safely (reject), not fail open.
  if (!WEBHOOK_SECRET) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET not set — rejecting unverifiable webhook');
    return res.status(503).json({ error: 'Webhook verification is not configured.' });
  }
  const ok = verifyStripeSignature(rawBody, req.headers['stripe-signature'], WEBHOOK_SECRET);
  if (!ok) return res.status(400).json({ error: 'Invalid signature' });

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.log('[stripe webhook] Event:', event.type);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[stripe webhook] Supabase not configured — acknowledging event without processing');
    return res.status(200).json({ received: true });
  }

  // Sales Team platform: client payments, refunds/disputes and representative payout callbacks. Idempotent per event id;
  // a processing error answers 500 so Stripe retries instead of silently losing a payment confirmation.
  const sales = await handleSalesStripeEvent(event);
  if (sales.error) return res.status(500).json({ error: 'Processing failed; please retry.' });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      const clientId = session.metadata?.client_id;

      let invoicePaid = false;
      if (invoiceId) {
        invoicePaid = session.payment_status === 'paid'
          && await markInvoicePaidIfCovered(SUPABASE_URL, SUPABASE_KEY, invoiceId, session.amount_total, session.currency);
      } else if (clientId && UUID_RE.test(clientId) && session.payment_status === 'paid') {
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'clients', `id=eq.${encodeURIComponent(clientId)}`, {
          payment_status: 'Paid', status: 'Active', first_payment_date: new Date().toISOString(),
        });
      }

      if (RESEND_KEY && session.customer_details?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Nova Systems <noreply@nova-systems.app>',
            to: [session.customer_details.email],
            subject: 'Payment Received — Nova Systems',
            text: `Thank you! Your payment of $${(session.amount_total / 100).toFixed(2)} was received.\n\nNova Systems`,
          }),
        }).catch(() => {});
      }

      if (RESEND_KEY && invoicePaid) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Nova Systems <noreply@nova-systems.app>',
            to: ['Isaac_0427@icloud.com'],
            subject: `Invoice Paid — $${(session.amount_total / 100).toFixed(2)}`,
            text: `An invoice was just paid.\n\nAmount: $${(session.amount_total / 100).toFixed(2)}\nPaid by: ${session.customer_details?.email || 'unknown'}\n\nnova-systems.app/dashboard/invoices`,
          }),
        }).catch(() => {});
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const invoiceId = intent.metadata?.invoice_id;
      const clientId = intent.metadata?.client_id;

      if (invoiceId) {
        await markInvoicePaidIfCovered(SUPABASE_URL, SUPABASE_KEY, invoiceId, intent.amount_received, intent.currency);
      } else if (clientId && UUID_RE.test(clientId)) {
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'clients', `id=eq.${encodeURIComponent(clientId)}`, {
          payment_status: 'Paid', status: 'Active', first_payment_date: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[stripe webhook] Processing error:', err.message);
  }

  return res.status(200).json({ received: true });
}

// Redirect-style Stripe Checkout — used for invoice "PAY NOW" links emailed
// to clients, and as a fallback checkout flow for the /onboard intake wizard.
async function handleCheckoutSession(req, res, b) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.' });
  }

  const charge = await resolveCharge(req, res, b);
  if (!charge) return;
  const { cents, client_id, invoice_id, tier_name } = charge;
  const client_email   = sanitizeEmail(b.client_email || '');
  const description       = sanitize(b.description, 200) || (tier_name ? `Nova Systems — ${tier_name} (first month)` : 'Nova Systems Invoice');

  const origin = req.headers.origin || 'https://nova-systems.app';
  const success_url = (() => { try { return sanitizeUrl(b.success_url || ''); } catch { return ''; } })()
    || `${origin}/onboard/success?session_id={CHECKOUT_SESSION_ID}&client_id=${encodeURIComponent(client_id)}`;
  const cancel_url = (() => { try { return sanitizeUrl(b.cancel_url || ''); } catch { return ''; } })()
    || `${origin}/onboard?step=6`;

  try {
    const session = await stripeRequest(STRIPE_SECRET_KEY, 'POST', 'checkout/sessions', {
      mode: 'payment',
      success_url,
      cancel_url,
      customer_email: client_email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          product_data: { name: description },
        },
      }],
      metadata: { client_id: client_id || '', invoice_id: invoice_id || '', tier_name: tier_name || '' },
    });
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[stripe checkout-session] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}

// Used by the /onboard intake wizard — embedded Stripe Elements payment for
// the client's first month, and by the Nova Vault invoice flow for deposits.
async function handlePaymentIntent(req, res, b) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.' });
  }

  const charge = await resolveCharge(req, res, b);
  if (!charge) return;
  const { cents, client_id, invoice_id, tier_name } = charge;
  const client_email   = sanitizeEmail(b.client_email || '');
  const description       = sanitize(b.description, 200) || (tier_name ? `Nova Systems — ${tier_name}` : 'Nova Systems Payment');

  try {
    const intent = await stripeRequest(STRIPE_SECRET_KEY, 'POST', 'payment_intents', {
      amount: cents,
      currency: 'usd',
      description,
      receipt_email: client_email || undefined,
      'automatic_payment_methods[enabled]': 'true',
      metadata: { client_id: client_id || '', invoice_id: invoice_id || '', tier_name: tier_name || '' },
    });
    return res.status(200).json({ client_secret: intent.client_secret, payment_intent_id: intent.id });
  } catch (err) {
    console.error('[stripe payment-intent] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
}

// Used by the /intake business-intake form's final step — collects a card via
// Stripe Elements and saves it for future off-session charging without
// charging anything now (zero-amount SetupIntent).
async function handleSetupIntent(req, res, b) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.' });
  }

  const email = sanitizeEmail(b.email || '');
  const name = sanitize(b.name, 200);
  const payment_method_id = sanitize(b.payment_method_id, 100);
  if (!payment_method_id) return res.status(400).json({ error: 'payment_method_id is required' });

  try {
    const customer = await stripeRequest(STRIPE_SECRET_KEY, 'POST', 'customers', {
      email: email || undefined,
      name: name || undefined,
      payment_method: payment_method_id,
    });

    const setupIntent = await stripeRequest(STRIPE_SECRET_KEY, 'POST', 'setup_intents', {
      customer: customer.id,
      payment_method: payment_method_id,
      confirm: 'true',
      'payment_method_types[0]': 'card',
      usage: 'off_session',
    });

    if (setupIntent.status !== 'succeeded') {
      return res.status(200).json({
        ok: false,
        requires_action: setupIntent.status === 'requires_action',
        client_secret: setupIntent.client_secret,
        status: setupIntent.status,
      });
    }

    return res.status(200).json({
      ok: true,
      customer_id: customer.id,
      payment_method_id,
      setup_intent_id: setupIntent.id,
    });
  } catch (err) {
    console.error('[stripe setup-intent] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to save payment method' });
  }
}

async function handleVerifyPayment(req, res, b) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe is not configured' });

  const session_id = sanitize(req.query?.session_id || b.session_id, 200);
  if (!session_id) return res.status(400).json({ error: 'session_id is required' });

  try {
    const session = await stripeRequest(STRIPE_SECRET_KEY, 'GET', `checkout/sessions/${encodeURIComponent(session_id)}`);
    return res.status(200).json({
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email || session.customer_email,
      amount_total: session.amount_total ? session.amount_total / 100 : null,
      metadata: session.metadata || {},
    });
  } catch (err) {
    console.error('[stripe verify-payment] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to verify payment' });
  }
}

export default async function handler(req, res) {
  if (req.query?.action === 'channel-webhook') {
    const { handleChannelWebhook } = await import('./_channelWorkspace.js');
    if(req.method==='GET') return handleChannelWebhook(req,res,Buffer.alloc(0));
    const chunks=[];let size=0;
    for await (const chunk of req) { size+=chunk.length;if(size>524288)return res.status(413).json({error:'Webhook payload too large.'});chunks.push(chunk); }
    return handleChannelWebhook(req,res,Buffer.concat(chunks));
  }
  // Stripe calls this directly (server-to-server) with a signature header —
  // route it to the webhook handler before anything else touches the body.
  if (req.headers['stripe-signature']) {
    const rawBody = await readRawBody(req);
    return handleWebhook(req, res, rawBody);
  }
  // Resend delivery callbacks (Svix-signed): updates the Sales Team email delivery ledger. Shares this raw-body function so the
  // project stays within the 12-function limit.
  if (req.headers['svix-signature']) {
    const rawBody = await readRawBody(req);
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'Webhook verification is not configured.' });
    const { verifySvix, handleResendEvent } = await import('./_sales/notifications.js');
    if (!verifySvix(req.headers, rawBody, secret)) return res.status(400).json({ error: 'Invalid signature' });
    let event; try { event = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON payload' }); }
    try { await handleResendEvent(event); } catch (err) { console.error('[resend webhook] processing failed:', err.message); return res.status(500).json({ error: 'Processing failed; please retry.' }); }
    return res.status(200).json({ received: true });
  }

  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  const b = req.method === 'POST' ? await parseJsonBody(req) : {};

  if (action === 'checkout-session') return handleCheckoutSession(req, res, b);
  if (action === 'payment-intent') return handlePaymentIntent(req, res, b);
  if (action === 'setup-intent') return handleSetupIntent(req, res, b);
  if (action === 'verify-payment') return handleVerifyPayment(req, res, b);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
