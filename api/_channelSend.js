// Delivers one reply from a client business on one channel. Each sender returns { ok, id } only
// when the provider ACCEPTED the message (accepted is not delivered), and { ok: false, error }
// otherwise. Nothing here decides whether a reply may be sent: that is api/_businessChannels.js.
import crypto from 'node:crypto';
import { twilioRequest } from './_twilio.js';
import { decryptProviderCredentials } from './_providerVault.js';

const GRAPH = (env) => `https://graph.facebook.com/${/^v\d{1,2}\.0$/.test(env.META_GRAPH_VERSION || '') ? env.META_GRAPH_VERSION : 'v21.0'}`;

async function viaTwilio(env, params) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return { ok: false, error: 'twilio_not_configured' };
  try {
    const m = await twilioRequest(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, 'POST', 'Messages.json', params);
    return m?.sid && !['failed', 'undelivered'].includes(m.status) ? { ok: true, id: m.sid } : { ok: false, error: 'provider_rejected' };
  } catch (e) { return { ok: false, error: e.code === 'spending_locked' ? 'spending_locked' : `provider_${e.status || 'error'}` }; }
}

async function viaJson(url, headers, body, read) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `provider_http_${r.status}` };
    const id = read(data);
    return id ? { ok: true, id } : { ok: false, error: 'provider_receipt_missing' };
  } catch { return { ok: false, error: 'provider_result_unknown' }; }
}

// agent: the business_agents row; to: { phone, ref } for this customer.
export function senderFor(channel, agent, to, env = process.env) {
  if (channel === 'web_chat') return async () => ({ ok: true, id: null }); // answered in the same request
  if (channel === 'whatsapp') return (text) => viaTwilio(env, { From: `whatsapp:${agent.whatsapp_number}`, To: `whatsapp:${to.phone}`, Body: text });
  // RCS through the business's Messaging Service: Android phones get RCS, others plain SMS.
  if (channel === 'rcs') return (text) => viaTwilio(env, { MessagingServiceSid: agent.messaging_service_sid, To: to.phone, Body: text });
  if (channel === 'sms') return (text) => viaTwilio(env, { From: agent.phone_number, To: to.phone, Body: text });
  if (channel === 'apple_messages') return (text) => {
    if (!env.CM_PRODUCT_TOKEN) return { ok: false, error: 'apple_provider_not_configured' };
    const reference = crypto.randomUUID();
    return viaJson('https://gw.messaging.cm.com/v1.0/message', { 'X-CM-PRODUCTTOKEN': env.CM_PRODUCT_TOKEN },
      { messages: { msg: [{ from: agent.apple_business_id, to: [{ number: to.ref }], allowedChannels: ['Apple Messages for Business'], body: { type: 'auto', content: text }, reference }] } },
      (d) => (d.errorCode === 0 && d.messages?.[0]?.status === 'Accepted' && d.messages[0].reference === reference ? `cm:${reference}` : null));
  };
  if (channel === 'facebook' || channel === 'instagram') return (text) => {
    let token;
    try { token = decryptProviderCredentials(agent.meta_token_enc, env.CLIENT_SESSION_SECRET).page_token; } catch { return { ok: false, error: 'meta_not_connected' }; }
    if (!token || !agent.meta_page_id) return { ok: false, error: 'meta_not_connected' };
    // Replies only inside Meta's answering window: messaging_type RESPONSE to someone who wrote first.
    return viaJson(`${GRAPH(env)}/${encodeURIComponent(agent.meta_page_id)}/messages`, { Authorization: `Bearer ${token}` },
      // A private reply to a comment goes to the comment; anything else to the person who wrote first.
      { recipient: to.commentId ? { comment_id: to.commentId } : { id: to.ref }, messaging_type: 'RESPONSE', message: { text: text.slice(0, 1000) } }, (d) => d.message_id || null);
  };
  return async () => ({ ok: false, error: 'unknown_channel' });
}
