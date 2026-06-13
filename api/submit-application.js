import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const RESEND_KEY         = process.env.RESEND_API_KEY;
  const SUPABASE_URL       = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[submit-application] RESEND_KEY present:', !!RESEND_KEY);
  console.log('[submit-application] Supabase configured:', !!(SUPABASE_URL && SUPABASE_SERVICE_KEY));

  // Sanitize all inputs
  const b = req.body || {};
  const id           = sanitize(b.id, 100);
  const name         = sanitize(b.name, 100);
  const email        = sanitizeEmail(b.email);
  const phone        = sanitizePhone(b.phone);
  const position     = sanitize(b.position, 100);
  const cover_letter = sanitize(b.cover_letter, 5000);
  const experience   = sanitize(b.experience, 3000);
  const why_nova     = sanitize(b.why_nova, 3000);
  const availability = sanitize(b.availability, 200);
  const expected_pay = sanitize(b.expected_pay, 200);
  const password_hash = sanitize(b.password_hash, 128);

  const reference_1_name         = sanitize(b.reference_1_name, 100);
  const reference_1_relationship = sanitize(b.reference_1_relationship, 100);
  const reference_1_phone        = sanitizePhone(b.reference_1_phone || '');
  const reference_1_email        = sanitizeEmail(b.reference_1_email || '');
  const reference_2_name         = sanitize(b.reference_2_name, 100);
  const reference_2_relationship = sanitize(b.reference_2_relationship, 100);
  const reference_2_phone        = sanitizePhone(b.reference_2_phone || '');
  const reference_2_email        = sanitizeEmail(b.reference_2_email || '');
  const reference_3_name         = sanitize(b.reference_3_name, 100);
  const reference_3_relationship = sanitize(b.reference_3_relationship, 100);
  const reference_3_phone        = sanitizePhone(b.reference_3_phone || '');
  const reference_3_email        = sanitizeEmail(b.reference_3_email || '');

  const portfolio_url    = (() => { try { return sanitizeUrl(b.portfolio_url || ''); } catch { return ''; } })();
  const owns_camera      = sanitize(b.owns_camera, 10);
  const camera_specs     = sanitize(b.camera_specs, 300);
  const has_editing_exp  = sanitize(b.has_editing_exp, 10);
  const editing_software = sanitize(b.editing_software, 200);
  const social_media     = sanitize(b.social_media, 300);
  const has_drone        = sanitize(b.has_drone, 10);
  const sales_experience = sanitize(b.sales_experience, 1000);
  const industries       = sanitize(b.industries, 300);
  const has_car          = sanitize(b.has_car, 10);
  const cold_calling     = sanitize(b.cold_calling, 10);
  const biggest_sale     = sanitize(b.biggest_sale, 500);

  const resume_name   = sanitize(b.resume_name, 200);
  const resume_base64 = typeof b.resume_base64 === 'string' ? b.resume_base64 : '';

  // Only name, email, position, password_hash are truly required
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (!position)       return res.status(400).json({ error: 'Position is required' });
  if (!password_hash)  return res.status(400).json({ error: 'Password hash is required' });

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
          id, name, email, phone, position, status: 'new',
          cover_letter, experience, why_nova_systems: why_nova,
          availability, expected_pay, password_hash,
          reference_1_name, reference_1_relationship, reference_1_phone, reference_1_email,
          reference_2_name, reference_2_relationship, reference_2_phone, reference_2_email,
          reference_3_name, reference_3_relationship, reference_3_phone, reference_3_email,
          portfolio_url: portfolio_url || null,
          owns_camera: owns_camera || null, camera_specs: camera_specs || null,
          has_editing_exp: has_editing_exp || null, editing_software: editing_software || null,
          social_media: social_media || null, has_drone: has_drone || null,
          sales_experience: sales_experience || null, industries: industries || null,
          has_car: has_car || null, cold_calling: cold_calling || null,
          biggest_sale: biggest_sale || null,
          resume_name: resume_name || null,
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

  const refs = [
    [reference_1_name, reference_1_relationship, reference_1_phone, reference_1_email],
    [reference_2_name, reference_2_relationship, reference_2_phone, reference_2_email],
    [reference_3_name, reference_3_relationship, reference_3_phone, reference_3_email],
  ].filter(([n]) => n);

  const refText = refs.length
    ? refs.map(([n, r, p, e], i) =>
        `  Ref ${i + 1}: ${n} · ${r || 'N/A'} · ${p || 'N/A'} · ${e || 'N/A'}`
      ).join('\n')
    : '  None provided';

  const posFields = position.includes('Videographer')
    ? [
        `Camera/Phone: ${owns_camera === 'yes' ? 'Yes' : owns_camera === 'no' ? 'No' : 'N/A'}`,
        `Camera Specs: ${camera_specs || 'N/A'}`,
        `Video Editing: ${has_editing_exp === 'yes' ? `Yes — ${editing_software || 'unspecified'}` : has_editing_exp === 'no' ? 'No' : 'N/A'}`,
        `Social Media: ${social_media || 'N/A'}`,
        `Drone: ${has_drone === 'yes' ? 'Yes' : has_drone === 'no' ? 'No' : 'N/A'}`,
        `Portfolio: ${portfolio_url || 'N/A'}`,
      ].join('\n')
    : position.includes('Sales')
    ? [
        `Sales Exp: ${sales_experience || 'N/A'}`,
        `Industries: ${industries || 'N/A'}`,
        `Reliable Car: ${has_car === 'yes' ? 'Yes' : has_car === 'no' ? 'No' : 'N/A'}`,
        `Cold Calling: ${cold_calling === 'yes' ? 'Yes' : cold_calling === 'no' ? 'No' : 'N/A'}`,
        `Biggest Sale: ${biggest_sale || 'N/A'}`,
        `Commission Expectation: ${expected_pay || 'N/A'}`,
      ].join('\n')
    : `Portfolio: ${portfolio_url || 'N/A'}`;

  const isaacBody = [
    'NEW JOB APPLICATION — Nova Systems',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Position: ${position}`,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || 'N/A'}`,
    '',
    'COVER LETTER',
    '━━━━━━━━━━━━',
    cover_letter || 'Not provided',
    '',
    'PREVIOUS EXPERIENCE',
    experience || 'N/A',
    '',
    'WHY NOVA SYSTEMS',
    why_nova || 'N/A',
    '',
    `Availability: ${availability || 'N/A'}`,
    `Expected Pay: ${expected_pay || 'N/A'}`,
    '',
    'POSITION-SPECIFIC',
    '━━━━━━━━━━━━━━━━━',
    posFields,
    '',
    'REFERENCES',
    '━━━━━━━━━━',
    refText,
    '',
    resume_name ? `RESUME: ${resume_name} (attached)` : 'RESUME: Not provided',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Review at: nova-systems.app/login → Candidates dashboard',
  ].join('\n');

  const attachments = resume_base64
    ? [{ filename: resume_name || 'resume.pdf', content: resume_base64.replace(/^data:[^;]+;base64,/, '') }]
    : undefined;

  // Email to Isaac
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
        ...(attachments ? { attachments } : {}),
      }),
    });
    const r1Body = await r1.text();
    console.log('[submit-application] Isaac email:', r1.status, r1Body);
    if (!r1.ok) console.error('[submit-application] Isaac email failed (non-fatal):', r1Body);
  } catch (e) {
    console.error('[submit-application] Isaac email error (non-fatal):', e.message);
  }

  // Confirmation email to applicant
  const confirmBody = [
    `Hi ${name},`,
    '',
    'Your application to Nova Systems has been received. Isaac will personally review it and reach out within a few days.',
    '',
    `Position: ${position}`,
    '',
    'YOUR APPLICANT LOGIN',
    '━━━━━━━━━━━━━━━━━━━━',
    'Track your application status at:',
    'https://nova-systems.app/applicant-login',
    '',
    `Login Email: ${email}`,
    'Password:    The password you set during your application',
    '',
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
