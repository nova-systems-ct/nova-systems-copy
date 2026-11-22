// Facebook Messenger, Instagram and Apple Messages for client businesses (Nova systems 12 and 15).
// Each incoming message is matched to the business that owns the Page, Instagram account or Apple
// Messages ID, then answered through api/_businessChannels.js under the same rules as every channel.
// Nova's own Instagram and Apple accounts keep their existing paths in api/_channelWorkspace.js.
import crypto from 'node:crypto';
import { receiveAndReply, blockedReason } from './_businessChannels.js';
import { senderFor as realSenderFor } from './_channelSend.js';
import { handleChannelTrigger } from './_journey.js';

const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;

export function metaSignatureOk(raw, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

// One verified Meta webhook body. Returns how many messages were taken in.
export async function routeMetaEvent(db, event, { env = process.env, now = new Date(), senderFor = realSenderFor } = {}) {
  const channel = event?.object === 'page' ? 'facebook' : event?.object === 'instagram' ? 'instagram' : null;
  if (!channel) return 0;
  const field = channel === 'facebook' ? 'meta_page_id' : 'instagram_account_id';
  let handled = 0;
  for (const entry of (Array.isArray(event.entry) ? event.entry : []).slice(0, 20)) {
    const account = String(entry?.id || '');
    if (!/^\d{5,30}$/.test(account)) continue;
    const agent = await one(db, 'business_agents', { [field]: account });
    if (!agent) continue;
    for (const m of (Array.isArray(entry.messaging) ? entry.messaging : []).slice(0, 20)) {
      const from = String(m?.sender?.id || '');
      if (m?.message?.is_echo || !m?.message?.mid || typeof m.message.text !== 'string' || String(m.recipient?.id) !== account || !/^\d{5,40}$/.test(from)) continue;
      await receiveAndReply(db, { agent, channel, customerRef: from, messageId: String(m.message.mid).slice(0, 200), text: m.message.text, env, now, send: senderFor(channel, agent, { ref: from }, env) });
      handled++;
    }
    for (const c of (Array.isArray(entry.changes) ? entry.changes : []).slice(0, 20)) if (await commentOffer(db, agent, channel, account, c, { env, now, senderFor })) handled++;
  }
  return handled;
}

// A comment on the business's post (system 15). When the owner has approved an offer for comments,
// the commenter gets ONE private reply with it (Meta allows one per comment) and a request opens
// with the offer attached, so their reply carries on in the same conversation. Without an approved
// offer nothing is sent. Likes never trigger a message.
async function commentOffer(db, agent, channel, account, change, { env, now, senderFor }) {
  const v = change?.value || {};
  const fb = channel === 'facebook' && change?.field === 'feed' && v.item === 'comment' && v.verb === 'add';
  const ig = channel === 'instagram' && change?.field === 'comments';
  const commentId = String((fb ? v.comment_id : v.id) || ''), from = String(v.from?.id || ''), text = fb ? v.message : v.text;
  if ((!fb && !ig) || !/^[\d_]{5,80}$/.test(commentId) || !/^\d{5,40}$/.test(from) || from === account || typeof text !== 'string') return false;
  if (await one(db, 'business_agent_messages', { provider_sid: `${channel}:comment:${commentId}` })) return false; // already handled
  if (await blockedReason(db, agent, channel, null, { env, now })) return false;
  let thread = await one(db, 'business_agent_threads', { agent_id: agent.id, channel, customer_ref: from });
  if (!thread) {
    try { thread = await db.insert('business_agent_threads', { organization_id: agent.organization_id, agent_id: agent.id, channel, customer_ref: from, customer_name: String(v.from?.username || v.from?.name || '').slice(0, 80) || null }); }
    catch (err) { if (err.status !== 409) throw err; thread = await one(db, 'business_agent_threads', { agent_id: agent.id, channel, customer_ref: from }); }
  }
  try { await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'inbound', body: `(comment) ${text.slice(0, 5900)}`, provider_sid: `${channel}:comment:${commentId}`, state: 'received' }); }
  catch (err) { if (err.status === 409) return false; throw err; }
  if (thread.opted_out) return true;
  // The request is keyed like a conversation with this person, so their reply continues it.
  const out = await handleChannelTrigger(db, { orgId: agent.organization_id, channel, type: 'social_comment', eventId: `conv:${channel}:${from}:comment-${commentId}`, handle: String(v.from?.username || v.from?.name || 'Commenter').slice(0, 100), canSend: true, now });
  if (!out.started || !out.send) return true;
  const message = `Thanks for the comment! ${String(out.offer.description).replace(/\.$/, '')}. Use code ${out.offer.code}, or reply here and we will help you book.`;
  let sent;
  try { sent = await senderFor(channel, agent, { ref: from, commentId }, env)(message); } catch { sent = null; }
  await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body: message, provider_sid: sent?.ok && sent.id ? `${channel}:${sent.id}` : null, state: sent?.ok ? 'sent' : 'failed', held_reason: sent?.ok ? null : 'provider_did_not_accept', model: 'offer', estimate_cents: 0 });
  if (sent?.ok) await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { last_outbound_at: now.toISOString() });
  return true;
}

// GET: Meta's subscription check. POST: signed message events.
export async function handleMetaBusiness(req, res, raw, { db, env, now = new Date(), senderFor = realSenderFor }) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const q = req.query || {};
    if (env.META_VERIFY_TOKEN && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === env.META_VERIFY_TOKEN) return res.status(200).send(String(q['hub.challenge'] || '').slice(0, 300));
    return res.status(403).json({ error: 'Verification failed.' });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!env.META_APP_SECRET) return res.status(503).json({ error: 'Business messaging is not configured.' });
  if (!metaSignatureOk(raw, req.headers['x-hub-signature-256'], env.META_APP_SECRET)) return res.status(403).json({ error: 'Invalid signature.' });
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
  try { return res.status(200).json({ received: true, handled: await routeMetaEvent(db, event, { env, now, senderFor }) }); }
  catch (err) { console.error('[meta-business]', err.message); return res.status(500).json({ error: 'Message storage could not be confirmed; retry later.' }); }
}

// An Apple Messages for Business message relayed by CM.com (already authenticated by the caller).
// Returns false when the Apple ID belongs to no client business.
export async function routeAppleBusiness(db, event, { env = process.env, now = new Date(), senderFor = realSenderFor } = {}) {
  const to = String(event?.to?.number || '');
  const agent = to ? await one(db, 'business_agents', { apple_business_id: to }) : null;
  if (!agent) return false;
  const from = String(event.from?.number || '').slice(0, 300);
  const text = typeof event.message?.text === 'string' ? event.message.text : '';
  if (!from || !text.trim() || typeof event.timeUtc !== 'string') return true;
  const id = 'cm:' + crypto.createHash('sha256').update(JSON.stringify([to, from, event.timeUtc, text])).digest('hex');
  await receiveAndReply(db, { agent, channel: 'apple_messages', customerRef: from, messageId: id, text, env, now, send: senderFor('apple_messages', agent, { ref: from }, env) });
  return true;
}
