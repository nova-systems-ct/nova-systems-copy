// Staff side of a client business's calls and messages: reply to a customer on any channel, mark a
// conversation handled, switch channels and call answering on or off, connect a Facebook/Instagram
// page, and issue the premium voice key. Called from api/_businessAgent.js after the caller's
// permission in that organization has been checked.
import { normalizePhone } from './_wave1.js';
import { CHANNELS, blockedReason } from './_businessChannels.js';
import { senderFor as realSenderFor } from './_channelSend.js';
import { encryptProviderCredentials } from './_providerVault.js';
import { newVoiceKey } from './_businessCalls.js';

const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;

// The agent as the dashboard may see it: never the encrypted page token or the voice key hash.
export function safeAgent(agent) {
  if (!agent) return null;
  const { meta_token_enc: token, voice_tool_secret_hash: keyHash, ...rest } = agent;
  return { ...rest, meta_connected: !!token, voice_key_set: !!keyHash };
}

export const REASON_TEXT = {
  customer_opted_out: 'This customer opted out. Nothing was sent.',
  channel_not_on: 'This channel is switched off for the business. Nothing was sent.',
  spending_locked: 'Sending on this channel costs money and spending is switched off. Nothing was sent.',
  no_budget_set: 'Set a monthly spending cap for this business first. Nothing was sent.',
  monthly_budget_reached: 'This month\'s spending cap is reached. Nothing was sent.',
  outside_window: 'This app only allows a reply within 24 hours of the customer\'s last message. Nothing was sent.',
};
// WhatsApp, Facebook and Instagram allow free-form replies only within 24 hours of the customer's last message.
const WINDOW_CHANNELS = new Set(['whatsapp', 'facebook', 'instagram']);

export async function staffReply(db, orgId, { threadId, text, env = process.env, now = new Date(), senderFor = realSenderFor }) {
  const thread = await one(db, 'business_agent_threads', { id: threadId, organization_id: orgId });
  if (!thread) return { status: 404, body: { error: 'Conversation not found.' } };
  const agent = await one(db, 'business_agents', { id: thread.agent_id, organization_id: orgId });
  const body = String(text || '').trim().slice(0, 1000);
  if (!agent || !body) return { status: 422, body: { error: 'Type a reply first.' } };
  if (thread.opted_out) return { status: 409, body: { error: REASON_TEXT.customer_opted_out } };
  const done = async (row) => {
    await db.insert('business_agent_messages', { organization_id: orgId, thread_id: thread.id, direction: 'outbound', body, model: 'staff', ...row });
    if (row.state === 'sent') await db.update('business_agent_threads', { id: thread.id, organization_id: orgId }, { needs_human: false, last_outbound_at: now.toISOString() });
  };
  if (thread.channel === 'web_chat') { await done({ state: 'sent', estimate_cents: 0 }); return { status: 200, body: { ok: true, sent: true } }; } // shown in the visitor's chat
  if (!CHANNELS[thread.channel]) return { status: 422, body: { error: 'Reply to this customer from your own phone.' } };
  if (WINDOW_CHANNELS.has(thread.channel) && (!thread.last_inbound_at || now - new Date(thread.last_inbound_at) > 24 * 3600 * 1000)) return { status: 409, body: { error: REASON_TEXT.outside_window } };
  const blocked = await blockedReason(db, agent, thread.channel, thread, { env, now });
  if (blocked) return { status: 409, body: { error: REASON_TEXT[blocked] || 'Nothing was sent.' } };
  let out;
  try { out = await senderFor(thread.channel, agent, { phone: thread.customer_phone, ref: thread.customer_ref }, env)(body); } catch { out = null; }
  if (!out?.ok) { await done({ state: 'failed', held_reason: 'provider_did_not_accept' }); return { status: 502, body: { error: 'The provider did not accept the message. Nothing was sent.' } }; }
  await done({ state: 'sent', provider_sid: out.id ? (thread.channel === 'sms' ? out.id : `${thread.channel}:${out.id}`) : null, estimate_cents: CHANNELS[thread.channel].estimate });
  return { status: 200, body: { ok: true, sent: true } };
}

