// Nova Operations — the one path every automated or staff SMS takes. Eligibility is evaluated at SEND time
// against live rows (a STOP, takeover, pause or booking between enqueue and send always wins).
//
// Two kinds of purpose:
//  • TRANSACTIONAL — replies about a request the customer started (answer, booking/agreement link,
//    confirmation, reminder). Allowed inside a customer-initiated conversation (30 days) or with recorded
//    consent. This is NOT marketing consent and never sets crm_contacts.sms_consent.
//  • CONSENT-REQUIRED — review/referral invitations, reactivation campaigns, missed-call follow-ups under the
//    default policy, weekly report SMS. These need a recorded consent with source and time.
// Live provider sends happen only when WAVE1_SEND_ENABLED=true; with OPS_SEND_ALLOWLIST set (staging), only
// listed numbers can receive a real message. Otherwise the message is recorded as a dry run — never "sent".
import { evaluateSendEligibility, classifySendOutcome, localHour, isQuietHour, nextSendWindow } from '../_wave1.js';
import { createTwilioSender } from '../_wave1Handlers.js';
import { dbOne, dbInsert, dbPatch, dbGet, enc, nowIso } from '../_sales/core.js';

export const TRANSACTIONAL = ['reply', 'staff_reply', 'booking_link', 'booking_confirmation', 'appointment_reminder', 'escalation_notice', 'owner_alert'];
const CUSTOMER_INITIATED_WINDOW_MS = 30 * 86400_000;
const QUIET_EXEMPT_AFTER_INBOUND_MS = 30 * 60_000;

export function evaluateOpsSend({ now = new Date(), purpose, contact, conversation, org, recentAutomatedCount = 0, lastAutomatedAt = null, allowlist = null }) {
  if (!contact) return { allowed: false, reason: 'no_contact' };
  if (!contact.phone_e164) return { allowed: false, reason: 'no_valid_number' };
  if (allowlist && !allowlist.includes(contact.phone_e164)) return { allowed: false, reason: 'not_on_test_allowlist' };
  if (!TRANSACTIONAL.includes(purpose)) {
    // "The contact replied" stops a pending missed-call follow-up (wave1 semantics). Campaigns apply their own
    // reply-since-start stop (harvest.js); a feedback/referral request after a completed job is not cancelled by
    // the customer having texted about that job earlier.
    const conv = conversation && purpose !== 'missed_call' ? { ...conversation, contact_replied_since_trigger: false } : conversation;
    return evaluateSendEligibility({ now, purpose, contact, org, conversation: conv, recentAutomatedCount, lastAutomatedAt });
  }
  if (contact.suppressed) return { allowed: false, reason: 'suppressed_opt_out' };
  if (contact.do_not_contact && purpose !== 'owner_alert') return { allowed: false, reason: 'do_not_contact' };
  if (org?.paused && purpose !== 'owner_alert') return { allowed: false, reason: 'organization_paused' };
  if (org?.channels_paused?.includes('sms') && purpose !== 'owner_alert') return { allowed: false, reason: 'channel_paused' };
  if (conversation?.staff_takeover && purpose !== 'staff_reply') return { allowed: false, reason: 'staff_takeover' };
  const initiated = conversation?.customer_initiated_at && now - new Date(conversation.customer_initiated_at) < CUSTOMER_INITIATED_WINDOW_MS;
  const consented = contact.sms_consent && contact.sms_consent_source && contact.sms_consent_at;
  if (!initiated && !consented && purpose !== 'owner_alert') return { allowed: false, reason: 'no_customer_request_or_consent' };
  if (!org?.timezone) return { allowed: false, reason: 'timezone_not_configured' };
  const recentInbound = conversation?.last_inbound_at && now - new Date(conversation.last_inbound_at) < QUIET_EXEMPT_AFTER_INBOUND_MS;
  if (!recentInbound && purpose !== 'staff_reply' && isQuietHour(localHour(now, org.timezone), org.quiet_hours || { start: 21, end: 8 })) {
    return { allowed: false, reason: 'quiet_hours', retryAt: nextSendWindow(now, org.timezone, org.quiet_hours || { start: 21, end: 8 }) };
  }
  return { allowed: true, reason: initiated ? 'customer_initiated_conversation' : 'recorded_consent' };
}

export const sendMode = (env = process.env) => (env.WAVE1_SEND_ENABLED === 'true' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN ? 'live' : 'dry_run');
export const allowlistFrom = (env = process.env) => (env.OPS_SEND_ALLOWLIST ? env.OPS_SEND_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean) : null);
let senderOverride = null;
export const setSenderForTests = (fn) => { senderOverride = fn; };

