// Every message channel a client business answers on, in one place: website chat, texts sent
// through a Messaging Service (RCS with SMS fallback), WhatsApp, Apple Messages, Instagram and
// Facebook. One customer = one conversation per channel. (Plain texts to the business number keep
// their own tested path in api/_businessAgent.js.)
//
// Replies come from the journey rules (api/_conversation.js): free, exact, and never a price, time
// or term that is not on file. What the rules cannot answer is passed to a person.
//
// A reply is sent only when ALL of these hold; otherwise the message is saved, a person is
// flagged, and nothing is sent:
//   1. the business is active and this channel is switched on for it,
//   2. the customer has not opted out,
//   3. for channels that cost money (texts, RCS, WhatsApp, Apple): the global spending switch is
//      on, the business has a monthly cap, and this month's planned spend stays under it.
import { classifyInboundKeyword } from './_wave1.js';
import { billableDispatchEnabled } from './_spendingPolicy.js';
import { converse } from './_conversation.js';

// Planned cost of one reply, in cents. Used only to keep a business under its cap; not a bill.
// Revisit once real provider invoices exist.
export const CHANNELS = {
  sms:            { name: 'Text message',     field: 'sms_enabled',       paid: true,  estimate: 2 },
  web_chat:       { name: 'Website chat',     field: 'web_chat_enabled',  paid: false, estimate: 0 },
  rcs:            { name: 'RCS / text',       field: 'rcs_enabled',       paid: true,  estimate: 2 },
  whatsapp:       { name: 'WhatsApp',         field: 'whatsapp_enabled',  paid: true,  estimate: 2 },
  apple_messages: { name: 'Apple Messages',   field: 'apple_enabled',     paid: true,  estimate: 2 },
  instagram:      { name: 'Instagram',        field: 'instagram_enabled', paid: false, estimate: 0 },
  facebook:       { name: 'Facebook Messenger', field: 'facebook_enabled', paid: false, estimate: 0 },
};
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
// On phone channels the carrier/Twilio answers STOP, START and HELP; the assistant stays silent.
// Elsewhere HELP is just a question, and STOP/START get a short confirmation in website chat.
const PHONE_CHANNELS = new Set(['rcs', 'whatsapp']);
// The full carrier opt-out list (STOP, CANCEL, END, QUIT...) belongs to phone-number channels. In
// website chat and app messaging a customer typing "cancel" means "cancel my booking", so only
// an explicit stop word turns replies off there; CANCEL, END and QUIT reach the booking worker.
const CARRIER_CHANNELS = new Set(['sms', ...PHONE_CHANNELS]);
const EXPLICIT_STOP = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE']);
export function keywordFor(channel, body) {
  const raw = classifyInboundKeyword(body);
  if (CARRIER_CHANNELS.has(channel)) return raw;
  if (raw === 'help') return 'message'; // elsewhere HELP is just a question
  if (raw === 'opt_out' && !EXPLICIT_STOP.has(String(body || '').trim().toUpperCase().replace(/[^A-Z]/g, ''))) return 'message';
  return raw;
}
export const CHAT_STOPPED = 'Okay. This chat will not send you any more messages. Type START if you want to chat again.';
export const CHAT_RESTARTED = 'You are back on. What can we help you with?';

// What this business has spent (planned) this calendar month on replies and calls.
export async function monthSpendCents(db, orgId, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [msgs, calls] = await Promise.all([
    db.select('business_agent_messages', { organization_id: orgId, direction: 'outbound', state: 'sent', created_at: { gte: monthStart } }, { limit: 5000 }),
    db.select('business_calls', { organization_id: orgId, started_at: { gte: monthStart } }, { limit: 5000 }),
  ]);
  return msgs.reduce((n, m) => n + (m.estimate_cents || 0), 0) + calls.reduce((n, c) => n + (c.estimate_cents || 0), 0);
}

