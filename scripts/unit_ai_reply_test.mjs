// AI answers (api/_aiReply.js) with all three model providers (Claude, GPT, Gemini) stubbed, on
// website chat, WhatsApp and phone calls. In-memory store; no model, carrier or database is
// contacted and nothing is spent.
import crypto from 'node:crypto';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { checkAnswer, looksLikeQuestion, aiAnswer, aiFirst, providersReady, modelFor, AI_COST_CENTS } = await import('../api/_aiReply.js');
const { receiveAndReply, monthSpendCents } = await import('../api/_businessChannels.js');
const { senderFor } = await import('../api/_channelSend.js');
const { businessCallTwiml, CALL_COST } = await import('../api/_businessCalls.js');
const { channelPatch, safeAgent } = await import('../api/_channelAdmin.js');

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BIZ = '+12035550100', OWNER = '+12035550111', CALLER = '+18605550101';
const NOW = new Date('2026-11-16T15:00:00Z');
const KEYS = { ANTHROPIC_API_KEY: 'sk-ant-test', OPENAI_API_KEY: 'sk-oa-test', GEMINI_API_KEY: 'gm-test' };
const PAID_ON = { NOVA_SPENDING_LOCK: 'disabled', NOVA_BILLABLE_DISPATCH_ENABLED: 'true' };
const ON = { ...PAID_ON, NOVA_AI_REPLIES: 'on', ...KEYS };
const UNIQUE = { journeys: [['organization_id', 'source_channel', 'source_event_id']], journey_events: [['idempotency_key']], journey_documents: [['journey_id', 'kind', 'seq']],
  business_agent_threads: [['agent_id', 'channel', 'customer_ref']], business_agent_messages: [['provider_sid']], business_calls: [['call_sid']] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

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

// ---- the three model providers, stubbed -------------------------------------------------------
const SAID = 'We are fully licensed and insured.';
let calls, answers, down, cutOff;
const resetModels = () => { calls = []; answers = { anthropic: SAID, openai: SAID, google: SAID }; down = new Set(); cutOff = new Set(); };
const modelFetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const name = { 'api.anthropic.com': 'anthropic', 'api.openai.com': 'openai', 'generativelanguage.googleapis.com': 'google' }[u.host];
  if (!name) throw new Error(`no network in tests: ${u.host}`);
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  calls.push({ name, url: String(url), headers: opts.headers || {}, body: JSON.parse(opts.body || '{}') });
  if (down.has(name)) return json(503, { error: { message: 'overloaded' } });
  const text = answers[name], cut = cutOff.has(name);
  if (name === 'anthropic') return json(200, { content: [{ type: 'text', text }], stop_reason: cut ? 'max_tokens' : 'end_turn' });
  if (name === 'openai') return json(200, { choices: [{ message: { role: 'assistant', content: text }, finish_reason: cut ? 'length' : 'stop' }] });
  return json(200, { candidates: [{ content: { parts: [{ text: 'thinking about it', thought: true }, { text }] }, finishReason: cut ? 'MAX_TOKENS' : 'STOP' }] });
};
globalThis.fetch = modelFetch; // the channel code uses the global fetch; anything but a model host throws

