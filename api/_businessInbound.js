// Facebook Messenger, Instagram and Apple Messages for client businesses (Nova systems 12 and 15).
// Each incoming message is matched to the business that owns the Page, Instagram account or Apple
// Messages ID, then answered through api/_businessChannels.js under the same rules as every channel.
// Nova's own Instagram and Apple accounts keep their existing paths in api/_channelWorkspace.js.
import crypto from 'node:crypto';
import { receiveAndReply } from './_businessChannels.js';
import { senderFor as realSenderFor } from './_channelSend.js';

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
  }
  return handled;
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
