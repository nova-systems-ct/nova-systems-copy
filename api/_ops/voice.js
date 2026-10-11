// Nova AI voice receptionist on Twilio Programmable Voice: <Gather input="speech dtmf"> turns with Twilio's speech
// recognition and <Say> speech, driven by the same deterministic engine as SMS (rules.decide). It identifies itself
// as automated, books only through the action service, sends the secure link by SMS only after the caller agrees,
// never takes card numbers, transfers to a person on escalation, and fails safe to a human or a callback task.
// Without an ACTIVE voice configuration with a disclosure script, the call falls back to plain forwarding.
import { dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import { normalizePhone, verifyTwilioSignature } from '../_wave1.js';
import * as R from './rules.js';
import { businessContext, approvedServices, busyIntervals, openJobForConversation, quoteJob, holdSlot, sendAgreement, transition } from './service.js';
import { sendSms } from './messaging.js';

const MAX_TURNS = 8;
const xe = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xml = (inner) => ({ status: 200, type: 'text/xml', body: `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>` });
const say = (t) => `<Say voice="Polly.Joanna">${xe(String(t).replace(/\n/g, '. ').replace(/https?:\/\/\S+/g, 'the link we text you'))}</Say>`;
const CARDISH = /\b(?:\d[ -]?){13,19}\b/;

function base(env) { return (env.WAVE1_PUBLIC_BASE || '').replace(/\/$/, ''); }
const turnUrl = (env) => `${base(env)}/api/client?resource=ops&op=voice-turn`;
const gather = (env, prompt) => `<Gather input="speech dtmf" action="${xe(turnUrl(env))}" method="POST" timeout="6" speechTimeout="auto" numDigits="1" actionOnEmptyResult="true">${say(prompt)}</Gather>`;

function verify({ url, params, signature }, env) {
  if (!env.TWILIO_AUTH_TOKEN) return { ok: false, status: 503 };
  return verifyTwilioSignature({ url, params, signature, authToken: env.TWILIO_AUTH_TOKEN }) ? { ok: true } : { ok: false, status: 403 };
}
async function transfer({ c, session, reason }) {
  const target = (c.wave.escalation_contacts || []).map((x) => normalizePhone(x.phone)).find(Boolean);
  await dbPatch('voice_call_sessions', `id=eq.${enc(session.id)}&organization_id=eq.${enc(session.organization_id)}`, { engine_state: 'transferred', outcome: target ? 'transferred' : 'callback_created', transferred_to: target ? 'escalation_contact' : null });
  if (!target) {
    await dbInsert('ops_incidents', { organization_id: session.organization_id, check_key: `callback:${session.id}`, severity: 'warning', title: `Caller needs a call back (${reason})`, detail: { session_id: session.id, reason } }).catch(() => null);
    return xml(`${say('I will ask a team member to call you back as soon as possible. Thank you for calling.')}<Hangup/>`);
  }
  return xml(`${say('Connecting you to a team member now.')}<Dial timeout="25"><Number>${xe(target)}</Number></Dial>${say('Sorry, no one was able to answer. A team member will call you back.')}<Hangup/>`);
}

export async function handleVoiceAiInbound({ url, params, signature }, env, fallback) {
  const v = verify({ url, params, signature }, env); if (!v.ok) return { status: v.status, type: 'application/json', body: { error: 'unauthorized' } };
  const from = normalizePhone(params.From); const to = normalizePhone(params.To); const callSid = params.CallSid;
  if (!from || !to || !callSid) return xml('<Hangup/>');
  const settings = await dbOne(`wave1_org_settings?sms_number_ref=eq.${enc(to)}&select=organization_id`);
  if (!settings) return xml(`${say('This number is not in service.')}<Hangup/>`);
  const orgId = settings.organization_id;
  const cfg = await dbOne(`voice_configurations?organization_id=eq.${enc(orgId)}&select=*`);
  if (!cfg || cfg.status !== 'active' || !cfg.disclosure_script || !base(env)) return fallback(); // human forwarding (existing behavior)
  const c = await businessContext(orgId);
  if (c.wave.paused || (c.wave.channels_paused || []).includes('voice')) return fallback();
  let contact = await dbOne(`crm_contacts?organization_id=eq.${enc(orgId)}&phone_e164=eq.${enc(from)}&merged_into_id=is.null&select=*`);
  if (!contact) contact = (await dbInsert('crm_contacts', { organization_id: orgId, name: 'Unknown (call)', phone: from, phone_e164: from, source: 'inbound_call' })).row;
  const existing = await dbOne(`voice_call_sessions?organization_id=eq.${enc(orgId)}&provider_call_sid=eq.${enc(callSid)}&select=*`);
  const session = existing || (await dbInsert('voice_call_sessions', { organization_id: orgId, direction: 'inbound', caller_ref: `…${from.slice(-4)}`, contact_id: contact.id, provider_call_sid: callSid, engine_state: 'new', consent_recorded: false })).row;
  return xml(gather(env, `${cfg.disclosure_script} Thanks for calling ${c.display_name}. How can we help? You can say the service you need, or press 0 for a person.`));
}

export async function handleVoiceAiTurn({ url, params, signature }, env) {
  const v = verify({ url, params, signature }, env); if (!v.ok) return { status: v.status, type: 'application/json', body: { error: 'unauthorized' } };
  const callSid = params.CallSid; const to = normalizePhone(params.To);
  const settings = to ? await dbOne(`wave1_org_settings?sms_number_ref=eq.${enc(to)}&select=organization_id`) : null;
  if (!settings || !callSid) return xml('<Hangup/>');
  const orgId = settings.organization_id;
  const session = await dbOne(`voice_call_sessions?organization_id=eq.${enc(orgId)}&provider_call_sid=eq.${enc(callSid)}&select=*`);
  if (!session) return xml(`${say('Sorry, something went wrong.')}<Hangup/>`);
  const c = await businessContext(orgId);
  const heard = String(params.SpeechResult || '').trim(); const digit = String(params.Digits || '').trim();
  const turns = Array.isArray(session.turns) ? session.turns : [];
  const cfg = await dbOne(`voice_configurations?organization_id=eq.${enc(orgId)}&select=transcript_retention_days`);
  turns.push({ at: nowIso(), digits: digit || null, speech: cfg?.transcript_retention_days ? heard.slice(0, 300) : (heard ? '[not retained]' : null) });
  const save = (patch) => dbPatch('voice_call_sessions', `id=eq.${enc(session.id)}&organization_id=eq.${enc(orgId)}`, { turns, ...patch });
  if (CARDISH.test(heard) || CARDISH.test(digit)) { await save({}); return xml(gather(env, 'Please do not share card numbers on this call. Payment is only taken on a secure web page. What service do you need?')); }
  if (digit === '0') { await save({}); return transfer({ c, session, reason: 'caller_pressed_0' }); }
  if (turns.length > MAX_TURNS) { await save({}); return transfer({ c, session, reason: 'turn_limit' }); }
  if (!heard && !digit) { await save({}); return turns.filter((t) => !t.speech && !t.digits).length >= 2 ? transfer({ c, session, reason: 'no_input' }) : xml(gather(env, 'Sorry, I did not hear anything. Which service do you need? Press 0 for a person.')); }

  const contact = await dbOne(`crm_contacts?id=eq.${enc(session.contact_id)}&organization_id=eq.${enc(orgId)}&select=*`);
  // SMS link consent step: the caller must agree to receive the secure link by text.
  if (session.engine_state === 'confirm_text_link') {
    const yes = /^(1|yes|yeah|sure|ok|okay|please|yep)\b/i.test(heard || digit);
    if (!yes) { await save({ engine_state: 'link_declined', outcome: 'callback_created' }); return transfer({ c, session, reason: 'caller_declined_text_link' }); }
    const ctx = session.turns_ctx || {};
    let conv = await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=*`);
    if (!conv) conv = (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: contact.id, channel: 'sms', customer_initiated_at: nowIso() }, { onConflict: 'organization_id,contact_id,channel' })).row || await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.sms&select=*`);
    await dbPatch('wave1_conversations', `id=eq.${enc(conv.id)}&organization_id=eq.${enc(orgId)}`, { customer_initiated_at: nowIso(), engine_state: 'awaiting_completion' });
    const job = await dbOne(`ops_jobs?id=eq.${enc(session.job_id)}&organization_id=eq.${enc(orgId)}&select=*`);
    await dbPatch('ops_jobs', `id=eq.${enc(job.id)}&organization_id=eq.${enc(orgId)}`, { conversation_id: conv.id });
    const sent = await dbOne(`ops_bookings?organization_id=eq.${enc(orgId)}&job_id=eq.${enc(job.id)}&status=eq.held&select=*&order=created_at.desc`);
    const ag = await sendAgreement({ orgId, job: { ...job, conversation_id: conv.id }, booking: sent, actor: { type: 'system', id: 'voice_engine' } });
    if (!ag.ok) { await save({ engine_state: 'escalated', outcome: 'callback_created' }); return transfer({ c, session, reason: ag.reason }); }
    const r = await sendSms({ orgId, conversationId: conv.id, contactId: contact.id, body: `${c.display_name}: review and sign your agreement${job.deposit_cents ? ' and pay the deposit' : ''} here: ${ag.link}`, purpose: 'booking_link', idempotencyKey: `voice-link:${session.id}`, isTest: !!job.is_test });
    await save({ engine_state: 'link_sent', outcome: 'booked_pending_signature' });
    const said = r.status === 'provider_accepted' ? 'I have texted you a secure link to sign and finish booking.' : 'I was not able to text the link, so a team member will follow up with it.';
    return xml(`${say(`${said} Your time is held for ${c.ops.hold_minutes} minutes. Thank you for calling ${c.display_name}.`)}<Hangup/>`);
  }

  const services = await approvedServices(orgId);
  const busy = await busyIntervals(orgId);
  const slotsFor = (key) => { const rule = services.find((s) => s.service_key === key); return rule && c.wave.timezone ? R.generateSlots({ now: new Date(), timeZone: c.wave.timezone, businessHours: c.wave.business_hours, durationMinutes: rule.duration_minutes, bufferMinutes: rule.buffer_minutes, intervalMinutes: c.ops.slot_interval_minutes, leadHours: c.ops.lead_time_hours, horizonDays: c.ops.booking_horizon_days, busy, limit: 3 }) : []; };
  const state = session.engine_state === 'new' ? 'awaiting_service' : session.engine_state;
  const d = R.decide({ state, context: session.turns_ctx || {}, text: heard || digit, services, slotsFor, business: { display_name: c.display_name }, timeZone: c.wave.timezone });
  let conv = await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.voice&select=*`);
  if (!conv) conv = (await dbInsert('wave1_conversations', { organization_id: orgId, contact_id: contact.id, channel: 'voice', customer_initiated_at: nowIso() }, { onConflict: 'organization_id,contact_id,channel' })).row || await dbOne(`wave1_conversations?organization_id=eq.${enc(orgId)}&contact_id=eq.${enc(contact.id)}&channel=eq.voice&select=*`);
  let job = session.job_id ? await dbOne(`ops_jobs?id=eq.${enc(session.job_id)}&organization_id=eq.${enc(orgId)}&select=*`) : await openJobForConversation({ orgId, contact, conversation: conv, channel: 'voice' });
  const actor = { type: 'system', id: 'voice_engine' };
  for (const a of d.actions) {
    if (a.type === 'escalate') { await save({ engine_state: 'escalated', job_id: job.id, turns_ctx: d.context }); if (R.canTransition('job', job.state, 'escalated')) await transition({ orgId, entity: 'job', table: 'ops_jobs', id: job.id, field: 'state', from: job.state, to: 'escalated', actor, reason: a.reason, patch: { escalation_reason: a.reason } }); return a.reason === 'emergency' ? xml(`${say(d.reply)}<Hangup/>`) : transfer({ c, session, reason: a.reason }); }
    if (a.type === 'set_service' || a.type === 'owner_quote') { try { ({ job } = await quoteJob({ orgId, job, serviceKey: a.service_key, actor })); } catch (e) { if (e.status !== 409) throw e; } if (a.type === 'owner_quote') { await save({ engine_state: 'owner_quote', job_id: job.id, turns_ctx: d.context }); return transfer({ c, session, reason: 'owner_quote_required' }); } }
    if (a.type === 'hold_slot') {
      const held = await holdSlot({ orgId, job, slot: a.slot, actor });
      if (!held.ok) { await save({ engine_state: 'awaiting_service', job_id: job.id, turns_ctx: {} }); return xml(gather(env, 'Sorry, that time was just taken. Which service do you need?')); }
      await save({ engine_state: 'confirm_text_link', job_id: job.id, turns_ctx: d.context });
      return xml(gather(env, `I have held ${R.formatSlot(held.booking.start_at, c.wave.timezone)}. May I text you a secure link to review the agreement${job.deposit_cents ? ' and pay the deposit' : ''}? Say yes or press 1.`));
    }
  }
  await save({ engine_state: d.nextState, job_id: job.id, turns_ctx: d.context });
  return xml(gather(env, d.reply || 'Could you say that again?'));
}

export async function handleVoiceAiStatus({ url, params, signature }, env) {
  const v = verify({ url, params, signature }, env); if (!v.ok) return { status: v.status, type: 'application/json', body: { error: 'unauthorized' } };
  const to = normalizePhone(params.To); const settings = to ? await dbOne(`wave1_org_settings?sms_number_ref=eq.${enc(to)}&select=organization_id`) : null;
  if (!settings || !params.CallSid) return xml('');
  const status = String(params.CallStatus || '').toLowerCase();
  if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) {
    await dbPatch('voice_call_sessions', `organization_id=eq.${enc(settings.organization_id)}&provider_call_sid=eq.${enc(params.CallSid)}&ended_at=is.null`, { ended_at: nowIso(), ...(params.CallDuration ? {} : {}) });
  }
  return xml('');
}
