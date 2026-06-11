import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const b = req.body || {};

  // Sanitize
  const name      = sanitize(b.name, 100);
  const business  = sanitize(b.business, 200);
  const industry  = sanitize(b.industry, 100);
  const phone     = sanitizePhone(b.phone);
  const email     = sanitizeEmail(b.email);
  const revenue   = sanitize(b.revenue, 100);
  const challenge = sanitize(b.challenge, 200);
  const time      = sanitize(b.time, 100);
  const message   = sanitize(b.message, 2000);

  // Validate required fields
  if (!name || !business || !email || !phone) {
    return res.status(400).json({ error: 'Name, business, email, and phone are required' });
  }

  // Save to Supabase if credentials present
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/demo_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name, business, industry, phone, email,
          revenue, challenge, preferred_time: time, message,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('[book-demo] Supabase save failed:', err.message);
    }
  }

  const key = process.env.RESEND_API_KEY;
  console.log('[book-demo] RESEND_API_KEY present:', !!key);

  if (!key) return res.status(200).json({ ok: true, warning: 'No Resend key — email not sent' });

  const bodyText = [
    'New Demo Request — Nova Systems',
    '',
    `Name: ${name}`,
    `Business: ${business}`,
    `Industry: ${industry}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Monthly Revenue: ${revenue || 'Not provided'}`,
    `Biggest Challenge: ${challenge}`,
    `Best Time: ${time}`,
    '',
    'Message:',
    message || '(none)',
    '',
    `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
  ].join('\n');

  try {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: ['Isaac_0427@icloud.com'],
        subject: `Demo Request: ${name} — ${business}`,
        text: bodyText,
        reply_to: email,
      }),
    });

    if (email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Demo request received — Nova Systems',
          text: `Hi ${name},\n\nYour demo request has been received. Isaac will reach out within 24 hours to confirm your strategy call.\n\n${bodyText}\n\n— Nova Systems\nnova-systems.app`,
        }),
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[book-demo] Resend error:', err);
    res.status(500).json({ error: err.message });
  }
}
