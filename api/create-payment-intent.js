import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { stripeRequest } from './_stripe.js';

// Used by the /welcome intake wizard — embedded Stripe Elements payment for
// the client's first month, and by the Nova Vault invoice flow for deposits.
export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.' });
  }

  const b = req.body || {};
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
    console.error('[create-payment-intent] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
}
