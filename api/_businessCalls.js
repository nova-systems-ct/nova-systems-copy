// Phone calls to a client business's number (Nova system 11) and the premium voice option.
//
// The business picks how its phone is answered (business_agents.call_mode):
//   off                      calls are not taken here: the caller hears a busy tone, nothing is spent
//   forward_only             ring the owner's phone; if nobody picks up, the call is "missed"
//   forward_then_assistant   ring the owner first; if nobody picks up, the assistant answers
//   assistant_first          the assistant answers every call
// A missed caller can get one text back (business_agents.missed_call_text) so they are not lost.
//
// The built-in assistant follows fixed rules and calls no AI model. It says it is automated and that
// what the caller says is written down, asks what they need, gives the owner-approved price when
// there is one, and texts the caller a private link to see the quote, accept it, pay and book. It
// never agrees a price, time or term by voice. Anything else is passed to a person for a call back.
// With voice_provider 'elevenlabs' a premium, natural-sounding agent answers instead; it can only
// act through voiceTool() below, under the same rules.
//
// Calls cost money (minutes, speech recognition, texts). Nothing is answered, forwarded or texted
// unless the spending switch is on and the business's monthly cap has room; otherwise the caller
// hears a busy tone and the call is still logged. Costs are planning numbers in cents, not a bill.
import crypto from 'node:crypto';
import { normalizePhone } from './_wave1.js';
import { CHANNELS, spendBlocked, blockedReason } from './_businessChannels.js';
import { senderFor as realSenderFor } from './_channelSend.js';
import { startJourney, chooseService, matchService, customerLink } from './_journey.js';

export const CALL_COST = { forward: 5, assistant: 15, premium: 40, text: CHANNELS.sms.estimate };
const BASE = 'https://nova-systems.app';
const MAX_TURNS = 6;
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const listText = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const pretty = (p) => (/^\+1\d{10}$/.test(p || '') ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p || 'a caller');

// The exact addresses given to Twilio. The signature check rebuilds them the same way.
export const CALL_STEPS = new Set(['after-dial', 'assistant', 'status']);
export const callUrl = (step, turn) => `${BASE}/webhooks/business-call${step ? `?step=${step}${Number.isInteger(turn) ? `&turn=${turn}` : ''}` : ''}`;

