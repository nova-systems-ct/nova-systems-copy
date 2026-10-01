import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';
import { requireStaff } from './_auth.js';
import { requireOrgAccess } from './_orgAccess.js';
import { sendEmail, resendBase } from './_email.js';
import { loadInvoice, loadInvoiceClient, createInvoiceCheckout } from './_legacyPayments.js';
import { textPdf } from './_sales/pdf.js';

// Combined email / notification endpoint — dispatch via ?action=
//   contact          POST  public — general contact-form email (+ confirmation)
//   book-demo        POST  public — demo request email
//   client-message   POST  [admin.view] message to a client (saved + emailed) — the client_email
//                            to send to is caller-supplied, so this must never be reachable
//                            unauthenticated (an open relay for arbitrary outbound email otherwise)
//   send-invoice     POST  [admin.view on the invoice's organization] emails a STORED invoice to
//                            its stored client. Recipient, amount, pay link and PDF are all derived
//                            on the server (security repair 2026-09-30, audit F-04); the body only
//                            names {organization_id, invoice_id}.
//   list             GET   [admin.view] admin notifications feed
//
// 2026-09-20 correction: the comment previously here said /welcome posts to nova-wave-one's
// api/nova-audit — that cross-origin hand-off was replaced with a real local api/welcome.js
// earlier this same build; this file was never part of that path in the current codebase.

const CONTACT_CATEGORIES = ['general', 'sales', 'support', 'careers', 'press', 'other'];

