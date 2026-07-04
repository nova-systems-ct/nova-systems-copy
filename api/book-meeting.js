import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';

const VALID_NEEDS = [
  'Website', 'Social Media', 'AI Phone System', 'Branding & Identity',
  'CRM & Lead Tracking', 'Email Marketing', 'Video & Content Creation',
  'Drone Footage', 'Signage & Uniforms', 'Full Business System', 'Not Sure Yet',
];

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  const b = req.body || {};
  const name          = sanitize(b.name, 100);
  const business_name = sanitize(b.business_name, 200);
  const phone         = sanitizePhone(b.phone);
  const email         = sanitizeEmail(b.email);
  const business_type = sanitize(b.business_type, 60);
  const needs         = Array.isArray(b.needs) ? b.needs.map((n) => sanitize(n, 60)).filter((n) => VALID_NEEDS.includes(n)) : [];
  const notes         = sanitize(b.notes, 3000);
  const referral_source = sanitize(b.referral_source, 60);
  const meeting_date  = sanitize(b.meeting_date, 100);
  const meeting_time  = sanitize(b.meeting_time, 30);

  if (!name || !business_name || !phone || !email) {
    return res.status(400).json({ error: 'Name, business name, phone, and email are required' });
  }
  if (!meeting_date || !meeting_time) {
    return res.status(400).json({ error: 'A meeting date and time are required' });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/intake_requests`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name, business_name, phone, email,
          business_type: business_type || null,
          needs,
          notes: notes || null,
          referral_source: referral_source || null,
          meeting_date, meeting_time,
          status: 'pending',
        }),
      });
      if (!r.ok) {
        console.error('[book-meeting] Supabase error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('[book-meeting] Supabase error (non-fatal):', err.message);
    }
  } else {
    console.warn('[book-meeting] Supabase not configured — skipping save');
  }

  if (!RESEND_KEY) {
    console.warn('[book-meeting] RESEND_API_KEY not set — skipping emails');
    return res.status(200).json({ ok: true, warning: 'Emails skipped — Resend not configured' });
  }

  const FROM = 'Nova Systems <noreply@nova-systems.app>';
  const needsRows = needs.length
    ? needs.map((n) => `<li style="padding:2px 0;">${escapeHtml(n)}</li>`).join('')
    : '<li style="padding:2px 0;color:#888;">Not specified</li>';

  const isaacHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <div style="background:#0a0800;padding:20px 28px;">
        <span style="color:#D4A030;font-weight:900;letter-spacing:2px;font-size:14px;">NOVA SYSTEMS</span>
      </div>
      <div style="padding:28px;border:1px solid #eee;border-top:none;">
        <h2 style="margin:0 0 4px;">New Strategy Meeting Request</h2>
        <p style="color:#555;margin:0 0 20px;">${escapeHtml(business_name)}</p>
        <div style="background:#D4A030;color:#0a0800;padding:14px 18px;border-radius:8px;font-weight:700;margin-bottom:20px;">
          ${escapeHtml(meeting_date)} at ${escapeHtml(meeting_time)}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:140px;">Name</td><td style="padding:8px 0;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Business</td><td style="padding:8px 0;">${escapeHtml(business_name)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Phone</td><td style="padding:8px 0;">${escapeHtml(phone)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Business Type</td><td style="padding:8px 0;">${escapeHtml(business_type || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Services Needed</td><td style="padding:8px 0;"><ul style="margin:0;padding-left:18px;">${needsRows}</ul></td></tr>
          <tr><td style="padding:8px 0;color:#888;">Referral Source</td><td style="padding:8px 0;">${escapeHtml(referral_source || 'N/A')}</td></tr>
          <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Notes</td><td style="padding:8px 0;">${escapeHtml(notes || 'None provided')}</td></tr>
        </table>
        <p style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#888;font-size:12px;">
          Action required — confirm or reschedule with this client.
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
        subject: `New Strategy Meeting Request — ${business_name} — ${meeting_date} at ${meeting_time}`,
        html: isaacHtml,
        reply_to: email,
      }),
    });
    if (!r1.ok) console.error('[book-meeting] Isaac email failed:', await r1.text());
  } catch (err) {
    console.error('[book-meeting] Isaac email error (non-fatal):', err.message);
  }

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <div style="background:#0a0800;padding:24px 28px;text-align:center;">
        <span style="color:#D4A030;font-weight:900;letter-spacing:2px;font-size:16px;">NOVA SYSTEMS</span>
      </div>
      <div style="padding:32px 28px;border:1px solid #eee;border-top:none;">
        <p>Hello ${escapeHtml(name)},</p>
        <p>Your free strategy meeting with Isaac Nova is confirmed for:</p>
        <div style="background:#D4A030;color:#0a0800;padding:16px 20px;border-radius:8px;font-weight:700;text-align:center;margin:20px 0;font-size:16px;">
          ${escapeHtml(meeting_date)}<br/>${escapeHtml(meeting_time)}
        </div>
        <p>We will review your business, discuss your goals, and map out exactly what Nova Systems can build for you.</p>
        <p>If you need to reschedule, call <strong>(203) 706-0504</strong> or email <a href="mailto:hello@nova-systems.app" style="color:#D4A030;">hello@nova-systems.app</a>.</p>
        <p>See you soon.</p>
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
        subject: 'Your Nova Systems Strategy Meeting Is Confirmed',
        html: clientHtml,
      }),
    });
    if (!r2.ok) console.error('[book-meeting] Client email failed:', await r2.text());
  } catch (err) {
    console.error('[book-meeting] Client email error (non-fatal):', err.message);
  }

  return res.status(200).json({ ok: true });
}
