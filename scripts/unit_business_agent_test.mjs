// The per-business call and messaging agent (api/_businessAgent.js), proven with an in-memory
// PostgREST stand-in and a recording fetch. No database, model, carrier or network is touched.
import crypto from 'node:crypto';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NUM_A = '+18605550101', NUM_B = '+18605550102', NOVA = '+18609626160', CUSTOMER = '+12035550199';
const UNLOCKED = { NOVA_SPENDING_LOCK: 'disabled', NOVA_BILLABLE_DISPATCH_ENABLED: 'true', ANTHROPIC_API_KEY: 'k', NOVA_AUTOMATION_MODEL: 'claude-test-1', TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32), TWILIO_AUTH_TOKEN: 'token-token-token-1', TWILIO_PHONE_NUMBER: NOVA };

let db, outbound;
function reset() {
  db = { business_agents: [], business_agent_threads: [], business_agent_messages: [], voice_knowledge_base: [], voice_configurations: [], journeys: [], journey_events: [], journey_documents: [], business_services: [], business_offers: [], crm_contacts: [], crm_deals: [], voice_calendar_slots: [], business_calls: [] };
  outbound = [];
}
const match = (row, params) => [...params].every(([k, v]) => {
  if (['select', 'order', 'limit'].includes(k)) return true;
  if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
  if (v.startsWith('gte.')) return String(row[k]) >= v.slice(4);
  if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(row[k]));
  return true;
});
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(String(url)), method = opts.method || 'GET';
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.host === 'api.anthropic.com') { outbound.push({ to: 'model', body: JSON.parse(opts.body) }); return json(200, { content: [{ type: 'text', text: 'Thanks for reaching out. What day works for you?' }] }); }
  if (u.host === 'api.twilio.com') { const b = Object.fromEntries(new URLSearchParams(opts.body)); outbound.push({ to: 'carrier', body: b }); return json(201, { sid: 'SM' + crypto.randomBytes(16).toString('hex'), status: 'queued' }); }
  if (u.pathname.startsWith('/rest/v1/rpc/')) return json(200, []);
  const table = u.pathname.replace('/rest/v1/', '');
  if (!db[table]) return json(404, {});
  if (method === 'GET') {
    let rows = db[table].filter((r) => match(r, u.searchParams));
    if ((u.searchParams.get('order') || '').includes('desc')) rows = [...rows].reverse();
    const limit = Number(u.searchParams.get('limit')); return json(200, limit ? rows.slice(0, limit) : rows);
  }
  const body = JSON.parse(opts.body);
  if (method === 'POST') {
    if (table === 'business_agents' && body.phone_number && db[table].some((r) => r.phone_number === body.phone_number)) return json(409, {});
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), opted_out: false, needs_human: false, ...body };
    db[table].push(row); return json(201, [row]);
  }
  if (method === 'PATCH') {
    const rows = db[table].filter((r) => match(r, u.searchParams));
    if (table === 'business_agents' && body.phone_number && db[table].some((r) => r.phone_number === body.phone_number && !rows.includes(r))) return json(409, {});
    rows.forEach((r) => Object.assign(r, body)); return json(200, rows);
  }
  return json(405, {});
};

const { buildBusinessPrompt, findAgentByNumber, handleBusinessSms, handleAgentAdmin } = await import('../api/_businessAgent.js');
const { handleUnifiedTwilio } = await import('../api/_unifiedTwilio.js');
const { twilioSignature } = await import('../api/_wave1.js');

