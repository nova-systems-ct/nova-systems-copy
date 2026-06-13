import { rateLimit } from './_rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json([]);
  }

  const featured = req.query?.featured === 'true';
  const qs = featured
    ? 'featured=eq.true&order=created_at.desc'
    : 'order=created_at.desc';

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/portfolio?${qs}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!r.ok) {
      console.error('[portfolio-items] Supabase error:', r.status, await r.text());
      return res.status(200).json([]);
    }
    const items = await r.json();
    return res.status(200).json(items);
  } catch (err) {
    console.error('[portfolio-items] Error:', err.message);
    return res.status(200).json([]);
  }
}
