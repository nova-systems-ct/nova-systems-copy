// Outbound email for client businesses: Revive come-back messages and the weekly scorecard.
//
// Sent through Nova's own email provider (Resend), from Nova's verified domain, with the
// business's name as the sender name and replies going to the business. Nothing is sent unless
// Isaac has switched email on (NOVA_EMAIL_SENDING=on). On Resend's free plan the whole account
// can send 100 emails a day and sending simply pauses past that (no charge), so the daily caps
// below leave room for Nova's own emails.
export function emailSwitch(env = process.env) {
  if (!env.RESEND_API_KEY) return { on: false, reason: 'Email is not set up for Nova yet.' };
  if (env.NOVA_EMAIL_SENDING !== 'on') return { on: false, reason: 'Email sending is switched off. Nova switches it on after checking the email plan and its daily limit.' };
  return { on: true };
}

const whole = (v, d) => { const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : d; };
export const emailCaps = (env = process.env) => ({ perBusiness: whole(env.NOVA_EMAIL_DAILY_CAP_PER_BUSINESS, 25), total: whole(env.NOVA_EMAIL_DAILY_CAP_TOTAL, 80) });

// A sender name may only hold letters, numbers, spaces and & ' - . so it can never add an address
// or a header (commas, quotes, angle brackets, colons and line breaks are removed).
const cleanName = (s) => String(s || '').replace(/[^\p{L}\p{N} &'.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'A local business';
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const validEmail = (s) => typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s);

// Returns { ok, id } only when the provider accepted the message ('sent' is not 'delivered').
export async function sendEmail({ to, subject, text, fromName, replyTo, headers, idempotencyKey }, env = process.env) {
  if (!emailSwitch(env).on) return { ok: false, error: 'email_off' };
  if (!validEmail(to)) return { ok: false, error: 'bad_address' };
  const base = (env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
  const from = `${cleanName(fromName)} <${env.NOVA_FROM_EMAIL || 'noreply@nova-systems.app'}>`;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(`${base}/emails`, {
      method: 'POST', signal: ctrl.signal,
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify({ from, to: [to], subject: String(subject).slice(0, 200), text, ...(validEmail(replyTo) ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}) }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok && body.id) return { ok: true, id: body.id };
    return { ok: false, error: `provider ${r.status}: ${String(body.message || '').slice(0, 120)}` };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'provider timeout (outcome unknown)' : e.message };
  } finally { clearTimeout(timer); }
}
