import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';
import { twilioRequest } from './nova-ai/_twilio.js';

// Combined email / notification endpoint — dispatch via ?action=
//   contact          POST  general contact-form email (+ confirmation)
//   book-demo        POST  demo request email
//   client-message   POST  message to a client (saved + emailed)
//   send-invoice     POST  invoice email to a client
//   welcome-lead     POST  /welcome quick-contact form (save + SMS alert + confirmation + 2hr email follow-up)
//   list             GET   admin notifications feed

async function handleContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const API_KEY = process.env.RESEND_API_KEY;
  console.log('[notify:contact] API_KEY present:', !!API_KEY);

  if (!API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

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
    console.log('[notify:contact] Resend response:', r1.status, r1Body);
    if (!r1.ok) return res.status(500).json({ error: 'Failed to send email', details: r1Body });
  } catch (err) {
    console.error('[notify:contact] Fetch error:', err.message);
    return res.status(500).json({ error: 'Network error contacting Resend' });
  }

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
      console.warn('[notify:contact] Confirmation email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true });
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
    if (!r.ok) { console.error('[notify:send-invoice] Resend error:', await r.text()); return res.status(500).json({ error: 'Failed to send invoice email' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[notify:send-invoice] Error:', err.message);
    return res.status(500).json({ error: 'Failed to send invoice email' });
  }
}

async function handleWelcomeLead(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const b = req.body || {};
  const name = sanitize(b.name, 150);
  const email = sanitizeEmail(b.email);
  const phone = sanitizePhone(b.phone);
  const company = sanitize(b.company, 200);
  const website = b.website ? (sanitizeUrl(b.website) || sanitize(b.website, 300)) : '';
  const industry = sanitize(b.industry, 100);
  const challenge = sanitize(b.challenge, 1000);
  const goal = sanitize(b.goal, 1000);
  const agreed_to_terms = b.agreed_to_terms === true || b.agreed_to_terms === 'true';
  const sms_consent = b.sms_consent === true || b.sms_consent === 'true';
  const email_consent = b.email_consent === true || b.email_consent === 'true';
  const call_consent = b.call_consent === true || b.call_consent === 'true';

  if (!name || !email || !phone) return res.status(400).json({ error: 'Full name, email, and phone are required' });
  if (!agreed_to_terms) return res.status(400).json({ error: 'You must agree to the Terms of Service and Privacy Policy' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let leadId = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name, email, phone, company, website, industry, challenge, goal,
          agreed_to_terms, sms_consent, email_consent, call_consent,
        }),
      });
      if (r.ok) {
        const rows = await r.json();
        leadId = rows[0]?.id || null;
      } else {
        console.error('[notify:welcome-lead] Supabase save error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('[notify:welcome-lead] Supabase error (non-fatal):', err.message);
    }
  }

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilioRequest(TWILIO_SID, TWILIO_TOKEN, 'POST', 'Messages.json', {
        To: process.env.ISAAC_ALERT_PHONE || '+12037060504',
        From: TWILIO_FROM,
        Body: `New lead: ${name}${company ? ` from ${company}` : ''}. ${phone}. Check dashboard.`,
      });
    } catch (err) {
      console.error('[notify:welcome-lead] Twilio alert error (non-fatal):', err.message);
    }
  }

  const origin = req.headers.origin && req.headers.origin.startsWith('https://') ? req.headers.origin : 'https://nova-systems.app';
  const intakeParams = new URLSearchParams({
    name, email, phone,
    ...(company ? { company } : {}),
    ...(website ? { website } : {}),
    ...(industry ? { industry } : {}),
    ...(leadId ? { lead_id: leadId } : {}),
  }).toString();
  const intakeLink = `${origin}/intake?${intakeParams}`;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'We got your info — here is what happens next.',
          text: [
            `Hi ${name},`,
            '',
            'Thank you for reaching out to Nova Systems. We are reviewing your information and will be in touch within 24 hours.',
            '',
            'In the meantime please complete your full Business Intelligence Assessment so we can prepare your custom audit and proposal before we meet:',
            intakeLink,
            '',
            'This takes about 30 minutes and gives us everything we need to hit the ground running.',
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[notify:welcome-lead] Confirmation email error (non-fatal):', err.message);
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'One more step — complete your Business Intelligence Assessment.',
          scheduled_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
          text: [
            `Hi ${name},`,
            '',
            'thank you again for reaching out to Nova Systems. To prepare your custom audit and proposal we need a little more information.',
            '',
            `Please take 30 minutes to complete your full Business Intelligence Assessment here: ${intakeLink}`,
            '',
            'This gives us everything we need to build your complete growth plan before we ever meet.',
            '',
            'Questions? Reply to this email or visit nova-systems.app.',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[notify:welcome-lead] Scheduled follow-up email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, lead_id: leadId });
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
    case 'client-message':   return handleClientMessage(req, res);
    case 'send-invoice':      return handleSendInvoice(req, res);
    case 'welcome-lead':       return handleWelcomeLead(req, res);
    case 'list':                return handleList(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
