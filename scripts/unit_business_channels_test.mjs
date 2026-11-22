// Message channels for client businesses (api/_businessChannels.js, api/_channelSend.js):
// website chat, WhatsApp, RCS, Apple Messages, Instagram and Facebook. In-memory store and stubbed
// providers; no carrier, Meta, CM.com or database is contacted and nothing is spent.
import crypto from 'node:crypto';
import { receiveAndReply, blockedReason, monthSpendCents, routeTwilioBusinessMessage, CHAT_STOPPED, CHAT_RESTARTED } from '../api/_businessChannels.js';
import { senderFor } from '../api/_channelSend.js';
import { encryptProviderCredentials } from '../api/_providerVault.js';
import { normalizePhone } from '../api/_wave1.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', EMPTY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-11-16T15:00:00Z');
const PAID_ON = { NOVA_SPENDING_LOCK: 'disabled', NOVA_BILLABLE_DISPATCH_ENABLED: 'true' };
const MG = 'MG' + 'a'.repeat(32), SID = (n) => 'SM' + String(n).padStart(32, '0');
const UNIQUE = { journeys: [['organization_id', 'source_channel', 'source_event_id']], journey_events: [['idempotency_key']], journey_documents: [['journey_id', 'kind', 'seq']],
  business_agent_threads: [['agent_id', 'channel', 'customer_ref']], business_agent_messages: [['provider_sid']] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : v && typeof v === 'object' && 'gte' in v ? r[k] >= v.gte : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => {
      for (const u of UNIQUE[n] || []) if (u.every((k) => row[k] != null) && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 });
      const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const db = memoryDb();
await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, terms_text: 'Pay the balance on the day.', terms_approved: true, active: true });
await db.insert('business_services', { organization_id: ORG, name: 'Car detailing', keywords: ['detail'], price_cents: null, price_approved: false, active: true });
await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: [], price_cents: 9000, price_approved: true, active: true });
const agent = await db.insert('business_agents', { organization_id: ORG, business_name: 'Green Lawns', status: 'active', web_chat_enabled: true, whatsapp_enabled: true, whatsapp_number: '+12035550100', rcs_enabled: true, messaging_service_sid: MG, monthly_spend_cap_cents: 10 });
const empty = await db.insert('business_agents', { organization_id: EMPTY, business_name: 'Nothing Yet', status: 'active', web_chat_enabled: true });

const sentLog = [];
const sender = (ok = true) => async (text) => { sentLog.push(text); return ok ? { ok: true, id: SID(sentLog.length) } : { ok: false, error: 'provider_rejected' }; };
let n = 0;
const chat = (text, ref = 'v_visitor1', extra = {}) => receiveAndReply(db, { agent: extra.agent || agent, channel: 'web_chat', customerRef: ref, messageId: extra.id || `w${++n}`, text, name: extra.name, env: {}, now: NOW, send: senderFor('web_chat') });
const wa = (text, env = PAID_ON, extra = {}) => receiveAndReply(db, { agent: extra.agent || agent, channel: 'whatsapp', customerRef: '+18605550101', phone: '+18605550101', messageId: extra.id || SID(1000 + ++n), text, env, now: NOW, send: extra.send || sender() });
const thread = (channel, ref) => db.t.business_agent_threads.find((t) => t.agent_id === agent.id && t.channel === channel && t.customer_ref === ref);
const msgs = (th) => db.t.business_agent_messages.filter((m) => m.thread_id === th.id);

