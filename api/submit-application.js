export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[submit-application] RESEND_KEY present:', !!RESEND_KEY);
  console.log('[submit-application] Supabase configured:', !!(SUPABASE_URL && SUPABASE_SERVICE_KEY));

  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'Email service not configured — RESEND_API_KEY missing' });
  }

  const {
    id, name, email, phone, position, status,
    cover_letter, experience, why_nova, availability, expected_pay,
    password_hash,
    // references
    reference_1_name, reference_1_relationship, reference_1_phone, reference_1_email,
    reference_2_name, reference_2_relationship, reference_2_phone, reference_2_email,
    reference_3_name, reference_3_relationship, reference_3_phone, reference_3_email,
    // videographer
    portfolio_url, owns_camera, camera_specs, has_editing_exp, editing_software,
    social_media, has_drone,
    // sales
    sales_experience, industries, has_car, cold_calling, biggest_sale,
    // resume
    resume_name, resume_base64,
  } = req.body;

  // ── Supabase (optional — only runs if env vars set) ──────────────────
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
          portfolio_url, submitted_at: new Date().toISOString(),
        }),
      });
      if (!sbRes.ok) {
        const txt = await sbRes.text();
        console.error('[submit-application] Supabase error:', sbRes.status, txt);
      } else {
        console.log('[submit-application] Saved to Supabase');
      }
    } catch (e) {
      console.error('[submit-application] Supabase error (non-fatal):', e.message);
    }
  }

  const FROM = 'Nova Systems <noreply@nova-systems.app>';

  // ── Build reference text ─────────────────────────────────────────────
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

  const posFields = position?.includes('Videographer')
    ? [
        `Camera/Phone: ${owns_camera === 'yes' ? 'Yes' : 'No'}`,
        `Camera Specs: ${camera_specs || 'N/A'}`,
        `Video Editing: ${has_editing_exp === 'yes' ? `Yes — ${editing_software || 'unspecified'}` : 'No'}`,
        `Social Media: ${social_media || 'N/A'}`,
        `Drone: ${has_drone === 'yes' ? 'Yes' : has_drone === 'no' ? 'No' : 'N/A'}`,
        `Portfolio: ${portfolio_url || 'N/A'}`,
      ].join('\n')
    : position?.includes('Sales')
    ? [
        `Sales Exp: ${sales_experience || 'N/A'}`,
        `Industries: ${industries || 'N/A'}`,
        `Reliable Car: ${has_car === 'yes' ? 'Yes' : 'No'}`,
        `Cold Calling: ${cold_calling === 'yes' ? 'Yes' : 'No'}`,
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
    'Review at: nova-systems.app/login → Jobs dashboard',
  ].join('\n');

  const attachments = resume_base64
    ? [{ filename: resume_name || 'resume.pdf', content: resume_base64.replace(/^data:[^;]+;base64,/, '') }]
    : undefined;

  // ── Email to Isaac ────────────────────────────────────────────────────
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
    if (!r1.ok) return res.status(500).json({ error: 'Failed to send notification', details: r1Body });
  } catch (e) {
    console.error('[submit-application] Isaac email error:', e.message);
    return res.status(500).json({ error: 'Network error sending notification' });
  }

  // ── Confirmation email to applicant ────────────────────────────────
  const confirmBody = [
    `Hi ${name},`,
    '',
    `Your application to Nova Systems has been received. Isaac will personally review it and reach out within a few days.`,
    '',
    `Position: ${position}`,
    '',
    'YOUR APPLICANT LOGIN',
    '━━━━━━━━━━━━━━━━━━━━',
    'Track your application status at:',
    'https://nova-systems.app/applicant-login',
    '',
    `Email:    ${email}`,
    `Password: (the password you created during your application)`,
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
    const r2Body = await r2.text();
    console.log('[submit-application] Applicant confirm:', r2.status, r2Body);
  } catch (e) {
    console.warn('[submit-application] Confirm email error (non-fatal):', e.message);
  }

  return res.status(200).json({ ok: true });
}
