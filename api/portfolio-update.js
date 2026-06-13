import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

const VALID_CATEGORIES = ['Website', 'Branding', 'Social Media', 'Apparel', 'Other'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const b      = req.body || {};
  const action = sanitize(b.action, 20);
  const id     = sanitize(b.id, 100);

  if (!id)     return res.status(400).json({ error: 'ID is required' });
  if (!action) return res.status(400).json({ error: 'Action is required' });

  if (action === 'delete') {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/portfolio?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (!r.ok) {
        console.error('[portfolio-update] Delete error:', r.status, await r.text());
        return res.status(500).json({ error: 'Failed to delete item' });
      }

      // Attempt to delete from storage (non-fatal — filename may vary)
      const filename = sanitize(b.filename, 300);
      if (filename) {
        try {
          await fetch(`${SUPABASE_URL}/storage/v1/object/portfolio/${filename}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
          });
        } catch {}
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[portfolio-update] Delete error:', err.message);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  if (action === 'update') {
    const title       = sanitize(b.title, 200);
    const category    = sanitize(b.category, 50);
    const client_name = sanitize(b.client_name, 200);

    const patch = {};
    if (title) patch.title = title;
    if (category && VALID_CATEGORIES.includes(category)) patch.category = category;
    if ('client_name' in b) patch.client_name = client_name || null;
    if ('featured' in b)    patch.featured = b.featured === true || b.featured === 'true';

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/portfolio?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(patch),
        }
      );
      if (!r.ok) {
        console.error('[portfolio-update] Update error:', r.status, await r.text());
        return res.status(500).json({ error: 'Failed to update item' });
      }
      const rows = await r.json();
      return res.status(200).json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('[portfolio-update] Update error:', err.message);
      return res.status(500).json({ error: 'Update failed' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
