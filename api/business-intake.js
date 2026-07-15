import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';
import { twilioRequest } from './nova-ai/_twilio.js';

// /intake — the 20-step Nova Business Intelligence Assessment — two actions:
//   submit       POST (?action=submit)      saves the full assessment, links back to the
//                                            originating /welcome lead, alerts Isaac via SMS,
//                                            emails the client a PDF summary, and schedules a
//                                            24-hour-later follow-up email via Resend's scheduled_at.
//   upload-file  POST (?action=upload-file)  stores a single base64-encoded document upload
//                                            (section 16) in the nova-intake-files bucket.

const CONTACT_METHODS = ['Call', 'Text', 'WhatsApp', 'Email'];
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Recursively cleans every string leaf in an object/array (HTML tags, control
// chars, length caps) while leaving booleans/numbers untouched — the intake
// payload is deeply nested (businesses[], services[], marketing{}, ...) and
// hand-listing every field here would be unmaintainable.
function deepSanitize(value, maxLen = 4000, depth = 0) {
  if (depth > 6) return null;
  if (typeof value === 'string') return sanitize(value, maxLen);
  if (typeof value === 'boolean' || typeof value === 'number' || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => deepSanitize(v, maxLen, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 100)) {
      out[sanitize(k, 100)] = deepSanitize(v, maxLen, depth + 1);
    }
    return out;
  }
  return null;
}

async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const b = req.body || {};
  const name = sanitize(b.name, 150);
  const email = sanitizeEmail(b.email);
  const phone = sanitizePhone(b.phone);
  const preferred_contact = CONTACT_METHODS.includes(b.preferred_contact) ? b.preferred_contact : '';
  const best_time = sanitize(b.best_time, 50);
  const lead_id = sanitize(b.lead_id, 100);

  const businesses = deepSanitize(
    Array.isArray(b.businesses) ? b.businesses.filter((biz) => biz && sanitize(biz.business_name, 200)) : [],
    2000,
  );
  const story = deepSanitize(b.story || {}, 5000);
  const goals = deepSanitize(b.goals || {}, 5000);
  const customers = deepSanitize(b.customers || {}, 5000);
  const services = deepSanitize(Array.isArray(b.services) ? b.services : [], 2000);
  const sales_process = deepSanitize(b.sales_process || {}, 5000);
  const marketing = deepSanitize(b.marketing || {}, 3000);
  const technology = deepSanitize(b.technology || {}, 3000);
  const communication = deepSanitize(b.communication || {}, 3000);
  const team = deepSanitize(b.team || {}, 3000);
  const reputation = deepSanitize(b.reputation || {}, 3000);
  const financials = deepSanitize(b.financials || {}, 3000);
  const competitors = deepSanitize(b.competitors || {}, 5000);
  const ai_knowledge = deepSanitize(b.ai_knowledge || {}, 5000);
  const document_urls = deepSanitize(b.document_urls || {}, 2000);
  const final_questions = deepSanitize(b.final_questions || {}, 5000);

  const stripe_customer_id = sanitize(b.stripe_customer_id, 100);
  const stripe_payment_method_id = sanitize(b.stripe_payment_method_id, 100);
  const no_card_on_file = b.no_card_on_file === true || b.no_card_on_file === 'true';

  const agree_terms = b.agree_terms === true;
  const agree_privacy = b.agree_privacy === true;
  const agree_audit_authorization = b.agree_audit_authorization === true;
  const agree_no_services_until_signed = b.agree_no_services_until_signed === true;
  const agree_no_charge_today = b.agree_no_charge_today === true;
  const agree_cancellation_policy = b.agree_cancellation_policy === true;
  const ai_authorization = b.ai_authorization === true;
  const sms_consent = b.sms_consent === true;
  const email_consent = b.email_consent === true;
  const call_consent = b.call_consent === true;
  const digital_signature = sanitize(b.digital_signature, 200);
  const signature_date = sanitize(b.signature_date, 20);
  const pdf_base64 = typeof b.pdf_base64 === 'string' ? b.pdf_base64 : '';

  if (!name || !email || !phone) return res.status(400).json({ error: 'Name, email, and phone are required' });
  if (!businesses.length) return res.status(400).json({ error: 'At least one business name is required' });

  const agreed_to_terms = agree_terms && agree_privacy && agree_audit_authorization
    && agree_no_services_until_signed && agree_no_charge_today && agree_cancellation_policy;
  if (!agreed_to_terms) return res.status(400).json({ error: 'You must agree to all required items before submitting' });
  if (!ai_authorization) return res.status(400).json({ error: 'AI authorization is required before submitting' });
  if (!digital_signature) return res.status(400).json({ error: 'A digital signature is required before submitting' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let submissionId = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/intake_submissions`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify({
          lead_id: lead_id || null,
          name, email, phone, preferred_contact, best_time,
          businesses, story, goals, customers, services, sales_process,
          marketing, technology, communication, team, reputation, financials,
          competitors, ai_knowledge, final_questions, document_urls,
          stripe_customer_id: stripe_customer_id || null,
          stripe_payment_method_id: stripe_payment_method_id || null,
          no_card_on_file,
          agreed_to_terms, ai_authorization,
          digital_signature, signature_date: signature_date || null,
          sms_consent, email_consent, call_consent,
        }),
      });
      if (r.ok) {
        const rows = await r.json();
        submissionId = rows[0]?.id || null;
      } else {
        console.error('[business-intake:submit] Supabase save error:', r.status, await r.text());
      }
    } catch (err) {
      console.error('[business-intake:submit] Supabase error (non-fatal):', err.message);
    }

    if (lead_id) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(lead_id)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal',
          },
          body: JSON.stringify({ intake_completed: true, intake_submission_id: submissionId }),
        });
      } catch (err) {
        console.error('[business-intake:submit] Lead update error (non-fatal):', err.message);
      }
    }

    try {
      const primary = businesses[0] || {};
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_audits?contact_email=eq.${encodeURIComponent(email)}&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      const existingRows = existing.ok ? await existing.json() : [];
      const record = {
        contact_name: name, contact_email: email, contact_phone: phone,
        business_name: primary.business_name, industry: primary.industry,
        source: 'intake_form', intake_submission_id: submissionId,
        updated_at: new Date().toISOString(),
      };

      if (existingRows.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_audits?id=eq.${existingRows[0].id}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal',
          },
          body: JSON.stringify(record),
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_audits`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal',
          },
          body: JSON.stringify(record),
        });
      }
    } catch (err) {
      console.error('[business-intake:submit] nova_ai_audits error (non-fatal):', err.message);
    }
  }

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
  const businessName = businesses[0]?.business_name || 'their business';

  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilioRequest(TWILIO_SID, TWILIO_TOKEN, 'POST', 'Messages.json', {
        To: process.env.ISAAC_ALERT_PHONE || '+12037060504',
        From: TWILIO_FROM,
        Body: `New intake completed. ${name} from ${businessName}. Budget: ${financials.monthly_revenue_range || 'not specified'}. Goal: ${goals.revenue_goal_12mo || 'not specified'}. Card on file: ${no_card_on_file ? 'no' : 'yes'}. Check dashboard.`,
      });
    } catch (err) {
      console.error('[business-intake:submit] Twilio error (non-fatal):', err.message);
    }
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';
    const attachments = pdf_base64
      ? [{ filename: `${name.replace(/[^a-z0-9]+/gi, '-')}-assessment.pdf`, content: pdf_base64.replace(/^data:[^;]+;base64,/, '') }]
      : undefined;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Your assessment has been received.',
          text: [
            `Thank you ${name}. We have everything we need.`,
            '',
            'Our team will begin reviewing your submission immediately. You can expect to hear from us within 3 to 5 business days to schedule your strategy meeting.',
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
          ...(attachments ? { attachments } : {}),
        }),
      });
    } catch (err) {
      console.error('[business-intake:submit] Confirmation email error (non-fatal):', err.message);
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Your Nova Audit is underway.',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          text: [
            `Hi ${name}, our team has begun the analysis of ${businessName}.`,
            '',
            'We are reviewing your digital presence, identifying revenue opportunities, and preparing your custom proposal. We will reach out soon to schedule your strategy meeting.',
            '',
            'In the meantime if you have any questions reply to this email or text (203) 706-0504.',
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[business-intake:submit] Scheduled follow-up email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, id: submissionId });
}

