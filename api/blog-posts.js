import { rateLimit } from './_rateLimit.js';

// GET /api/blog-posts            → all published posts
// GET /api/blog-posts?slug=x     → single post by slug (published only)
// GET /api/blog-posts?admin=true → all posts, published or not (dashboard)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  const slug  = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const admin = req.query?.admin === 'true';

  let qs = 'order=created_at.desc';
  if (slug) qs = `slug=eq.${encodeURIComponent(slug)}`;
  else if (!admin) qs = `published=eq.true&${qs}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[blog-posts] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    const data = await r.json();
    return res.status(200).json(slug ? (data[0] || null) : data);
  } catch (err) {
    console.error('[blog-posts] Error:', err.message);
    return res.status(200).json(slug ? null : []);
  }
}