function seed() {
  reset();
  db.business_agents.push(
    { id: crypto.randomUUID(), organization_id: ORG_A, business_name: 'Maria Plumbing', agent_name: 'Jo', industry: 'plumbing', phone_number: NUM_A, services: 'Leak repair and water heaters', booking_url: 'https://book.test/maria', never_say: 'financing', tone: 'friendly', sms_enabled: true, status: 'active', monthly_spend_cap_cents: 500 },
    { id: crypto.randomUUID(), organization_id: ORG_B, business_name: 'Bright Smile Dental', agent_name: 'Sam', phone_number: NUM_B, services: 'Cleanings and fillings', tone: 'calm', sms_enabled: true, status: 'active', monthly_spend_cap_cents: 500 },
  );
  db.voice_knowledge_base.push(
    { organization_id: ORG_A, question: 'Do you work weekends?', answer: 'Saturdays until noon.', status: 'approved' },
    { organization_id: ORG_A, question: 'Secret draft', answer: 'Unapproved answer.', status: 'draft' },
    { organization_id: ORG_B, question: 'Do you take new patients?', answer: 'Yes.', status: 'approved' },
  );
  db.voice_configurations.push({ organization_id: ORG_A, business_hours: { mon: [{ start: '08:00', end: '17:00' }], sun: [] }, timezone: 'America/New_York', emergency_script: 'Shut off the main valve.' });
}
const sid = () => 'SM' + crypto.randomBytes(16).toString('hex');
function response() {
  const res = { statusCode: 200, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; return this; }, send(d) { this.body = d; return this; } };
  return res;
}
async function text(to, body, env = UNLOCKED, MessageSid = sid()) {
  Object.assign(process.env, { NOVA_SPENDING_LOCK: env.NOVA_SPENDING_LOCK || '', NOVA_BILLABLE_DISPATCH_ENABLED: env.NOVA_BILLABLE_DISPATCH_ENABLED || '' });
  const agent = await findAgentByNumber(to); const res = response();
  await handleBusinessSms({}, res, { From: CUSTOMER, To: to, Body: body, MessageSid }, env, agent); return res;
}
const carrier = () => outbound.filter((o) => o.to === 'carrier');
const model = () => outbound.filter((o) => o.to === 'model');
const msgs = (f) => db.business_agent_messages.filter(f);

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

// ---- prompt
seed();
const agentA = db.business_agents[0];
const prompt = buildBusinessPrompt({ agent: agentA, knowledge: db.voice_knowledge_base.filter((k) => k.organization_id === ORG_A), config: db.voice_configurations[0], channel: 'sms' });
check('prompt speaks as the business and never as Nova', prompt.includes('Maria Plumbing') && !/nova/i.test(prompt));
check('prompt carries the business hours, including a closed day', prompt.includes('Monday: 08:00 to 17:00') && prompt.includes('Sunday: closed'));
check('prompt uses approved answers only', prompt.includes('Saturdays until noon.') && !prompt.includes('Unapproved answer.'));
check('prompt carries the owner\'s ruled-out topics and the emergency script', prompt.includes('financing') && prompt.includes('Shut off the main valve.'));
check('prompt tells the agent to admit it is an AI and never invent prices', /AI assistant for Maria Plumbing/.test(prompt) && /Never invent a price/.test(prompt));
check('with no hours on file the prompt says so instead of guessing', buildBusinessPrompt({ agent: db.business_agents[1] }).includes('Opening hours are not on file'));
check('voice prompt asks for short spoken sentences', buildBusinessPrompt({ agent: agentA, channel: 'voice' }).includes('phone call'));

// ---- two businesses, two numbers
seed();
let r = await text(NUM_A, 'My sink is leaking, can someone come today?');
check('a text to business A is answered from A\'s own number', r.statusCode === 200 && carrier().length === 1 && carrier()[0].body.From === NUM_A && carrier()[0].body.To === CUSTOMER);
check('the model was given A\'s facts and none of B\'s', model()[0].body.system.includes('Maria Plumbing') && !model()[0].body.system.includes('Bright Smile'));
r = await text(NUM_B, 'Do you take new patients?');
check('a text to business B is answered from B\'s number with B\'s facts', carrier()[1].body.From === NUM_B && model()[1].body.system.includes('Bright Smile Dental') && !model()[1].body.system.includes('Maria Plumbing'));
check('each conversation is stored under its own organization', db.business_agent_threads.length === 2 && db.business_agent_threads[0].organization_id === ORG_A && db.business_agent_threads[1].organization_id === ORG_B
  && msgs((m) => m.organization_id === ORG_A).length === 2 && msgs((m) => m.organization_id === ORG_B).length === 2);
