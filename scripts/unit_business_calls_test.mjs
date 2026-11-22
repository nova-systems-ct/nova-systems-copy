// Phone calls to client businesses and the premium voice tools (api/_businessCalls.js), plus the
// signed Twilio route for them (api/_unifiedTwilio.js). In-memory store, stubbed Twilio, ElevenLabs
// and texts; no carrier, provider or database is contacted and nothing is spent.
import crypto from 'node:crypto';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { businessCallTwiml, voiceTool, newVoiceKey, callUrl, CALL_COST } = await import('../api/_businessCalls.js');
const { tokenMatches } = await import('../api/_journey.js');

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BIZ = '+12035550100', OWNER = '+12035550111', ALERT = '+12035550122', CALLER = '+18605550101';
const NOW = new Date('2026-11-16T15:00:00Z');
const PAID_ON = { NOVA_SPENDING_LOCK: 'disabled', NOVA_BILLABLE_DISPATCH_ENABLED: 'true' };
const UNIQUE = { journeys: [['organization_id', 'source_channel', 'source_event_id']], journey_events: [['idempotency_key']], journey_documents: [['journey_id', 'kind', 'seq']],
  business_agent_threads: [['agent_id', 'channel', 'customer_ref']], business_agent_messages: [['provider_sid']], business_calls: [['call_sid']] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const hex = (n) => crypto.randomBytes(n).toString('hex');
const CA = () => 'CA' + hex(16);

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : v && typeof v === 'object' && 'gte' in v ? r[k] >= v.gte : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => {
      for (const u of UNIQUE[n] || []) if (u.every((k) => row[k] != null) && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 });
      const defaults = n === 'business_calls' ? { outcome: 'ringing', turns: 0, estimate_cents: 0, texted_back: false, caller_said: [], started_at: NOW.toISOString() } : {};
      const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...defaults, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
let db, agent, texts;
async function setup(agentExtra = {}) {
  db = memoryDb(); texts = [];
  await db.insert('organizations', { id: ORG, slug: 'green-lawns', name: 'Green Lawns', status: 'active' });
  await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, terms_text: 'Pay the balance on the day.', terms_approved: true, active: true });
  await db.insert('business_services', { organization_id: ORG, name: 'Car detailing', keywords: ['detail'], price_cents: null, price_approved: false, active: true });
  await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: ['teeth'], price_cents: 9000, price_approved: true, active: true });
  await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-18T15:00:00Z', end_at: '2026-11-18T16:00:00Z', status: 'open' });
  await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-10T15:00:00Z', end_at: '2026-11-10T16:00:00Z', status: 'open' });
  await db.insert('voice_calendar_slots', { organization_id: OTHER, start_at: '2026-11-19T15:00:00Z', end_at: '2026-11-19T16:00:00Z', status: 'open' });
  agent = await db.insert('business_agents', { organization_id: ORG, business_name: 'Green Lawns', status: 'active', phone_number: BIZ, sms_enabled: true, call_mode: 'forward_then_assistant', forward_phone: OWNER, ring_seconds: 25, missed_call_text: true, owner_alert_phone: ALERT, monthly_spend_cap_cents: 500, ...agentExtra });
}
const fakeSender = (ok = true) => (channel, a, to) => async (text) => { texts.push({ channel, from: a.phone_number, to: to.phone, text }); return ok ? { ok: true, id: 'SM' + hex(16) } : { ok: false }; };
let sid = CA();
const ring = (o = {}) => businessCallTwiml(db, { p: { CallSid: o.sid || sid, From: o.from ?? CALLER, To: o.to || BIZ, ...(o.p || {}) }, step: o.step || '', turn: o.turn ?? null, env: o.env || PAID_ON, now: o.now || NOW, senderFor: o.sender || fakeSender(), fetchImpl: o.fetch || (async () => { throw new Error('no network in tests'); }) });
const theCall = (s = sid) => db.t.business_calls.find((c) => c.call_sid === s);

