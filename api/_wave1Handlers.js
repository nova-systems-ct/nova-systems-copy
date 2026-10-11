// Wave One webhook + follow-up orchestration. Talks to storage ONLY through a `repo` interface:
//   - createPostgrestRepo(): production (service-role PostgREST) — used by api/client.js and the worker.
//   - the in-memory repo in scripts/unit_wave1_handlers_test.mjs — proves these code paths run.
// A passing in-memory test proves LOGIC. It does not prove a Twilio webhook was received, a text
// was delivered, or that any table exists in the real database.
import { verifyTwilioSignature, normalizePhone, classifyInboundKeyword, evaluateSendEligibility, isMissedCallStatus, missedCallKey, validateFormSubmission, classifySendOutcome } from './_wave1.js';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = (status = 200) => ({ status, type: 'text/xml', body: EMPTY_TWIML });

function checkSignature({ url, params, signature }, env) {
  // Fail CLOSED: no token or no configured public base URL means the webhook is not accepting traffic.
  if (!env.TWILIO_AUTH_TOKEN || !url) return { ok: false, status: 503, error: 'Webhook not configured' };
  if (!verifyTwilioSignature({ url, params, signature, authToken: env.TWILIO_AUTH_TOKEN })) return { ok: false, status: 403, error: 'Invalid signature' };
  return { ok: true };
}

// ---------------------------------------------------------------- inbound SMS
export async function handleSmsInbound({ url, params, signature }, repo, env) {
  const sig = checkSignature({ url, params, signature }, env);
  if (!sig.ok) return { status: sig.status, type: 'application/json', body: { error: sig.error } };

  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);
  const sid = params.MessageSid || params.SmsSid;
  if (!from || !to || !sid) return twiml(200); // malformed but signed: ack, never retry-storm

  const org = await repo.orgByNumber(to);
  if (!org) return twiml(200); // number not assigned to any organization — nothing to record, no leak
  const orgId = org.organization_id;

  // Duplicate / replayed provider event → acknowledge with NO side effects.
  const isNew = await repo.recordSourceEvent('twilio_sms', sid, orgId, { kind: 'inbound_sms' });
  if (!isNew) return twiml(200);

  const kind = classifyInboundKeyword(params.Body);
  const now = new Date().toISOString();
  let contact = await repo.upsertContactByPhone(orgId, from, { name: 'Unknown (SMS)', source: 'inbound_sms' });

  if (kind === 'opt_out') {
    // STOP always wins. Suppression is stored on the contact; every later automated send re-reads it at
    // EXECUTION time (runMissedCallFollowup), so already-queued jobs are blocked too.
    contact = await repo.updateContact(orgId, contact.id, { suppressed: true, suppressed_at: now, suppression_source: 'sms_stop_keyword', sms_consent: false });
  } else if (kind === 'opt_in') {
    contact = await repo.updateContact(orgId, contact.id, { suppressed: false, sms_consent: true, sms_consent_source: 'sms_start_keyword', sms_consent_at: now });
  }

  const conv = await repo.upsertConversation(orgId, contact.id, 'sms');
  await repo.insertMessage(orgId, { conversation_id: conv.id, direction: 'inbound', body: params.Body || '', status: 'received', provider: 'twilio', provider_sid: sid, purpose: kind === 'message' ? null : kind });
  // A reply (or STOP) halts any automated follow-up that was waiting on this contact.
  await repo.updateConversation(orgId, conv.id, { last_inbound_at: now, contact_replied_since_trigger: true });
  return twiml(200);
}

// ---------------------------------------------------------------- outbound delivery status
// Twilio status callbacks arrive duplicated and out of order. Rank statuses so a late "sent" can never
// overwrite "delivered"; terminal failures are never downgraded either.
const RANK = { provider_accepted: 1, delivered: 2, undelivered: 3, failed: 3 };
const MAP = { queued: 'provider_accepted', accepted: 'provider_accepted', sending: 'provider_accepted', sent: 'provider_accepted', delivered: 'delivered', undelivered: 'undelivered', failed: 'failed' };
export async function handleSmsStatus({ url, params, signature }, repo, env) {
  const sig = checkSignature({ url, params, signature }, env);
  if (!sig.ok) return { status: sig.status, type: 'application/json', body: { error: sig.error } };
  const sid = params.MessageSid || params.SmsSid; const raw = String(params.MessageStatus || params.SmsStatus || '').toLowerCase();
  const from = normalizePhone(params.From); const to = normalizePhone(params.To);
  const status = MAP[raw];
  if (!sid || !status || !from) return twiml(200);
  const org = await repo.orgByNumber(from); // outbound: From is OUR number
  if (!org) return twiml(200);
  const orgId = org.organization_id;
  if (!(await repo.recordSourceEvent('twilio_sms_status', `${sid}:${raw}`, orgId, { kind: 'delivery_status' }))) return twiml(200);
  const msg = await repo.findMessageBySid(orgId, sid);
  if (!msg) return twiml(200); // not one of ours (or not recorded yet) — acknowledge, do not guess
  if ((RANK[status] || 0) > (RANK[msg.status] || 0) || (msg.status === 'ambiguous' && RANK[status])) {
    await repo.updateMessage(orgId, msg.id, { status, error_code: params.ErrorCode ? String(params.ErrorCode).slice(0, 20) : msg.error_code || null });
  }
  // 21610 = recipient has opted out with the carrier/Twilio. Treat as an opt-out here too.
  if (String(params.ErrorCode) === '21610' && to) {
    const c = await repo.upsertContactByPhone(orgId, to, { name: 'Unknown (SMS)', source: 'twilio_status' });
    await repo.updateContact(orgId, c.id, { suppressed: true, suppressed_at: new Date().toISOString(), suppression_source: 'twilio_21610', sms_consent: false });
  }
  return twiml(200);
}