check('a number that belongs to no business finds no agent', (await findAgentByNumber('+18605559999')) === null);

// ---- spending rules
seed();
r = await text(NUM_A, 'Hello?', { ...UNLOCKED, NOVA_SPENDING_LOCK: '', NOVA_BILLABLE_DISPATCH_ENABLED: '' });
check('with spending locked: message saved, nothing sent, flagged for a human', carrier().length === 0 && model().length === 0 && msgs((m) => m.direction === 'inbound').length === 1
  && msgs((m) => m.state === 'held' && m.held_reason === 'spending_locked').length === 1 && db.business_agent_threads[0].needs_human === true);
seed(); db.business_agents[0].monthly_spend_cap_cents = null;
await text(NUM_A, 'Hello?');
check('with no monthly cap set: nothing sent', carrier().length === 0 && msgs((m) => m.held_reason === 'no_budget_set').length === 1);
seed(); db.business_agents[0].monthly_spend_cap_cents = 2;
await text(NUM_A, 'First'); await text(NUM_A, 'Second');
check('once the monthly cap is used up the agent stops sending', carrier().length === 1 && msgs((m) => m.held_reason === 'monthly_budget_reached').length === 1);
seed(); db.business_agents[0].status = 'paused';
await text(NUM_A, 'Hello?');
check('a paused agent does not reply', carrier().length === 0 && msgs((m) => m.held_reason === 'agent_not_active').length === 1);

// ---- opt-out and retries
seed();
await text(NUM_A, 'STOP');
check('STOP opts the customer out and gets no agent reply', db.business_agent_threads[0].opted_out === true && carrier().length === 0 && model().length === 0);
await text(NUM_A, 'actually, yes, call me');
check('after STOP an ordinary message (even "yes") is not answered', carrier().length === 0 && msgs((m) => m.held_reason === 'customer_opted_out').length === 1);
await text(NUM_A, 'START'); await text(NUM_A, 'Are you open Saturday?');
check('START clears the opt-out and the agent answers again', db.business_agent_threads[0].opted_out === false && carrier().length === 1);
seed(); const dup = sid();
await text(NUM_A, 'Hi', UNLOCKED, dup); await text(NUM_A, 'Hi', UNLOCKED, dup);
check('a retried webhook for the same message is stored and answered once', msgs((m) => m.direction === 'inbound').length === 1 && carrier().length === 1);

// ---- the real webhook entry point
seed(); Object.assign(process.env, UNLOCKED);
async function webhook(to) {
  const p = { AccountSid: UNLOCKED.TWILIO_ACCOUNT_SID, From: CUSTOMER, To: to, Body: 'Need a quote', MessageSid: sid() };
  const res = response();
  await handleUnifiedTwilio({ method: 'POST', query: {}, body: p, headers: { 'x-twilio-signature': twilioSignature('https://nova-systems.app/webhooks/twilio-message', p, UNLOCKED.TWILIO_AUTH_TOKEN) } }, res, 'twilio-message');
  return res;
}
r = await webhook(NUM_A);
check('a signed carrier webhook to a business number reaches that business\'s agent', r.statusCode === 200 && carrier().length === 1 && carrier()[0].body.From === NUM_A);
r = await webhook('+18605559999');
check('a signed webhook to a number nobody owns is refused', r.statusCode === 403 && carrier().length === 1);
{
  const p = { AccountSid: UNLOCKED.TWILIO_ACCOUNT_SID, From: CUSTOMER, To: NUM_A, Body: 'x', MessageSid: sid() }; const res = response();
  await handleUnifiedTwilio({ method: 'POST', query: {}, body: p, headers: { 'x-twilio-signature': 'forged' } }, res, 'twilio-message');
  check('an unsigned request to a business number is refused before any agent runs', res.statusCode === 403 && carrier().length === 1);
}