export async function markHandled(db, orgId, threadId) {
  const rows = await db.update('business_agent_threads', { id: threadId, organization_id: orgId }, { needs_human: false });
  return rows.length ? { status: 200, body: { ok: true } } : { status: 404, body: { error: 'Conversation not found.' } };
}

const CALL_MODES = new Set(['off', 'forward_only', 'forward_then_assistant', 'assistant_first']);
const bool = (v) => v === true;
// Channel and call settings. Only the fields present in the request change, so a screen that does
// not know a field can never switch it off. Returns { patch } or { error }.
export function channelPatch(b, existing = {}) {
  const patch = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (has('call_mode')) { if (!CALL_MODES.has(b.call_mode)) return { error: 'Choose how calls are answered.' }; patch.call_mode = b.call_mode; patch.voice_enabled = b.call_mode !== 'off'; }
  if (has('forward_phone')) { const p = b.forward_phone ? normalizePhone(b.forward_phone) : null; if (b.forward_phone && !p) return { error: 'Enter the phone to ring with its area code, for example +12035551234.' }; patch.forward_phone = p; }
  if (has('ring_seconds')) { const n = Number(b.ring_seconds); if (!Number.isInteger(n) || n < 5 || n > 60) return { error: 'Ring time must be 5 to 60 seconds.' }; patch.ring_seconds = n; }
  if (has('missed_call_text')) patch.missed_call_text = bool(b.missed_call_text);
  for (const k of ['web_chat_enabled', 'whatsapp_enabled', 'rcs_enabled', 'apple_enabled', 'facebook_enabled', 'instagram_enabled']) if (has(k)) patch[k] = bool(b[k]);
  if (has('whatsapp_number')) { const p = b.whatsapp_number ? normalizePhone(String(b.whatsapp_number).replace(/^whatsapp:/, '')) : null; if (b.whatsapp_number && !p) return { error: 'Enter the approved WhatsApp number with its area code.' }; patch.whatsapp_number = p; }
  if (has('messaging_service_sid')) { const v = String(b.messaging_service_sid || '').trim(); if (v && !/^MG[0-9a-fA-F]{32}$/.test(v)) return { error: 'The Messaging Service SID starts with MG followed by 32 letters and numbers.' }; patch.messaging_service_sid = v || null; }
  if (has('apple_business_id')) { const v = String(b.apple_business_id || '').trim(); if (v && !/^[A-Za-z0-9._:-]{3,100}$/.test(v)) return { error: 'Enter the Apple Messages for Business ID exactly as given.' }; patch.apple_business_id = v || null; }
  for (const k of ['meta_page_id', 'instagram_account_id']) if (has(k)) { const v = String(b[k] || '').trim(); if (v && !/^\d{5,30}$/.test(v)) return { error: k === 'meta_page_id' ? 'The Facebook Page ID is a number.' : 'The Instagram account ID is a number.' }; patch[k] = v || null; }
  if (has('ai_enabled')) patch.ai_enabled = bool(b.ai_enabled);
  if (has('ai_provider')) { if (![null, '', 'anthropic', 'openai', 'google'].includes(b.ai_provider ?? null)) return { error: 'Choose Claude, GPT or Gemini.' }; patch.ai_provider = b.ai_provider || null; }
  if (has('faq')) { const v = String(b.faq || '').trim(); if (v.length > 4000) return { error: 'Keep your answers under 4,000 characters.' }; patch.faq = v || null; }
  if (has('voice_provider')) { if (![null, '', 'elevenlabs'].includes(b.voice_provider ?? null)) return { error: 'Choose the standard assistant or premium voice.' }; patch.voice_provider = b.voice_provider || null; }
  if (has('voice_provider_agent_id')) { const v = String(b.voice_provider_agent_id || '').trim(); if (v && !/^[A-Za-z0-9_-]{8,100}$/.test(v)) return { error: 'Enter the premium voice agent ID exactly as given.' }; patch.voice_provider_agent_id = v || null; }

  const next = { ...existing, ...patch };
  if (next.call_mode && next.call_mode !== 'off' && !next.phone_number) return { error: 'Add the business phone number before answering calls.' };
  if (['forward_only', 'forward_then_assistant'].includes(next.call_mode) && !next.forward_phone) return { error: 'Add the phone to ring first.' };
  if (next.forward_phone && next.forward_phone === next.phone_number) return { error: 'The phone to ring must be different from the business number.' };
  if (next.whatsapp_enabled && !next.whatsapp_number) return { error: 'Add the approved WhatsApp number before switching WhatsApp on.' };
  if (next.rcs_enabled && !next.messaging_service_sid) return { error: 'Add the Messaging Service SID before switching RCS on.' };
  if (next.apple_enabled && !next.apple_business_id) return { error: 'Add the Apple Messages for Business ID before switching it on.' };
  if (next.facebook_enabled && (!next.meta_page_id || !next.meta_token_enc)) return { error: 'Connect the Facebook Page first.' };
  if (next.instagram_enabled && (!next.instagram_account_id || !next.meta_page_id || !next.meta_token_enc)) return { error: 'Connect the Facebook Page linked to the Instagram account first.' };
  if (next.voice_provider === 'elevenlabs' && !next.voice_provider_agent_id) return { error: 'Add the premium voice agent ID first.' };
  return { patch };
}