// ---- answering: forward first ------------------------------------------------------------------
await setup();
let x = await ring({ to: '+12035550999' });
check('a number that belongs to no business is not answered here', x === null);
x = await ring();
check('forward first: the owner\'s phone rings for the set time, showing the caller\'s number', /^<Dial timeout="25" answerOnBridge="true" action="https:\/\/nova-systems\.app\/webhooks\/business-call\?step=after-dial" method="POST" callerId="\+18605550101"><Number>\+12035550111<\/Number><\/Dial>$/.test(x));
check('the call is logged with its planned cost', theCall()?.outcome === 'ringing' && theCall().estimate_cents === CALL_COST.forward && theCall().from_phone === CALLER && theCall().organization_id === ORG);
x = await ring({ step: 'after-dial', p: { DialCallStatus: 'completed' } });
check('when the owner picks up, the call is "answered" and nothing else happens', x === '<Hangup/>' && theCall().outcome === 'answered' && texts.length === 0);

sid = CA();
await ring();
x = await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
check('no answer: the assistant takes the call, says it is automated and that it writes things down', /<Gather input="speech" action="https:\/\/nova-systems\.app\/webhooks\/business-call\?step=assistant&amp;turn=1"/.test(x) && /automated assistant/.test(x) && /written down/.test(x) && theCall().outcome === 'assistant');
check('the assistant\'s planned cost is added to the call', theCall().estimate_cents === CALL_COST.forward + CALL_COST.assistant);
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'Can you cut my grass this week?' } });
check('the assistant recognizes the service and gives only the owner-approved price', /Lawn mowing is \$40\./.test(x) && /say yes or no/.test(x) && theCall().service_id && theCall().caller_said[0].said === 'Can you cut my grass this week?');
x = await ring({ step: 'assistant', turn: 2, p: { SpeechResult: 'yes please' } });
const j = db.t.journeys.find((r) => r.id === theCall().journey_id);
const linkText = texts.find((t) => /private link/.test(t.text));
const k = linkText?.text.match(/#j=([0-9a-f-]{36})&k=([0-9a-f]{64})/);
check('"yes": a request is opened for this caller with the service chosen', j && j.organization_id === ORG && j.source_channel === 'voice' && j.stage === 'quoted' && db.t.crm_contacts.find((c) => c.id === j.contact_id)?.phone === CALLER);
check('"yes": the caller is texted a private link from the business number', linkText && linkText.from === BIZ && linkText.to === CALLER && k && k[1] === j.id && tokenMatches(j, k[2]));
check('the call ends politely and is marked "link sent"', /The link is on its way by text/.test(x) && theCall().outcome === 'link_sent' && theCall().texted_back === true);
const smsThread = db.t.business_agent_threads.find((t) => t.channel === 'sms' && t.customer_ref === CALLER);
check('the link text is filed in the caller\'s text conversation with its planned cost', smsThread && db.t.business_agent_messages.some((m) => m.thread_id === smsThread.id && m.state === 'sent' && m.model === 'call_link' && m.estimate_cents === CALL_COST.text));
const before = texts.length;
x = await ring({ step: 'assistant', turn: 2, p: { SpeechResult: 'yes please' } });
check('a repeated request for the same turn does not text twice', texts.length === before && /Goodbye/.test(x));

// ---- the assistant passes the call to a person ---------------------------------------------------
sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'busy' } });
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'I want to talk to a real person' } });
check('asking for a person: marked for a call back and the caller is told so', theCall().outcome === 'callback_requested' && theCall().held_reason === 'caller_asked' && /call you back at this number/.test(x));
check('the owner gets one alert text with what the caller said', texts.some((t) => t.to === ALERT && /Call back needed/.test(t.text) && /real person/.test(t.text)) && theCall().estimate_cents === CALL_COST.forward + CALL_COST.assistant + CALL_COST.text);

sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'hmm' } });
check('not understood: the assistant lists the services (this business only) and asks again', /We do Lawn mowing and Car detailing\./.test(x) && !/Teeth/.test(x) && /turn=2/.test(x));
await ring({ step: 'assistant', turn: 2, p: { SpeechResult: '' } });
x = await ring({ step: 'assistant', turn: 3, p: { SpeechResult: 'something else entirely' } });
check('after three tries it passes the call to a person instead of guessing', theCall().outcome === 'callback_requested' && theCall().held_reason === 'service_not_understood');

sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'I need a car detail' } });
check('a service with no approved price is never priced by voice', /The team prices Car detailing after a quick look\./.test(x) && !/\$/.test(x));
x = await ring({ step: 'assistant', turn: 2, p: { SpeechResult: 'no thanks' } });
check('"no": the call ends politely and nothing is texted', /No problem/.test(x) && !texts.some((t) => t.to === CALLER && /Car/.test(t.text)));

// ---- missed calls and the text back ---------------------------------------------------------------
await setup({ call_mode: 'forward_only' });
sid = CA();
await ring();
x = await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
const back = texts.find((t) => t.to === CALLER);
check('forward only, no answer: "missed", and the caller gets one text back with the business page', theCall().outcome === 'missed' && back && /Sorry we missed your call at Green Lawns/.test(back.text) && /https:\/\/nova-systems\.app\/b\/green-lawns/.test(back.text) && /STOP/.test(back.text) && /sent you a text/.test(x));
const n1 = texts.length;
sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
check('a second missed call from the same number the same day gets no second text', texts.length === n1 && theCall().outcome === 'missed' && theCall().texted_back === false);
await setup({ call_mode: 'forward_only' });
await db.insert('business_agent_threads', { organization_id: ORG, agent_id: agent.id, channel: 'sms', customer_phone: CALLER, customer_ref: CALLER, opted_out: true });
sid = CA();
await ring(); x = await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
check('a caller who texted STOP is never texted back', texts.length === 0 && theCall().held_reason === 'text_not_sent:customer_opted_out' && /try again later/.test(x));
await setup({ call_mode: 'forward_only', sms_enabled: false });
sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'no-answer' } });
check('no text back when the business has texting switched off', texts.length === 0 && theCall().held_reason === 'text_not_sent:channel_not_on');
await setup({ call_mode: 'forward_only' });
sid = CA();
await ring();
await ring({ step: 'status', p: { CallStatus: 'completed' } });
check('a caller who hangs up while it rings counts as missed (and gets the text back)', theCall().outcome === 'missed' && theCall().ended_at && texts.some((t) => t.to === CALLER));
sid = CA();
await ring(); await ring({ step: 'after-dial', p: { DialCallStatus: 'completed' } });
const n2 = texts.length;
await ring({ step: 'status', p: { CallStatus: 'completed' } });
check('the end of an answered call only records the end time', theCall().outcome === 'answered' && theCall().ended_at && texts.length === n2);

// ---- spending rules: nothing is answered that cannot be paid for ----------------------------------
await setup({ call_mode: 'forward_only' });
sid = CA();
x = await ring({ env: {} });
check('under the $0 lock the caller hears busy, nothing is answered or forwarded, the call is logged', x === '<Reject reason="busy"/>' && theCall().outcome === 'not_taking_calls' && theCall().held_reason === 'spending_locked' && theCall().estimate_cents === 0);
await setup({ call_mode: 'assistant_first', monthly_spend_cap_cents: null });
sid = CA();
x = await ring();
check('no monthly budget set: busy, not answered', x === '<Reject reason="busy"/>' && theCall().held_reason === 'no_budget_set');
await setup({ call_mode: 'assistant_first', monthly_spend_cap_cents: 10 });
sid = CA();
x = await ring();
check('a call that would pass the monthly budget is not answered', x === '<Reject reason="busy"/>' && theCall().held_reason === 'monthly_budget_reached');
await setup({ call_mode: 'off' });
sid = CA();
x = await ring();
check('calls switched off: busy, logged as not taking calls', x === '<Reject reason="busy"/>' && theCall().held_reason === 'calls_off');
await setup({ status: 'paused' });
sid = CA();
x = await ring();
check('a paused business takes no calls', x === '<Reject reason="busy"/>' && theCall().held_reason === 'business_not_active');
await setup({ call_mode: 'assistant_first' });
db.t.business_services.forEach((s) => { if (s.organization_id === ORG) s.active = false; });
sid = CA();
x = await ring();
check('nothing published to sell: the assistant does not answer', x === '<Reject reason="busy"/>' && theCall().held_reason === 'no_services_published');
await setup({ call_mode: 'assistant_first' });
sid = CA();
x = await ring({ sid, p: {}, from: '' });
check('assistant first: answers straight away', /automated assistant/.test(x) && theCall().estimate_cents === CALL_COST.assistant);