let db, agent;
async function setup(extra = {}) {
  db = memoryDb(); resetModels();
  await db.insert('organizations', { id: ORG, slug: 'green-lawns', name: 'Green Lawns', status: 'active' });
  await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, terms_text: 'Pay the balance on the day.', terms_approved: true, active: true });
  await db.insert('business_services', { organization_id: ORG, name: 'Car detailing', keywords: ['detail'], price_cents: null, price_approved: false, active: true });
  await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: ['teeth'], price_cents: 9000, price_approved: true, active: true });
  await db.insert('voice_knowledge_base', { organization_id: ORG, question: 'Do you work weekends?', answer: 'Saturdays until noon.', status: 'approved' });
  await db.insert('voice_knowledge_base', { organization_id: ORG, question: 'Draft', answer: 'Unapproved draft answer.', status: 'draft' });
  await db.insert('voice_knowledge_base', { organization_id: OTHER, question: 'New patients?', answer: 'New patients welcome.', status: 'approved' });
  await db.insert('voice_configurations', { organization_id: ORG, business_hours: { mon: [{ start: '08:00', end: '17:00' }] }, timezone: 'America/New_York' });
  agent = await db.insert('business_agents', { organization_id: ORG, business_name: 'Green Lawns', agent_name: 'Jo', status: 'active', phone_number: BIZ, forward_phone: OWNER, call_mode: 'assistant_first',
    web_chat_enabled: true, whatsapp_enabled: true, whatsapp_number: BIZ, monthly_spend_cap_cents: 100, ai_enabled: true, faq: 'We are fully licensed and insured. Rain dates are free.', ...extra });
}
const ask = (text, o = {}) => aiAnswer(db, o.agent || agent, { text, channel: o.channel || 'web_chat', requestLink: o.link ?? null, env: o.env || ON, now: NOW, fetchImpl: modelFetch });

// ---- the checks every answer must pass ---------------------------------------------------------
const PRICES = { approvedCents: [4000, 120000] };
check('check: a plain answer passes', checkAnswer(SAID, PRICES).ok === true);
check('check: "HANDOFF" (the model does not know) goes to a person', checkAnswer('HANDOFF', PRICES).reason === 'model_did_not_know' && checkAnswer('', PRICES).reason === 'model_did_not_know');
check('check: an approved price may be stated, in any common form', checkAnswer('Mowing is $40.', PRICES).ok && checkAnswer('Mowing is $40.00.', PRICES).ok && checkAnswer('It is $1,200.00.', PRICES).ok);
check('check: a price nobody approved is never sent', checkAnswer('Mowing is $35 this week.', PRICES).reason === 'price_not_approved' && checkAnswer('Only $ 39.99!', PRICES).reason === 'price_not_approved');
check('check: a discount nobody approved is never sent', checkAnswer('Take 20% off today.', PRICES).reason === 'discount_not_approved' && checkAnswer('10 percent off for you', PRICES).reason === 'discount_not_approved');
check('check: only the business\'s own links', checkAnswer('Book at https://nova-systems.app/start?org=1.', { allowedLinks: ['https://nova-systems.app/start?org=1'] }).ok
  && checkAnswer('See https://evil.test/x', { allowedLinks: ['https://nova-systems.app/start?org=1'] }).reason === 'unknown_link' && checkAnswer('Try www.other.com', {}).reason === 'unknown_link');
check('check: only the business\'s own phone numbers, in any format', checkAnswer('Call us at (203) 555-0100.', { allowedPhones: [BIZ] }).ok && checkAnswer('Call 860-555-0000.', { allowedPhones: [BIZ] }).reason === 'unknown_phone');
check('check: an answer longer than 600 characters is not sent', checkAnswer('a '.repeat(301), PRICES).reason === 'answer_too_long');
check('a question is recognised; a greeting or a request is not', looksLikeQuestion('Are you insured?') && looksLikeQuestion('Do you work Saturdays') && !looksLikeQuestion('hi') && !looksLikeQuestion('thanks!') && !looksLikeQuestion('I need my lawn mowed'));
check('providers count only when their key is set', providersReady({}).length === 0 && providersReady(KEYS).join() === 'anthropic,openai,google' && providersReady({ GEMINI_API_KEY: 'x' }).join() === 'google');
check('models: a default per provider, overridable per provider', modelFor('anthropic', {}) === 'claude-haiku-5-5' && modelFor('anthropic', { NOVA_AUTOMATION_MODEL: 'claude-x' }) === 'claude-x'
  && modelFor('anthropic', { NOVA_AUTOMATION_MODEL: 'claude-x', NOVA_AI_MODEL_ANTHROPIC: 'claude-y' }) === 'claude-y' && modelFor('openai', {}) === 'gpt-6-luna' && modelFor('openai', { NOVA_AI_MODEL_OPENAI: 'gpt-z' }) === 'gpt-z'
  && modelFor('google', {}) === 'gemini-3.5-flash-lite' && modelFor('google', { NOVA_AI_MODEL_GOOGLE: 'gemini-3.8-flash' }) === 'gemini-3.8-flash');

