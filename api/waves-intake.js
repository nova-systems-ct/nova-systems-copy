import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';
import { twilioRequest } from './nova-ai/_twilio.js';

const VALID_PRIORITY_ENGINES = ['Nova Voice', 'Nova Blue', 'Nova Email', 'Nova Social', 'Nova Revive', 'Nova Audit'];

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function supabaseFetch(path, opts = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured');
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

async function handleSpots(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const r = await supabaseFetch('nova_ai_settings?key=eq.wave_one_spots_remaining&select=value&limit=1');
    const rows = r.ok ? await r.json() : [];
    const spots = rows[0]?.value ? parseInt(rows[0].value, 10) : 7;
    return res.status(200).json({ spots_remaining: Number.isFinite(spots) ? spots : 7 });
  } catch (err) {
    console.error('[waves-intake:spots] Error:', err.message);
    return res.status(200).json({ spots_remaining: 7 });
  }
}

async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;
  try {
    const r = await supabaseFetch('wave_one_applications?order=created_at.desc');
    return res.status(200).json(r.ok ? await r.json() : []);
  } catch (err) {
    console.error('[waves-intake:list] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function handleUpdateStatus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;
  const b = req.body || {};
  const id = sanitize(b.id, 100);
  const status = sanitize(b.status, 30);
  const VALID_STATUSES = ['new', 'reviewing', 'approved', 'rejected', 'waitlisted'];
  if (!id || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Valid id and status are required' });
  try {
    const r = await supabaseFetch(`wave_one_applications?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Update failed' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Update failed' });
  }
}

async function handleSetSpots(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const spots = parseInt(b.spots_remaining, 10);
  if (!Number.isFinite(spots) || spots < 0) return res.status(400).json({ error: 'spots_remaining must be a non-negative number' });
  try {
    const r = await supabaseFetch('nova_ai_settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'wave_one_spots_remaining', value: String(spots), updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Failed to update spots' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to update spots' });
  }
}

async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const b = req.body || {};
  const first_name       = sanitize(b.first_name, 60);
  const last_name        = sanitize(b.last_name, 60);
  const phone            = sanitizePhone(b.phone);
  const email            = sanitizeEmail(b.email);
  const company_name     = sanitize(b.company_name, 200);
  const website          = b.website ? sanitizeUrl(b.website) : '';
  const city             = sanitize(b.city, 80);
  const industry         = sanitize(b.industry, 80);
  const biggest_problem  = sanitize(b.biggest_problem, 100);
  const revenue_range    = sanitize(b.revenue_range, 60);
  const priority_engines = Array.isArray(b.priority_engines)
    ? b.priority_engines.map((e) => sanitize(e, 40)).filter((e) => VALID_PRIORITY_ENGINES.includes(e))
    : [];
  const notes = sanitize(b.notes, 3000);

  if (!first_name || !last_name || !phone || !email || !company_name) {
    return res.status(400).json({ error: 'First name, last name, phone, email, and company name are required' });
  }

  const record = {
    first_name, last_name, phone, email, company_name,
    website: website || null, city: city || null, industry: industry || null,
    biggest_problem: biggest_problem || null, revenue_range: revenue_range || null,
    priority_engines, notes: notes || null, status: 'new',
  };

  try {
    const r = await supabaseFetch('wave_one_applications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(record),
    });
    if (!r.ok) console.error('[waves-intake] Supabase save error:', r.status, await r.text());
  } catch (err) {
    console.error('[waves-intake] Supabase error (non-fatal):', err.message);
  }

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    try {
      await twilioRequest(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, 'POST', 'Messages.json', {
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Body: `Hi ${first_name} — this is Nova Systems. Your Wave One application for ${company_name} is in. We review every application personally and will follow up by email shortly. — Isaac`,
      });
    } catch (err) {
      console.error('[waves-intake] Twilio SMS error (non-fatal):', err.message);
    }
  } else {
    console.warn('[waves-intake] Twilio not configured — skipping SMS');
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.warn('[waves-intake] RESEND_API_KEY not set — skipping emails');
    return res.status(200).json({ ok: true, warning: 'Emails skipped — Resend not configured' });
  }

  const FROM = 'Nova Systems <noreply@nova-systems.app>';

  const isaacHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <div style="background:#0a0800;padding:20px 28px;">
        <span style="color:#D4A030;font-weight:900;letter-spacing:2px;font-size:14px;">NOVA SYSTEMS — WAVE ONE</span>
      </div>
      <div style="padding:28px;border:1px solid #eee;border-top:none;">
        <h2 style="margin:0 0 4px;">New Wave One Application</h2>
        <p style="color:#555;margin:0 0 20px;">${escapeHtml(company_name)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:160px;">Name</td><td style="padding:8px 0;">${escapeHtml(first_name)} ${escapeHtml(last_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Phone</td><td style="padding:8px 0;">${escapeHtml(phone)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Company</td><td style="padding:8px 0;">${escapeHtml(company_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Website</td><td style="padding:8px 0;">${escapeHtml(website || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">City</td><td style="padding:8px 0;">${escapeHtml(city || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Industry</td><td style="padding:8px 0;">${escapeHtml(industry || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Biggest Problem</td><td style="padding:8px 0;">${escapeHtml(biggest_problem || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Revenue Range</td><td style="padding:8px 0;">${escapeHtml(revenue_range || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Priority Engines</td><td style="padding:8px 0;">${priority_engines.length ? escapeHtml(priority_engines.join(', ')) : 'None selected'}</td></tr>
          <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Notes</td><td style="padding:8px 0;">${escapeHtml(notes || 'None provided')}</td></tr>
        </table>
        <p style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#888;font-size:12px;">
          Review this application in the Nova Systems dashboard — Wave One tab.
        </p>
      </div>
    </div>`;

  try {
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: ['Isaac_0427@icloud.com'],
        subject: `Wave One Application — ${company_name}`,
        html: isaacHtml,
        reply_to: email,
      }),
    });
    if (!r1.ok) console.error('[waves-intake] Isaac email failed:', await r1.text());
  } catch (err) {
    console.error('[waves-intake] Isaac email error (non-fatal):', err.message);
  }

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <div style="background:#0a0800;padding:24px 28px;text-align:center;">
        <span style="color:#D4A030;font-weight:900;letter-spacing:2px;font-size:16px;">NOVA SYSTEMS — WAVE ONE</span>
      </div>
      <div style="padding:32px 28px;border:1px solid #eee;border-top:none;">
        <p>Hi ${escapeHtml(first_name)},</p>
        <p>Your Wave One application for <strong>${escapeHtml(company_name)}</strong> is in.</p>
        <p>We review every application personally. Here's what happens next:</p>
        <ol style="padding-left:20px;color:#333;">
          <li style="margin-bottom:8px;">We review your application within 24 hours.</li>
          <li style="margin-bottom:8px;">We put together your free Nova Audit — a look at where you're losing revenue right now.</li>
          <li style="margin-bottom:8px;">If there's a spot open, Isaac reaches out directly to get you live in 14 days.</li>
        </ol>
        <p>If you have any questions in the meantime, call <strong>(203) 706-0504</strong> or email <a href="mailto:hello@nova-systems.app" style="color:#D4A030;">hello@nova-systems.app</a>.</p>
        <p style="margin-top:24px;">— Isaac Nova<br/>Founder and CEO, Nova Systems</p>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center;">
          <p style="margin:0;">nova-systems.app · Waterbury, Connecticut</p>
        </div>
      </div>
    </div>`;

  try {
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'Your Wave One Application Is In — Nova Systems',
        html: clientHtml,
      }),
    });
    if (!r2.ok) console.error('[waves-intake] Client email failed:', await r2.text());
  } catch (err) {
    console.error('[waves-intake] Client email error (non-fatal):', err.message);
  }

  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  if (action === 'spots') return handleSpots(req, res);
  if (action === 'list') return handleList(req, res);
  if (action === 'update-status') return handleUpdateStatus(req, res);
  if (action === 'set-spots') return handleSetSpots(req, res);
  return handleSubmit(req, res);
}