export async function orgSettings(orgId) {
  return (await dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=*`)) || {};
}

// Sends (or records why not) one SMS. Returns {status, reason, message}. Idempotent per (org, idempotencyKey).
export async function sendSms({ orgId, conversationId, contactId, body, purpose, idempotencyKey, triggerAt = null, sentBy = null, isTest = false, now = new Date() }) {
  const contact = await dbOne(`crm_contacts?id=eq.${enc(contactId)}&organization_id=eq.${enc(orgId)}&select=*`);
  const conv = conversationId ? await dbOne(`wave1_conversations?id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}&select=*`) : null;
  const settings = await orgSettings(orgId);
  if (idempotencyKey && await dbOne(`wave1_messages?organization_id=eq.${enc(orgId)}&idempotency_key=eq.${enc(idempotencyKey)}&select=id`)) return { status: 'duplicate', reason: 'already_attempted' };
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const recent = contact ? await dbGet(`wave1_messages?organization_id=eq.${enc(orgId)}&conversation_id=eq.${enc(conversationId || '00000000-0000-0000-0000-000000000000')}&automated=eq.true&direction=eq.outbound&purpose=not.in.(${TRANSACTIONAL.join(",")})&created_at=gte.${enc(since)}&status=in.(queued,provider_accepted,delivered)&select=created_at&order=created_at.desc`) : []; // courtesy caps apply to marketing-type sends, not replies to the customer
  const decision = evaluateOpsSend({
    now, purpose, contact, conversation: conv, recentAutomatedCount: recent.length, lastAutomatedAt: recent[0]?.created_at || null, allowlist: allowlistFrom(),
    org: { timezone: settings.timezone, quiet_hours: settings.quiet_hours, paused: settings.paused, channels_paused: settings.channels_paused, max_automated_per_day: settings.max_automated_per_day, min_gap_minutes: settings.min_gap_minutes },
  });
  const base = { conversation_id: conversationId, direction: 'outbound', body, automated: !sentBy, purpose, provider: 'twilio', idempotency_key: idempotencyKey || null, sent_by: sentBy, is_test: isTest, trigger_at: triggerAt };
  if (!conversationId) return { status: 'blocked', reason: 'no_conversation' };
  // A blocked attempt is recorded under its own key, so it never consumes the one real send this key allows.
  const blockedBase = () => ({ ...base, idempotency_key: idempotencyKey ? `${idempotencyKey}:blocked:${Date.now()}:${Math.random().toString(36).slice(2, 7)}` : null });
  if (process.env.OPS_KILL_SWITCH === 'true') {
    const ins = await dbInsert('wave1_messages', { ...blockedBase(), organization_id: orgId, status: 'blocked', blocked_reason: 'kill_switch', provider: null });
    return { status: 'blocked', reason: 'kill_switch', message: ins.row };
  }
  if (!decision.allowed) {
    const ins = await dbInsert('wave1_messages', { ...blockedBase(), organization_id: orgId, status: 'blocked', blocked_reason: decision.reason, provider: null });
    return { status: 'blocked', reason: decision.reason, retryAt: decision.retryAt || null, message: ins.row };
  }
  if (sendMode() !== 'live') {
    const ins = await dbInsert('wave1_messages', { ...base, organization_id: orgId, status: 'blocked', blocked_reason: 'send_disabled_dry_run', provider: null });
    return { status: 'dry_run', reason: 'send_disabled_dry_run', message: ins.row };
  }
  if (!settings.sms_number_ref) {
    const ins = await dbInsert('wave1_messages', { ...blockedBase(), organization_id: orgId, status: 'blocked', blocked_reason: 'no_business_number', provider: null });
    return { status: 'blocked', reason: 'no_business_number', message: ins.row };
  }
  const claimed = await dbInsert('wave1_messages', { ...base, organization_id: orgId, status: 'queued' });
  if (claimed.conflict) return { status: 'duplicate', reason: 'already_attempted' };
  let result;
  try { result = await (senderOverride || createTwilioSender(process.env))({ to: contact.phone_e164, from: settings.sms_number_ref, body }); }
  catch (e) { result = { httpStatus: 0, error: e.message }; }
  const outcome = classifySendOutcome(result);
  const at = nowIso();
  if (outcome === 'provider_accepted') {
    const [m] = await dbPatch('wave1_messages', `id=eq.${enc(claimed.row.id)}&organization_id=eq.${enc(orgId)}`, { status: 'provider_accepted', provider_sid: result.sid || null, submitted_at: at });
    await dbPatch('wave1_conversations', `id=eq.${enc(conversationId)}&organization_id=eq.${enc(orgId)}`, { last_outbound_at: at });
    return { status: 'provider_accepted', message: m };
  }
  if (outcome === 'ambiguous_reconcile') {
    await dbPatch('wave1_messages', `id=eq.${enc(claimed.row.id)}`, { status: 'ambiguous', error_code: String(result.httpStatus || result.error || 'unknown').slice(0, 60), submitted_at: at });
    return { status: 'ambiguous', reason: 'provider_outcome_unknown_reconcile_before_retry' };
  }
  await dbPatch('wave1_messages', `id=eq.${enc(claimed.row.id)}`, { status: 'failed', error_code: String(result.httpStatus || 'rejected') });
  if (outcome === 'rate_limited_retry') throw Object.assign(new Error('provider rate limited — retry with backoff'), { retryable: true });
  return { status: 'failed', reason: 'provider_rejected' };
}