const say = (text) => `<Say>${esc(text)}</Say>`;
const bye = (text) => `${say(text)}<Hangup/>`;
const ask = (text, turn) => `<Gather input="speech" action="${esc(callUrl('assistant', turn))}" method="POST" timeout="6" speechTimeout="auto" language="en-US" actionOnEmptyResult="true">${say(text)}</Gather>${bye('Sorry, I did not hear anything. Goodbye.')}`;
const BUSY = '<Reject reason="busy"/>';
const WANTS_PERSON = /\b(person|human|someone|somebody|representative|manager|owner|operator|call me|call back|callback|speak to|talk to)\b/i;
const YES = /\b(yes|yeah|yep|yup|sure|ok|okay|please|send it|go ahead|absolutely|of course|sounds good)\b/i;
const NO = /\b(no|nope|nah|don'?t|do not|not now)\b/i;

async function callRecord(db, agent, p) {
  const sid = String(p.CallSid || '');
  const found = await one(db, 'business_calls', { call_sid: sid });
  if (found) return found.agent_id === agent.id ? found : null;
  try { return await db.insert('business_calls', { organization_id: agent.organization_id, agent_id: agent.id, call_sid: sid, from_phone: normalizePhone(p.From) || null, to_phone: agent.phone_number, outcome: 'ringing' }); }
  catch (err) { if (err.status !== 409) throw err; const again = await one(db, 'business_calls', { call_sid: sid }); return again?.agent_id === agent.id ? again : null; }
}
const setCall = async (db, call, patch) => Object.assign(call, (await db.update('business_calls', { id: call.id, organization_id: call.organization_id }, patch))[0] || patch);

// Texts a caller from the business number under the same rules as every text the business sends
// (texting on, not opted out, budget left), and files it in the caller's text conversation so a
// reply carries on there.
async function textCaller(db, agent, phone, body, { env, now, senderFor, kind }) {
  if (!agent.phone_number || !phone) return { sent: false, reason: 'no_number' };
  let thread = await one(db, 'business_agent_threads', { agent_id: agent.id, channel: 'sms', customer_ref: phone });
  const blocked = await blockedReason(db, agent, 'sms', thread, { env, now });
  if (blocked) return { sent: false, reason: blocked };
  let out;
  try { out = await senderFor('sms', agent, { phone, ref: phone }, env)(body); } catch { out = null; }
  if (!out?.ok) return { sent: false, reason: 'provider_did_not_accept' };
  if (!thread) {
    try { thread = await db.insert('business_agent_threads', { organization_id: agent.organization_id, agent_id: agent.id, channel: 'sms', customer_phone: phone, customer_ref: phone }); }
    catch (err) { if (err.status !== 409) throw err; thread = await one(db, 'business_agent_threads', { agent_id: agent.id, channel: 'sms', customer_ref: phone }); }
  }
  await db.insert('business_agent_messages', { organization_id: agent.organization_id, thread_id: thread.id, direction: 'outbound', body, provider_sid: out.id || null, state: 'sent', model: kind, estimate_cents: CALL_COST.text });
  await db.update('business_agent_threads', { id: thread.id, organization_id: agent.organization_id }, { last_outbound_at: now.toISOString() });
  return { sent: true };
}

// One short text to the owner's alert number. Its planned cost is added to the call.
async function alertOwner(db, agent, call, text, { env, now, senderFor }) {
  if (!agent.owner_alert_phone || !agent.phone_number) return false;
  if (await spendBlocked(db, agent, CALL_COST.text, { env, now })) return false;
  let out;
  try { out = await senderFor('sms', agent, { phone: agent.owner_alert_phone }, env)(text.slice(0, 600)); } catch { out = null; }
  if (!out?.ok) return false;
  await setCall(db, call, { estimate_cents: (call.estimate_cents || 0) + CALL_COST.text });
  return true;
}

async function missed(db, agent, call, { env, now, senderFor, reason }) {
  const patch = { outcome: 'missed', ...(reason ? { held_reason: reason } : {}) };
  let texted = false;
  if (agent.missed_call_text === true && call.from_phone && !call.texted_back) {
    // At most one text per caller per day, however many times they call.
    const since = new Date(now.getTime() - 86400000).toISOString();
    const recent = await db.select('business_calls', { agent_id: agent.id, from_phone: call.from_phone, texted_back: true, started_at: { gte: since } }, { limit: 1 });
    if (!recent.length) {
      const org = await one(db, 'organizations', { id: agent.organization_id });
      const link = org?.slug ? `${BASE}/b/${org.slug}` : `${BASE}/start?org=${agent.organization_id}`;
      const r = await textCaller(db, agent, call.from_phone, `Sorry we missed your call at ${agent.business_name}. Reply to this text and we will help, or request a quote here: ${link} Reply STOP to opt out.`, { env, now, senderFor, kind: 'missed_call_text' });
      texted = r.sent;
      if (!r.sent && !reason) patch.held_reason = `text_not_sent:${r.reason}`;
    }
  }
  await setCall(db, call, { ...patch, texted_back: call.texted_back === true || texted });
  return texted;
}

async function toPerson(db, agent, call, { env, now, senderFor, reason, lead = '' }) {
  await setCall(db, call, { outcome: 'callback_requested', held_reason: reason || null, ended_at: now.toISOString() });
  const said = (Array.isArray(call.caller_said) ? call.caller_said : []).map((t) => t.said).filter(Boolean).join(' / ').slice(0, 300);
  await alertOwner(db, agent, call, `Call back needed: ${pretty(call.from_phone)} called ${agent.business_name}.${said ? ` They said: "${said}"` : ''}`, { env, now, senderFor });
  const next = call.from_phone ? 'someone will call you back at this number' : 'please call again or message us on our website';
  return bye(`${lead}I have passed your call to the team, and ${next}. Thank you for calling ${agent.business_name}. Goodbye.`);
}

// ElevenLabs answers the call (premium voice). Returns the TwiML it gives, or null.
async function premiumTwiml(env, agent, call, fetchImpl) {
  if (!env.ELEVENLABS_API_KEY || !agent.voice_provider_agent_id || !call.from_phone) return null;
  try {
    const r = await fetchImpl('https://api.elevenlabs.io/v1/convai/twilio/register-call', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agent.voice_provider_agent_id, from_number: call.from_phone, to_number: agent.phone_number, direction: 'inbound',
        conversation_initiation_client_data: { dynamic_variables: { business_name: agent.business_name, call_sid: call.call_sid } } }),
    });
    if (!r.ok) return null;
    let text = await r.text();
    if (text.startsWith('"')) text = JSON.parse(text);
    const inner = String(text).match(/<Response>([\s\S]*)<\/Response>/)?.[1];
    return inner && /<Connect>[\s\S]*<Stream\s/.test(inner) ? inner : null;
  } catch { return null; }
}

