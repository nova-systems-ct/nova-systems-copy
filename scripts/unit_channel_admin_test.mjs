// Website chat (api/_webChat.js), staff replies and channel settings (api/_channelAdmin.js), and
// Facebook/Instagram/Apple messages for client businesses (api/_businessInbound.js). In-memory store
// and stubbed providers; nothing is sent and no database or network is contacted.
import crypto from 'node:crypto';
import { chatOpen, chatSend, chatHistory, visitorRef } from '../api/_webChat.js';
import { staffReply, markHandled, channelPatch, saveChannels, connectMeta, issueVoiceKey, callLog, safeAgent } from '../api/_channelAdmin.js';
import { routeMetaEvent, metaSignatureOk, routeAppleBusiness } from '../api/_businessInbound.js';
import { decryptProviderCredentials } from '../api/_providerVault.js';
import { siteFor } from '../api/_site.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-16T15:00:00Z');
const PAID_ON = { NOVA_SPENDING_LOCK: 'disabled', NOVA_BILLABLE_DISPATCH_ENABLED: 'true' };
const SECRET = 's'.repeat(40);
const UNIQUE = { journeys: [['organization_id', 'source_channel', 'source_event_id']], journey_events: [['idempotency_key']], journey_documents: [['journey_id', 'kind', 'seq']],
  business_agent_threads: [['agent_id', 'channel', 'customer_ref']], business_agent_messages: [['provider_sid']] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const hex = (n) => crypto.randomBytes(n).toString('hex');

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : v && typeof v === 'object' && 'gte' in v ? r[k] >= v.gte : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => {
      for (const u of UNIQUE[n] || []) if (u.every((k) => row[k] != null) && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 });
      const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length * 1000).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => {
      if (n === 'business_agents' && ['whatsapp_number', 'messaging_service_sid'].some((k) => patch[k] && rows(n).some((r) => r[k] === patch[k] && !hit(r, f)))) throw Object.assign(new Error('conflict'), { status: 409 });
      return rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })); } };
}
const db = memoryDb();
await db.insert('organizations', { id: ORG, slug: 'green-lawns', name: 'Green Lawns', status: 'active' });
await db.insert('organizations', { id: OTHER, slug: 'smile-dental', name: 'Smile Dental', status: 'active' });
await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, terms_text: 'Pay the balance on the day.', terms_approved: true, active: true });
await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: ['teeth'], price_cents: 9000, price_approved: true, active: true });
const agent = await db.insert('business_agents', { organization_id: ORG, business_name: 'Green Lawns', status: 'active', phone_number: '+12035550100', sms_enabled: true, web_chat_enabled: true, monthly_spend_cap_cents: 500, call_mode: 'off' });
const other = await db.insert('business_agents', { organization_id: OTHER, business_name: 'Smile Dental', status: 'active', phone_number: '+12035550200', web_chat_enabled: false, whatsapp_number: '+12035550299', monthly_spend_cap_cents: 500 });
const sent = [];
const fakeSender = (ok = true) => (channel, a, to) => async (text) => { sent.push({ channel, agent: a.id, to, text }); return ok ? { ok: true, id: 'X' + hex(8) } : { ok: false }; };

// ---- website chat ------------------------------------------------------------------------------
const KEY = hex(32), KEY2 = hex(32);
let r = await chatOpen(db, 'green-lawns');
check('chat opens for a business with website chat on, with a greeting in its name', r.status === 200 && r.body.open === true && r.body.business.name === 'Green Lawns' && /Green Lawns/.test(r.body.greeting));
r = await chatOpen(db, 'smile-dental');
check('chat shows as closed for a business that has not switched it on', r.status === 200 && r.body.open === false && r.body.greeting === null);
r = await chatOpen(db, 'no-such-business');
check('an unknown business has no chat', r.status === 404);
const say = (text, key = KEY, id = crypto.randomUUID(), slug = 'green-lawns') => chatSend(db, { slug, key, messageId: id, text, env: {}, now: NOW });
r = await say('hi');
check('a visitor gets an instant answer from the business\'s own records', r.status === 200 && /Lawn mowing/.test(r.body.reply) && !/Teeth/.test(r.body.reply));
const tid = crypto.randomUUID();
await say('1', KEY, tid);
r = await say('1', KEY, tid);
check('the same message sent twice is answered once', r.status === 200 && r.body.reply === null && db.t.business_agent_messages.filter((m) => m.provider_sid === `web_chat:${tid}`).length === 1);
r = await say('hello', 'not-a-key');
check('a malformed visitor key is refused', r.status === 400);
r = await say('hello', KEY, 'not-an-id');
check('a malformed message id is refused', r.status === 400);
r = await say('   ');
check('an empty message is refused', r.status === 422);
r = await say('hi', KEY, crypto.randomUUID(), 'smile-dental');
check('a business with chat off takes no chat messages', r.status === 409);
let h = await chatHistory(db, { slug: 'green-lawns', key: KEY });
check('the visitor sees their own conversation, in order', h.status === 200 && h.body.messages.map((m) => m.from).join() === 'you,assistant,you,assistant' && h.body.messages[0].text === 'hi');
h = await chatHistory(db, { slug: 'green-lawns', key: KEY2 });
check('another visitor sees nothing of it', h.body.messages.length === 0);
check('the server keeps only a hash of the visitor key', db.t.business_agent_threads.some((t) => t.customer_ref === visitorRef(KEY)) && !JSON.stringify(db.t).includes(KEY));
r = await say('Can I talk to a person?');
check('asking for a person flags the conversation and says the team will reply', /team member/i.test(r.body.reply || '') && db.t.business_agent_threads.find((t) => t.customer_ref === visitorRef(KEY)).needs_human === true);
const chatThread = db.t.business_agent_threads.find((t) => t.customer_ref === visitorRef(KEY));

