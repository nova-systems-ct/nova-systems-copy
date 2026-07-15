import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from './_sanitize.js';
import { twilioRequest } from './nova-ai/_twilio.js';

// /intake full business-intake form — single action (?action=submit):
//   saves the full submission to intake_submissions, upserts a nova_ai_audits
//   contact record, alerts Isaac via SMS, emails the client a confirmation
//   (with a PDF attachment generated client-side) immediately, and schedules
//   a 24-hour-later follow-up email via Resend's scheduled_at.

const CONTACT_METHODS = ['Call', 'Text', 'WhatsApp', 'Email'];
const BEST_TIMES = ['Morning', 'Afternoon', 'Evening'];

function sanitizeBusiness(b) {
  if (!b || typeof b !== 'object') return null;
  const business_name = sanitize(b.business_name, 200);
  if (!business_name) return null;
  return {
    business_name,
    industry: sanitize(b.industry, 100),
    address: sanitize(b.address, 300),
    website: b.website ? (sanitizeUrl(b.website) || sanitize(b.website, 300)) : '',
    time_in_business: sanitize(b.time_in_business, 100),
    employee_count: sanitize(b.employee_count, 50),
    monthly_revenue: sanitize(b.monthly_revenue, 50),
    locations: sanitize(b.locations, 50),
  };
}

function sanitizeSocialMedia(s) {
  const src = s && typeof s === 'object' ? s : {};
  const platform = (p) => ({
    handle: sanitize(src[p]?.handle, 200),
    followers: sanitize(src[p]?.followers, 50),
  });
  return {
    instagram: platform('instagram'),
    facebook: platform('facebook'),
    tiktok: platform('tiktok'),
    linkedin: platform('linkedin'),
    youtube: platform('youtube'),
    twitter: platform('twitter'),
    paid_ads: {
      running: src.paid_ads?.running === true || src.paid_ads?.running === 'true',
      platforms: sanitize(src.paid_ads?.platforms, 300),
      spend: sanitize(src.paid_ads?.spend, 100),
    },
    google_business: sanitize(src.google_business, 20),
    google_rating: sanitize(src.google_rating, 20),
  };
}

function sanitizeGoals(g) {
  const src = g && typeof g === 'object' ? g : {};
  return {
    biggest_challenge: sanitize(src.biggest_challenge, 3000),
    revenue_goal_12mo: sanitize(src.revenue_goal_12mo, 500),
    dream_vision_3yr: sanitize(src.dream_vision_3yr, 3000),
    expansion_goals: sanitize(src.expansion_goals, 500),
    tried_before: sanitize(src.tried_before, 3000),
    why_now: sanitize(src.why_now, 3000),
  };
}

async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return;

  const b = req.body || {};
  const name = sanitize(b.name, 150);
  const email = sanitizeEmail(b.email);
  const phone = sanitizePhone(b.phone);
  const preferred_contact = CONTACT_METHODS.includes(b.preferred_contact) ? b.preferred_contact : '';
  const best_time = BEST_TIMES.includes(b.best_time) ? b.best_time : '';

  const businesses = Array.isArray(b.businesses) ? b.businesses.map(sanitizeBusiness).filter(Boolean) : [];
  const social_media = sanitizeSocialMedia(b.social_media);
  const goals = sanitizeGoals(b.goals);

  const budget_range = sanitize(b.budget_range, 50);
  const timeline = sanitize(b.timeline, 50);
  const referrer_name = sanitize(b.referrer_name, 200);
  let referral_source = sanitize(b.referral_source, 100);
  if (referral_source === 'Referral' && referrer_name) referral_source = `Referral (${referrer_name})`;

  const stripe_customer_id = sanitize(b.stripe_customer_id, 100);
  const stripe_payment_method_id = sanitize(b.stripe_payment_method_id, 100);
  const agreed_to_terms = b.agreed_to_terms === true || b.agreed_to_terms === 'true';
  const pdf_base64 = typeof b.pdf_base64 === 'string' ? b.pdf_base64 : '';

  if (!name || !email || !phone) return res.status(400).json({ error: 'Name, email, and phone are required' });
  if (businesses.length === 0) return res.status(400).json({ error: 'At least one business name is required' });
  if (!agreed_to_terms) return res.status(400).json({ error: 'You must agree to the Terms of Service, Privacy Policy, and Service Agreement' });

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
          name, email, phone, preferred_contact, best_time,
          businesses, social_media, goals,
          budget_range, timeline, referral_source,
          stripe_customer_id: stripe_customer_id || null,
          stripe_payment_method_id: stripe_payment_method_id || null,
          agreed_to_terms, agreement_date: new Date().toISOString(),
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

    try {
      const primary = businesses[0];
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
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilioRequest(TWILIO_SID, TWILIO_TOKEN, 'POST', 'Messages.json', {
        To: process.env.ISAAC_ALERT_PHONE || '+12037060504',
        From: TWILIO_FROM,
        Body: `New intake completed. ${name} from ${businesses[0].business_name}. Budget: ${budget_range || 'not specified'}. Goal: ${goals.revenue_goal_12mo || 'not specified'}. Check dashboard.`,
      });
    } catch (err) {
      console.error('[business-intake:submit] Twilio error (non-fatal):', err.message);
    }
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';
    const business_name = businesses[0].business_name;
    const attachments = pdf_base64
      ? [{ filename: `${name.replace(/[^a-z0-9]+/gi, '-')}-intake.pdf`, content: pdf_base64.replace(/^data:[^;]+;base64,/, '') }]
      : undefined;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'We received everything. Here is what happens next.',
          text: [
            `Thank you ${name}. We have received your complete intake for ${business_name}.`,
            '',
            'Here is what happens now. Our team and AI are reviewing your information. We will run a full business audit on ' + business_name + '. Within 24 to 48 hours we will send you your custom growth plan and reach out to schedule a meeting to review it together.',
            '',
            'In the meantime if you have any questions reply to this email or text (203) 706-0504.',
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
          subject: 'Your Nova Systems Business Analysis is Ready.',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          text: [
            `Hi ${name}, our team has completed the initial analysis of ${business_name}.`,
            '',
            'Based on your intake information we have identified several opportunities to grow your revenue and save time. We are ready to walk you through everything.',
            '',
            'Please book a time that works for you: nova-systems.app/welcome',
            '',
            'We will come prepared with your full audit results, a custom growth plan, and all the paperwork ready to sign.',
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

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : 'submit';

  switch (action) {
    case 'submit': return handleSubmit(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
