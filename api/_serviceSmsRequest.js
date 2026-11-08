import { sanitize, sanitizeEmail } from './_sanitize.js';
import { normalizePhone } from './_wave1.js';
import { SERVICE_SMS_POLICY } from '../public/sms-program/policy.js';

export function validateServiceRequest(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid request.' };
  if (body.website_url_confirm) return { error: 'We could not verify this request. Please try again.' };
  const age = now - Number(body.rendered_at);
  if (!Number.isFinite(age) || age < 2000 || age > 86400000) return { error: 'Please wait a moment and try again, or reload this page if it has been open for a day.' };
  if (typeof body.submission_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submission_id)) return { error: 'Reload this page before sending your request.' };
  const name = sanitize(body.name, 100);
  const business = sanitize(body.business_name, 200);
  const email = sanitizeEmail(body.email);
  const phoneInput = sanitize(body.phone, 40);
  const phone = normalizePhone(phoneInput);
  const granted = body.service_sms_consent === true;
  if (!name || !business || !email) return { error: 'Enter your name, business name and a valid email address.' };
  if (phoneInput && !phone) return { error: 'Enter a valid phone number, including its country code, or leave the phone field empty.' };
  if (granted && !phone) return { error: 'Enter a phone number to request service texts, or leave the service-text box unchecked.' };
  if (granted && body.service_sms_consent_version !== SERVICE_SMS_POLICY.version) return { error: 'Reload this page to review the current service-text disclosure.' };
  return { data: {
    request_id: body.submission_id.toLowerCase(), name, business_name: business, email,
    phone_e164: phone || null, message: sanitize(body.message, 2000),
    service_sms_consent: granted, disclosure_version: SERVICE_SMS_POLICY.version,
  } };
}

// Only stores the request and its exact service-only permission. No email,
// Twilio, model, calendar, payment or job-dispatch function is called here.
export async function handleServiceSmsRequest(req, res) {
  const validated = validateServiceRequest(req.body);
  if (validated.error) return res.status(422).json({ ok: false, error: validated.error });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ ok: false, error: 'Online requests are unavailable. Email isaac@nova-systems.app for help.' });
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/record_nova_service_request`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_request: validated.data }),
    });
    if (!response.ok) throw new Error('Request storage failed');
    const result = await response.json();
    if (result?.ok !== true || result.reference !== validated.data.request_id) throw new Error('Unexpected storage result');
    return res.status(200).json({
      ok: true, reference: result.reference, duplicate: result.duplicate === true,
      ...(result.duplicate ? {} : { service_sms_consent: result.service_sms_consent === true }),
      marketing_consent: false,
    });
  } catch {
    console.error('[service-request] Request could not be stored.');
    return res.status(502).json({ ok: false, error: 'Your request could not be confirmed. Please try again or email isaac@nova-systems.app.' });
  }
}
