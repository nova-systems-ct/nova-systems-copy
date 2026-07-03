import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';

const ALLOWED_PORTFOLIO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'];

async function uploadPortfolioFile(SUPABASE_URL, SUPABASE_SERVICE_KEY, email, base64) {
  const match = base64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  if (!ALLOWED_PORTFOLIO_MIMES.includes(mimeType)) return null;

  let buffer;
  try { buffer = Buffer.from(base64Data, 'base64'); } catch { return null; }
  if (buffer.length > 4.5 * 1024 * 1024) return null;

  const ext = mimeType.split('/')[1].replace('quicktime', 'mov');
  const safeEmail = email.replace(/[^a-z0-9@._-]/gi, '_');
  const filename = `${safeEmail}/${Date.now()}.${ext}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/portfolios/${filename}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!r.ok) { console.error('[submit-application] Portfolio upload error:', r.status, await r.text()); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/portfolios/${filename}`;
  } catch (e) {
    console.error('[submit-application] Portfolio upload error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const RESEND_KEY           = process.env.RESEND_API_KEY;
  const SUPABASE_URL         = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const b = req.body || {};
  const id           = sanitize(b.id, 100);
  const name         = sanitize(b.name, 100);
  const email        = sanitizeEmail(b.email);
  const phone        = sanitizePhone(b.phone);
  const position     = sanitize(b.position, 100);
  const password_hash = sanitize(b.password_hash, 128);

  const city                       = sanitize(b.city, 100);
  const bio                        = sanitize(b.bio, 3000);
  const equipment_owned            = sanitize(b.equipment_owned, 1000);
  const has_transportation         = sanitize(b.has_transportation, 10);
  const instagram_tiktok           = sanitize(b.instagram_tiktok, 200);
  const camera_equipment           = sanitize(b.camera_equipment, 1000);
  const drone_equipment            = sanitize(b.drone_equipment, 1000);
  const faa_part_107               = sanitize(b.faa_part_107, 10);
  const has_transportation_license = sanitize(b.has_transportation_license, 10);
  const speaks_spanish             = sanitize(b.speaks_spanish, 15);
  const sales_experience           = sanitize(b.sales_experience, 20);
  const sales_experience_desc      = sanitize(b.sales_experience_desc, 2000);
  const why_position                = sanitize(b.why_position, 2000);
  const start_timing                = sanitize(b.start_timing, 20);
  const linkedin_url                = (() => { try { return sanitizeUrl(b.linkedin_url || ''); } catch { return ''; } })();
  const ai_tools_experience         = sanitize(b.ai_tools_experience, 1500);
  const ai_system_description       = sanitize(b.ai_system_description, 3000);
  const portfolio_links              = sanitize(b.portfolio_links, 2000);
  const portfolio_file_name          = sanitize(b.portfolio_file_name, 200);
  const portfolio_file_base64        = typeof b.portfolio_file_base64 === 'string' ? b.portfolio_file_base64 : '';

  const isSalesRep = position.toLowerCase().includes('sales');

  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (!position)       return res.status(400).json({ error: 'Position is required' });
  if (!isSalesRep && !password_hash) return res.status(400).json({ error: 'Password hash is required' });

  let portfolio_file_url = null;
  if (portfolio_file_base64 && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    portfolio_file_url = await uploadPortfolioFile(SUPABASE_URL, SUPABASE_SERVICE_KEY, email, portfolio_file_base64);
  }

  // 1. Save to Supabase first — always, before emails
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id, name, email, phone, position, status: 'new', password_hash: password_hash || null,
          city: city || null, bio: bio || null,
          equipment_owned: equipment_owned || null, has_transportation: has_transportation || null,
          instagram_tiktok: instagram_tiktok || null,
          camera_equipment: camera_equipment || null, drone_equipment: drone_equipment || null,
          faa_part_107: faa_part_107 || null,
          has_transportation_license: has_transportation_license || null,
          speaks_spanish: speaks_spanish || null,
          sales_experience: sales_experience || null, sales_experience_desc: sales_experience_desc || null,
          why_position: why_position || null, start_timing: start_timing || null,
          linkedin_url: linkedin_url || null,
          ai_tools_experience: ai_tools_experience || null, ai_system_description: ai_system_description || null,
          portfolio_links: portfolio_links || null,
          portfolio_file_url,
          submitted_at: new Date().toISOString(),
        }),
      });
      if (!sbRes.ok) {
        const errText = await sbRes.text();
        console.error('[submit-application] Supabase error:', sbRes.status, errText);
      } else {
        console.log('[submit-application] Saved to Supabase');
      }
    } catch (e) {
      console.error('[submit-application] Supabase error (non-fatal):', e.message);
    }
  }

  // 2. Send emails (non-fatal — application is already saved above)
  if (!RESEND_KEY) {
    console.warn('[submit-application] RESEND_API_KEY not set — skipping emails');
    return res.status(200).json({ ok: true, warning: 'Emails skipped — Resend not configured' });
  }

  const FROM = 'Nova Systems <noreply@nova-systems.app>';

  const posFields = position.includes('Content Creator')
    ? [
        `Equipment Owned: ${equipment_owned || 'N/A'}`,
        `Reliable Transportation: ${has_transportation === 'yes' ? 'Yes' : has_transportation === 'no' ? 'No' : 'N/A'}`,
        `Instagram/TikTok: ${instagram_tiktok || 'N/A'}`,
      ].join('\n')
    : position.includes('Videographer')
    ? [
        `Camera Equipment: ${camera_equipment || 'N/A'}`,
        `Drone Equipment: ${drone_equipment || 'N/A'}`,
        `FAA Part 107: ${faa_part_107 === 'yes' ? 'Yes' : faa_part_107 === 'no' ? 'No' : 'N/A'}`,
        `Reliable Transportation: ${has_transportation === 'yes' ? 'Yes' : has_transportation === 'no' ? 'No' : 'N/A'}`,
      ].join('\n')
    : isSalesRep
    ? [
        `Transportation + Valid CT License: ${has_transportation_license === 'yes' ? 'Yes' : has_transportation_license === 'no' ? 'No' : 'N/A'}`,
        `Speaks Spanish: ${speaks_spanish || 'N/A'}`,
        `Sales Experience: ${sales_experience || 'N/A'}`,
        `Experience Details: ${sales_experience_desc || 'N/A'}`,
        `Why This Position: ${why_position || 'N/A'}`,
        `Can Start: ${start_timing || 'N/A'}`,
        `LinkedIn: ${linkedin_url || 'N/A'}`,
      ].join('\n')
    : [
        `AI Tools Experience: ${ai_tools_experience || 'N/A'}`,
        `System Built: ${ai_system_description || 'N/A'}`,
      ].join('\n');

  const isaacBody = [
    'NEW JOB APPLICATION — Nova Systems',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Position: ${position}`,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || 'N/A'}`,
    `City:     ${city || 'N/A'}`,
    '',
    'BIO',
    '━━━',
    bio || 'N/A',
    '',
    'POSITION-SPECIFIC',
    '━━━━━━━━━━━━━━━━━',
    posFields,
    '',
    portfolio_links ? `PORTFOLIO LINKS:\n${portfolio_links}` : 'PORTFOLIO LINKS: None provided',
    portfolio_file_url ? `PORTFOLIO FILE: ${portfolio_file_url}` : (portfolio_file_name ? `PORTFOLIO FILE: ${portfolio_file_name} (upload failed, see logs)` : ''),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Review at: nova-systems.app/dashboard/candidates',
  ].filter(Boolean).join('\n');

  try {
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: ['Isaac_0427@icloud.com'],
        subject: `New Application: ${name} — ${position}`,
        text: isaacBody,
        reply_to: email,
      }),
    });
    if (!r1.ok) console.error('[submit-application] Isaac email failed (non-fatal):', await r1.text());
  } catch (e) {
    console.error('[submit-application] Isaac email error (non-fatal):', e.message);
  }

  const confirmBody = [
    `Hi ${name},`,
    '',
    'Your application to Nova Systems has been received. Isaac will personally review it and reach out within a few days.',
    '',
    `Position: ${position}`,
    '',
    ...(isSalesRep ? [] : [
      'YOUR APPLICANT LOGIN',
      '━━━━━━━━━━━━━━━━━━━━',
      'Track your application status at:',
      'https://nova-systems.app/application-status',
      '',
      `Login Email: ${email}`,
      'Password:    The password you set during your application',
      '',
    ]),
    '━━━━━━━━━━━━━━━━━━━━',
    'Questions? Email hello@nova-systems.app',
    '',
    'Isaac Nova',
    'Founder, Nova Systems',
    'nova-systems.app',
  ].join('\n');

  try {
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'Application Received — Nova Systems',
        text: confirmBody,
      }),
    });
    console.log('[submit-application] Applicant confirmation email:', r2.status);
  } catch (e) {
    console.warn('[submit-application] Applicant confirm email error (non-fatal):', e.message);
  }

  return res.status(200).json({ ok: true });
}