// ---- staff replies --------------------------------------------------------------------------------
r = await staffReply(db, ORG, { threadId: chatThread.id, text: 'Hi, this is Dana from Green Lawns. Thursday works.', env: {}, now: NOW, senderFor: fakeSender() });
h = await chatHistory(db, { slug: 'green-lawns', key: KEY });
check('a team reply to a website chat appears in the visitor\'s chat, marked as the team', r.status === 200 && h.body.messages.at(-1).from === 'team' && /Dana/.test(h.body.messages.at(-1).text) && sent.length === 0);
check('replying marks the conversation handled', db.t.business_agent_threads.find((t) => t.id === chatThread.id).needs_human === false);
r = await staffReply(db, OTHER, { threadId: chatThread.id, text: 'hi', env: {}, now: NOW, senderFor: fakeSender() });
check('another business cannot reply in this conversation', r.status === 404);
const smsThread = await db.insert('business_agent_threads', { organization_id: ORG, agent_id: agent.id, channel: 'sms', customer_phone: '+18605550101', customer_ref: '+18605550101', opted_out: false, last_inbound_at: NOW.toISOString() });
r = await staffReply(db, ORG, { threadId: smsThread.id, text: 'On our way', env: {}, now: NOW, senderFor: fakeSender() });
check('a text reply under the $0 lock is refused with a plain reason, nothing sent', r.status === 409 && /spending is switched off/.test(r.body.error) && sent.length === 0);
r = await staffReply(db, ORG, { threadId: smsThread.id, text: 'On our way', env: PAID_ON, now: NOW, senderFor: fakeSender() });
const smsSent = db.t.business_agent_messages.find((m) => m.thread_id === smsThread.id && m.model === 'staff');
check('a text reply with spending on goes out from the business and counts toward its cap', r.status === 200 && sent.at(-1).channel === 'sms' && sent.at(-1).to.phone === '+18605550101' && smsSent.state === 'sent' && smsSent.estimate_cents === 2);
r = await staffReply(db, ORG, { threadId: smsThread.id, text: 'again', env: PAID_ON, now: NOW, senderFor: fakeSender(false) });
check('a reply the provider refuses is marked failed and reported', r.status === 502 && db.t.business_agent_messages.some((m) => m.thread_id === smsThread.id && m.state === 'failed'));
const waThread = await db.insert('business_agent_threads', { organization_id: ORG, agent_id: agent.id, channel: 'whatsapp', customer_phone: '+18605550101', customer_ref: '+18605550101', last_inbound_at: new Date(NOW.getTime() - 25 * 3600 * 1000).toISOString() });
r = await staffReply(db, ORG, { threadId: waThread.id, text: 'hello', env: PAID_ON, now: NOW, senderFor: fakeSender() });
check('WhatsApp/Facebook/Instagram: no reply more than 24 hours after the customer\'s last message', r.status === 409 && /24 hours/.test(r.body.error));
db.t.business_agent_threads.find((t) => t.id === smsThread.id).opted_out = true;
r = await staffReply(db, ORG, { threadId: smsThread.id, text: 'hello?', env: PAID_ON, now: NOW, senderFor: fakeSender() });
check('a customer who opted out is never messaged, even by a person', r.status === 409 && /opted out/.test(r.body.error));
db.t.business_agent_threads.find((t) => t.id === chatThread.id).needs_human = true;
r = await markHandled(db, ORG, chatThread.id);
check('"handled" clears the flag', r.status === 200 && db.t.business_agent_threads.find((t) => t.id === chatThread.id).needs_human === false);
r = await markHandled(db, OTHER, chatThread.id);
check('another business cannot mark it handled', r.status === 404);