export async function saveChannels(db, orgId, b) {
  const existing = await one(db, 'business_agents', { organization_id: orgId });
  if (!existing) return { status: 404, body: { error: 'Set up the business assistant first.' } };
  const { patch, error } = channelPatch(b, existing);
  if (error) return { status: 400, body: { error } };
  if (!Object.keys(patch).length) return { status: 200, body: { ok: true, agent: safeAgent(existing) } };
  try {
    const rows = await db.update('business_agents', { id: existing.id, organization_id: orgId }, { ...patch, updated_at: new Date().toISOString() });
    return { status: 200, body: { ok: true, agent: safeAgent(rows[0] || { ...existing, ...patch }) } };
  } catch (err) {
    if (err.status === 409) return { status: 409, body: { error: 'That number or account already belongs to another business.' } };
    throw err;
  }
}

// The Facebook Page access token (it also answers Instagram messages for the page's linked
// Instagram account). Stored encrypted; never shown again.
export async function connectMeta(db, orgId, b, env = process.env) {
  const existing = await one(db, 'business_agents', { organization_id: orgId });
  if (!existing) return { status: 404, body: { error: 'Set up the business assistant first.' } };
  if (b.disconnect === true) {
    const rows = await db.update('business_agents', { id: existing.id, organization_id: orgId }, { meta_token_enc: null, facebook_enabled: false, instagram_enabled: false });
    return { status: 200, body: { ok: true, agent: safeAgent(rows[0]) } };
  }
  const token = String(b.page_token || '').trim();
  if (!/^[A-Za-z0-9_-]{20,1000}$/.test(token)) return { status: 400, body: { error: 'Paste the Page access token exactly as Meta shows it.' } };
  if (!env.CLIENT_SESSION_SECRET) return { status: 503, body: { error: 'The server cannot store connections yet (missing encryption key).' } };
  const rows = await db.update('business_agents', { id: existing.id, organization_id: orgId }, { meta_token_enc: encryptProviderCredentials({ page_token: token }, env.CLIENT_SESSION_SECRET) });
  return { status: 200, body: { ok: true, agent: safeAgent(rows[0]) } };
}

export async function issueVoiceKey(db, orgId) {
  try {
    const key = await newVoiceKey(db, orgId);
    return { status: 200, body: { ok: true, key, header: 'X-Nova-Voice-Key', tools: ['services', 'open_times', 'send_link', 'hand_to_person'].map((t) => ({ name: t, url: `https://nova-systems.app/webhooks/voice-tools/${t}` })) } };
  } catch (err) { if (err.status === 404) return { status: 404, body: { error: err.message } }; throw err; }
}

export async function callLog(db, orgId) {
  const calls = await db.select('business_calls', { organization_id: orgId }, { order: 'started_at.desc', limit: 50 });
  return calls.map(({ id, call_sid: _sid, ...c }) => ({ id, ...c }));
}
