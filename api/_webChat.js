// Website chat for a client business (Nova system 10): a chat box on the business's own website and
// on its Nova page (/b/<slug>). Replies come from the journey rules through api/_businessChannels.js,
// so the chat states only what is on file, costs nothing to answer, and passes anything else to a
// person, whose reply then appears in the same chat. A visitor is known only by a random key kept in
// their own browser; the server stores a hash of it.
import crypto from 'node:crypto';
import { receiveAndReply } from './_businessChannels.js';
import { senderFor } from './_channelSend.js';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const KEY_RE = /^[0-9a-f]{64}$/;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
export const visitorRef = (key) => `v_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
const NOT_HERE = { status: 404, body: { error: 'Chat is not available for this business.' } };

async function chatBusiness(db, slug) {
  if (!SLUG_RE.test(String(slug || ''))) return null;
  const org = await one(db, 'organizations', { slug });
  if (!org || (org.status && org.status !== 'active')) return null;
  const agent = await one(db, 'business_agents', { organization_id: org.id });
  return agent ? { org, agent } : null;
}
export const chatIsOpen = (agent) => !!agent && agent.status === 'active' && agent.web_chat_enabled === true;

export async function chatOpen(db, slug) {
  const found = await chatBusiness(db, slug);
  if (!found) return NOT_HERE;
  const name = found.agent.business_name || found.org.name || 'this business';
  const open = chatIsOpen(found.agent);
  return { status: 200, body: { ok: true, open, business: { name }, greeting: open ? `Hi! How can ${name} help you today? Ask about a service or tell us what you need for a quote.` : null } };
}

export async function chatSend(db, { slug, key, messageId, text, name, env = process.env, now = new Date() }) {
  const found = await chatBusiness(db, slug);
  if (!found) return NOT_HERE;
  if (!KEY_RE.test(String(key || '')) || !ID_RE.test(String(messageId || ''))) return { status: 400, body: { error: 'Please reload the chat and try again.' } };
  const body = String(text || '').trim().slice(0, 1000);
  if (!body) return { status: 422, body: { error: 'Type a message first.' } };
  if (!chatIsOpen(found.agent)) return { status: 409, body: { error: 'Chat is not available right now.' } };
  const out = await receiveAndReply(db, { agent: found.agent, channel: 'web_chat', customerRef: visitorRef(key), messageId: String(messageId).toLowerCase(), text: body, name: String(name || '').trim().slice(0, 80) || 'Website visitor', env, now, send: senderFor('web_chat') });
  return { status: 200, body: { ok: true, reply: out.reply || null, passed_to_team: !out.reply && ['held', 'handed_to_person', 'failed'].includes(out.state) } };
}

// The visitor's own conversation: their messages, the assistant's replies and the team's replies.
export async function chatHistory(db, { slug, key }) {
  const found = await chatBusiness(db, slug);
  if (!found) return NOT_HERE;
  if (!KEY_RE.test(String(key || ''))) return { status: 400, body: { error: 'Please reload the chat and try again.' } };
  const thread = await one(db, 'business_agent_threads', { agent_id: found.agent.id, channel: 'web_chat', customer_ref: visitorRef(key) });
  if (!thread) return { status: 200, body: { ok: true, messages: [] } };
  const rows = await db.select('business_agent_messages', { thread_id: thread.id, organization_id: found.agent.organization_id }, { order: 'created_at.desc', limit: 80 });
  const messages = rows.filter((m) => m.direction === 'inbound' || m.state === 'sent').slice(0, 60).reverse()
    .map((m) => ({ id: m.id, from: m.direction === 'inbound' ? 'you' : m.model === 'staff' ? 'team' : 'assistant', text: m.body, at: m.created_at }));
  return { status: 200, body: { ok: true, messages } };
}