// ---- channel and call settings -------------------------------------------------------------------
check('settings: an unknown call mode is refused', !!channelPatch({ call_mode: 'always' }, agent).error);
check('settings: forwarding needs a phone to ring', /phone to ring/.test(channelPatch({ call_mode: 'forward_only' }, agent).error || ''));
check('settings: the phone to ring cannot be the business number (no loop)', /different/.test(channelPatch({ call_mode: 'forward_only', forward_phone: '+12035550100' }, agent).error || ''));
check('settings: ring time is 5 to 60 seconds', !!channelPatch({ ring_seconds: 90 }, agent).error && !!channelPatch({ ring_seconds: 2.5 }, agent).error);
check('settings: WhatsApp needs its approved number first', /WhatsApp number/.test(channelPatch({ whatsapp_enabled: true }, agent).error || ''));
check('settings: RCS needs a real Messaging Service SID', !!channelPatch({ messaging_service_sid: 'MG123' }, agent).error && /SID/.test(channelPatch({ rcs_enabled: true }, agent).error || ''));
check('settings: Facebook needs a connected Page', /Connect the Facebook Page/.test(channelPatch({ facebook_enabled: true, meta_page_id: '1234567890' }, agent).error || ''));
check('settings: premium voice needs its agent ID', /agent ID/.test(channelPatch({ voice_provider: 'elevenlabs' }, agent).error || ''));
check('settings: calls need the business number', /business phone number/.test(channelPatch({ call_mode: 'assistant_first' }, { ...agent, phone_number: null }).error || ''));
const okPatch = channelPatch({ call_mode: 'forward_then_assistant', forward_phone: '(203) 555-0111', ring_seconds: '25', missed_call_text: true }, agent);
check('settings: a good call setup is normalized and keeps the old voice switch in step', !okPatch.error && okPatch.patch.forward_phone === '+12035550111' && okPatch.patch.ring_seconds === 25 && okPatch.patch.voice_enabled === true);
check('settings: only fields that were sent change', Object.keys(channelPatch({ web_chat_enabled: false }, agent).patch).join() === 'web_chat_enabled');
r = await saveChannels(db, ORG, { whatsapp_enabled: true, whatsapp_number: 'whatsapp:+12035550299' });
check('settings: a sender that belongs to another business is refused', r.status === 409);
r = await saveChannels(db, ORG, { call_mode: 'forward_then_assistant', forward_phone: '+12035550111', missed_call_text: true, whatsapp_enabled: true, whatsapp_number: '+12035550188' });
check('settings: saved for this business only', r.status === 200 && r.body.agent.call_mode === 'forward_then_assistant' && r.body.agent.whatsapp_enabled === true && db.t.business_agents.find((a) => a.id === other.id).call_mode === undefined);
r = await connectMeta(db, ORG, { page_token: 'EAAB' + 'x'.repeat(60) }, { CLIENT_SESSION_SECRET: SECRET });
const stored = db.t.business_agents.find((a) => a.id === agent.id).meta_token_enc;
check('Facebook Page token: stored encrypted, never shown back', r.status === 200 && r.body.agent.meta_connected === true && !('meta_token_enc' in r.body.agent) && !String(stored).includes('xxxx') && decryptProviderCredentials(stored, SECRET).page_token.startsWith('EAAB'));
r = await saveChannels(db, ORG, { facebook_enabled: true, meta_page_id: '1234567890', instagram_enabled: true, instagram_account_id: '17841400000000001' });
check('settings: Facebook and Instagram switch on once the Page is connected', r.status === 200 && r.body.agent.facebook_enabled && r.body.agent.instagram_enabled);
r = await connectMeta(db, ORG, { page_token: 'short' }, { CLIENT_SESSION_SECRET: SECRET });
check('a malformed token is refused', r.status === 400);
r = await issueVoiceKey(db, ORG);
check('premium voice key: shown once with the tool addresses; the agent view shows only that one is set', r.status === 200 && r.body.key && r.body.tools.length === 4 && safeAgent(db.t.business_agents.find((a) => a.id === agent.id)).voice_key_set === true && !('voice_tool_secret_hash' in safeAgent(db.t.business_agents.find((a) => a.id === agent.id))));
await db.insert('business_calls', { organization_id: ORG, agent_id: agent.id, call_sid: 'CA' + hex(16), outcome: 'missed', started_at: NOW.toISOString() });
await db.insert('business_calls', { organization_id: OTHER, agent_id: other.id, call_sid: 'CA' + hex(16), outcome: 'answered', started_at: NOW.toISOString() });
const log = await callLog(db, ORG);
check('the call log shows this business\'s calls only, without provider ids', log.length === 1 && log[0].outcome === 'missed' && !('call_sid' in log[0]));