// Why this business may not spend `cents` more right now; '' when it may.
export async function spendBlocked(db, agent, cents, { env = process.env, now = new Date() } = {}) {
  if (!billableDispatchEnabled(env)) return 'spending_locked';
  if (!Number.isInteger(agent.monthly_spend_cap_cents) || agent.monthly_spend_cap_cents < 1) return 'no_budget_set';
  if ((await monthSpendCents(db, agent.organization_id, now)) + cents > agent.monthly_spend_cap_cents) return 'monthly_budget_reached';
  return '';
}

// Why the business may not reply on this channel right now; '' when it may.
export async function blockedReason(db, agent, channel, thread, { env = process.env, now = new Date(), extraCents = 0 } = {}) {
  const ch = CHANNELS[channel];
  if (!ch) return 'unknown_channel';
  if (thread?.opted_out) return 'customer_opted_out';
  if (agent.status !== 'active' || agent[ch.field] !== true) return 'channel_not_on';
  if (ch.paid || extraCents > 0) return spendBlocked(db, agent, ch.estimate + extraCents, { env, now });
  return '';
}

async function ensureThread(db, agent, channel, customerRef, { phone, name }) {
  const found = await one(db, 'business_agent_threads', { agent_id: agent.id, channel, customer_ref: customerRef });
  if (found) return found;
  try { return await db.insert('business_agent_threads', { organization_id: agent.organization_id, agent_id: agent.id, channel, customer_ref: customerRef, customer_phone: phone || null, customer_name: name || null }); }
  catch (err) { if (err.status === 409) return one(db, 'business_agent_threads', { agent_id: agent.id, channel, customer_ref: customerRef }); throw err; }
}

// One customer message on one channel. `send(text)` delivers the reply through the provider and
// returns { ok, id } only when the provider accepted it (website chat answers in the same request).
// Returns { reply, state, held_reason, journey_id }. A repeated delivery returns { repeated: true }.
export async function receiveAndReply(db, { agent, channel, customerRef, messageId, text, name, phone, email, env = process.env, now = new Date(), send }) {
  const body = String(text || '').slice(0, 6000);
  const ref = String(customerRef || '').slice(0, 300);
  if (!CHANNELS[channel] || !ref || !messageId || !body.trim()) return { reply: null, state: 'ignored' };
  const providerId = `${channel}:${String(messageId).slice(0, 200)}`;
  if (await one(db, 'business_agent_messages', { provider_sid: providerId })) return { reply: null, state: 'repeated', repeated: true };

  let thread = await ensureThread(db, agent, channel, ref, { phone, name });
  const keyword = keywordFor(channel, body);
  const patch = { last_inbound_at: now.toISOString(), ...(keyword === 'opt_out' ? { opted_out: true } : keyword === 'opt_in' ? { opted_out: false } : {}) };
  thread = (await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, patch))[0] || { ...thread, ...patch };
  try { await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'inbound', body, provider_sid: providerId, state: 'received' }); }
  catch (err) { if (err.status === 409) return { reply: null, state: 'repeated', repeated: true }; throw err; }

  const hold = async (reason) => {
    await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { needs_human: true });
    await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: '(no reply sent)', state: 'held', held_reason: reason });
    return { reply: null, state: 'held', held_reason: reason, thread_id: thread.id };
  };
  if ((keyword === 'opt_out' || keyword === 'opt_in') && channel === 'web_chat') {
    const reply = keyword === 'opt_out' ? CHAT_STOPPED : CHAT_RESTARTED; // shown in the same request; costs nothing
    await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: reply, state: 'sent', model: 'keyword', estimate_cents: 0 });
    return { reply, state: keyword === 'opt_out' ? 'opted_out' : 'opted_in', thread_id: thread.id };
  }
  if (keyword === 'opt_out') return { reply: null, state: 'opted_out', thread_id: thread.id }; // STOP is never argued with
  if (keyword !== 'message') return { reply: null, state: 'keyword', thread_id: thread.id };

  const blocked = await blockedReason(db, agent, channel, thread, { env, now });
  if (blocked) return hold(blocked);

  let out;
  // A question the rules cannot answer goes to the business's AI first, when it is switched on
  // (api/_aiReply.js); any answer that fails its checks falls through to the rules below.
  if (agent.ai_enabled === true) {
    let ai = null;
    try { const { aiFirst } = await import('./_aiReply.js'); ai = await aiFirst(db, agent, { text: body, channel, customerKey: `${channel}:${ref}`, env, now, extraCents: CHANNELS[channel].paid ? CHANNELS[channel].estimate : 0 }); } catch { ai = null; }
    if (ai?.reply) {
      let sent;
      try { sent = await send(ai.reply); } catch { sent = { ok: false }; }
      const ok = !!sent?.ok;
      await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: ai.reply, provider_sid: ok && sent.id ? `${channel}:${sent.id}` : null, state: ok ? 'sent' : 'failed', held_reason: ok ? null : 'provider_did_not_accept', model: `ai:${ai.provider}`, estimate_cents: ok ? CHANNELS[channel].estimate + ai.estimate_cents : 0 });
      await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, ok ? { last_outbound_at: now.toISOString() } : { needs_human: true });
      return ok ? { reply: ai.reply, state: 'sent', ai: ai.provider, thread_id: thread.id } : { reply: null, state: 'failed', held_reason: 'provider_did_not_accept', thread_id: thread.id };
    }
  }
  try { out = await converse(db, { orgId: agent.organization_id, channel, customerKey: `${channel}:${ref}`, phone, email, name, messageId: providerId, text: body, timezone: agent.timezone || 'America/New_York', now }); }
  catch { return hold('reply_could_not_be_written'); }
  if (!out.journey_id) return hold('no_services_published');
  if (out.handed_to_person) await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { needs_human: true });
  if (!out.reply) return { reply: null, state: out.repeated ? 'repeated' : 'handed_to_person', journey_id: out.journey_id, thread_id: thread.id };

  let sent;
  try { sent = await send(out.reply); } catch { sent = { ok: false }; }
  if (!sent?.ok) {
    await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: out.reply, state: 'failed', held_reason: 'provider_did_not_accept', model: 'journey_rules' });
    await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { needs_human: true });
    return { reply: null, state: 'failed', held_reason: 'provider_did_not_accept', journey_id: out.journey_id, thread_id: thread.id };
  }
  await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: out.reply, provider_sid: sent.id ? `${channel}:${sent.id}` : null, state: 'sent', model: 'journey_rules', estimate_cents: CHANNELS[channel].estimate });
  await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { last_outbound_at: new Date().toISOString() });
  return { reply: out.reply, state: 'sent', journey_id: out.journey_id, thread_id: thread.id };
}

