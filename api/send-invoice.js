import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizeUrl } from './_sanitize.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 15, 60_000)) return;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(200).json({ ok: true, warning: 'Email skipped — Resend not configured' });

  const b = req.body || {};
  const client_email  = sanitizeEmail(b.client_email);
  const client_name     = sanitize(b.client_name, 200);
  const invoice_number   = sanitize(b.invoice_number, 50);
  const total              = Number(b.total) || 0;
  const due_date             = sanitize(b.due_date, 20);
  const pay_link               = (() => { try { return sanitizeUrl(b.pay_link || ''); } catch { return ''; } })();
  const pdf_base64               = typeof b.pdf_base64 === 'string' ? b.pdf_base64 : '';

  if (!client_email) return res.status(400).json({ error: 'client_email is required' });

  const bodyText = [
    `Hi ${client_name || 'there'},`,
    '',
    `Your invoice ${invoice_number} from Nova Systems is ready.`,
    '',
    `Total Due: $${total.toFixed(2)}`,
    due_date ? `Due Date: ${due_date}` : '',
    '',
    pay_link ? `Pay now: ${pay_link}` : 'Payment instructions are attached to this email.',
    '',
    'Thank you for working with Nova Systems.',
    '',
    'Isaac Nova',
    'Founder, Nova Systems',
  ].filter(Boolean).join('\n');

  const attachments = pdf_base64
    ? [{ filename: `${invoice_number || 'invoice'}.pdf`, content: pdf_base64.replace(/^data:[^;]+;base64,/, '') }]
    : undefined;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Nova Systems <noreply@nova-systems.app>',
        to: [client_email],
        subject: `Invoice ${invoice_number} — Nova Systems`,
        text: bodyText,
        ...(attachments ? { attachments } : {}),
      }),
    });
    if (!r.ok) { console.error('[send-invoice] Resend error:', await r.text()); return res.status(500).json({ error: 'Failed to send invoice email' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-invoice] Error:', err.message);
    return res.status(500).json({ error: 'Failed to send invoice email' });
  }
}
