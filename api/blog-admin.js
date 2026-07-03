import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

const CATEGORIES = ['AI and Technology', 'Connecticut Business', 'Case Studies', 'News', 'Tips and Strategy'];

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: 'Delete failed' });
    return res.status(200).json({ ok: true });
  }

  if (action === 'save') {
    const id               = sanitize(b.id, 100);
    const title              = sanitize(b.title, 200);
    const category             = sanitize(b.category, 50);
    const excerpt                = sanitize(b.excerpt, 500);
    const content                 = sanitize(b.content, 20000);
    const thumbnail_color          = sanitize(b.thumbnail_color, 20) || '#C49A3C';
    const seo_title                  = sanitize(b.seo_title, 200);
    const seo_description             = sanitize(b.seo_description, 300);
    const published                    = b.published === true || b.published === 'true';

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });

    const slug = sanitize(b.slug, 100) || slugify(title);

    const record = {
      title, slug, category: category || CATEGORIES[0], excerpt, content,
      thumbnail_color, seo_title: seo_title || title, seo_description: seo_description || excerpt,
      published, updated_at: new Date().toISOString(),
    };

    try {
      const url = id
        ? `${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`
        : `${SUPABASE_URL}/rest/v1/blog_posts`;
      const r = await fetch(url, {
        method: id ? 'PATCH' : 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[blog-admin] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save post — slug may already be in use' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    } catch (err) {
      console.error('[blog-admin] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save post' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
