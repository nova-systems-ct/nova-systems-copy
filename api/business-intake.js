import { resendBase } from './_email.js';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';
import { twilioRequest } from './_twilio.js';
import crypto from 'node:crypto';
import { requireStaff } from './_auth.js';

// /intake — the 20-step Nova Business Intelligence Assessment — two actions:
//   submit       POST (?action=submit)      saves the full assessment, links back to the
//                                            originating /welcome lead, alerts Isaac via SMS,
//                                            emails the client a PDF summary, and schedules a
//                                            24-hour-later follow-up email via Resend's scheduled_at.
//   upload-token POST (?action=upload-token) issues a short-lived, signed, submission-scoped token
//   upload-file  POST (?action=upload-file)  stores ONE document under that token's private prefix
//                                            (type checked from the file bytes, size-capped, no
//                                            overwrite) and returns its storage path — never a URL
//   file-url     GET  (?action=file-url&path) [intelligence.view, Nova org] 5-minute signed link
// Security repair 2026-09-30 (audit F-16): uploads used to be anonymous, public, overwritable, with a
// caller-chosen content type at a guessable email-based path. The bucket must be PRIVATE.

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
  const uploadGrant = verifyUploadToken(b.upload_token);
  const document_urls = ownDocumentPaths(b.document_urls, uploadGrant);
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

  // The intake_submissions write is the one step that determines whether this assessment exists
  // anywhere — a visitor just spent ~30 minutes on this form. The leads PATCH and nova_ai_audits
  // upsert below are best-effort cross-references and stay non-fatal, but this write failing (or
  // Supabase not being configured) must surface as a real error, not the { ok: true } this used
  // to return unconditionally regardless of what actually got saved.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[business-intake:submit] Supabase not configured — submission was not saved anywhere');
    return res.status(500).json({ error: 'We could not save your assessment right now. Please email hello@nova-systems.app directly so nothing is lost.' });
  }
  {
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
        return res.status(502).json({ error: 'We could not save your assessment right now. Please email hello@nova-systems.app directly so nothing is lost.' });
      }
    } catch (err) {
      console.error('[business-intake:submit] Supabase error:', err.message);
      return res.status(502).json({ error: 'We could not save your assessment right now. Please email hello@nova-systems.app directly so nothing is lost.' });
    }

    if (lead_id) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(lead_id)}&email=eq.${encodeURIComponent(email)}`, {
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
    const attachments = undefined; // client-supplied PDFs are no longer relayed (F-04/F-16 repair)

    try {
      await fetch(`${resendBase()}/emails`, {
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
      await fetch(`${resendBase()}/emails`, {
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

// ---------------------------------------------------------------- private, token-scoped uploads
const BUCKET = 'nova-intake-files';
const MAX_FILES_PER_TOKEN = 20;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
// Signing key derived from the server-only service-role key (never sent to a browser), so no extra
// secret has to be provisioned; rotating the service key simply invalidates outstanding tokens.
const tokenKey = () => crypto.createHash('sha256').update(`nova-intake-upload-v1:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`).digest();
const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signUploadToken(now = Date.now()) {
  const payload = b64u(JSON.stringify({ sid: crypto.randomBytes(16).toString('hex'), exp: now + TOKEN_TTL_MS }));
  return `${payload}.${b64u(crypto.createHmac('sha256', tokenKey()).update(payload).digest())}`;
}
export function verifyUploadToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(b64u(crypto.createHmac('sha256', tokenKey()).update(payload).digest()));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^[0-9a-f]{32}$/.test(p.sid) || !Number.isFinite(p.exp) || now > p.exp) return null;
    return { sid: p.sid, prefix: `intake/${p.sid}/` };
  } catch { return null; }
}
function ownDocumentPaths(docs, grant) {
  const out = {};
  if (!grant || !docs || typeof docs !== 'object') return out;
  for (const [cat, list] of Object.entries(docs).slice(0, 20)) {
    if (!Array.isArray(list)) continue;
    const keep = list.slice(0, MAX_FILES_PER_TOKEN)
      .filter((f) => f && typeof f.path === 'string' && f.path.startsWith(grant.prefix) && !f.path.includes('..'))
      .map((f) => ({ path: f.path.slice(0, 300), filename: sanitize(f.filename, 200), content_type: sanitize(f.content_type, 100) }));
    if (keep.length) out[sanitize(cat, 40).replace(/[^a-z0-9_]/gi, '') || 'other'] = keep;
  }
  return out;
}

// File type decided by the bytes, never by the name or the browser-declared type.
export function sniffType(buf) {
  const head = buf.subarray(0, 12);
  const hex = head.toString('hex');
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (hex.startsWith('89504e470d0a1a0a')) return { mime: 'image/png', ext: 'png' };
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (head.toString('latin1', 0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (hex.startsWith('504b0304')) {
    const scan = buf.toString('latin1', 0, Math.min(buf.length, 6000));
    if (/word\//.test(scan)) return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
    if (/xl\//.test(scan)) return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  return null;
}

async function handleUploadToken(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'File storage is not configured yet' });
  return res.status(200).json({ ok: true, upload_token: signUploadToken(), expires_in: TOKEN_TTL_MS / 1000 });
}

async function handleUploadFile(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'File storage is not configured yet' });

  const b = req.body || {};
  const grant = verifyUploadToken(b.upload_token);
  if (!grant) return res.status(401).json({ error: 'Your upload session expired. Reload the page and try again.' });
  const file_base64 = typeof b.file_base64 === 'string' ? b.file_base64 : '';
  if (!file_base64) return res.status(400).json({ error: 'file_base64 is required' });
  let buffer;
  try { buffer = Buffer.from(file_base64.replace(/^data:[^;]+;base64,/, ''), 'base64'); } catch { return res.status(400).json({ error: 'Invalid file data' }); }
  if (!buffer.length) return res.status(400).json({ error: 'The file is empty.' });
  if (buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'File is too large. Please keep files under 4MB.' });
  const type = sniffType(buffer);
  if (!type) return res.status(415).json({ error: 'Upload a PDF, PNG, JPG, WebP, GIF, Word (.docx) or Excel (.xlsx) file.' });

  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  try {
    const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: grant.prefix, limit: MAX_FILES_PER_TOKEN + 1 }) });
    if (list.ok && (await list.json()).length >= MAX_FILES_PER_TOKEN) return res.status(429).json({ error: `At most ${MAX_FILES_PER_TOKEN} files per submission.` });
  } catch { /* count is best-effort */ }

  const safe = (sanitize(b.filename, 120).replace(/\.[^.]*$/, '').replace(/[^a-z0-9_-]/gi, '_') || 'file').slice(0, 60);
  const path = `${grant.prefix}${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safe}.${type.ext}`;
  try {
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...H, 'Content-Type': type.mime, 'x-upsert': 'false' }, body: buffer });
    if (!up.ok) { console.error('[business-intake:upload-file] storage error:', up.status, await up.text()); return res.status(502).json({ error: 'Upload failed. Please try again.' }); }
    return res.status(200).json({ ok: true, path, content_type: type.mime });
  } catch (err) {
    console.error('[business-intake:upload-file] Error:', err.message);
    return res.status(502).json({ error: 'Upload failed. Please try again.' });
  }
}

async function handleFileUrl(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const path = typeof req.query?.path === 'string' ? req.query.path : '';
  if (!/^intake\/[0-9a-f]{32}\/[A-Za-z0-9._-]+$/.test(path)) return res.status(400).json({ error: 'Invalid path' });
  const SUPABASE_URL = process.env.SUPABASE_URL; const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
  if (!r.ok) return res.status(404).json({ error: 'File not found' });
  const { signedURL } = await r.json();
  return res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1${signedURL}`, expires_in: 300 });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : 'submit';

  switch (action) {
    case 'submit': return handleSubmit(req, res);
    case 'upload-token': return handleUploadToken(req, res);
    case 'upload-file': return handleUploadFile(req, res);
    case 'file-url':
      if (!(await requireStaff(req, res, 'intelligence.view'))) return;
      return handleFileUrl(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