// ---------------------------------------------------------------- call status (missed call)
export async function handleCallStatus({ url, params, signature }, repo, env) {
  const sig = checkSignature({ url, params, signature }, env);
  if (!sig.ok) return { status: sig.status, type: 'application/json', body: { error: sig.error } };

  const from = normalizePhone(params.From);
  const to = normalizePhone(params.To);
  const callSid = params.CallSid;
  // When the call was forwarded with <Dial action=...>, DialCallStatus says whether the FORWARDED leg was
  // answered; the parent CallStatus alone would read "completed" even for a call nobody picked up.
  const callStatus = params.DialCallStatus || params.CallStatus;
  if (!from || !to || !callSid || !callStatus) return twiml(200);

  const org = await repo.orgByNumber(to);
  if (!org) return twiml(200);
  const orgId = org.organization_id;

  // Twilio can deliver the same status callback more than once and out of order; key on call+status.
  const isNew = await repo.recordSourceEvent('twilio_call_status', `${callSid}:${callStatus}`, orgId, { kind: 'call_status' });
  if (!isNew) return twiml(200);
  if (!isMissedCallStatus(callStatus)) return twiml(200);
  await processMissedCall({ repo, org, from, callSid });
  return twiml(200);
}

// One missed call → a CRM record, and at most ONE follow-up (keyed by CallSid) if — and only if — the
// contact is eligible right now. Everything is re-checked when the job runs.
async function processMissedCall({ repo, org, from, callSid }) {
  const orgId = org.organization_id;
  const contact = await repo.upsertContactByPhone(orgId, from, { name: 'Unknown (missed call)', source: 'missed_call' });
  const conv = await repo.upsertConversation(orgId, contact.id, 'sms');
  const settings = org.settings || {};

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const recent = await repo.countRecentAutomated(orgId, contact.id, since);
  const decision = evaluateSendEligibility({
    purpose: 'missed_call', contact, conversation: conv, recentAutomatedCount: recent.count, lastAutomatedAt: recent.lastAt,
    org: { timezone: settings.timezone, quiet_hours: settings.quiet_hours, paused: settings.paused, channels_paused: settings.channels_paused, max_automated_per_day: settings.max_automated_per_day, min_gap_minutes: settings.min_gap_minutes },
  });

  if (!decision.allowed && decision.reason === 'quiet_hours' && decision.retryAt) {
    // Not refused, just too late/early: the same single follow-up is scheduled for when quiet hours end,
    // and re-evaluated then (a STOP/reply/booking in between still wins).
    await repo.enqueueJob({ job_type: 'wave1_missed_call_followup', organization_id: orgId, scheduled_at: decision.retryAt, payload: { contact_id: contact.id, conversation_id: conv.id, call_sid: callSid, deferrals: 1 }, idempotency_key: missedCallKey(callSid) });
    return;
  }
  if (!decision.allowed) {
    // Recorded for the operator view so "why didn't it text them?" is answerable. Nothing is sent.
    await repo.insertMessage(orgId, { conversation_id: conv.id, direction: 'outbound', body: null, automated: true, purpose: 'missed_call', status: 'blocked', blocked_reason: decision.reason, idempotency_key: missedCallKey(callSid) });
    return;
  }
  // Exactly one follow-up per call: the job's idempotency key is the CallSid. The worker re-checks
  // eligibility at execution time (a STOP or reply between now and then must win).
  await repo.enqueueJob({ job_type: 'wave1_missed_call_followup', organization_id: orgId, payload: { contact_id: contact.id, conversation_id: conv.id, call_sid: callSid }, idempotency_key: missedCallKey(callSid) });
}

