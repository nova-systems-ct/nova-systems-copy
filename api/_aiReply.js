// AI answers on every channel (website chat, texts, WhatsApp, RCS, Apple Messages, Facebook,
// Instagram and phone calls). The journey rules still handle choosing a service, quotes, accepting,
// paying and booking; a model answers only the QUESTIONS the rules cannot ("Do you work Saturdays?",
// "Are you insured?"), from the business's own facts and approved answers.
//
// Any of three model providers can answer: Anthropic (Claude), OpenAI (GPT) or Google (Gemini),
// chosen per business, with the others as fallbacks when their keys are set. Every answer is
// checked before it is sent: a dollar amount must be an approved price, a link must be the
// business's own, a phone number must be the business's own, and the answer must be short. An
// answer that fails a check, or a model that says it does not know, goes to a person instead.
//
// Model calls cost money, so nothing is called unless Nova's AI switch is on (NOVA_AI_REPLIES=on),
// the business has AI answers on, spending is on and its monthly cap has room (planned 1¢ each).
import { spendBlocked } from './_businessChannels.js';
import { buildBusinessPrompt } from './_businessAgent.js';
import { matchService } from './_journey.js';
import { WANTS_PERSON } from './_conversation.js';

export const AI_COST_CENTS = 1;
export const PROVIDERS = {
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'NOVA_AI_MODEL_ANTHROPIC', fallbackModel: 'NOVA_AUTOMATION_MODEL', defaultModel: 'claude-haiku-5-5' },
  // Each provider's model for fast, high-volume answers as of Nov 2026; replace with the env names above.
  openai: { key: 'OPENAI_API_KEY', model: 'NOVA_AI_MODEL_OPENAI', defaultModel: 'gpt-6-luna' },
  google: { key: 'GEMINI_API_KEY', model: 'NOVA_AI_MODEL_GOOGLE', defaultModel: 'gemini-3.5-flash-lite' },
};
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const QUESTION = /\?\s*$|^(do|does|are|is|can|could|will|would|what|when|where|which|who|how|why|should)\b/i;
export const looksLikeQuestion = (text) => QUESTION.test(String(text || '').trim()) && String(text).trim().length >= 8;
export const modelFor = (name, env) => env[PROVIDERS[name].model] || (PROVIDERS[name].fallbackModel && env[PROVIDERS[name].fallbackModel]) || PROVIDERS[name].defaultModel;
export const providersReady = (env = process.env) => Object.keys(PROVIDERS).filter((p) => !!env[PROVIDERS[p].key]);

