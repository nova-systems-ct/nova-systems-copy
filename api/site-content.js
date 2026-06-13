import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // GET — return one section or all sections
  if (req.method === 'GET') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json(null);

    const key = req.query?.key ? sanitize(req.query.key, 100) : null;
    const qs = key
      ? `section_key=eq.${encodeURIComponent(key)}&limit=1`
      : 'order=section_key.asc';

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content?${qs}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) return res.status(200).json(key ? null : []);
      const rows = await r.json();
      return res.status(200).json(key ? (rows[0] || null) : rows);
    } catch {
      return res.status(200).json(key ? null : []);
    }
  }

  // POST — upsert a section
  if (req.method === 'POST') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const b = req.body || {};
    const section_key = sanitize(b.section_key, 100);
    if (!section_key) return res.status(400).json({ error: 'section_key is required' });

    const content_json = b.content_json && typeof b.content_json === 'object'
      ? b.content_json
      : {};

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          section_key,
          content_json,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('[site-content] Upsert error:', r.status, errText);
        return res.status(500).json({ error: 'Failed to save content. Make sure site_content table exists.' });
      }

      const rows = await r.json();
      return res.status(200).json({ ok: true, row: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