// ---------------------------------------------------------------- inbound voice (forward to a human)
// Point the business number's Voice webhook here. The call is forwarded to the organization's first
// escalation contact with a ring timeout; Twilio then calls .../op=call-status with DialCallStatus, and an
// unanswered forward becomes a missed call. NO conversational AI answers the phone — that is not built.
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xml = (inner) => ({ status: 200, type: 'text/xml', body: `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>` });
export async function handleVoiceInbound({ url, params, signature }, repo, env) {
  const sig = checkSignature({ url, params, signature }, env);
  if (!sig.ok) return { status: sig.status, type: 'application/json', body: { error: sig.error } };
  const from = normalizePhone(params.From); const to = normalizePhone(params.To); const callSid = params.CallSid;
  if (!from || !to || !callSid) return twiml(200);
  const org = await repo.orgByNumber(to);
  if (!org) return xml('<Say>This number is not in service.</Say><Hangup/>');
  const contacts = org.settings?.escalation_contacts || [];
  const target = contacts.map((c) => normalizePhone(c.phone)).find(Boolean);
  const base = (env.WAVE1_PUBLIC_BASE || '').replace(/\/$/, '');
  if (!target || !base) {
    // Nobody to ring (or no public base to receive the result): treat as missed, say so honestly, hang up.
    if (await repo.recordSourceEvent('twilio_call_status', `${callSid}:no-forward-target`, org.organization_id, { kind: 'no_forward_target' })) await processMissedCall({ repo, org, from, callSid });
    return xml('<Say>Sorry, no one is available to take your call right now.</Say><Hangup/>');
  }
  const action = `${base}/api/client?resource=wave1&op=call-status`;
  const ring = Math.max(10, Math.min(60, Number(org.settings?.ring_timeout_seconds) || 20));
  return xml(`<Dial timeout="${ring}" action="${xmlEsc(action)}" method="POST"><Number>${xmlEsc(target)}</Number></Dial>`);
}

// ---------------------------------------------------------------- form intake (public)
export async function handleFormIntake({ token, body, ip }, repo) {
  if (!token) return { status: 400, body: { error: 'Missing form token' } };
  const settings = await repo.orgByFormToken(token);
  if (!settings) return { status: 404, body: { error: 'Unknown form' } }; // same answer for wrong/rotated tokens
  const orgId = settings.organization_id;

  const v = validateFormSubmission({ fields: body?.fields, honeypot: body?.website_url_confirm, renderedAtMs: Number(body?.rendered_at), submittedAtMs: Date.now() });
  if (!v.ok) return { status: 422, body: { ok: false, reason: v.reason } };

  const submissionId = String(body?.submission_id || '').slice(0, 100);
  if (submissionId) {
    const isNew = await repo.recordSourceEvent('web_form', `${orgId}:${submissionId}`, orgId, { kind: 'form' });
    if (!isNew) return { status: 200, body: { ok: true, duplicate: true } };
  }
  const now = new Date().toISOString();
  const contact = v.contact.phone_e164
    ? await repo.upsertContactByPhone(orgId, v.contact.phone_e164, { name: v.contact.name, email: v.contact.email, source: 'web_form' })
    : await repo.createContact(orgId, { name: v.contact.name, email: v.contact.email, source: 'web_form' });
  if (v.contact.sms_consent && v.contact.phone_e164) {
    await repo.updateContact(orgId, contact.id, { sms_consent: true, sms_consent_source: 'web_form_checkbox', sms_consent_at: now });
  }
  const conv = await repo.upsertConversation(orgId, contact.id, 'form');
  await repo.insertMessage(orgId, { conversation_id: conv.id, direction: 'inbound', body: String(body?.fields?.message || '').slice(0, 2000), status: 'received', provider: 'web_form', provider_sid: submissionId ? `${orgId}:${submissionId}` : null });
  return { status: 200, body: { ok: true } };
}