// ---- premium voice (ElevenLabs) -------------------------------------------------------------------
await setup({ call_mode: 'assistant_first', voice_provider: 'elevenlabs', voice_provider_agent_id: 'agent_premium_01' });
let sentToEleven = null;
const eleven = async (url, opts) => { sentToEleven = { url, opts }; return { ok: true, status: 200, text: async () => '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://api.elevenlabs.io/v1/convai/conversation/twilio" /></Connect></Response>' }; };
sid = CA();
x = await ring({ env: { ...PAID_ON, ELEVENLABS_API_KEY: 'xi-test' }, fetch: eleven });
const reg = sentToEleven && JSON.parse(sentToEleven.opts.body);
check('premium voice: the call is handed to the business\'s premium agent', /^<Connect><Stream url="wss:\/\/api\.elevenlabs\.io/.test(x) && theCall().outcome === 'assistant' && theCall().estimate_cents === CALL_COST.premium);
check('premium voice: registered with the right agent, numbers and key', sentToEleven.url === 'https://api.elevenlabs.io/v1/convai/twilio/register-call' && sentToEleven.opts.headers['xi-api-key'] === 'xi-test' && reg.agent_id === 'agent_premium_01' && reg.from_number === CALLER && reg.to_number === BIZ && reg.direction === 'inbound' && reg.conversation_initiation_client_data.dynamic_variables.call_sid === sid);
sid = CA();
x = await ring({ env: { ...PAID_ON, ELEVENLABS_API_KEY: 'xi-test' }, fetch: async () => ({ ok: false, status: 500, text: async () => '' }) });
check('premium voice unavailable: the standard assistant answers instead', /automated assistant/.test(x) && theCall().estimate_cents === CALL_COST.assistant);

// ---- premium voice tools ----------------------------------------------------------------------------
await setup({ call_mode: 'assistant_first', voice_provider: 'elevenlabs', voice_provider_agent_id: 'agent_premium_01' });
const key = await newVoiceKey(db, ORG);
check('the voice key is shown once and only its hash is stored', /^[A-Za-z0-9_-]{48}$/.test(key) && db.t.business_agents[0].voice_tool_secret_hash === crypto.createHash('sha256').update(key).digest('hex'));
const tool = (name, body = {}, k = key) => voiceTool(db, { key: k, tool: name, body, env: PAID_ON, now: NOW, senderFor: fakeSender() });
let r = await tool('services', {}, 'x'.repeat(48));
check('a wrong voice key is refused', r.status === 401);
r = await tool('services');
check('services: only this business\'s services, priced only where the owner approved', r.status === 200 && r.body.services.length === 2 && r.body.services[0].price === '$40' && /after a quick look/.test(r.body.services[1].price));
r = await tool('open_times');
check('open times: only future open times of this business', r.body.open_times.length === 1 && /November 18/.test(r.body.open_times[0]));
sid = CA();
await ring({ env: { ...PAID_ON, ELEVENLABS_API_KEY: 'xi-test' }, fetch: eleven });
r = await tool('send_link', { caller: CALLER, service: 'lawn mowing', call_sid: sid, conversation_id: 'conv_123' });
const j2 = db.t.journeys.find((q) => q.source_event_id === `voice:${sid}`);
check('send_link: a request is opened, the link texted, and the call updated', r.body.sent === true && j2?.stage === 'quoted' && texts.some((t) => t.to === CALLER && t.text.includes(`#j=${j2.id}&k=`)) && theCall().outcome === 'link_sent' && theCall().journey_id === j2.id);
r = await tool('hand_to_person', { caller: CALLER, call_sid: sid, summary: 'Wants a price for a big yard' });
check('hand_to_person: marked for a call back and the owner alerted', theCall().outcome === 'callback_requested' && texts.some((t) => t.to === ALERT && /big yard/.test(t.text)));
r = await tool('book_now');
check('a tool that does not exist does nothing', r.status === 404);
db.t.business_agents[0].status = 'paused';
r = await tool('services');
check('a paused business\'s voice key stops working', r.status === 401);

// ---- the signed Twilio route ------------------------------------------------------------------------
const pg = { business_agents: [{ id: crypto.randomUUID(), organization_id: ORG, business_name: 'Green Lawns', status: 'active', phone_number: BIZ, call_mode: 'forward_only', forward_phone: OWNER, ring_seconds: 20, monthly_spend_cap_cents: 500 }], business_calls: [], business_agent_messages: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(String(url)); const table = u.pathname.replace('/rest/v1/', '');
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  if (!pg[table]) return json(404, {});
  const hitRow = (row) => [...u.searchParams].every(([k2, v]) => ['select', 'order', 'limit'].includes(k2) || (v.startsWith('eq.') ? String(row[k2]) === decodeURIComponent(v.slice(3)) : v.startsWith('gte.') ? String(row[k2]) >= decodeURIComponent(v.slice(4)) : true));
  if ((opts.method || 'GET') === 'GET') return json(200, pg[table].filter(hitRow));
  const body = JSON.parse(opts.body);
  if (opts.method === 'POST') { const row = { id: crypto.randomUUID(), outcome: 'ringing', turns: 0, estimate_cents: 0, texted_back: false, caller_said: [], started_at: new Date().toISOString(), ...body }; pg[table].push(row); return json(201, [row]); }
  const rows = pg[table].filter(hitRow); rows.forEach((row) => Object.assign(row, body)); return json(200, rows);
};
const TW = { TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32), TWILIO_AUTH_TOKEN: 'token-token-token-1', TWILIO_PHONE_NUMBER: '+18609626160' };
Object.assign(process.env, TW, PAID_ON);
const { handleUnifiedTwilio } = await import('../api/_unifiedTwilio.js');
const { twilioSignature } = await import('../api/_wave1.js');
const hit = async (query, p, url) => {
  const res = { code: 0, body: '', headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, send(b) { this.body = b; return this; }, json(b) { this.body = b; return this; } };
  await handleUnifiedTwilio({ method: 'POST', query: { resource: 'company', op: 'business-call', ...query }, body: p, headers: { 'x-twilio-signature': url ? twilioSignature(url, p, TW.TWILIO_AUTH_TOKEN) : 'forged' } }, res, 'business-call');
  return res;
};
const P = { AccountSid: TW.TWILIO_ACCOUNT_SID, CallSid: CA(), From: CALLER, To: BIZ };
let res = await hit({}, P, callUrl(''));
check('Twilio route: a signed new call to a business number is forwarded', res.code === 200 && /<Dial timeout="20"/.test(res.body) && pg.business_calls.length === 1);
res = await hit({ step: 'after-dial' }, { ...P, DialCallStatus: 'completed' }, callUrl('after-dial'));
check('Twilio route: the signed after-dial step is accepted (address rebuilt exactly)', res.code === 200 && /<Hangup\/>/.test(res.body) && pg.business_calls[0].outcome === 'answered');
res = await hit({}, P, null);
check('Twilio route: a forged signature is refused', res.code === 403);
res = await hit({ step: 'voicemail' }, P, 'https://nova-systems.app/webhooks/business-call?step=voicemail');
check('Twilio route: a step we never hand out is refused even when signed', res.code === 403);
res = await hit({ step: 'after-dial', turn: '2' }, P, 'https://nova-systems.app/webhooks/business-call?step=after-dial&turn=2');
check('Twilio route: a turn on anything but the assistant is refused', res.code === 403);
res = await hit({}, { ...P, CallSid: CA(), To: '+12035550999' }, callUrl(''));
check('Twilio route: a number that belongs to no business is rejected', res.code === 200 && /<Reject\/>/.test(res.body));
res = await hit({}, { ...P, AccountSid: 'AC' + 'b'.repeat(32) }, callUrl(''));
check('Twilio route: another Twilio account is refused', res.code === 403);
globalThis.fetch = realFetch;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
