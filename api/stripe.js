import crypto from 'crypto';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizeUrl } from './_sanitize.js';
import { stripeRequest } from './_stripe.js';

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

async function handleWebhook(req, res, rawBody) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  if (WEBHOOK_SECRET) {
    const ok = verifyStripeSignature(rawBody, req.headers['stripe-signature'], WEBHOOK_SECRET);
    if (!ok) return res.status(400).json({ error: 'Invalid signature' });
  } else {
    console.warn('[stripe webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
  }

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

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      const clientId = session.metadata?.client_id;

      if (invoiceId) {
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'client_invoices', `id=eq.${invoiceId}`, {
          status: 'Paid', paid_at: new Date().toISOString(),
        });
      } else if (clientId) {
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'clients', `id=eq.${clientId}`, {
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

      if (RESEND_KEY && invoiceId) {
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
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'client_invoices', `id=eq.${invoiceId}`, {
          status: 'Paid', paid_at: new Date().toISOString(),
        });
      } else if (clientId) {
        await supabasePatch(SUPABASE_URL, SUPABASE_KEY, 'clients', `id=eq.${clientId}`, {
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

  const amount        = Number(b.tier_price ?? b.amount);
  const client_email   = sanitizeEmail(b.client_email || '');
  const tier_name       = sanitize(b.tier_name, 100);
  const client_id        = sanitize(b.client_id, 100);
  const invoice_id       = sanitize(b.invoice_id, 100);
  const description       = sanitize(b.description, 200) || (tier_name ? `Nova Systems — ${tier_name} (first month)` : 'Nova Systems Invoice');

  const origin = req.headers.origin || 'https://nova-systems.app';
  const success_url = (() => { try { return sanitizeUrl(b.success_url || ''); } catch { return ''; } })()
    || `${origin}/onboard/success?session_id={CHECKOUT_SESSION_ID}&client_id=${encodeURIComponent(client_id)}`;
  const cancel_url = (() => { try { return sanitizeUrl(b.cancel_url || ''); } catch { return ''; } })()
    || `${origin}/onboard?step=6`;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'A valid amount is required' });

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
          unit_amount: Math.round(amount * 100),
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

  const amount        = Number(b.amount);
  const client_email   = sanitizeEmail(b.client_email || '');
  const tier_name       = sanitize(b.tier_name, 100);
  const client_id        = sanitize(b.client_id, 100);
  const invoice_id       = sanitize(b.invoice_id, 100);
  const description       = sanitize(b.description, 200) || (tier_name ? `Nova Systems — ${tier_name}` : 'Nova Systems Payment');

  if (!amount || amount <= 0) return res.status(400).json({ error: 'A valid amount is required' });

  try {
    const intent = await stripeRequest(STRIPE_SECRET_KEY, 'POST', 'payment_intents', {
      amount: Math.round(amount * 100),
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
  // Stripe calls this directly (server-to-server) with a signature header —
  // route it to the webhook handler before anything else touches the body.
  if (req.headers['stripe-signature']) {
    const rawBody = await readRawBody(req);
    return handleWebhook(req, res, rawBody);
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
