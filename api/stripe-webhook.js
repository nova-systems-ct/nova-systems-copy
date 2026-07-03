import crypto from 'crypto';

// Raw body is required to verify the Stripe signature.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  const rawBody = await readRawBody(req);

  if (WEBHOOK_SECRET) {
    const ok = verifyStripeSignature(rawBody, req.headers['stripe-signature'], WEBHOOK_SECRET);
    if (!ok) return res.status(400).json({ error: 'Invalid signature' });
  } else {
    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.log('[stripe-webhook] Event:', event.type);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[stripe-webhook] Supabase not configured — acknowledging event without processing');
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
    console.error('[stripe-webhook] Processing error:', err.message);
  }

  return res.status(200).json({ received: true });
}