async function startAssistant(db, agent, call, { env, now, senderFor, fetchImpl, answered }) {
  const services = await db.select('business_services', { organization_id: agent.organization_id, active: true }, { limit: 50 });
  const cannot = async (reason) => {
    if (!answered) { await setCall(db, call, { outcome: 'not_taking_calls', held_reason: reason }); return BUSY; } // nothing answered, nothing spent
    const texted = await missed(db, agent, call, { env, now, senderFor, reason });
    return bye(`Sorry, nobody can take your call right now. ${texted ? 'We just sent you a text so you can reach us.' : 'Please try again later.'}`);
  };
  if (!services.length) return cannot('no_services_published');
  if (agent.voice_provider === 'elevenlabs' && !(await spendBlocked(db, agent, CALL_COST.premium, { env, now }))) {
    const twiml = await premiumTwiml(env, agent, call, fetchImpl);
    if (twiml) { await setCall(db, call, { outcome: 'assistant', estimate_cents: (call.estimate_cents || 0) + CALL_COST.premium }); return twiml; }
  }
  const blocked = await spendBlocked(db, agent, CALL_COST.assistant, { env, now });
  if (blocked) return cannot(blocked);
  await setCall(db, call, { outcome: 'assistant', estimate_cents: (call.estimate_cents || 0) + CALL_COST.assistant });
  return ask(`Hi, you have reached ${agent.business_name}. I am the automated assistant, and what you say is written down for the team. What can we help you with today?`, 1);
}

async function sendLink(db, agent, call, ctx) {
  const { now } = ctx;
  if (!call.from_phone) return toPerson(db, agent, call, { ...ctx, reason: 'no_caller_number' });
  let j = call.journey_id ? await one(db, 'journeys', { id: call.journey_id, organization_id: agent.organization_id }) : null;
  if (!j) {
    const first = (Array.isArray(call.caller_said) ? call.caller_said : []).map((t) => t.said).find(Boolean) || null;
    j = (await startJourney(db, { orgId: agent.organization_id, channel: 'voice', eventId: `call:${call.call_sid}`, name: 'Phone caller', phone: call.from_phone, text: first, now })).journey;
    if (j.stage === 'inquiry' && call.service_id) { try { await chooseService(db, j, call.service_id, { now }); } catch (err) { if (!err.expected) throw err; } }
    await setCall(db, call, { journey_id: j.id });
  }
  const link = await customerLink(db, j);
  const r = await textCaller(db, agent, call.from_phone, `${agent.business_name}: here is your private link to see your quote and book a time: ${link} Reply STOP to opt out.`, { ...ctx, kind: 'call_link' });
  if (r.sent) { await setCall(db, call, { outcome: 'link_sent', texted_back: true, ended_at: now.toISOString() }); return bye(`Done. The link is on its way by text. Thank you for calling ${agent.business_name}. Goodbye.`); }
  return toPerson(db, agent, call, { ...ctx, reason: `text_not_sent:${r.reason}`, lead: 'I could not send a text just now, so ' });
}

