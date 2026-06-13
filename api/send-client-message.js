import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const b = req.body || {};
  const client_id   = sanitize(b.client_id, 100);
  const client_name = sanitize(b.client_name, 200);
  const client_email = sanitizeEmail(b.client_email);
  const message     = sanitize(b.message, 5000);

  if (!client_id)    return res.status(400).json({ error: 'client_id is required' });
  if (!client_email) return res.status(400).json({ error: 'Client email is required' });
  if (!message)      return res.status(400).json({ error: 'Message is required' });

  // 1. Save to Supabase client_messages table
  let savedMessage = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/client_messages`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          client_id,
          message,
          sent_at: new Date().toISOString(),
        }),
      });
      if (r.ok) {
        const rows = await r.json();
        savedMessage = rows[0];
      } else {
        console.error('[send-client-message] Supabase save error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('[send-client-message] Supabase error (non-fatal):', err.message);
    }
  }

  // 2. Send email via Resend
  if (!RESEND_KEY) {
    return res.status(200).json({
      ok: true,
      warning: 'Email skipped — Resend not configured',
      message: savedMessage,
    });
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nova Systems <noreply@nova-systems.app>',
        to: [client_email],
        reply_to: 'Isaac_0427@icloud.com',
        subject: `Update from Nova Systems${client_name ? ` — ${client_name}` : ''}`,
        text: `${message}\n\n---\nIsaac Nova\nNova Systems\nnova-systems.app`,
      }),
    });

    const emailBody = await emailRes.text();
    if (!emailRes.ok) {
      console.error('[send-client-message] Email error:', emailRes.status, emailBody);
      return res.status(200).json({ ok: true, warning: 'Saved but email failed', message: savedMessage });
    }

    return res.status(200).json({ ok: true, message: savedMessage });
  } catch (err) {
    console.error('[send-client-message] Email error:', err.message);
    return res.status(200).json({ ok: true, warning: 'Saved but email failed', message: savedMessage });
  }
}
