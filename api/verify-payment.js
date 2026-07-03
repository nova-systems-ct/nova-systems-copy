import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';
import { stripeRequest } from './_stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe is not configured' });

  const session_id = sanitize(req.query?.session_id || req.body?.session_id, 200);
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
    console.error('[verify-payment] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to verify payment' });
  }
}
