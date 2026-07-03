import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';

// Saves the /welcome wizard (steps 1-5 + signature) to Supabase before the
// client pays. Called right before redirecting to / mounting Stripe payment.
export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const b = req.body || {};
  const id                = sanitize(b.id, 100) || undefined;
  const full_name          = sanitize(b.full_name, 150);
  const business_name       = sanitize(b.business_name, 200);
  const phone                = sanitizePhone(b.phone);
  const email                 = sanitizeEmail(b.email);
  const business_address       = sanitize(b.business_address, 300);
  const business_type           = sanitize(b.business_type, 100);
  const current_website          = sanitize(b.current_website, 300);
  const referral_source           = sanitize(b.referral_source, 100);
  const tier_name                  = sanitize(b.tier_name, 100);
  const tier_price                  = Number(b.tier_price) || 0;
  const signature_data_url           = typeof b.signature_data_url === 'string' ? b.signature_data_url.slice(0, 500000) : '';
  const language                      = sanitize(b.language, 5) || 'en';
  const intake_data                    = b.intake_data && typeof b.intake_data === 'object' ? b.intake_data : {};

  if (!full_name || !email) return res.status(400).json({ error: 'Full name and email are required' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Not configured — hand back a locally-generated id so the wizard can still proceed to payment in dev.
    return res.status(200).json({ ok: true, client_id: id || `local-${Date.now()}`, warning: 'Supabase not configured — using local id' });
  }

  const record = {
    full_name, business_name, phone, email, business_address, business_type,
    current_website, referral_source, tier_name, tier_price,
    signature_data_url: signature_data_url || null,
    language, intake_data, status: 'Pending Payment', payment_status: 'Pending',
  };

  try {
    const isUpdate = !!id;
    const url = isUpdate
      ? `${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(id)}`
      : `${SUPABASE_URL}/rest/v1/clients`;

    const r = await fetch(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!r.ok) {
      console.error('[save-intake] Supabase error:', r.status, await r.text());
      return res.status(500).json({ error: 'Failed to save intake data' });
    }

    const rows = await r.json();
    return res.status(200).json({ ok: true, client_id: rows[0]?.id });
  } catch (err) {
    console.error('[save-intake] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save intake data' });
  }
}