// Stores one base64-encoded document (logo, price list, photo, etc.) from
// section 16 into the nova-intake-files storage bucket (public read — these
// are business collateral, not sensitive records) and returns its public URL.
async function handleUploadFile(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'File storage is not configured yet' });

  const b = req.body || {};
  const category = (sanitize(b.category, 50).replace(/[^a-z0-9_-]/gi, '') || 'other');
  const filename = (sanitize(b.filename, 200).replace(/[^a-z0-9._-]/gi, '_') || `file-${Date.now()}`);
  const content_type = sanitize(b.content_type, 100) || 'application/octet-stream';
  const email = sanitizeEmail(b.email) || 'anonymous';
  const file_base64 = typeof b.file_base64 === 'string' ? b.file_base64 : '';

  if (!file_base64) return res.status(400).json({ error: 'file_base64 is required' });

  const buffer = Buffer.from(file_base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length > MAX_UPLOAD_BYTES) return res.status(400).json({ error: 'File is too large. Please keep files under 4MB.' });

  const emailSlug = email.replace(/[^a-z0-9]/gi, '_');
  const path = `${emailSlug}/${category}/${Date.now()}-${filename}`;

  try {
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/nova-intake-files/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': content_type, 'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!uploadRes.ok) {
      console.error('[business-intake:upload-file] Supabase storage error:', uploadRes.status, await uploadRes.text());
      return res.status(500).json({ error: 'Upload failed. Please try again.' });
    }
    return res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/nova-intake-files/${path}` });
  } catch (err) {
    console.error('[business-intake:upload-file] Error:', err.message);
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : 'submit';

  switch (action) {
    case 'submit': return handleSubmit(req, res);
    case 'upload-file': return handleUploadFile(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