// ---- nothing is called unless every switch is on ----------------------------------------------
await setup();
let r = await ask('Are you insured?', { env: { ...PAID_ON, ...KEYS } });
check('Nova\'s AI switch off: no model is called', r.reply === null && r.reason === 'ai_off' && calls.length === 0);
r = await ask('Are you insured?', { agent: { ...agent, ai_enabled: false } });
check('AI off for this business: no model is called', r.reply === null && r.reason === 'ai_off_for_business' && calls.length === 0);
r = await ask('Are you insured?', { env: { ...PAID_ON, NOVA_AI_REPLIES: 'on' } });
check('no model key set: no model is called', r.reply === null && r.reason === 'no_ai_provider' && calls.length === 0);
r = await ask('Are you insured?', { env: { NOVA_AI_REPLIES: 'on', ...KEYS } });
check('spending locked: no model is called', r.reply === null && r.reason === 'spending_locked' && calls.length === 0);
r = await ask('Are you insured?', { agent: { ...agent, monthly_spend_cap_cents: null } });
check('no monthly budget: no model is called', r.reply === null && r.reason === 'no_budget_set' && calls.length === 0);
await db.insert('business_agent_messages', { organization_id: ORG, direction: 'outbound', state: 'sent', body: 'earlier', estimate_cents: 100 });
r = await ask('Are you insured?');
check('monthly budget used up: no model is called', r.reply === null && r.reason === 'monthly_budget_reached' && calls.length === 0);

// ---- the three providers ------------------------------------------------------------------------
await setup();
r = await ask('Are you insured?');
const first = calls[0];
check('Claude answers by default, through Anthropic\'s Messages API with the business\'s key', r.reply === SAID && r.provider === 'anthropic' && r.estimate_cents === AI_COST_CENTS && calls.length === 1
  && first.url === 'https://api.anthropic.com/v1/messages' && first.headers['x-api-key'] === KEYS.ANTHROPIC_API_KEY && first.headers['anthropic-version'] && first.body.model === 'claude-haiku-5-5' && first.body.max_tokens === 300);
check('the model gets this business\'s facts, approved answers, approved prices and the owner\'s answers', first.body.system.includes('Green Lawns') && first.body.system.includes('Saturdays until noon.')
  && first.body.system.includes('Lawn mowing: $40.00') && first.body.system.includes('Car detailing: price set by the team after a look') && first.body.system.includes('Rain dates are free.'));
check('the model never sees another business\'s services or answers, or unapproved drafts', !/Teeth|New patients|Unapproved draft/.test(first.body.system));
check('the model is told to say HANDOFF when the facts do not answer it', /exactly HANDOFF/.test(first.body.system) && first.body.messages[0].content === 'Are you insured?');
resetModels();
r = await ask('Are you insured?', { agent: { ...agent, ai_provider: 'openai' } });
check('GPT answers when the business chose it, through OpenAI\'s chat API', r.reply === SAID && r.provider === 'openai' && r.model === 'gpt-6-luna' && calls[0].url === 'https://api.openai.com/v1/chat/completions'
  && calls[0].headers.Authorization === `Bearer ${KEYS.OPENAI_API_KEY}` && calls[0].body.messages[0].role === 'system' && calls[0].body.messages[0].content.includes('Green Lawns'));
check('GPT: the current limit setting (max_completion_tokens), no thinking on GPT-6, and no unsupported settings on older models', calls[0].body.max_completion_tokens === 1000 && !('max_tokens' in calls[0].body) && calls[0].body.reasoning_effort === 'none');
resetModels();
await ask('Are you insured?', { agent: { ...agent, ai_provider: 'openai' }, env: { ...ON, NOVA_AI_MODEL_OPENAI: 'gpt-4o-mini' } });
check('GPT: an older model chosen by Nova gets no thinking setting', calls[0].body.model === 'gpt-4o-mini' && !('reasoning_effort' in calls[0].body));
resetModels();
r = await ask('Are you insured?', { agent: { ...agent, ai_provider: 'google' } });
check('Gemini answers when the business chose it, through Google\'s generateContent API (its thinking is never sent)', r.reply === SAID && r.provider === 'google' && calls[0].url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'
  && calls[0].headers['x-goog-api-key'] === KEYS.GEMINI_API_KEY && calls[0].body.systemInstruction.parts[0].text.includes('Green Lawns') && calls[0].body.contents[0].parts[0].text === 'Are you insured?');