// ---- website chat ------------------------------------------------------------------------------
let r = await chat('hi');
const webThread = thread('web_chat', 'v_visitor1');
check('website chat: a first message is answered with the services, by number', r.state === 'sent' && /1\. Lawn mowing\n2\. Car detailing/.test(r.reply) && !/Teeth/.test(r.reply));
check('website chat: one conversation for this visitor, no phone needed', webThread && webThread.customer_phone === null && webThread.organization_id === ORG);
check('website chat: the question and the answer are both saved; a chat reply costs nothing', msgs(webThread).map((m) => `${m.direction}:${m.state}:${m.estimate_cents ?? '-'}`).join() === 'inbound:received:-,outbound:sent:0');
const before = db.t.business_agent_messages.length;
r = await chat('hi', 'v_visitor1', { id: `w${n}` });
check('website chat: the same message delivered twice is answered once', r.repeated && r.reply === null && db.t.business_agent_messages.length === before);
r = await chat('1');
check('website chat: choosing a service gives the approved price', r.state === 'sent' && /\$40\.00/.test(r.reply));
r = await chat('help');
check('website chat: "help" is a question, not a carrier keyword', r.state === 'sent' && typeof r.reply === 'string' && r.reply.length > 0);
r = await chat('STOP');
check('website chat: STOP is confirmed in the chat and the conversation is stopped', r.reply === CHAT_STOPPED && thread('web_chat', 'v_visitor1').opted_out === true);
r = await chat('hello again');
check('website chat: after STOP nothing is answered, and a person is flagged', r.reply === null && r.held_reason === 'customer_opted_out' && thread('web_chat', 'v_visitor1').needs_human === true);
r = await chat('start');
check('website chat: START turns the chat back on', r.reply === CHAT_RESTARTED && thread('web_chat', 'v_visitor1').opted_out === false);
r = await chat('hi', 'v_visitor2', { agent: { ...agent, web_chat_enabled: false } });
check('website chat switched off: the message is saved for a person, nothing is answered', r.reply === null && r.held_reason === 'channel_not_on' && msgs(thread('web_chat', 'v_visitor2')).some((m) => m.direction === 'inbound'));
r = await chat('hi', 'v_visitor3', { agent: { ...agent, status: 'paused' } });
check('a paused business never answers', r.reply === null && r.held_reason === 'channel_not_on');
r = await receiveAndReply(db, { agent: empty, channel: 'web_chat', customerRef: 'v_x', messageId: 'e1', text: 'hi', env: {}, now: NOW, send: senderFor('web_chat') });
check('a business with no services published passes the chat to a person', r.reply === null && r.held_reason === 'no_services_published');
r = await chat('', 'v_visitor4');
check('an empty message is ignored', r.state === 'ignored' && !thread('web_chat', 'v_visitor4'));
r = await receiveAndReply(db, { agent, channel: 'telegram', customerRef: 'x', messageId: 't1', text: 'hi', env: {}, now: NOW, send: sender() });
check('an unknown channel is ignored', r.state === 'ignored');

// ---- paid channels: spending rules -------------------------------------------------------------
sentLog.length = 0;
r = await wa('hi', {});
check('WhatsApp under the $0 lock: saved, flagged, nothing sent', r.held_reason === 'spending_locked' && sentLog.length === 0 && thread('whatsapp', '+18605550101').needs_human === true);
r = await wa('hi', PAID_ON, { agent: { ...agent, monthly_spend_cap_cents: null } });
check('WhatsApp with no monthly budget set: nothing sent', r.held_reason === 'no_budget_set' && sentLog.length === 0);
r = await wa('hi', PAID_ON, { agent: { ...agent, whatsapp_enabled: false } });
check('WhatsApp switched off: nothing sent', r.held_reason === 'channel_not_on' && sentLog.length === 0);
r = await wa('hi');
const waThread = thread('whatsapp', '+18605550101');
check('WhatsApp with spending on and budget left: the reply goes out', r.state === 'sent' && sentLog.length === 1 && /Lawn mowing/.test(sentLog[0]));
const sentRow = msgs(waThread).find((m) => m.state === 'sent');
check('the sent reply records its planned cost and the provider id', sentRow.estimate_cents === 2 && sentRow.provider_sid === `whatsapp:${SID(1)}` && sentRow.model === 'journey_rules');
check('the website chat and WhatsApp are separate conversations', webThread.id !== waThread.id);

