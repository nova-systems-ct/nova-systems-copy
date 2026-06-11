import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const API_KEY = process.env.RESEND_API_KEY;
  console.log('[api/contact] API_KEY present:', !!API_KEY);

  if (!API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // Sanitize all inputs
  const subject     = sanitize(req.body?.subject, 200);
  const body        = sanitize(req.body?.body, 5000);
  const replyTo     = sanitizeEmail(req.body?.replyTo || req.body?.email);
  const confirmTo   = sanitizeEmail(req.body?.confirmTo);
  const confirmName = sanitize(req.body?.confirmName || req.body?.name, 100);
  const name        = sanitize(req.body?.name, 100);
  const email       = sanitizeEmail(req.body?.email);
  const company     = sanitize(req.body?.company, 200);
  const phone       = sanitize(req.body?.phone, 50);
  const message     = sanitize(req.body?.message, 3000);

  // Require at least an email or a reply-to
  if (!email && !replyTo && !confirmTo) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const FROM  = 'Nova Systems <noreply@nova-systems.app>';
  const DEST  = 'Isaac_0427@icloud.com';

  const emailBody =
    body ||
    [
      name    && `Name: ${name}`,
      email   && `Email: ${email}`,
      company && `Company: ${company}`,
      phone   && `Phone: ${phone}`,
      message && `\nMessage:\n${message}`,
    ].filter(Boolean).join('\n') ||
    '(no details provided)';

  const emailSubject = subject || 'New Submission — Nova Systems';

  // Send to Isaac
  try {
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [DEST],
        subject: emailSubject,
        text: emailBody,
        ...(replyTo || email ? { reply_to: replyTo || email } : {}),
      }),
    });
    const r1Body = await r1.text();
    console.log('[api/contact] Resend response:', r1.status, r1Body);
    if (!r1.ok) return res.status(500).json({ error: 'Failed to send email', details: r1Body });
  } catch (err) {
    console.error('[api/contact] Fetch error:', err.message);
    return res.status(500).json({ error: 'Network error contacting Resend' });
  }

  // Confirmation to submitter
  const confirmEmail = confirmTo || email;
  const confirmNameStr = confirmName || name || 'there';

  if (confirmEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [confirmEmail],
          subject: 'We received your request — Nova Systems',
          text: [
            `Hi ${confirmNameStr},`,
            '',
            'Thanks for reaching out to Nova Systems. Isaac will personally review your request and get back to you within 24 hours.',
            '',
            'Talk soon,',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.warn('[api/contact] Confirmation email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true });
}
