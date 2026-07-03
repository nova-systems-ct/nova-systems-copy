import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';
import { uploadToVault } from './_vaultStorage.js';

// Combined intake endpoint — dispatch via ?action=
//   save-client         POST  save /welcome wizard steps before payment
//   welcome-complete     POST  finalize client account after payment
//   clients               GET  list clients created via the wizard
//   submit-application     POST  submit a job application
//   check-applicant          POST  applicant portal login
//   applications                GET  list job applications (admin)

async function hashPassword(pw) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(pw).digest('hex');
}

// Saves the /welcome wizard (steps 1-5 + signature) to Supabase before the
// client pays. Called right before redirecting to / mounting Stripe payment.
async function handleSaveClient(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const b = req.body || {};
  const id                = sanitize(b.id, 100) || undefined;
  const full_name          = sanitize(b.full_name, 150);
  const business_name       = sanitize(b.business_name, 200);
  const phone                = sanitizePhone(b.phone);
  const email                 = sanitizeEmail(b.email);
  const business_address       = sanitize(b.business_address, 300);
  const business_type           = sanitize(b.business_type, 100);
  const current_website          = sanitize(b.current_website, 300);
  const referral_source           = sanitize(b.referral_source, 100);
  const tier_name                  = sanitize(b.tier_name, 100);
  const tier_price                  = Number(b.tier_price) || 0;
  const signature_data_url           = typeof b.signature_data_url === 'string' ? b.signature_data_url.slice(0, 500000) : '';
  const language                      = sanitize(b.language, 5) || 'en';
  const intake_data                    = b.intake_data && typeof b.intake_data === 'object' ? b.intake_data : {};

  if (!full_name || !email) return res.status(400).json({ error: 'Full name and email are required' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ ok: true, client_id: id || `local-${Date.now()}`, warning: 'Supabase not configured — using local id' });
  }

  const record = {
    full_name, business_name, phone, email, business_address, business_type,
    current_website, referral_source, tier_name, tier_price,
    signature_data_url: signature_data_url || null,
    language, intake_data, status: 'Pending Payment', payment_status: 'Pending',
  };

  try {
    const isUpdate = !!id;
    const url = isUpdate
      ? `${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(id)}`
      : `${SUPABASE_URL}/rest/v1/clients`;

    const r = await fetch(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!r.ok) {
      console.error('[intake:save-client] Supabase error:', r.status, await r.text());
      return res.status(500).json({ error: 'Failed to save intake data' });
    }

    const rows = await r.json();
    return res.status(200).json({ ok: true, client_id: rows[0]?.id });
  } catch (err) {
    console.error('[intake:save-client] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save intake data' });
  }
}

async function handleWelcomeComplete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;

  const b = req.body || {};
  const client_id      = sanitize(b.client_id, 100);
  const full_name        = sanitize(b.full_name, 150);
  const business_name     = sanitize(b.business_name, 200);
  const email               = sanitizeEmail(b.email);
  const phone                = sanitizePhone(b.phone);
  const tier_name              = sanitize(b.tier_name, 100);
  const tier_price               = Number(b.tier_price) || 0;
  const contract_pdf_base64        = typeof b.contract_pdf_base64 === 'string' ? b.contract_pdf_base64 : '';

  if (!client_id || !email) return res.status(400).json({ error: 'client_id and email are required' });

  const tempPassword = `Nova${(phone || '').replace(/\D/g, '').slice(0, 4) || '0000'}`;
  let contract_url = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(client_id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'Active', payment_status: 'Paid', first_payment_date: new Date().toISOString() }),
      });
    } catch (e) { console.error('[intake:welcome-complete] client update error:', e.message); }

    try {
      const password_hash = await hashPassword(tempPassword);
      await fetch(`${SUPABASE_URL}/rest/v1/client_accounts`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates',
        },
        body: JSON.stringify({ client_id, email, password_hash, status: 'active' }),
      });
    } catch (e) { console.error('[intake:welcome-complete] client_accounts error:', e.message); }

    if (contract_pdf_base64) {
      const match = contract_pdf_base64.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        try {
          const result = await uploadToVault(SUPABASE_URL, SUPABASE_KEY, {
            base64: match[2], fileName: `contract-${new Date().toISOString().slice(0, 10)}.pdf`,
            mimeType: 'application/pdf', category: 'contracts',
            clientId: client_id, clientName: business_name || full_name, docType: 'Contract', status: 'Signed',
          });
          contract_url = result.file_url;
          await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(client_id)}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json', Prefer: 'return=minimal',
            },
            body: JSON.stringify({ contract_url }),
          });
        } catch (e) { console.error('[intake:welcome-complete] contract upload error:', e.message); }
      }
    }
  }

  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Welcome to Nova Systems 🖤',
          text: [
            `Hi ${full_name},`,
            '',
            `Welcome to Nova Systems! Your ${tier_name} plan is now active.`,
            '',
            'YOUR CLIENT PORTAL LOGIN',
            '━━━━━━━━━━━━━━━━━━━━━━━━',
            `Email:    ${email}`,
            `Password: ${tempPassword}`,
            '',
            'Log in at https://nova-systems.app/login to track your services, approve content, and message your team.',
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (e) { console.warn('[intake:welcome-complete] client email error:', e.message); }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: ['Isaac_0427@icloud.com'],
          subject: `New Client Signed: ${business_name || full_name} — $${tier_price}/mo`,
          text: [
            'NEW CLIENT — CONTRACT SIGNED & PAID',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            `Business: ${business_name}`,
            `Contact:  ${full_name}`,
            `Email:    ${email}`,
            `Phone:    ${phone || 'N/A'}`,
            `Plan:     ${tier_name} — $${tier_price}/mo`,
            contract_url ? `Contract: ${contract_url}` : '',
          ].filter(Boolean).join('\n'),
        }),
      });
    } catch (e) { console.warn('[intake:welcome-complete] isaac email error:', e.message); }
  }

  return res.status(200).json({ ok: true, temp_password: tempPassword, contract_url });
}