// ---- Twilio: WhatsApp and RCS to a client business ----------------------------------------
// The caller (api/_unifiedTwilio.js) has ALREADY verified Twilio's signature and account.
// Returns true when the message belonged to a client business (and was handled), else false.
// Plain texts to a business number keep their own path (findAgentByNumber + handleBusinessSms).
export async function routeTwilioBusinessMessage(db, p, env, { normalizePhone, senderFor, now = new Date() }) {
  const to = String(p.To || ''), from = String(p.From || '');
  let agent = null, channel = null;
  if (to.startsWith('whatsapp:') && to !== env.TWILIO_WHATSAPP_FROM) {
    const number = normalizePhone(to.slice(9));
    if (number) { agent = await one(db, 'business_agents', { whatsapp_number: number }); channel = 'whatsapp'; }
  } else if (to !== env.TWILIO_PHONE_NUMBER && /^MG[0-9a-fA-F]{32}$/.test(String(p.MessagingServiceSid || ''))) {
    // RCS (and the plain-text fallback) arrives through the business's own Messaging Service.
    agent = await one(db, 'business_agents', { messaging_service_sid: p.MessagingServiceSid }); channel = 'rcs';
  }
  if (!agent) return false;
  const phone = normalizePhone(from.replace(/^(whatsapp|rcs):/, ''));
  if (!phone || !/^[A-Z]{2}[0-9a-fA-F]{32}$/.test(String(p.MessageSid || '')) || typeof p.Body !== 'string' || !p.Body.trim()) return true;
  await receiveAndReply(db, { agent, channel, customerRef: phone, phone, messageId: p.MessageSid, text: p.Body, env, now, send: senderFor(channel, agent, { phone, ref: phone }, env) });
  return true;
}