resetModels();
r = await ask('Are you insured?', { env: { ...ON, NOVA_AI_PROVIDER: 'google' } });
check('Nova\'s default provider is used when the business has no choice', r.provider === 'google' && calls[0].url.includes('generativelanguage'));
resetModels(); down.add('anthropic');
r = await ask('Are you insured?');
check('if Claude is down, GPT answers instead', r.reply === SAID && r.provider === 'openai' && calls.map((c) => c.name).join() === 'anthropic,openai');
resetModels(); down = new Set(['anthropic', 'openai', 'google']);
r = await ask('Are you insured?');
check('if every provider is down, nothing is sent and the rules or a person answer', r.reply === null && r.reason === 'ai_provider_failed' && calls.length === 3);
resetModels();
r = await ask('Are you insured?', { env: { ...PAID_ON, NOVA_AI_REPLIES: 'on', OPENAI_API_KEY: 'sk-oa-test' }, agent: { ...agent, ai_provider: 'anthropic' } });
check('a provider without a key is skipped', r.provider === 'openai' && calls.length === 1 && calls[0].name === 'openai');
resetModels();
r = await ask('Are you insured?', { env: { ...ON, NOVA_AI_MODEL_ANTHROPIC: 'bad model; drop' } });
check('a malformed model name is never sent; the next provider answers', r.provider === 'openai' && calls.every((c) => c.name !== 'anthropic'));
resetModels(); answers.anthropic = 'Sure, mowing is $25 for you.';
r = await ask('How much is mowing for a small yard?');
check('an answer with an unapproved price is not sent, and no second model is asked to try again', r.reply === null && r.reason === 'price_not_approved' && calls.length === 1);
for (const name of ['anthropic', 'openai', 'google']) {
  resetModels(); cutOff.add(name);
  r = await ask('Are you insured?', { agent: { ...agent, ai_provider: name } });
  check(`${name}: an answer cut off at the length limit is never sent`, r.reply === null && r.reason === 'answer_cut_off' && calls.length === 1);
}
resetModels(); answers.anthropic = 'HANDOFF';
r = await ask('Do you trim hedges?');
check('when the model does not know, nothing is sent', r.reply === null && r.reason === 'model_did_not_know');
resetModels(); answers.anthropic = `Book at https://nova-systems.app/start?org=${ORG} any time.`;
r = await ask('How do I book?', { link: `https://nova-systems.app/start?org=${ORG}` });
check('the business\'s own request page may be linked in a message', r.reply === answers.anthropic && calls[0].body.system.includes(`https://nova-systems.app/start?org=${ORG}`));
resetModels(); answers.anthropic = `Book at https://nova-systems.app/start?org=${ORG} any time.`;
r = await ask('How do I book?', { channel: 'voice', link: `https://nova-systems.app/start?org=${ORG}` });
check('on a call no link is given to the model, and an answer with a link is not spoken', r.reply === null && r.reason === 'unknown_link' && !calls[0].body.system.includes('/start?org=') && /spoken on a phone call/.test(calls[0].body.system));

