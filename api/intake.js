import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';
import { uploadToVault } from './_vaultStorage.js';
import { requireStaff } from './_auth.js';

// Combined intake endpoint — dispatch via ?action=
//   save-client         POST  save /welcome wizard steps before payment
//   welcome-complete     POST  finalize client account after payment
//   clients               GET  &id=<uuid> public: one client's own record (e.g. OnboardSuccess.jsx
//                                right after payment) — no id: [intelligence.view] full list
//   submit-application     POST  submit a job application
//   check-applicant          POST  applicant portal login (own account only)
//   applications                GET  [admin.view] list job applications — includes applicant PII
//   update-application            POST  [admin.view] update an application's status/notes/interview

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

  // Public path: a specific id (e.g. OnboardSuccess.jsx reading its own just-created record off
  // the URL right after payment) is scoped to exactly that row server-side — never the full table
  // filtered client-side, which is what this used to do (and what the unscoped path below still
  // requires staff auth for).
  const id = typeof req.query?.id === 'string' ? sanitize(req.query.id, 100) : '';

  try {
    const qs = id ? `id=eq.${encodeURIComponent(id)}&limit=1` : 'order=created_at.desc';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[intake:clients] Supabase error:', r.status, await r.text()); return res.status(200).json(id ? null : []); }
    const rows = await r.json();
    return res.status(200).json(id ? (rows[0] || null) : rows);
  } catch (err) {
    console.error('[intake:clients] Error:', err.message);
    return res.status(200).json(id ? null : []);
  }
}