// ---- the three providers (each returns { text, cut }, or throws) -------------------------------
// cut is true when the provider stopped at its length limit: a cut-off answer is never sent.
// Newer OpenAI and Gemini models think before answering and the thinking counts against the
// limit, so their limit is larger; the 600-character check below still bounds what is sent.
async function callProvider(name, { system, user, env, fetchImpl }) {
  const model = modelFor(name, env), signal = AbortSignal.timeout(10_000);
  if (!/^[A-Za-z0-9._:-]{3,80}$/.test(model)) throw new Error('bad model name');
  let r, body;
  if (name === 'anthropic') {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 300, system, messages: [{ role: 'user', content: user }] }) });
    body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`anthropic ${r.status}`);
    return { text: (body.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim(), cut: body.stop_reason === 'max_tokens' };
  }
  if (name === 'openai') {
    r = await fetchImpl('https://api.openai.com/v1/chat/completions', { method: 'POST', signal, headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_completion_tokens: 1000, ...(/^gpt-6/.test(model) ? { reasoning_effort: 'none' } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`openai ${r.status}`);
    return { text: String(body.choices?.[0]?.message?.content || '').trim(), cut: body.choices?.[0]?.finish_reason === 'length' };
  }
  r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal, headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 1000 } }) });
  body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google ${r.status}`);
  const c = body.candidates?.[0];
  return { text: (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim(), cut: c?.finishReason === 'MAX_TOKENS' };
}

// ---- the checks every answer must pass ---------------------------------------------------------
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export function checkAnswer(text, { approvedCents = [], allowedLinks = [], allowedPhones = [] } = {}) {
  const t = String(text || '').trim();
  if (!t || /^HANDOFF\b/i.test(t) || /\bHANDOFF\b/.test(t)) return { ok: false, reason: 'model_did_not_know' };
  if (t.length > 600) return { ok: false, reason: 'answer_too_long' };
  for (const m of t.matchAll(/\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g)) {
    const cents = Number(m[1].replace(/,/g, '')) * 100 + Number(m[2] || 0);
    if (!approvedCents.includes(cents)) return { ok: false, reason: 'price_not_approved' };
  }
  if (/\b\d{1,3}\s?(%|percent)\s?off\b/i.test(t)) return { ok: false, reason: 'discount_not_approved' };
  for (const m of t.matchAll(/\b(?:https?:\/\/|www\.)\S+/gi)) if (!allowedLinks.some((l) => l && m[0].replace(/[).,]+$/, '').startsWith(l))) return { ok: false, reason: 'unknown_link' };
  for (const m of t.matchAll(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g)) if (!allowedPhones.map(digits).includes(digits(m[0]))) return { ok: false, reason: 'unknown_phone' };
  return { ok: true, text: t };
}

// The answer to one customer question for this business, or { reply: null, reason }.
export async function aiAnswer(db, agent, { text, channel = 'chat', requestLink = null, env = process.env, now = new Date(), fetchImpl = fetch, extraCents = 0 } = {}) {
  if (env.NOVA_AI_REPLIES !== 'on') return { reply: null, reason: 'ai_off' };
  if (agent.ai_enabled !== true) return { reply: null, reason: 'ai_off_for_business' };
  const ready = providersReady(env);
  if (!ready.length) return { reply: null, reason: 'no_ai_provider' };
  const blocked = await spendBlocked(db, agent, AI_COST_CENTS + extraCents, { env, now });
  if (blocked) return { reply: null, reason: blocked };
  const [services, knowledge, config] = await Promise.all([
    db.select('business_services', { organization_id: agent.organization_id, active: true }, { limit: 50 }),
    db.select('voice_knowledge_base', { organization_id: agent.organization_id, status: 'approved' }, { limit: 60 }),
    one(db, 'voice_configurations', { organization_id: agent.organization_id }),
  ]);
  const priced = services.filter((s) => s.price_approved === true && Number.isInteger(s.price_cents));
  const prices = services.map((s) => (priced.includes(s) ? `${s.name}: $${(s.price_cents / 100).toFixed(2)}` : `${s.name}: price set by the team after a look`)).join('; ');
  const faq = String(agent.faq || '').trim();
  const spoken = channel === 'voice';
  if (spoken) requestLink = null; // a web address is never read out on a call
  const system = [
    buildBusinessPrompt({ agent: { ...agent, agent_name: agent.agent_name || 'the assistant' }, knowledge, config, channel: channel === 'voice' ? 'voice' : 'sms' }),
    prices ? `SERVICES AND THE ONLY PRICES YOU MAY STATE: ${prices}.` : '',
    faq ? `THE OWNER'S OWN ANSWERS:\n${faq.slice(0, 4000)}` : '',
    requestLink ? `To get a quote or book, the customer uses this page: ${requestLink}` : '',
    spoken ? 'This answer is spoken on a phone call: plain words only, no links, lists or symbols.' : '',
    'ANSWER ONLY THE QUESTION, in at most three short sentences. This replaces the rule above about answers that are not on file: if the facts and answers above do not answer the question, do not ask for details; reply with exactly HANDOFF and nothing else, and the team takes it from there.',
  ].filter(Boolean).join('\n\n');
  const order = [agent.ai_provider, env.NOVA_AI_PROVIDER, ...Object.keys(PROVIDERS)].filter((p, i, a) => p && PROVIDERS[p] && ready.includes(p) && a.indexOf(p) === i);
  for (const name of order) {
    let out;
    try { out = await callProvider(name, { system, user: String(text).slice(0, 1000), env, fetchImpl }); } catch { continue; } // next provider
    if (out.cut) return { reply: null, reason: 'answer_cut_off', provider: name };
    const checked = checkAnswer(out.text, { approvedCents: priced.map((s) => s.price_cents), allowedLinks: spoken ? [] : [requestLink, agent.booking_url].filter(Boolean), allowedPhones: [agent.phone_number, agent.forward_phone].filter(Boolean) });
    return checked.ok ? { reply: checked.text, provider: name, model: modelFor(name, env), estimate_cents: AI_COST_CENTS } : { reply: null, reason: checked.reason, provider: name };
  }
  return { reply: null, reason: 'ai_provider_failed' };
}

// The AI answers first only when the business has it on, the message is a question, and the
// question is not one the rules handle: a service they can quote, a numbered choice, ACCEPT,
// cancel, or asking for a person. It never answers a conversation a person has taken over
// (customerKey is the key the rules use for this customer: api/_conversation.js).
// Returns null when the rules should answer.
const RULE_WORDS = /^(#?\s*\d{1,2}\b|(i\s+)?accept\b|cancel\b)/i;
const appBase = (env) => (env.APP_BASE_URL || 'https://nova-systems.app').replace(/\/$/, '');
export async function aiFirst(db, agent, { text, channel, customerKey = null, env = process.env, now = new Date(), fetchImpl = fetch, extraCents = 0 } = {}) {
  const t = String(text || '').trim();
  if (agent.ai_enabled !== true || !looksLikeQuestion(t) || RULE_WORDS.test(t) || WANTS_PERSON.test(t)) return null;
  const services = await db.select('business_services', { organization_id: agent.organization_id, active: true }, { limit: 50 });
  if (matchService(t, services)) return null; // the rules quote it, and the request moves forward
  if (customerKey) {
    const prefix = `conv:${customerKey}:`;
    const open = (await db.select('journeys', { organization_id: agent.organization_id, source_channel: channel }, { order: 'created_at.desc', limit: 500 }))
      .filter((j) => String(j.source_event_id || '').startsWith(prefix) && !['closed', 'cancelled'].includes(j.stage));
    if (open.some((j) => j.paused === true)) return null; // a person owns this conversation now
  }
  return aiAnswer(db, agent, { text: t, channel, env, now, fetchImpl, extraCents, requestLink: `${appBase(env)}/start?org=${agent.organization_id}` });
}
