import crypto from 'crypto';

// Twilio request validation — https://www.twilio.com/docs/usage/security#validating-requests
// Signs the full webhook URL + sorted form params with the auth token (HMAC-SHA1)
// and compares to the X-Twilio-Signature header.
export function validateTwilioSignature(req, authToken, fullUrl) {
  if (!authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const key of sortedKeys) data += key + params[key];

  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function escapeXml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

// Minimal Twilio REST client using raw fetch, matching this codebase's existing
// pattern (see api/_stripe.js) rather than pulling in the Twilio SDK.
export async function twilioRequest(accountSid, authToken, method, path, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const opts = {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body && method !== 'GET') {
    opts.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || `Twilio error ${res.status}`);
    err.twilioError = data;
    err.status = res.status;
    throw err;
  }
  return data;
}