// Repair task (2026-09-23): the `portfolios` storage bucket this used to upload into did not
// actually exist in production (confirmed live via the Storage Admin API — every bucket this
// codebase references, including this one, 404'd) — every application submitted to date has
// silently had NO resume/portfolio file saved, even when the applicant successfully attached
// one, because this function's own upload request failed and was caught, not because of
// anything wrong on the applicant's end. Storing a *path* now (not a constructed public URL) —
// this bucket must be created PRIVATE (see docs handed to Isaac alongside this change), and
// access happens only through a fresh, short-lived signed URL generated on demand by an admin
// action (see handleResumeSignedUrl below), never a permanent public link. This is what "private
// uploads" in the master build prompt's Careers/application spec actually requires.
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
  const path = `${safeEmail}/${Date.now()}.${ext}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/portfolios/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!r.ok) { console.error('[intake:submit-application] Portfolio upload error:', r.status, await r.text()); return null; }
    return path; // caller stores this in applications.portfolio_file_path — never a public URL
  } catch (e) {
    console.error('[intake:submit-application] Portfolio upload error:', e.message);
    return null;
  }
}

// [column, label, maxLen, isUrl] — every optional applications-table column
// that any job's application form might populate. Driven generically so new
// jobs/fields don't require new email-formatting code.
const EXTRA_FIELDS = [
  ['linkedin_url', 'LinkedIn', 300, true],
  ['github_url', 'GitHub', 300, true],
  ['years_experience', 'Years of Experience', 30],
  ['tech_stack', 'Tech Stack', 2000],
  ['ai_tools_experience', 'AI/Automation Experience', 1500],
  ['management_experience', 'Team Management Experience', 30],
  ['operations_experience', 'Operational/Management Experience', 2000],
  ['organization_tools', 'Organization Tools', 1000],
  ['planning_experience', 'Planning/Product Management Experience', 2000],
  ['project_example', 'Project Example', 2000],
  ['financial_background', 'Financial/Accounting Background', 2000],
  ['invoicing_tax_experience', 'Invoicing & Tax Experience', 10],
  ['invoicing_tax_explain', 'Invoicing & Tax Details', 2000],
  ['has_transportation_license', 'Reliable Vehicle + CT License', 10],
  ['speaks_spanish', 'Speaks Spanish', 20],
  ['sales_experience', 'Sales Experience', 30],
  ['sales_experience_desc', 'Sales Experience Details', 2000],
  ['start_timing', 'Can Start', 30],
  ['equipment_owned', 'Equipment Owned', 1000],
  ['has_transportation', 'Reliable Transportation', 10],
  ['platforms', 'Platforms', 200],
  ['instagram_tiktok', 'Instagram/TikTok', 200],
  ['editing_software', 'Editing Software', 1000],
  ['bio', 'Bio', 3000],
  ['reliable_internet', 'Reliable Internet', 10],
  ['outreach_experience', 'Outreach Experience', 30],
  ['hours_per_week', 'Hours Per Week', 20],
  ['camera_equipment', 'Camera Equipment', 1000],
  ['drone_equipment', 'Drone Equipment', 1000],
  ['faa_part_107', 'FAA Part 107', 10],
  ['ai_system_description', 'AI System Description', 3000],
  ['why_position', 'Why Nova Systems', 2000],
];

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
  const city          = sanitize(b.city, 100);

  const extra = {};
  for (const [column, , maxLen, isUrl] of EXTRA_FIELDS) {
    extra[column] = isUrl
      ? (() => { try { return sanitizeUrl(b[column] || ''); } catch { return ''; } })()
      : sanitize(b[column], maxLen);
  }

  const portfolio_links       = sanitize(b.portfolio_links, 2000);
  const portfolio_file_name   = sanitize(b.portfolio_file_name, 200);
  const portfolio_file_base64 = typeof b.portfolio_file_base64 === 'string' ? b.portfolio_file_base64 : '';

  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (!position)       return res.status(400).json({ error: 'Position is required' });
  // Sales applications moved to the authenticated flow (api/_sales/hiring.js, /apply/sales): it validates server-side, keeps
  // history, and refuses bank/ID numbers. This legacy generic form must not create a parallel sales applicant record.
  if (/\bsales\b/i.test(position)) return res.status(410).json({ error: 'Sales representative applications now use the new application at /apply/sales.' });

  let portfolio_file_path = null;
  if (portfolio_file_base64 && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    portfolio_file_path = await uploadPortfolioFile(SUPABASE_URL, SUPABASE_SERVICE_KEY, email, portfolio_file_base64);
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const record = {
        id, name, email, phone, position, status: 'new', password_hash: null, // never store a client-computed password hash: no login path uses it (retired 2026-09-23)
        city: city || null,
        portfolio_links: portfolio_links || null,
        portfolio_file_path,
        submitted_at: new Date().toISOString(),
      };
      for (const [column] of EXTRA_FIELDS) record[column] = extra[column] || null;

      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(record),
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

  const isaacBody = [
    'NEW JOB APPLICATION — Nova Systems',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Position: ${position}`,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || 'N/A'}`,
    city ? `City:     ${city}` : '',
    '',
    'APPLICATION DETAILS',
    '━━━━━━━━━━━━━━━━━━━',
    ...EXTRA_FIELDS.filter(([column]) => extra[column]).map(([column, label]) => `${label}: ${cap(extra[column])}`),
    '',
    portfolio_links ? `PORTFOLIO LINKS:\n${portfolio_links}` : 'PORTFOLIO LINKS: None provided',
    portfolio_file_path ? 'PORTFOLIO FILE: uploaded — view it from the applicant\'s record in the dashboard (private file, no public link)' : (portfolio_file_name ? `PORTFOLIO FILE: ${portfolio_file_name} (upload failed, see logs)` : ''),
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
    ...(password_hash ? [
      'YOUR APPLICANT LOGIN',
      '━━━━━━━━━━━━━━━━━━━━',
      'Track your application status at:',
      'https://nova-systems.app/application-status',
      '',
      `Login Email: ${email}`,
      'Password:    The password you set during your application',
      '',
    ] : []),
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

// handleCheckApplicant removed 2026-09-23 — it compared a client-computed SHA-256 password hash
// server-side and returned a no_account/wrong_password result split with no real session ever
// issued: the same category of security relic as api/client.js's old `auth` resource ("Nova
// Connect"), and disabled the same way (410, see the dispatcher below) rather than secured.
// Replaced by real Supabase Auth (ApplicantLogin.jsx signs in via supabase.auth.signInWithPassword;
// see invite-applicant/my-application below for how an applicant gets a real account at all).

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
      portfolio_url: r.portfolio_url || '',
      portfolio_file_path: r.portfolio_file_path || '', // private — never a public URL; see resume-signed-url action
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
      auth_user_id: r.auth_user_id || null,
      invited_at: r.invited_at || null,
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

// Repair task (2026-09-21): Jobs.jsx/JobDetail.jsx previously wrote status/notes/interview
// changes ONLY to localStorage (`nova_applications`) — never back to Supabase. That meant any
// change was invisible cross-device and to any other staff member, and would silently vanish if
// the browser's storage was cleared. This is the real, persisted write path those pages now call.
const VALID_APPLICATION_STATUSES = ['new', 'reviewing', 'interview_scheduled', 'hired', 'declined'];

async function handleUpdateApplication(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const patch = {};
  if ('status' in b) {
    const status = sanitize(b.status, 30);
    if (!VALID_APPLICATION_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    patch.status = status;
  }
  if ('admin_notes' in b) patch.admin_notes = sanitize(b.admin_notes, 5000);
  if ('interview_date' in b) patch.interview_date = sanitize(b.interview_date, 20) || null;
  if ('interview_time' in b) patch.interview_time = sanitize(b.interview_time, 20) || null;

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No fields to update' });

  // Sales-position applications are managed only through the Sales Team hiring workspace (server-enforced stages, history, owner decision).
  try {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(id)}&select=position&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const pos = pr.ok ? (await pr.json())[0]?.position : '';
    if (/\bsales\b/i.test(pos || '')) return res.status(409).json({ error: 'Sales applications are managed in the Sales Team hiring workspace.' });
  } catch { /* fall through to the normal update path */ }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { console.error('[intake:update-application] Supabase error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to update application' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[intake:update-application] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update application' });
  }
}

// ------------------------------------------------------------- hiring workflow
// Careers -> application (above) -> administrator review (Jobs.jsx/JobDetail.jsx, existing) ->
// secure account invitation (below) -> Academy enrollment (api/academy.js, existing) -> practical
// approval (api/academy.js, existing) -> approved working agreement (api/contracts.js, extended)
// -> administrator-controlled representative activation (below). Every step after "secure
// account invitation" runs through the SAME canonical Supabase Auth / organization_members
// system the rest of the app already uses — a candidate is a real organization_members row with
// role='nova_sales_candidate' (granted ONLY academy.view; see
// supabase/hiring-workflow-migration-standalone.sql), not a separate identity system.

// (legacy invite-applicant / activate-representative removed 2026-09-26: replaced by the owner-controlled invitation and activation flow in api/_sales)

// Applicant self-service: returns only the caller's OWN application (matched by auth_user_id,
// never a client-supplied id) plus their Academy enrollment summary and any working-agreement
// contract status. Gated by requireStaff() with NO specific permission — deliberately: a
// candidate's organization_members row only ever grants academy.view, never admin.view/
// growth.view/etc., so "any active member" is safe here precisely because the row-ownership
// check below (auth_user_id = caller.id) is what actually restricts the data, not the role.
async function handleMyApplication(req, res, caller) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json(null);

  const appRes = await fetch(`${SUPABASE_URL}/rest/v1/applications?auth_user_id=eq.${encodeURIComponent(caller.id)}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const appRows = appRes.ok ? await appRes.json() : [];
  const application = appRows[0];
  if (!application) return res.status(200).json(null);

  const contractRes = await fetch(`${SUPABASE_URL}/rest/v1/contracts?application_id=eq.${encodeURIComponent(application.id)}&order=created_at.desc&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const contracts = contractRes.ok ? await contractRes.json() : [];

  return res.status(200).json({
    id: application.id, name: application.name, email: application.email, position: application.position,
    status: application.status, submitted_at: application.submitted_at,
    interview_date: application.interview_date, interview_time: application.interview_time,
    status_messages: application.status_messages || [],
    agreement: contracts[0] || null,
  });
}

async function handleResumeSignedUrl(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const id = sanitize(req.query?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const appRes = await fetch(`${SUPABASE_URL}/rest/v1/applications?id=eq.${encodeURIComponent(id)}&select=portfolio_file_path&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const appRows = appRes.ok ? await appRes.json() : [];
  const path = appRows[0]?.portfolio_file_path;
  if (!path) return res.status(404).json({ error: 'No file on file for this application' });

  try {
    const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/portfolios/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 }), // 5 minutes — regenerated fresh on every view, never stored
    });
    if (!signRes.ok) { console.error('[intake:resume-signed-url] Sign error:', signRes.status, await signRes.text()); return res.status(500).json({ error: 'Failed to generate a signed link' }); }
    const { signedURL } = await signRes.json();
    return res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1${signedURL}` });
  } catch (err) {
    console.error('[intake:resume-signed-url] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate a signed link' });
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  switch (action) {
    case 'save-client':          return handleSaveClient(req, res);
    case 'welcome-complete':      return handleWelcomeComplete(req, res);
    case 'clients':
      // Scoped-by-id lookup is public (a client reading their own just-created record); the full,
      // unscoped list is real PII across every client and requires staff auth.
      if (!req.query?.id && !(await requireStaff(req, res, 'intelligence.view'))) return;
      return handleListClients(req, res);
    case 'submit-application':      return handleSubmitApplication(req, res);
    // check-applicant retired 2026-09-23 — replaced by real Supabase Auth (see ApplicantLogin.jsx
    // and the invite-applicant/my-application actions below). It compared a client-computed
    // SHA-256 hash server-side with no real session issued — a genuine security relic, same
    // category as api/client.js's old `auth` resource, disabled the same way rather than secured.
    case 'check-applicant':          return res.status(410).json({ error: 'This login method has been retired. Applicants now sign in with a real Nova Systems account — see your invitation email.' });
    case 'applications':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleListApplications(req, res);
    case 'update-application':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleUpdateApplication(req, res);
    case 'invite-applicant':
      return res.status(410).json({ error: 'Retired. Invitations are created by the owner from the Sales Team hiring workspace (a decision, a single-use expiring link and a delivery record are required).' });
    case 'my-application': {
      const caller = await requireStaff(req, res);
      if (!caller) return;
      return handleMyApplication(req, res, caller);
    }
    case 'resume-signed-url':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleResumeSignedUrl(req, res);
    case 'activate-representative':
      return res.status(410).json({ error: 'Retired. Activation is an owner-only action with a complete checklist in the Sales Team workspace; training completion or a signature alone never activates a representative.' });
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