async function assistantTurn(db, agent, call, p, turn, ctx) {
  if (call.outcome !== 'assistant' || turn <= (call.turns || 0)) return bye(`Thank you for calling ${agent.business_name}. Goodbye.`);
  const said = String(p.SpeechResult || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  await setCall(db, call, { caller_said: [...(Array.isArray(call.caller_said) ? call.caller_said : []), { turn, said }].slice(-20), turns: Math.min(turn, 20) });
  if (turn > MAX_TURNS) return toPerson(db, agent, call, { ...ctx, reason: 'too_many_turns' });
  if (said && WANTS_PERSON.test(said)) return toPerson(db, agent, call, { ...ctx, reason: 'caller_asked' });
  if (!call.service_id) {
    const services = await db.select('business_services', { organization_id: agent.organization_id, active: true }, { limit: 50 });
    const svc = said ? matchService(said, services) : null;
    if (!svc && said && agent.ai_enabled === true) { // a question: the business's AI answers it, then asks again
      let ai = null;
      try { const { aiFirst } = await import('./_aiReply.js'); ai = await aiFirst(db, agent, { text: said, channel: 'voice', env: ctx.env, now: ctx.now, fetchImpl: ctx.fetchImpl }); } catch { ai = null; }
      if (ai?.reply) { await setCall(db, call, { estimate_cents: (call.estimate_cents || 0) + ai.estimate_cents }); return ask(`${ai.reply} Is there a service I can help you with today?`, turn + 1); }
    }
    if (!svc) {
      if (turn >= 3) return toPerson(db, agent, call, { ...ctx, reason: 'service_not_understood' });
      return ask(`${said ? 'Sorry, I did not catch which service you need.' : 'Sorry, I did not hear you.'} We do ${listText(services.slice(0, 4).map((s) => s.name))}. Which one do you need?`, turn + 1);
    }
    await setCall(db, call, { service_id: svc.id });
    const price = svc.price_approved === true && Number.isInteger(svc.price_cents) ? `${svc.name} is ${money(svc.price_cents)}.` : `The team prices ${svc.name} after a quick look.`;
    return ask(`${price} I can text you a private link to see your quote and book a time. Should I text it to the number you are calling from? Please say yes or no.`, turn + 1);
  }
  const yes = YES.test(said), no = NO.test(said);
  if (yes && !no) return sendLink(db, agent, call, ctx);
  if (no && !yes) { await setCall(db, call, { ended_at: ctx.now.toISOString() }); return bye(`No problem. Thank you for calling ${agent.business_name}. Goodbye.`); }
  if (turn >= MAX_TURNS) return toPerson(db, agent, call, { ...ctx, reason: 'answer_not_understood' });
  return ask('Sorry, should I text you the link? Please say yes or no.', turn + 1);
}

// One Twilio request about a call to a client business. The caller of this function has ALREADY
// verified Twilio's signature and account. Returns the TwiML that goes inside <Response>, or null
// when the number belongs to no client business.
export async function businessCallTwiml(db, { p, step = '', turn = null, env = process.env, now = new Date(), senderFor = realSenderFor, fetchImpl = fetch }) {
  const to = normalizePhone(p.To);
  const agent = to ? await one(db, 'business_agents', { phone_number: to }) : null;
  if (!agent || !/^CA[0-9a-fA-F]{32}$/.test(String(p.CallSid || ''))) return null;
  const call = await callRecord(db, agent, p);
  if (!call) return null;
  const ctx = { env, now, senderFor, fetchImpl };

  if (step === 'status') { // the call ended (the number's "call status changes" address)
    if (!['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(p.CallStatus)) return '';
    if (call.outcome === 'ringing') await missed(db, agent, call, ctx);
    await setCall(db, call, { ended_at: call.ended_at || now.toISOString() });
    return '';
  }
  if (step === 'after-dial') {
    if (p.DialCallStatus === 'completed') { await setCall(db, call, { outcome: 'answered' }); return '<Hangup/>'; }
    if (agent.call_mode === 'forward_then_assistant') return startAssistant(db, agent, call, { ...ctx, answered: true });
    const texted = await missed(db, agent, call, ctx);
    return bye(`Sorry we missed your call. ${texted ? 'We just sent you a text so you can reach us.' : 'Please try again later.'}`);
  }
  if (step === 'assistant') return assistantTurn(db, agent, call, p, turn, ctx);

  // A new call.
  const mode = agent.call_mode || 'off';
  if (agent.status !== 'active' || mode === 'off') { await setCall(db, call, { outcome: 'not_taking_calls', held_reason: agent.status !== 'active' ? 'business_not_active' : 'calls_off' }); return BUSY; }
  if (call.outcome !== 'ringing') return bye(`Thank you for calling ${agent.business_name}. Goodbye.`); // a repeated first request
  if (mode === 'assistant_first' || (mode === 'forward_then_assistant' && !agent.forward_phone)) return startAssistant(db, agent, call, { ...ctx, answered: false });
  if (!agent.forward_phone) { await setCall(db, call, { outcome: 'not_taking_calls', held_reason: 'no_forward_number' }); return BUSY; }
  const blocked = await spendBlocked(db, agent, CALL_COST.forward, { env, now });
  if (blocked) { await setCall(db, call, { outcome: 'not_taking_calls', held_reason: blocked }); return BUSY; }
  await setCall(db, call, { estimate_cents: (call.estimate_cents || 0) + CALL_COST.forward });
  const ring = Number.isInteger(agent.ring_seconds) ? Math.min(60, Math.max(5, agent.ring_seconds)) : 20;
  return `<Dial timeout="${ring}" answerOnBridge="true" action="${esc(callUrl('after-dial'))}" method="POST" callerId="${esc(call.from_phone || agent.phone_number)}"><Number>${esc(agent.forward_phone)}</Number></Dial>`;
}

// ---- premium voice tools -----------------------------------------------------------------------
// The premium voice agent (ElevenLabs) can do only these things, each through the same rules as
// the rest of the system. Each request carries the business's voice key (shown once to the owner,
// stored only as a hash). Returns { status, body }; body.say is what the agent tells the caller.
export async function voiceTool(db, { key, tool, body = {}, env = process.env, now = new Date(), senderFor = realSenderFor, timeZone = 'America/New_York' }) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(String(key || ''))) return { status: 401, body: { error: 'Not allowed' } };
  const agent = await one(db, 'business_agents', { voice_tool_secret_hash: sha(key) });
  if (!agent || agent.status !== 'active') return { status: 401, body: { error: 'Not allowed' } };
  const orgId = agent.organization_id;
  const services = await db.select('business_services', { organization_id: orgId, active: true }, { limit: 50 });
  const callSid = /^CA[0-9a-fA-F]{32}$/.test(String(body.call_sid || '')) ? body.call_sid : null;
  const call = callSid ? await one(db, 'business_calls', { call_sid: callSid, agent_id: agent.id }) : null;
  const caller = normalizePhone(body.caller) || call?.from_phone || null;
  const ctx = { env, now, senderFor };

  if (tool === 'services') {
    return { status: 200, body: { services: services.map((s) => ({ name: s.name, price: s.price_approved === true && Number.isInteger(s.price_cents) ? money(s.price_cents) : 'priced by the team after a quick look' })),
      say: services.length ? `We do ${listText(services.map((s) => s.name))}.` : 'The team will tell you what we can do. I can pass your call to them.' } };
  }
  if (tool === 'open_times') {
    const slots = (await db.select('voice_calendar_slots', { organization_id: orgId, status: 'open' }, { order: 'start_at.asc', limit: 50 })).filter((s) => new Date(s.start_at) > now).slice(0, 6);
    const labels = slots.map((s) => new Date(s.start_at).toLocaleString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    return { status: 200, body: { open_times: labels, say: labels.length ? `Open times include ${listText(labels.slice(0, 3))}. The caller books one from the link we text them.` : 'No open times are published right now. The team will arrange a time.' } };
  }
  if (tool === 'send_link') {
    if (!caller) return { status: 200, body: { sent: false, say: 'I do not have a number to text. I can pass your call to the team instead.' } };
    const svc = matchService(String(body.service || ''), services);
    const eventId = `voice:${callSid || String(body.conversation_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100) || crypto.randomUUID()}`;
    const out = await startJourney(db, { orgId, channel: 'voice', eventId, name: 'Phone caller', phone: caller, text: String(body.request || body.service || '').slice(0, 500) || null, now });
    const j = out.journey;
    if (svc && j.stage === 'inquiry') { try { await chooseService(db, j, svc.id, { now }); } catch (err) { if (!err.expected) throw err; } }
    const link = await customerLink(db, j);
    const r = await textCaller(db, agent, caller, `${agent.business_name}: here is your private link to see your quote and book a time: ${link} Reply STOP to opt out.`, { ...ctx, kind: 'call_link' });
    if (call) await setCall(db, call, { journey_id: j.id, ...(svc ? { service_id: svc.id } : {}), ...(r.sent ? { outcome: 'link_sent', texted_back: true } : {}) });
    return { status: 200, body: { sent: r.sent, say: r.sent ? 'Done. The link is on its way by text.' : 'I could not send a text just now. I will pass your request to the team so they can call you back.' } };
  }
  if (tool === 'hand_to_person') {
    const summary = String(body.summary || '').replace(/\s+/g, ' ').slice(0, 300);
    if (call) { await setCall(db, call, { outcome: 'callback_requested', held_reason: 'caller_asked', caller_said: [...(Array.isArray(call.caller_said) ? call.caller_said : []), { turn: (call.turns || 0) + 1, said: summary }].slice(-20) }); await alertOwner(db, agent, call, `Call back needed: ${pretty(caller)} called ${agent.business_name}.${summary ? ` Summary: "${summary}"` : ''}`, ctx); }
    return { status: 200, body: { ok: true, say: caller ? 'I have passed this to the team, and someone will call you back at this number.' : 'I have passed this to the team.' } };
  }
  return { status: 404, body: { error: 'Unknown tool' } };
}

// A new voice key for the premium agent's tools. Shown once; only its hash is stored.
export async function newVoiceKey(db, orgId) {
  const key = crypto.randomBytes(36).toString('base64url');
  const rows = await db.update('business_agents', { organization_id: orgId }, { voice_tool_secret_hash: sha(key) });
  if (!rows.length) throw Object.assign(new Error('Set up the business assistant first.'), { status: 404 });
  return key;
}
