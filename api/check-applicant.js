import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return; // strict: 5 login attempts/min per IP

  const email         = sanitizeEmail(req.body?.email || '');
  const password_hash = sanitize(req.body?.password_hash || '', 128);

  if (!email || !password_hash) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  console.log('[check-applicant] Checking email:', email);

  const SUPABASE_URL        = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('[check-applicant] Supabase not configured — signaling localStorage fallback');
    return res.status(200).json({ mode: 'localStorage' });
  }

  // Query Supabase for all applications with this email
  let rows;
  try {
    const url = `${SUPABASE_URL}/rest/v1/applications?email=eq.${encodeURIComponent(email)}&select=id,email,name,position,status,password_hash`;
    const sbRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!sbRes.ok) {
      const txt = await sbRes.text();
      console.error('[check-applicant] Supabase query error:', sbRes.status, txt);
      return res.status(502).json({ error: 'Database error — try again' });
    }

    rows = await sbRes.json();
  } catch (err) {
    console.error('[check-applicant] Fetch error:', err.message);
    return res.status(502).json({ error: 'Database unreachable — try again' });
  }

  console.log('[check-applicant] Rows found for email:', rows.length);

  if (rows.length === 0) {
    console.log('[check-applicant] No account found for:', email);
    return res.status(200).json({ result: 'no_account' });
  }

  // Check hash against every matching row (edge case: multiple applications)
  const row = rows.find((r) => r.password_hash === password_hash);
  console.log('[check-applicant] Hash match:', !!row);

  if (!row) {
    return res.status(200).json({ result: 'wrong_password' });
  }

  return res.status(200).json({
    result: 'ok',
    application: {
      id:       row.id,
      email:    row.email,
      name:     row.name,
      position: row.position,
      status:   row.status,
    },
  });
}