// ---- when the AI answers first, and when the rules do -------------------------------------------
await setup();
const first2 = (text, o = {}) => aiFirst(db, o.agent || agent, { text, channel: o.channel || 'web_chat', customerKey: o.key ?? null, env: o.env || ON, now: NOW, fetchImpl: modelFetch });
check('not a question: the rules answer', (await first2('hi there')) === null && calls.length === 0);
check('a question about a service: the rules quote the approved price', (await first2('Can you mow my grass this week?')) === null && calls.length === 0);
check('asking for a person: the rules hand it to a person', (await first2('Can I talk to a person please?')) === null && calls.length === 0);
check('numbered choices, ACCEPT and cancel stay with the rules', (await first2('2 - is that the earliest one?')) === null && (await first2('Accept Dana Reyes, is that ok?')) === null && (await first2('Cancel my visit, can you?')) === null && calls.length === 0);
check('AI off for this business: the rules answer', (await first2('Are you insured?', { agent: { ...agent, ai_enabled: false } })) === null && calls.length === 0);
r = await first2('Are you insured?');
check('any other question: the AI answers, with the business\'s request page', r?.reply === SAID && calls[0].body.system.includes(`https://nova-systems.app/start?org=${ORG}`));
resetModels();
r = await first2('Are you insured?', { env: { ...ON, APP_BASE_URL: 'https://staging.nova.test/' } });
check('the request page follows the installed app address', calls[0].body.system.includes(`https://staging.nova.test/start?org=${ORG}`));
await db.insert('journeys', { organization_id: ORG, source_channel: 'web_chat', source_event_id: 'conv:web_chat:v_taken:w1', stage: 'quoted', paused: true });
resetModels();
check('a conversation a person has taken over is never answered by the AI', (await first2('Are you insured?', { key: 'web_chat:v_taken' })) === null && calls.length === 0);
r = await first2('Are you insured?', { key: 'web_chat:v_other' });
check('another customer\'s conversation is unaffected', r?.reply === SAID);

// ---- website chat and WhatsApp ----------------------------------------------------------------
await setup();
let n = 0;
const chat = (text, env = ON, ref = 'v1', id = `w${++n}`) => receiveAndReply(db, { agent, channel: 'web_chat', customerRef: ref, messageId: id, text, env, now: NOW, send: senderFor('web_chat') });
const outbound = () => db.t.business_agent_messages.filter((m) => m.direction === 'outbound');
r = await chat('Are you insured?');
check('website chat: a question is answered by the AI', r.state === 'sent' && r.reply === SAID && r.ai === 'anthropic');
check('website chat: the AI answer is saved with its model and its planned cost (1¢)', outbound().length === 1 && outbound()[0].model === 'ai:anthropic' && outbound()[0].estimate_cents === 1 && outbound()[0].body === SAID);
check('the AI\'s cost counts toward the business\'s monthly budget', (await monthSpendCents(db, ORG, NOW)) === 1);
const before = calls.length;
r = await chat('Are you insured?', ON, 'v1', `w${n}`);
check('the same message delivered twice calls no model twice', r.repeated === true && calls.length === before);
r = await chat('Can you mow my grass this week?');
check('website chat: a service request still gets the approved quote from the rules', r.state === 'sent' && /\$40\.00/.test(r.reply) && !r.ai && calls.length === before);
resetModels();
r = await chat('Do you work in the rain?', { NOVA_AI_REPLIES: 'on', ...KEYS }, 'v2');
check('website chat with spending locked: no model is called and the rules still answer for free', r.state === 'sent' && !r.ai && calls.length === 0 && typeof r.reply === 'string');
resetModels(); answers.anthropic = 'Yes, and today it is only $19!';
r = await chat('Do you have any deals?', ON, 'v3');
check('website chat: an AI answer that fails a check is never shown; the rules answer', r.state === 'sent' && !r.ai && !/\$19/.test(r.reply) && calls.length === 1);
await chat('Can you mow my grass?', ON, 'v4');
const taken = db.t.journeys.find((j) => String(j.source_event_id).startsWith('conv:web_chat:v4:'));
taken.paused = true; resetModels();
r = await chat('Are you insured?', ON, 'v4');
check('website chat: once a person takes over, neither the AI nor the rules reply', r.reply === null && r.state === 'handed_to_person' && calls.length === 0);

await setup();
const waSent = [];
const wa = (text, ok = true) => receiveAndReply(db, { agent, channel: 'whatsapp', customerRef: CALLER, phone: CALLER, messageId: 'SM' + crypto.randomBytes(16).toString('hex'), text, env: ON, now: NOW,
  send: async (t) => { waSent.push(t); return ok ? { ok: true, id: 'SM' + crypto.randomBytes(16).toString('hex') } : { ok: false }; } });