// ---- Facebook, Instagram and Apple Messages for client businesses ------------------------------------
sent.length = 0;
const live = db.t.business_agents.find((a) => a.id === agent.id);
const page = (msgs, object = 'page', id = '1234567890') => ({ object, entry: [{ id, time: NOW.getTime(), messaging: msgs }] });
let n = await routeMetaEvent(db, page([{ sender: { id: '99887766' }, recipient: { id: '1234567890' }, timestamp: NOW.getTime(), message: { mid: 'm_1', text: 'Do you mow lawns?' } }]), { env: {}, now: NOW, senderFor: fakeSender() });
check('Facebook: a message to the business\'s Page is answered as that business', n === 1 && sent.length === 1 && sent[0].channel === 'facebook' && sent[0].agent === live.id && sent[0].to.ref === '99887766' && /Lawn mowing/.test(sent[0].text));
n = await routeMetaEvent(db, page([{ sender: { id: '99887766' }, recipient: { id: '1234567890' }, message: { mid: 'm_1', text: 'Do you mow lawns?' } }]), { env: {}, now: NOW, senderFor: fakeSender() });
check('Facebook: a re-delivered message is not answered twice', sent.length === 1);
n = await routeMetaEvent(db, page([{ sender: { id: '1234567890' }, recipient: { id: '99887766' }, message: { mid: 'm_2', text: 'our own reply', is_echo: true } }]), { env: {}, now: NOW, senderFor: fakeSender() });
check('Facebook: the business\'s own replies (echoes) are ignored', n === 0 && sent.length === 1);
n = await routeMetaEvent(db, page([{ sender: { id: '55554444' }, recipient: { id: '1234567890' }, message: { mid: 'm_3', text: 'hi' } }], 'page', '5555555555'), { env: {}, now: NOW, senderFor: fakeSender() });
check('Facebook: a Page that belongs to no business is ignored', n === 0);
n = await routeMetaEvent(db, page([{ sender: { id: '11112222' }, recipient: { id: '17841400000000001' }, message: { mid: 'ig_1', text: 'hi' } }], 'instagram', '17841400000000001'), { env: {}, now: NOW, senderFor: fakeSender() });
check('Instagram: a DM to the business\'s account is answered on Instagram', n === 1 && sent.at(-1).channel === 'instagram' && sent.at(-1).to.ref === '11112222');
const raw = Buffer.from(JSON.stringify({ object: 'page' }));
const sig = 'sha256=' + crypto.createHmac('sha256', 'app-secret').update(raw).digest('hex');
check('Meta signature: the right signature passes, anything else fails', metaSignatureOk(raw, sig, 'app-secret') && !metaSignatureOk(raw, sig, 'other-secret') && !metaSignatureOk(raw, 'sha256=00', 'app-secret') && !metaSignatureOk(raw, sig, ''));
live.apple_business_id = 'apple-green-lawns'; live.apple_enabled = true;
const apple = { channel: 'Apple Messages for Business', to: { number: 'apple-green-lawns' }, from: { number: 'urn:mbid:AQAAY' }, timeUtc: '2026-11-16T15:00:00', message: { text: 'hi' } };
let routed = await routeAppleBusiness(db, apple, { env: PAID_ON, now: NOW, senderFor: fakeSender() });
check('Apple Messages: a message to the business\'s Apple ID is answered as that business', routed === true && sent.at(-1).channel === 'apple_messages' && sent.at(-1).to.ref === 'urn:mbid:AQAAY');
const count = sent.length;
routed = await routeAppleBusiness(db, apple, { env: PAID_ON, now: NOW, senderFor: fakeSender() });
check('Apple Messages: a repeated delivery is answered once', routed === true && sent.length === count);
routed = await routeAppleBusiness(db, { ...apple, to: { number: 'someone-else' } }, { env: PAID_ON, now: NOW, senderFor: fakeSender() });
check('Apple Messages: an ID that belongs to no business is not claimed', routed === false);

// ---- the business page shows the chat button only when chat is on ----------------------------------
let page1 = await siteFor(db, 'green-lawns', { now: NOW });
check('business page: the chat button is added when website chat is on', page1.status === 200 && page1.html.includes('<script src="/chat/embed.js?v=20261121a" data-business="green-lawns" async></script>'));
live.web_chat_enabled = false;
page1 = await siteFor(db, 'green-lawns', { now: NOW });
check('business page: no chat button when chat is off', page1.status === 200 && !page1.html.includes('/chat/embed.js'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
