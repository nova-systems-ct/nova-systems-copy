import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const id = sanitize(req.body?.id, 100);
  const storagePath = sanitize(req.body?.storage_path, 400);
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vault_documents?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[vault-delete] DB error:', r.status, await r.text()); return res.status(500).json({ error: 'Delete failed' }); }

    if (storagePath) {
      try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/nova-vault/${storagePath}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
        });
      } catch {}
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[vault-delete] Error:', err.message);
    return res.status(500).json({ error: 'Delete failed' });
  }
}