r = await wa('Are you insured?');
check('WhatsApp: a question is answered by the AI and sent once', r.state === 'sent' && r.ai === 'anthropic' && waSent.join() === SAID);
check('WhatsApp: the planned cost is the message plus the answer (2¢ + 1¢)', outbound()[0].estimate_cents === 3 && outbound()[0].model === 'ai:anthropic');
r = await wa('Do you work weekends?', false);
const th = db.t.business_agent_threads.find((t) => t.channel === 'whatsapp');
check('WhatsApp: if the provider refuses the AI answer, it is marked failed, costs nothing, and a person is flagged', r.state === 'failed' && outbound()[1].state === 'failed' && outbound()[1].estimate_cents === 0 && th.needs_human === true);

// ---- phone calls -------------------------------------------------------------------------------
await setup();
const CA = () => 'CA' + crypto.randomBytes(16).toString('hex');
let sid = CA();
const ring = (o = {}) => businessCallTwiml(db, { p: { CallSid: sid, From: CALLER, To: BIZ, ...(o.p || {}) }, step: o.step || '', turn: o.turn ?? null, env: o.env || ON, now: NOW,
  senderFor: () => async () => ({ ok: true, id: 'SM' + crypto.randomBytes(16).toString('hex') }), fetchImpl: modelFetch });
const theCall = () => db.t.business_calls.find((c) => c.call_sid === sid);
let x = await ring();
check('calls: the assistant answers (assistant first)', /step=assistant&amp;turn=1/.test(x) && theCall().estimate_cents === CALL_COST.assistant);
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'Are you insured?' } });
check('calls: a caller\'s question is answered by the AI, then the assistant asks what they need', x.includes(`<Say>${SAID} Is there a service I can help you with today?</Say>`) && /turn=2/.test(x));
check('calls: the answer is spoken from a prompt written for a phone call, and its cost is added to the call', /spoken on a phone call/.test(calls[0].body.system) && theCall().estimate_cents === CALL_COST.assistant + AI_COST_CENTS);
x = await ring({ step: 'assistant', turn: 2, p: { SpeechResult: 'Can you mow my grass?' } });
check('calls: after the answer, a service request still gets the approved price', /Lawn mowing is \$40\./.test(x) && /say yes or no/.test(x) && calls.length === 1);
sid = CA(); await ring(); answers.anthropic = 'Visit https://evil.test for prices.';
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'Where can I see your prices?' } });
check('calls: an AI answer that fails a check is never spoken', !x.includes('evil.test') && /did not catch which service/.test(x) && theCall().estimate_cents === CALL_COST.assistant);
sid = CA(); await setup({ ai_enabled: false }); await ring();
x = await ring({ step: 'assistant', turn: 1, p: { SpeechResult: 'Are you insured?' } });
check('calls: AI off for this business: no model, the assistant asks which service', calls.length === 0 && /did not catch which service/.test(x));

// ---- the owner's settings ----------------------------------------------------------------------
check('settings: AI on/off, the provider and the owner\'s answers can be saved', JSON.stringify(channelPatch({ ai_enabled: true, ai_provider: 'google', faq: ' We are insured. ' }, {}).patch) === JSON.stringify({ ai_enabled: true, ai_provider: 'google', faq: 'We are insured.' }));
check('settings: an unknown provider is refused', /Claude, GPT or Gemini/.test(channelPatch({ ai_provider: 'llama' }, {}).error || ''));
check('settings: the owner\'s answers are limited to 4,000 characters', /4,000/.test(channelPatch({ faq: 'x'.repeat(4001) }, {}).error || '') && channelPatch({ faq: '' }, {}).patch.faq === null);
check('settings: the AI fields are visible to the owner', safeAgent({ ai_enabled: true, ai_provider: 'openai', faq: 'hi' }).ai_provider === 'openai');

console.log(`\n${pass}/${pass + fail} AI answer checks passed (stubbed Claude, GPT and Gemini — no model, carrier or database contacted, nothing spent)`);
process.exit(fail ? 1 : 0);
