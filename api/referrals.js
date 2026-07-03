import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_tracking?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) { console.error('[referrals] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[referrals] Error:', err.message);
      return res.status(200).json([]);
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const deal_value = Number(b.deal_value) || 0;
    const commission_rate = Number(b.commission_rate) || 0;
    const record = {
      rep_name: sanitize(b.rep_name, 150),
      rep_email: sanitize(b.rep_email, 200),
      client_id: sanitize(b.client_id, 100) || null,
      client_name: sanitize(b.client_name, 200),
      deal_value,
      commission_rate,
      commission_amount: Number((deal_value * commission_rate / 100).toFixed(2)),
      status: sanitize(b.status, 30) || 'Pending',
      retention_bonus_paid: b.retention_bonus_paid === true || b.retention_bonus_paid === 'true',
    };
    try {
      const url = (action === 'update' && id)
        ? `${SUPABASE_URL}/rest/v1/referral_tracking?id=eq.${encodeURIComponent(id)}`
        : `${SUPABASE_URL}/rest/v1/referral_tracking`;
      const r = await fetch(url, {
        method: (action === 'update' && id) ? 'PATCH' : 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[referrals] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save referral' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, referral: rows[0] });
    } catch (err) {
      console.error('[referrals] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save referral' });
    }
  }

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_tracking?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: 'Delete failed' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