// planned spend this month: 2 (above) + a call; last month and other businesses never count
await db.insert('business_calls', { organization_id: ORG, agent_id: agent.id, call_sid: 'CA1', estimate_cents: 5, started_at: '2026-11-03T12:00:00.000Z' });
await db.insert('business_calls', { organization_id: ORG, agent_id: agent.id, call_sid: 'CA0', estimate_cents: 99, started_at: '2026-10-30T12:00:00.000Z' });
await db.insert('business_calls', { organization_id: OTHER, agent_id: 'x', call_sid: 'CA2', estimate_cents: 50, started_at: '2026-11-04T12:00:00.000Z' });
check('this month\'s planned spend counts this business\'s replies and calls only', (await monthSpendCents(db, ORG, NOW)) === 7);
r = await wa('1');
check('a reply that fits the budget goes out (7 + 2 <= 10)', r.state === 'sent' && sentLog.length === 2);
r = await wa('ok');
check('a reply that would pass the monthly budget is held (9 + 2 > 10)', r.held_reason === 'monthly_budget_reached' && sentLog.length === 2);
check('blockedReason allows a free channel with no budget at all', (await blockedReason(db, { ...agent, monthly_spend_cap_cents: null }, 'web_chat', null, { env: {}, now: NOW })) === '');
check('blockedReason checks the budget when a free channel is asked to cover a paid extra', (await blockedReason(db, { ...agent, monthly_spend_cap_cents: null }, 'web_chat', null, { env: PAID_ON, now: NOW, extraCents: 2 })) === 'no_budget_set');

// provider failures never count as sent
const big = { ...agent, monthly_spend_cap_cents: 1000 };
r = await wa('hi there', PAID_ON, { agent: big, send: sender(false) });
check('a reply the provider refuses is marked failed and flagged for a person', r.state === 'failed' && r.held_reason === 'provider_did_not_accept' && msgs(waThread).some((m) => m.state === 'failed' && m.estimate_cents === undefined));
r = await wa('hello?', PAID_ON, { agent: big, send: async () => { throw new Error('network'); } });
check('a provider that errors is treated as not sent', r.state === 'failed');
const sentBefore = sentLog.length;
r = await wa('STOP', PAID_ON, { agent: big });
check('WhatsApp STOP: opted out, and the assistant sends nothing', r.state === 'opted_out' && sentLog.length === sentBefore && thread('whatsapp', '+18605550101').opted_out === true);
r = await wa('what time?', PAID_ON, { agent: big });
check('after STOP on WhatsApp nothing is sent', r.held_reason === 'customer_opted_out' && sentLog.length === sentBefore);
r = await wa('HELP', PAID_ON, { agent: big });
check('WhatsApp HELP is left to the carrier rules: nothing sent', r.state === 'keyword' && sentLog.length === sentBefore);

