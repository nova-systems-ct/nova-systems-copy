import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizeUrl } from './_sanitize.js';
import { stripeRequest } from './_stripe.js';

// Redirect-style Stripe Checkout — used for invoice "PAY NOW" links emailed
// to clients, and as a fallback checkout flow for the /welcome intake wizard.
export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.' });
  }

  const b = req.body || {};
  const amount        = Number(b.tier_price ?? b.amount);
  const client_email   = sanitizeEmail(b.client_email || '');
  const tier_name       = sanitize(b.tier_name, 100);
  const client_id        = sanitize(b.client_id, 100);
  const invoice_id       = sanitize(b.invoice_id, 100);
  const description       = sanitize(b.description, 200) || (tier_name ? `Nova Systems — ${tier_name} (first month)` : 'Nova Systems Invoice');

  const origin = req.headers.origin || 'https://nova-systems.app';
  const success_url = (() => { try { return sanitizeUrl(b.success_url || ''); } catch { return ''; } })()
    || `${origin}/welcome/success?session_id={CHECKOUT_SESSION_ID}&client_id=${encodeURIComponent(client_id)}`;
  const cancel_url = (() => { try { return sanitizeUrl(b.cancel_url || ''); } catch { return ''; } })()
    || `${origin}/welcome?step=6`;

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
    console.error('[create-checkout-session] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