// ---------------------------------------------------------------- worker: send the one follow-up
// Re-reads LIVE state (contact/conversation/settings) — nothing is trusted from enqueue time.
export async function runMissedCallFollowup(job, repo, sender, env) {
  const { contact_id, conversation_id, call_sid } = job.payload || {};
  const orgId = job.organization_id;
  if (!orgId || !contact_id || !conversation_id) throw new Error('job payload incomplete');

  const contact = await repo.getContact(orgId, contact_id);
  const conv = await repo.getConversation(orgId, conversation_id);
  const settings = (await repo.getSettings(orgId)) || {};
  if (!contact || !conv) return { skipped: true, reason: 'contact or conversation no longer exists in this organization' };

  // Redelivery guard FIRST, independent of the frequency/min-gap rules: if this call's send was already
  // claimed, stop — so redelivery safety never depends on a rate-limit setting happening to block it.
  if (await repo.messageExists(orgId, `${missedCallKey(call_sid)}:send`)) return { sent: false, skipped: 'already_attempted' };
  const recent = await repo.countRecentAutomated(orgId, contact.id, new Date(Date.now() - 24 * 3600_000).toISOString());
  const decision = evaluateSendEligibility({
    purpose: 'missed_call', contact, conversation: conv, recentAutomatedCount: recent.count, lastAutomatedAt: recent.lastAt,
    org: { timezone: settings.timezone, quiet_hours: settings.quiet_hours, paused: settings.paused, channels_paused: settings.channels_paused, max_automated_per_day: settings.max_automated_per_day, min_gap_minutes: settings.min_gap_minutes },
  });
  const key = missedCallKey(call_sid);
  if (!decision.allowed && decision.reason === 'quiet_hours' && decision.retryAt && (job.payload?.deferrals || 0) < 3) {
    const n = (job.payload?.deferrals || 0) + 1;
    await repo.enqueueJob({ job_type: 'wave1_missed_call_followup', organization_id: orgId, scheduled_at: decision.retryAt, payload: { ...job.payload, deferrals: n }, idempotency_key: `${key}:defer${n}` });
    return { sent: false, deferred_until: decision.retryAt };
  }
  if (!decision.allowed) {
    await repo.insertMessage(orgId, { conversation_id, direction: 'outbound', automated: true, purpose: 'missed_call', status: 'blocked', blocked_reason: decision.reason, idempotency_key: `${key}:exec` });
    return { sent: false, blocked: decision.reason };
  }
  const template = settings.templates?.missed_call;
  if (!template) {
    await repo.insertMessage(orgId, { conversation_id, direction: 'outbound', automated: true, purpose: 'missed_call', status: 'blocked', blocked_reason: 'no_reviewed_template', idempotency_key: `${key}:exec` });
    return { sent: false, blocked: 'no_reviewed_template' };
  }
  if (env.WAVE1_SEND_ENABLED !== 'true') {
    // Live sends are OFF unless explicitly enabled. This is a dry run — NOT a sent message.
    await repo.insertMessage(orgId, { conversation_id, direction: 'outbound', body: template, automated: true, purpose: 'missed_call', status: 'blocked', blocked_reason: 'send_disabled_dry_run', idempotency_key: `${key}:exec` });
    return { sent: false, blocked: 'send_disabled_dry_run' };
  }

  // Claim the send BEFORE calling the provider (idempotency row). A redelivered job hits the unique key and stops.
  const claimed = await repo.insertMessage(orgId, { conversation_id, direction: 'outbound', body: template, automated: true, purpose: 'missed_call', status: 'queued', provider: 'twilio', idempotency_key: `${key}:send` });
  if (!claimed) return { sent: false, skipped: 'already_attempted' };
  let result;
  try { result = await sender({ to: contact.phone_e164, from: settings.sms_number_ref, body: template }); }
  catch (e) { result = { httpStatus: 0, error: e.message }; }
  const outcome = classifySendOutcome(result);
  if (outcome === 'provider_accepted') {
    await repo.updateMessage(orgId, claimed.id, { status: 'provider_accepted', provider_sid: result.sid || null });
    await repo.updateConversation(orgId, conversation_id, { last_outbound_at: new Date().toISOString(), contact_replied_since_trigger: false });
    return { sent: true, delivery: 'provider_accepted (not yet confirmed delivered)' };
  }
  if (outcome === 'ambiguous_reconcile') {
    // Unknown whether Twilio queued it. NEVER auto-retry (could double-text). Surface for reconciliation.
    await repo.updateMessage(orgId, claimed.id, { status: 'ambiguous', error_code: String(result.httpStatus || result.error || 'unknown').slice(0, 60) });
    return { sent: false, ambiguous: true };
  }
  await repo.updateMessage(orgId, claimed.id, { status: 'failed', error_code: String(result.httpStatus || 'rejected') });
  if (outcome === 'rate_limited_retry') throw new Error('provider rate limited — retry with backoff');
  return { sent: false, failed: true };
}

// ---------------------------------------------------------------- Twilio REST sender (production)
export function createTwilioSender(env, fetchImpl = fetch) {
  return async ({ to, from, body }) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const r = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: from, Body: body, ...(env.WAVE1_PUBLIC_BASE ? { StatusCallback: `${env.WAVE1_PUBLIC_BASE.replace(/\/$/, '')}/api/client?resource=wave1&op=sms-status` } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      return { httpStatus: r.status, sid: j.sid };
    } finally { clearTimeout(timer); }
  };
}