// ---- Twilio routing ----------------------------------------------------------------------------
const routed = [];
const fakeSenderFor = (channel, a, to) => { routed.push({ channel, agent: a.id, to }); return sender(); };
const ENV = { ...PAID_ON, TWILIO_WHATSAPP_FROM: 'whatsapp:+12035550999', TWILIO_PHONE_NUMBER: '+12035550998' };
let handled = await routeTwilioBusinessMessage(db, { To: 'whatsapp:+12035550100', From: 'whatsapp:+18605550177', MessageSid: SID(5001), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: WhatsApp to a business sender is answered as that business', handled && routed.at(-1)?.channel === 'whatsapp' && routed.at(-1).agent === agent.id && routed.at(-1).to.phone === '+18605550177' && thread('whatsapp', '+18605550177'));
handled = await routeTwilioBusinessMessage(db, { To: 'whatsapp:+12035550999', From: 'whatsapp:+18605550177', MessageSid: SID(5002), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: Nova\'s own WhatsApp sender keeps its own path', handled === false);
handled = await routeTwilioBusinessMessage(db, { To: 'whatsapp:+12035550555', From: 'whatsapp:+18605550177', MessageSid: SID(5003), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: a WhatsApp sender that belongs to no business is not claimed', handled === false);
handled = await routeTwilioBusinessMessage(db, { To: 'rcs:green_lawns_agent', From: 'rcs:+18605550188', MessagingServiceSid: MG, MessageSid: SID(5004), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: RCS through the business\'s Messaging Service is answered as that business', handled && routed.at(-1).channel === 'rcs' && routed.at(-1).to.phone === '+18605550188' && thread('rcs', '+18605550188'));
handled = await routeTwilioBusinessMessage(db, { To: '+12035550998', From: '+18605550188', MessagingServiceSid: MG, MessageSid: SID(5005), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: a text to Nova\'s own number is never claimed by a business', handled === false);
handled = await routeTwilioBusinessMessage(db, { To: 'rcs:x', From: 'rcs:+18605550188', MessagingServiceSid: 'MG' + 'b'.repeat(32), MessageSid: SID(5006), Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: a Messaging Service that belongs to no business is not claimed', handled === false);
const count = db.t.business_agent_messages.length;
handled = await routeTwilioBusinessMessage(db, { To: 'whatsapp:+12035550100', From: 'whatsapp:+18605550177', MessageSid: 'not-a-sid', Body: 'hi' }, ENV, { normalizePhone, senderFor: fakeSenderFor, now: NOW });
check('Twilio: a malformed message for a business is dropped without saving anything', handled === true && db.t.business_agent_messages.length === count);

// ---- provider senders (stubbed HTTP) -----------------------------------------------------------
const realFetch = globalThis.fetch;
let calls = [];
const stub = (status, json) => { globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return { ok: status < 400, status, json: async () => (typeof json === 'function' ? json(opts) : json) }; }; };
const ENVT = { TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'x'.repeat(32), CLIENT_SESSION_SECRET: 's'.repeat(40) };
const saved = { lock: process.env.NOVA_SPENDING_LOCK, dispatch: process.env.NOVA_BILLABLE_DISPATCH_ENABLED };
const setLock = (on) => { if (on) { delete process.env.NOVA_SPENDING_LOCK; delete process.env.NOVA_BILLABLE_DISPATCH_ENABLED; } else Object.assign(process.env, PAID_ON); };

setLock(false); stub(201, { sid: SID(9001), status: 'queued' });
let out = await senderFor('whatsapp', agent, { phone: '+18605550101' }, ENVT)('Hello');
let form = new URLSearchParams(calls.at(-1).opts.body);
check('WhatsApp sender: posts from the business\'s WhatsApp number to the customer', out.ok && out.id === SID(9001) && form.get('From') === 'whatsapp:+12035550100' && form.get('To') === 'whatsapp:+18605550101' && form.get('Body') === 'Hello');
out = await senderFor('rcs', agent, { phone: '+18605550101' }, ENVT)('Hello');
form = new URLSearchParams(calls.at(-1).opts.body);
check('RCS sender: posts through the business\'s Messaging Service (RCS, or text as fallback)', out.ok && form.get('MessagingServiceSid') === MG && form.get('To') === '+18605550101' && !form.get('From'));
stub(201, { sid: SID(9002), status: 'failed' });
out = await senderFor('whatsapp', agent, { phone: '+18605550101' }, ENVT)('Hello');
check('Twilio sender: a message Twilio marks failed is not "sent"', out.ok === false);
stub(400, { message: 'bad' });
out = await senderFor('whatsapp', agent, { phone: '+18605550101' }, ENVT)('Hello');
check('Twilio sender: an HTTP error is not "sent"', out.ok === false && out.error === 'provider_400');
setLock(true); calls = []; stub(201, { sid: SID(9003), status: 'queued' });
out = await senderFor('whatsapp', agent, { phone: '+18605550101' }, ENVT)('Hello');
check('Twilio sender under the $0 lock: refused before any request is made', out.ok === false && out.error === 'spending_locked' && calls.length === 0);
out = await senderFor('whatsapp', agent, { phone: '+18605550101' }, {})('Hello');
check('Twilio sender without Twilio keys: refused', out.ok === false && out.error === 'twilio_not_configured');

const appleAgent = { ...agent, apple_business_id: 'apple-biz-1' };
out = await senderFor('apple_messages', appleAgent, { ref: 'urn:mbid:abc' }, {})('Hi');
check('Apple Messages sender without the CM.com token: refused', out.ok === false && out.error === 'apple_provider_not_configured');
calls = []; stub(200, (opts) => { const ref = JSON.parse(opts.body).messages.msg[0].reference; return { errorCode: 0, messages: [{ status: 'Accepted', reference: ref }] }; });
out = await senderFor('apple_messages', appleAgent, { ref: 'urn:mbid:abc' }, { CM_PRODUCT_TOKEN: 'tok' })('Hi');
const appleBody = JSON.parse(calls.at(-1).opts.body).messages.msg[0];
check('Apple Messages sender: sends as the business to the customer\'s Apple id, Apple channel only', out.ok && calls.at(-1).opts.headers['X-CM-PRODUCTTOKEN'] === 'tok' && appleBody.from === 'apple-biz-1' && appleBody.to[0].number === 'urn:mbid:abc' && appleBody.allowedChannels.join() === 'Apple Messages for Business');
stub(200, { errorCode: 0, messages: [{ status: 'Accepted', reference: 'someone-else' }] });
out = await senderFor('apple_messages', appleAgent, { ref: 'urn:mbid:abc' }, { CM_PRODUCT_TOKEN: 'tok' })('Hi');
check('Apple Messages sender: a receipt for a different message is not "sent"', out.ok === false);

const metaAgent = { ...agent, meta_page_id: '1234567890', meta_token_enc: encryptProviderCredentials({ page_token: 'PAGE_TOKEN_X' }, ENVT.CLIENT_SESSION_SECRET) };
out = await senderFor('facebook', { ...agent, meta_page_id: '1', meta_token_enc: null }, { ref: '999' }, ENVT)('Hi');
check('Facebook sender without a connected page: refused', out.ok === false && out.error === 'meta_not_connected');
calls = []; stub(200, { recipient_id: '999', message_id: 'm_abc' });
out = await senderFor('instagram', metaAgent, { ref: '999' }, ENVT)('Hi there');
const metaBody = JSON.parse(calls.at(-1).opts.body);
check('Instagram/Facebook sender: answers through the business\'s page as a RESPONSE to the customer', out.ok && out.id === 'm_abc' && calls.at(-1).url === 'https://graph.facebook.com/v21.0/1234567890/messages' && calls.at(-1).opts.headers.Authorization === 'Bearer PAGE_TOKEN_X' && metaBody.recipient.id === '999' && metaBody.messaging_type === 'RESPONSE');
out = await senderFor('facebook', metaAgent, { ref: '999' }, { ...ENVT, CLIENT_SESSION_SECRET: 't'.repeat(40) })('Hi');
check('Meta sender: a token that cannot be decrypted is refused', out.ok === false && out.error === 'meta_not_connected');
stub(400, { error: { message: 'outside window' } });
out = await senderFor('facebook', metaAgent, { ref: '999' }, ENVT)('Hi');
check('Meta sender: an HTTP error is not "sent"', out.ok === false && out.error === 'provider_http_400');
out = await senderFor('fax', agent, {}, ENVT)('Hi');
check('an unknown channel never sends', out.ok === false);
calls = [];
out = await senderFor('web_chat', agent, {}, ENVT)('Hi');
check('website chat sender makes no outside request', out.ok === true && calls.length === 0);

globalThis.fetch = realFetch;
if (saved.lock === undefined) delete process.env.NOVA_SPENDING_LOCK; else process.env.NOVA_SPENDING_LOCK = saved.lock;
if (saved.dispatch === undefined) delete process.env.NOVA_BILLABLE_DISPATCH_ENABLED; else process.env.NOVA_BILLABLE_DISPATCH_ENABLED = saved.dispatch;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