// Lists clients created via the /welcome intake wizard.
async function handleListClients(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[intake:clients] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[intake:clients] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function uploadPortfolioFile(SUPABASE_URL, SUPABASE_SERVICE_KEY, email, base64) {
  const ALLOWED_PORTFOLIO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'];
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
    if (!r.ok) { console.error('[intake:submit-application] Portfolio upload error:', r.status, await r.text()); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/portfolios/${filename}`;
  } catch (e) {
    console.error('[intake:submit-application] Portfolio upload error:', e.message);
    return null;
  }
}

async function handleSubmitApplication(req, res) {
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
        console.error('[intake:submit-application] Supabase error:', sbRes.status, errText);
      } else {
        console.log('[intake:submit-application] Saved to Supabase');
      }
    } catch (e) {
      console.error('[intake:submit-application] Supabase error (non-fatal):', e.message);
    }
  }

  if (!RESEND_KEY) {
    console.warn('[intake:submit-application] RESEND_API_KEY not set — skipping emails');
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
    if (!r1.ok) console.error('[intake:submit-application] Isaac email failed (non-fatal):', await r1.text());
  } catch (e) {
    console.error('[intake:submit-application] Isaac email error (non-fatal):', e.message);
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
    console.log('[intake:submit-application] Applicant confirmation email:', r2.status);
  } catch (e) {
    console.warn('[intake:submit-application] Applicant confirm email error (non-fatal):', e.message);
  }

  return res.status(200).json({ ok: true });
}

async function handleCheckApplicant(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return; // strict: 5 login attempts/min per IP

  const email         = sanitizeEmail(req.body?.email || '');
  const password_hash = sanitize(req.body?.password_hash || '', 128);

  if (!email || !password_hash) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  console.log('[intake:check-applicant] Checking email:', email);

  const SUPABASE_URL        = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('[intake:check-applicant] Supabase not configured — signaling localStorage fallback');
    return res.status(200).json({ mode: 'localStorage' });
  }

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
      console.error('[intake:check-applicant] Supabase query error:', sbRes.status, txt);
      return res.status(502).json({ error: 'Database error — try again' });
    }

    rows = await sbRes.json();
  } catch (err) {
    console.error('[intake:check-applicant] Fetch error:', err.message);
    return res.status(502).json({ error: 'Database unreachable — try again' });
  }

  console.log('[intake:check-applicant] Rows found for email:', rows.length);

  if (rows.length === 0) {
    console.log('[intake:check-applicant] No account found for:', email);
    return res.status(200).json({ result: 'no_account' });
  }

  const row = rows.find((r) => r.password_hash === password_hash);
  console.log('[intake:check-applicant] Hash match:', !!row);

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

async function handleListApplications(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[intake:applications] Supabase not configured — returning empty');
    return res.status(200).json([]);
  }

  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/applications?select=*&order=submitted_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!sbRes.ok) {
      console.error('[intake:applications] Supabase error:', sbRes.status, await sbRes.text());
      return res.status(200).json([]);
    }

    const rows = await sbRes.json();

    const normalized = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      position: r.position,
      status: r.status || 'new',
      cover_letter: r.cover_letter || '',
      experience: r.experience || '',
      why_nova: r.why_nova_systems || '',
      availability: r.availability || '',
      expected_pay: r.expected_pay || '',
      password_hash: r.password_hash || '',
      portfolio_url: r.portfolio_url || '',
      owns_camera: r.owns_camera || '',
      camera_specs: r.camera_specs || '',
      has_editing_exp: r.has_editing_exp || '',
      editing_software: r.editing_software || '',
      social_media: r.social_media || '',
      has_drone: r.has_drone || '',
      sales_experience: r.sales_experience || '',
      industries: r.industries || '',
      has_car: r.has_car || '',
      cold_calling: r.cold_calling || '',
      biggest_sale: r.biggest_sale || '',
      reference_1_name: r.reference_1_name || '',
      reference_1_relationship: r.reference_1_relationship || '',
      reference_1_phone: r.reference_1_phone || '',
      reference_1_email: r.reference_1_email || '',
      reference_2_name: r.reference_2_name || '',
      reference_2_relationship: r.reference_2_relationship || '',
      reference_2_phone: r.reference_2_phone || '',
      reference_2_email: r.reference_2_email || '',
      reference_3_name: r.reference_3_name || '',
      reference_3_relationship: r.reference_3_relationship || '',
      reference_3_phone: r.reference_3_phone || '',
      reference_3_email: r.reference_3_email || '',
      resume_name: r.resume_name || '',
      submittedAt: r.submitted_at,
      submitted_at: r.submitted_at,
      status_messages: r.status_messages || [],
      adminNotes: r.admin_notes || '',
      interviewDate: r.interview_date || '',
      interviewTime: r.interview_time || '',
    }));

    return res.status(200).json(normalized);
  } catch (err) {
    console.error('[intake:applications] Error:', err.message);
    return res.status(200).json([]);
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  switch (action) {
    case 'save-client':          return handleSaveClient(req, res);
    case 'welcome-complete':      return handleWelcomeComplete(req, res);
    case 'clients':                return handleListClients(req, res);
    case 'submit-application':      return handleSubmitApplication(req, res);
    case 'check-applicant':          return handleCheckApplicant(req, res);
    case 'applications':              return handleListApplications(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
