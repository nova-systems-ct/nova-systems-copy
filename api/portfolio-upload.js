import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

const VALID_CATEGORIES = ['Website', 'Branding', 'Social Media', 'Apparel', 'Other'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const b = req.body || {};
  const title       = sanitize(b.title, 200);
  const category    = sanitize(b.category, 50);
  const client_name = sanitize(b.client_name, 200);
  const image_base64 = typeof b.image_base64 === 'string' ? b.image_base64 : '';
  const featured    = b.featured === true || b.featured === 'true';

  if (!title)        return res.status(400).json({ error: 'Title is required' });
  if (!image_base64) return res.status(400).json({ error: 'Image is required' });
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // Parse base64 data URI
  const match = image_base64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return res.status(400).json({ error: 'Invalid image data' });

  const [, mimeType, base64Data] = match;
  if (!ALLOWED_MIMES.includes(mimeType)) {
    return res.status(400).json({ error: 'Image must be JPEG, PNG, WebP, or GIF' });
  }

  const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const slug     = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
  const filename = `${Date.now()}-${slug}.${ext}`;

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 image data' });
  }

  if (imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be under 5MB' });
  }

  // Upload to Supabase Storage
  try {
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/portfolio/${filename}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: imageBuffer,
      }
    );
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[portfolio-upload] Storage error:', uploadRes.status, errText);
      return res.status(500).json({ error: 'Failed to upload image to storage. Make sure the "portfolio" bucket exists and is public in Supabase.' });
    }
  } catch (err) {
    console.error('[portfolio-upload] Storage upload error:', err.message);
    return res.status(500).json({ error: 'Failed to upload image' });
  }

  const image_url = `${SUPABASE_URL}/storage/v1/object/public/portfolio/${filename}`;

  // Insert into portfolio table
  try {
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolio`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title,
        image_url,
        category: category || 'Other',
        client_name: client_name || null,
        featured,
        created_at: new Date().toISOString(),
      }),
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error('[portfolio-upload] DB error:', dbRes.status, errText);
      return res.status(500).json({ error: 'Failed to save portfolio record. Make sure the "portfolio" table exists in Supabase.' });
    }

    const rows = await dbRes.json();
    return res.status(200).json({ ok: true, item: rows[0] });
  } catch (err) {
    console.error('[portfolio-upload] DB error:', err.message);
    return res.status(500).json({ error: 'Failed to save portfolio item' });
  }
}