// ---- staff API
const deps = (allowed) => ({ requireOrgAccess: async (_q, res) => { if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (s, n = 2000) => (typeof s === 'string' ? s.trim().slice(0, n) : ''), rateLimit: () => true });
async function admin(method, payload, allowed = true, op = '') {
  const res = response();
  await handleAgentAdmin({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined }, res, op, deps(allowed)); return res;
}
seed();
r = await admin('POST', { organization_id: ORG_A, business_name: 'Hijacked', phone_number: NUM_A }, false);
check('someone without permission in that organization cannot change its agent', r.statusCode === 403 && db.business_agents[0].business_name === 'Maria Plumbing');
r = await admin('GET', { organization_id: ORG_A }, false);
check('someone without permission cannot read it either', r.statusCode === 403);
r = await admin('POST', { organization_id: ORG_A, business_name: 'Maria Plumbing LLC', phone_number: '(860) 555-0101', status: 'active', sms_enabled: true, monthly_spend_cap_cents: 300 });
check('an owner can update their agent; the number is stored in standard form', r.statusCode === 200 && db.business_agents[0].business_name === 'Maria Plumbing LLC' && db.business_agents[0].phone_number === NUM_A);
r = await admin('POST', { organization_id: ORG_B, business_name: 'Bright Smile Dental', phone_number: NUM_A });
check('one business cannot take another business\'s number', r.statusCode === 409 && db.business_agents[1].phone_number === NUM_B);
r = await admin('POST', { organization_id: ORG_B, business_name: 'Bright Smile Dental', status: 'active' });
check('an agent cannot go active without a phone number', r.statusCode === 400);
r = await admin('POST', { organization_id: ORG_B, business_name: 'Bright Smile Dental', phone_number: NUM_B, monthly_spend_cap_cents: -5 });
check('a negative spending cap is refused', r.statusCode === 400);
r = await admin('POST', { organization_id: ORG_B, business_name: 'Bright Smile Dental', phone_number: NUM_B });
check('saving without re-confirming SMS turns it off rather than inheriting it', r.statusCode === 200 && db.business_agents[1].sms_enabled === false && db.business_agents[1].monthly_spend_cap_cents === null);
r = await admin('GET', { organization_id: ORG_A }, true, 'threads');
check('the conversation list returns only that organization\'s threads', r.statusCode === 200 && r.body.threads.every((t) => t.organization_id === ORG_A));

// ---- a business with published services is answered by the journey workers, not a model
seed();
db.business_services.push({ id: crypto.randomUUID(), organization_id: ORG_A, name: 'Drain cleaning', keywords: ['drain', 'clog'], price_cents: 12000, price_approved: true, deposit_cents: null, terms_text: null, terms_approved: false, active: true, created_at: '2026-11-01T00:00:00Z' });
r = await text(NUM_A, 'my drain is clogged');
check('the reply is the quote from the approved price, sent from the business number', carrier().length === 1 && carrier()[0].body.From === NUM_A && /\$120\.00/.test(carrier()[0].body.Body));
check('no model was called to write it', model().length === 0 && msgs((m) => m.direction === 'outbound')[0].model === 'journey_rules');
check('the customer now has a journey in that business only', db.journeys.length === 1 && db.journeys[0].organization_id === ORG_A && db.journeys[0].source_channel === 'sms');
r = await text(NUM_B, 'my drain is clogged');
check('another business without services still uses its own assistant', model().length === 1 && model()[0].body.system.includes('Bright Smile Dental') && db.journeys.length === 1);
seed();
delete db.journeys;
r = await text(NUM_A, 'hello');
check('if the journey records cannot be read, nothing is sent and a person is flagged', carrier().length === 0 && model().length === 0 && db.business_agent_threads[0].needs_human === true && msgs((m) => m.state === 'held').length === 1);

console.log(`\n${pass}/${pass + fail} business agent checks passed (in-memory stand-in — no database, model or carrier contacted, nothing sent)`);
process.exit(fail ? 1 : 0);