// 2026-09-20 rewrite: this used to be a pure email relay with no database persistence at all —
// correct only as long as Resend stays configured. With it currently disconnected as part of the
// credential reset, a submission that only sends an email loses the message entirely. The
// database write is now the real, required action (same pattern as /welcome and /waves/form);
// email is best-effort on top of it, and the response honestly reflects which parts actually
// happened rather than a single ok:true covering both.
async function handleContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const name        = sanitize(req.body?.name, 100);
  const email       = sanitizeEmail(req.body?.email);
  const phone       = sanitize(req.body?.phone, 50);
  const company     = sanitize(req.body?.company, 200);
  const category    = CONTACT_CATEGORIES.includes(req.body?.category) ? req.body.category : 'general';
  const message     = sanitize(req.body?.message || req.body?.body, 5000);
  // Legacy callers (ChatBot) pass replyTo/confirmTo/confirmName/subject instead of the Contact
  // page's own field names — kept working rather than forcing every caller to migrate at once.
  // Repair 2026-09-30 (F-04): the confirmation goes ONLY to the address the visitor entered as their
  // own, and legacy replyTo/confirmTo overrides are ignored — otherwise this public form was a relay
  // that could send Nova-branded mail to any address. Link-like text is stripped from the greeting.
  const replyTo     = email;
  const confirmTo   = email;
  const confirmName = (sanitize(req.body?.confirmName, 60) || name || 'there').replace(/(https?:\/\/|www\.)\S*/gi, '').replace(/[<>]/g, '').trim() || 'there';
  const subject     = sanitize(req.body?.subject, 200);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'We could not save your message right now. Please email hello@nova-systems.app directly so nothing is lost.' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contact_submissions`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: phone || null, company: company || null, category, message }),
    });
    if (!r.ok) {
      console.error('[notify:contact] Supabase save error:', r.status, await r.text());
      return res.status(502).json({ error: 'We could not save your message right now. Please email hello@nova-systems.app directly so nothing is lost.' });
    }
  } catch (err) {
    console.error('[notify:contact] Supabase error:', err.message);
    return res.status(502).json({ error: 'We could not save your message right now. Please email hello@nova-systems.app directly so nothing is lost.' });
  }

  // Everything below is best-effort notification on top of the now-persisted message — a failure
  // here no longer means the submission itself was lost.
  const API_KEY = process.env.RESEND_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({ ok: true, warning: 'Saved — email notification skipped (Resend not configured)' });
  }

  const FROM = 'Nova Systems <noreply@nova-systems.app>';
  const DEST = 'Isaac_0427@icloud.com';
  const emailBody = [
    `Category: ${category}`,
    `Name: ${name}`,
    `Email: ${email}`,
    company && `Company: ${company}`,
    phone   && `Phone: ${phone}`,
    `\nMessage:\n${message}`,
  ].filter(Boolean).join('\n');

  let alertSent = false;
  try {
    const r1 = await fetch(`${resendBase()}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [DEST], subject: subject || `New Contact — ${name}`, text: emailBody,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    alertSent = r1.ok;
    if (!r1.ok) console.error('[notify:contact] Resend alert error:', r1.status, await r1.text());
  } catch (err) {
    console.error('[notify:contact] Resend alert fetch error:', err.message);
  }

  if (confirmTo) {
    try {
      await fetch(`${resendBase()}/emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [confirmTo],
          subject: 'We received your request — Nova Systems',
          text: [
            `Hi ${confirmName},`,
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
      console.warn('[notify:contact] Confirmation email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, ...(alertSent ? {} : { warning: 'Saved — email alert could not be sent' }) });
}

async function handleBookDemo(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const b = req.body || {};
  const name      = sanitize(b.name, 100);
  const business  = sanitize(b.business, 200);
  const industry  = sanitize(b.industry, 100);
  const phone     = sanitizePhone(b.phone);
  const email     = sanitizeEmail(b.email);
  const revenue   = sanitize(b.revenue, 100);
  const challenge = sanitize(b.challenge, 200);
  const time      = sanitize(b.time, 100);
  const message   = sanitize(b.message, 2000);

  if (!name || !business || !email || !phone) {
    return res.status(400).json({ error: 'Name, business, email, and phone are required' });
  }

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
      console.error('[notify:book-demo] Supabase save failed:', err.message);
    }
  }

  const key = process.env.RESEND_API_KEY;
  console.log('[notify:book-demo] RESEND_API_KEY present:', !!key);

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

    await fetch(`${resendBase()}/emails`, {
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
      await fetch(`${resendBase()}/emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Demo request received — Nova Systems',
          text: `Hi there,\n\nYour demo request has been received. Nova will reply to this address.\n\n— Nova Systems\nnova-systems.app`,
        }),
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[notify:book-demo] Resend error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function handleClientMessage(req, res) {
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
        console.error('[notify:client-message] Supabase save error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('[notify:client-message] Supabase error (non-fatal):', err.message);
    }
  }

  if (!RESEND_KEY) {
    return res.status(200).json({
      ok: true,
      warning: 'Email skipped — Resend not configured',
      message: savedMessage,
    });
  }

  try {
    const emailRes = await fetch(`${resendBase()}/emails`, {
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
      console.error('[notify:client-message] Email error:', emailRes.status, emailBody);
      return res.status(200).json({ ok: true, warning: 'Saved but email failed', message: savedMessage });
    }

    return res.status(200).json({ ok: true, message: savedMessage });
  } catch (err) {
    console.error('[notify:client-message] Email error:', err.message);
    return res.status(200).json({ ok: true, warning: 'Saved but email failed', message: savedMessage });
  }
}

async function handleSendInvoice(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 15, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'admin.view'))) return;
  const inv = await loadInvoice(sanitize(b.invoice_id, 100), orgId);
  if (!inv) return res.status(404).json({ error: 'Invoice not found in this organization' });
  const client = await loadInvoiceClient(inv);
  const to = sanitizeEmail(client?.email || '');
  if (!to) return res.status(422).json({ error: 'The invoice\'s client has no email address on file.' });

  const warnings = [];
  let payLink = '';
  try {
    const out = await createInvoiceCheckout(inv, client);
    if (out.error) warnings.push(`No online payment link: ${out.error}`); else payLink = out.url;
  } catch (err) {
    console.error('[notify:send-invoice] checkout error:', err.message);
    warnings.push('No online payment link: the payment provider did not respond.');
  }

  const total = Number(inv.total) || 0;
  const lines = Array.isArray(inv.line_items) ? inv.line_items : [];
  const clientName = client?.business_name || client?.full_name || 'there';
  const pdf = textPdf({ title: `Invoice ${inv.invoice_number || inv.id}`, blocks: [
    { style: 'h1', text: 'NOVA SYSTEMS' }, { style: 'h2', text: `Invoice ${inv.invoice_number || ''}` },
    { style: 'p', text: `Billed to: ${clientName}` }, ...(inv.due_date ? [{ style: 'p', text: `Due: ${inv.due_date}` }] : []), { style: 'gap' },
    ...lines.slice(0, 50).map((l) => ({ style: 'mono', text: `${String(l?.description || l?.name || 'Item').slice(0, 60)}  ${l?.quantity ?? ''}  ${l?.amount ?? l?.price ?? ''}` })),
    { style: 'gap' }, { style: 'h2', text: `Total due: $${total.toFixed(2)}` },
    ...(payLink ? [{ style: 'p', text: 'Pay online using the link in the email.' }] : [{ style: 'p', text: 'Payment instructions will be sent separately.' }]),
  ] });
  const text = [
    `Hi ${clientName},`, '', `Your invoice ${inv.invoice_number || ''} from Nova Systems is ready.`, '',
    `Total Due: $${total.toFixed(2)}`, inv.due_date ? `Due Date: ${inv.due_date}` : '', '',
    payLink ? `Pay now: ${payLink}` : 'Payment instructions will be sent separately.', '',
    'Thank you for working with Nova Systems.',
  ].filter((l) => l !== null).join('\n');

  const sent = await sendEmail({ to, subject: `Invoice ${inv.invoice_number || ''} — Nova Systems`, text, attachments: [{ filename: `${(inv.invoice_number || 'invoice').replace(/[^a-z0-9._-]/gi, '_')}.pdf`, content: pdf.toString('base64') }], idempotencyKey: `invoice-email:${inv.id}:${new Date().toISOString().slice(0, 16)}` });
  if (sent.skipped) return res.status(200).json({ ok: false, warning: 'Email not sent — Resend is not configured', warnings });
  if (!sent.ok) return res.status(502).json({ error: 'The email provider did not accept the invoice email', warnings });
  return res.status(200).json({ ok: true, provider_accepted: true, pay_link_created: !!payLink, warnings });
}

async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/notifications?order=created_at.desc&limit=20`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[notify:list] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[notify:list] Error:', err.message);
    return res.status(200).json([]);
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  switch (action) {
    case 'contact':        return handleContact(req, res);
    case 'book-demo':       return handleBookDemo(req, res);
    case 'client-message':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleClientMessage(req, res);
    case 'send-invoice':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleSendInvoice(req, res);
    case 'list':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleList(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
