import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';
import { twilioRequest } from './_twilio.js';

// Phase 1 vertical slice (2026-09-20, Nova Systems Master Build Prompt Section 4.4/20): the
// /welcome short lead form previously cross-posted to https://nova-wave-one.vercel.app — a
// different Vercel project, on the domain (.agency) that's actively being decommissioned. This
// endpoint replaces that with a real local write into this repo's own `leads` table, following
// the same validate -> save -> notify -> confirm pattern already established in
// api/business-intake.js (rate limit, sanitize, Supabase insert, non-fatal Twilio/Resend
// notifications). "A green toast without a persisted record is failure" — this makes the
// persisted record real and local instead of dependent on a domain being retired.

const CONTACT_METHODS = ['email', 'phone', 'sms'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const b = req.body || {};

  // Honeypot — bots that autofill every input get silently accepted-but-discarded, matching the
  // frontend's own honeypot handling (Welcome.jsx treats a filled honeypot as a normal success).
  const honeypot = sanitize(b.company_website_confirm, 200);
  if (honeypot) {
    return res.status(200).json({ ok: true, reference_number: `NV-${Date.now().toString(36).toUpperCase()}` });
  }

  const first_name = sanitize(b.first_name, 100);
  const last_name = sanitize(b.last_name, 100);
  const email = sanitizeEmail(b.business_email || b.email);
  const phone = sanitizePhone(b.phone);
  const preferred_contact = CONTACT_METHODS.includes(b.preferred_contact) ? b.preferred_contact : 'email';
  const business_name = sanitize(b.business_name || b.company, 200);
  const website = sanitize(b.website, 300);
  const industry = sanitize(b.industry, 100);
  const help_topics = Array.isArray(b.help_topics) ? b.help_topics.slice(0, 20).map((t) => sanitize(t, 60)) : [];
  const main_challenge = sanitize(b.main_challenge || b.biggest_problem, 2000);
  const primary_goal = sanitize(b.primary_goal || b.goal, 2000);
  const consent = b.consent === true;
  const marketing_consent = b.marketing_consent === true;

  if (!first_name || !last_name || !email || !phone || !business_name) {
    return res.status(400).json({ error: 'Name, email, phone, and business name are required.' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'You must agree to be contacted to continue.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[welcome] Supabase not configured — submission was not saved anywhere');
    return res.status(500).json({ error: 'We could not save your request right now. Please email hello@nova-systems.app directly so nothing is lost.' });
  }

  // Best-effort org lookup — never let this block real lead capture. If it fails for any reason
  // (migration not applied yet, transient error), the insert below still proceeds without
  // organization_id rather than losing the lead; RLS will simply treat that row as unscoped until
  // backfilled, same as every pre-Stage-5 row already was.
  let organizationId = null;
  try {
    const orgRes = await fetch(`${SUPABASE_URL}/rest/v1/organizations?kind=eq.nova_internal&select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (orgRes.ok) {
      const rows = await orgRes.json();
      organizationId = rows[0]?.id || null;
    }
  } catch (err) {
    console.error('[welcome] Organization lookup error (non-fatal):', err.message);
  }

  let referenceNumber = '';
  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: `${first_name} ${last_name}`.trim(),
        email, phone, company: business_name, website, industry,
        challenge: main_challenge, goal: primary_goal,
        service_needed: help_topics.join(', ') || null,
        agreed_to_terms: consent,
        email_consent: marketing_consent,
        sms_consent: preferred_contact === 'sms',
        call_consent: preferred_contact === 'phone',
        ...(organizationId ? { organization_id: organizationId } : {}),
      }),
    });
    if (!insertRes.ok) {
      console.error('[welcome] Supabase save error:', insertRes.status, await insertRes.text());
      return res.status(502).json({ error: 'We could not save your request right now. Please email hello@nova-systems.app directly so nothing is lost.' });
    }
    const rows = await insertRes.json();
    const leadId = rows[0]?.id;
    referenceNumber = leadId ? `NV-${leadId.slice(0, 8).toUpperCase()}` : `NV-${Date.now().toString(36).toUpperCase()}`;
  } catch (err) {
    console.error('[welcome] Supabase error:', err.message);
    return res.status(502).json({ error: 'We could not save your request right now. Please email hello@nova-systems.app directly so nothing is lost.' });
  }

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilioRequest(TWILIO_SID, TWILIO_TOKEN, 'POST', 'Messages.json', {
        To: process.env.ISAAC_ALERT_PHONE || '+12037060504',
        From: TWILIO_FROM,
        Body: `New Nova request: ${first_name} ${last_name} from ${business_name}. ${main_challenge ? 'Wants help with: ' + main_challenge.slice(0, 100) : ''} Check dashboard.`,
      });
    } catch (err) {
      console.error('[welcome] Twilio error (non-fatal):', err.message);
    }
  }

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
          subject: 'We got your request.',
          text: [
            `Hi ${first_name},`,
            '',
            'Your Nova request has been received. We will review your business information and follow up with next steps — including a detailed intake if we move forward with a diagnostic.',
            '',
            `Reference: ${referenceNumber}`,
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[welcome] Confirmation email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, reference_number: referenceNumber });
}
