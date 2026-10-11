// Wave One core rules — pure, dependency-free (node:crypto only), unit-tested in
// scripts/unit_wave1_test.mjs. Nothing here performs I/O or sends anything; it only DECIDES.
// A decision of "allowed" is never a claim that a message was sent or delivered.
import crypto from 'node:crypto';

// ---- Twilio webhook signature (X-Twilio-Signature): HMAC-SHA1 over the full public URL followed
// by every POST param name+value sorted by name, base64-encoded. Compared in constant time.
export function twilioSignature(url, params, authToken) {
  const data = url + Object.keys(params || {}).sort().reduce((acc, k) => acc + k + params[k], '');
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}
export function verifyTwilioSignature({ url, params, signature, authToken }) {
  if (!signature || !authToken || !url) return false;
  const expected = Buffer.from(twilioSignature(url, params, authToken));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// ---- Phone normalization (E.164). US 10/11-digit default; anything else must already be +E.164.
export function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// ---- Carrier-standard keywords. STOP-class must ALWAYS win, regardless of workflow state.
const OPT_OUT = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
// Only carrier-standard re-subscribe keywords. "YES" is deliberately NOT one: a contact answering "yes" to a
// question must not silently clear an opt-out or grant SMS consent.
const OPT_IN = new Set(['START', 'UNSTOP']);
const HELP = new Set(['HELP', 'INFO']);
export function classifyInboundKeyword(body) {
  const word = String(body || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (OPT_OUT.has(word)) return 'opt_out';
  if (OPT_IN.has(word)) return 'opt_in';
  if (HELP.has(word)) return 'help';
  return 'message';
}

// ---- Local time helpers for quiet hours (DST-correct via Intl, no hand-rolled offsets).
export function localHour(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour').value) % 24;
}

export const isQuietHour = (h, qh) => (qh.start > qh.end ? (h >= qh.start || h < qh.end) : (h >= qh.start && h < qh.end));
// Earliest moment (10-minute resolution, DST-correct via Intl) at which quiet hours have ended; null if none within 26h.
export function nextSendWindow(now, timeZone, quietHours = { start: 21, end: 8 }) {
  for (let m = 10; m <= 26 * 60; m += 10) {
    const t = new Date(now.getTime() + m * 60_000);
    if (!isQuietHour(localHour(t, timeZone), quietHours)) return t.toISOString();
  }
  return null;
}

// ---- The gate every AUTOMATED send must pass, evaluated at EXECUTION time (never trusted from
// enqueue time). Returns {allowed, reason, retryAt?}. First failing rule wins; order is by severity
// (legal/consent first, then operator controls, then courtesy limits).
export function evaluateSendEligibility({ now = new Date(), purpose, channel = 'sms', contact, org, conversation, recentAutomatedCount = 0, lastAutomatedAt = null }) {
  if (!contact) return { allowed: false, reason: 'no_contact' };
  if (!contact.phone_e164) return { allowed: false, reason: 'no_valid_number' };
  if (contact.suppressed) return { allowed: false, reason: 'suppressed_opt_out' };
  if (contact.do_not_contact) return { allowed: false, reason: 'do_not_contact' };
  // Consent must be an explicit recorded grant with a source and time — a number existing is not consent.
  if (!contact.sms_consent || !contact.sms_consent_source || !contact.sms_consent_at) return { allowed: false, reason: 'no_recorded_consent' };
  if (org?.paused) return { allowed: false, reason: 'organization_paused' };
  if (org?.channels_paused?.includes(channel)) return { allowed: false, reason: 'channel_paused' };
  if (conversation?.staff_takeover) return { allowed: false, reason: 'staff_takeover' };
  if (conversation?.contact_replied_since_trigger && purpose !== 'reply') return { allowed: false, reason: 'contact_replied' };
  if (conversation?.appointment_confirmed && ['missed_call', 'inquiry_followup', 'estimate_followup'].includes(purpose)) return { allowed: false, reason: 'already_booked' };

  const tz = org?.timezone;
  if (!tz) return { allowed: false, reason: 'timezone_not_configured' }; // unknown zone blocks, never guesses
  const qh = org?.quiet_hours || { start: 21, end: 8 };
  const h = localHour(now, tz);
  const inQuiet = isQuietHour(h, qh);
  if (inQuiet && purpose !== 'reply') return { allowed: false, reason: 'quiet_hours', retryAt: nextSendWindow(now, tz, qh) };

  const limit = org?.max_automated_per_day ?? 3;
  if (recentAutomatedCount >= limit) return { allowed: false, reason: 'frequency_limit' };
  const minGapMs = (org?.min_gap_minutes ?? 10) * 60_000;
  if (lastAutomatedAt && now - new Date(lastAutomatedAt) < minGapMs) return { allowed: false, reason: 'min_gap' };
  return { allowed: true, reason: 'eligible' };
}

// ---- Missed-call decision: exactly one follow-up per call, keyed by provider CallSid.
export function missedCallKey(callSid) { return `missed_call:${callSid}`; }
export function isMissedCallStatus(callStatus) { return ['no-answer', 'busy', 'failed', 'canceled'].includes(String(callStatus || '').toLowerCase()); }

// ---- Ambiguous provider outcome: a timeout/5xx after submitting a send is NOT a failure and NOT a
// success — it must be reconciled (status callback / provider lookup) before any retry.
export function classifySendOutcome({ httpStatus, error }) {
  if (httpStatus >= 200 && httpStatus < 300) return 'provider_accepted';
  if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429) return 'rejected';
  if (httpStatus === 429) return 'rate_limited_retry';
  return 'ambiguous_reconcile'; // network error, timeout, 5xx
}

// ---- Form intake: honeypot + timing + required consent, deterministic and unit-tested.
export function validateFormSubmission({ fields, honeypot, renderedAtMs, submittedAtMs = Date.now() }) {
  if (honeypot) return { ok: false, reason: 'spam_honeypot' };
  if (renderedAtMs && submittedAtMs - renderedAtMs < 2000) return { ok: false, reason: 'spam_too_fast' };
  const name = String(fields?.name || '').trim();
  const phone = normalizePhone(fields?.phone);
  const email = String(fields?.email || '').trim();
  if (!name) return { ok: false, reason: 'name_required' };
  if (!phone && !email) return { ok: false, reason: 'phone_or_email_required' };
  const smsConsent = fields?.sms_consent === true; // explicit checkbox only — never inferred from providing a number
  return { ok: true, contact: { name, phone_e164: phone, email: email || null, sms_consent: smsConsent } };
}
