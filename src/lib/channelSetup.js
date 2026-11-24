// Calls, messages and installation for a client business: plain-language labels and the "what is
// switched on" checklist shown in the Business desk. Pure functions; the server decides everything.

export const CHANNEL_LABELS = { sms: 'Text', web_chat: 'Website chat', whatsapp: 'WhatsApp', rcs: 'RCS / text', voice: 'Phone', apple_messages: 'Apple Messages', instagram: 'Instagram', facebook: 'Facebook' };

export const CALL_MODES = [
  ['off', 'Off: callers hear busy (nothing is spent)'],
  ['forward_only', 'Ring my phone only'],
  ['forward_then_assistant', 'Ring my phone first, then the assistant answers'],
  ['assistant_first', 'The assistant answers every call'],
];

export const OUTCOME_LABELS = {
  ringing: 'Ringing', answered: 'You answered', missed: 'Missed', assistant: 'Talked to the assistant',
  link_sent: 'Got a text with their quote link', callback_requested: 'Wants a call back', not_taking_calls: 'Not answered (calls off)',
};

const HELD = {
  customer_opted_out: 'the customer opted out', channel_not_on: 'this channel is off', spending_locked: 'spending is switched off',
  no_budget_set: 'no monthly spending cap is set', monthly_budget_reached: 'the monthly spending cap was reached',
  no_services_published: 'no services are published yet', reply_could_not_be_written: 'the reply could not be worked out',
  provider_did_not_accept: 'the provider did not accept it', calls_off: 'calls are switched off', business_not_active: 'the business is not live',
  no_forward_number: 'there is no phone to ring', caller_asked: 'the caller asked for a person', service_not_understood: 'the assistant could not tell which service',
  answer_not_understood: 'the assistant could not understand the answer', too_many_turns: 'the call went on too long for the assistant',
  no_caller_number: 'the caller\'s number was hidden', model_not_configured: 'the reply writer is not set up',
};
export function heldText(reason) {
  if (!reason) return '';
  const [head, tail] = String(reason).split(':');
  if (head === 'text_not_sent') return `no text was sent because ${HELD[tail] || tail}`;
  return HELD[head] || head.replace(/_/g, ' ');
}

export const pretty = (p) => (/^\+1\d{10}$/.test(p || '') ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p || '');

export function customerLabel(t) {
  if (t.customer_name) return t.customer_name;
  if (t.customer_phone) return pretty(t.customer_phone);
  if (t.channel === 'web_chat') return `Website visitor ${String(t.customer_ref || '').slice(2, 6)}`;
  return `${CHANNEL_LABELS[t.channel] || 'Customer'} ${String(t.customer_ref || '').slice(-4)}`;
}

// Conversations with their messages; the ones waiting for a person first, then the newest.
export function inbox(threads = [], messages = []) {
  const by = new Map(threads.map((t) => [t.id, []]));
  for (const m of messages) by.get(m.thread_id)?.push(m);
  return threads.map((t) => {
    const list = by.get(t.id);
    const last = [...list].reverse().find((m) => m.direction === 'inbound' || m.state === 'sent') || list[list.length - 1] || null;
    return { ...t, label: customerLabel(t), messages: list, last, lastAt: t.last_inbound_at || last?.created_at || t.created_at };
  }).sort((a, b) => (b.needs_human === true) - (a.needs_human === true) || String(b.lastAt).localeCompare(String(a.lastAt)));
}

export function messageWho(m) {
  if (m.direction === 'inbound') return 'Customer';
  if (m.state === 'held') return 'Not sent';
  if (m.state === 'failed') return 'Not delivered';
  return m.model === 'staff' ? 'Team' : 'Assistant';
}

// The addresses to paste into each provider's console when installing.
export const PROVIDER_ADDRESSES = [
  ['Twilio number: "A call comes in" (POST)', 'https://nova-systems.app/webhooks/business-call'],
  ['Twilio number: "Call status changes"', 'https://nova-systems.app/webhooks/business-call?step=status'],
  ['Twilio number, WhatsApp sender and Messaging Service: incoming messages (POST)', 'https://nova-systems.app/webhooks/twilio-message'],
  ['Meta app: Messenger and Instagram webhook', 'https://nova-systems.app/webhooks/meta-business'],
  ['CM.com: Apple Messages relay', 'https://nova-systems.app/webhooks/apple-messages'],
  ['ElevenLabs agent tools (header X-Nova-Voice-Key)', 'https://nova-systems.app/webhooks/voice-tools/<tool>'],
];

export const embedSnippet = (slug) => (slug ? `<script src="https://nova-systems.app/chat/embed.js" data-business="${slug}" async></script>` : '');

// What is switched on for this business, what is missing, and what costs money.
export function readiness({ agent = {}, services = [], payments = null, spending = false, team = null, slug = '', aiReady = false } = {}) {
  const live = agent.status === 'active';
  const active = services.filter((s) => s.active);
  const priced = active.filter((s) => s.price_approved === true && Number.isInteger(s.price_cents));
  const cap = Number(agent.monthly_spend_cap_cents || 0), capSet = Number.isInteger(cap) && cap > 0;
  const paidReady = spending && capSet;
  const item = (key, name, state, detail, costs = false) => ({ key, name, state, detail, costs });
  const paid = (on, needs) => (!on ? 'off' : !live ? 'needs' : !paidReady ? 'waiting' : needs ? 'needs' : 'ready');
  const money = !spending ? 'Waiting: spending is switched off for all businesses.' : !capSet ? 'Waiting: no monthly spending cap is set.' : '';
  return [
    item('services', 'Services and prices', priced.length ? 'ready' : 'needs', active.length ? `${active.length} service${active.length === 1 ? '' : 's'} on, ${priced.length} with a price you approved.` : 'Add at least one service.'),
    item('request_page', 'Request page', active.length ? 'ready' : 'needs', active.length ? 'Live: customers can ask for a quote.' : 'Goes live once one service is on.'),
    item('website', 'Website', slug && active.length ? 'ready' : 'needs', slug ? `nova-systems.app/b/${slug}` : 'The business needs a web address name.'),
    item('web_chat', 'Website chat', agent.web_chat_enabled ? (live ? 'ready' : 'needs') : 'off', agent.web_chat_enabled ? (live ? 'Answering on the website. Free.' : 'Switched on; goes live when the business is live.') : 'Off.'),
    item('texts', 'Text messages', paid(agent.sms_enabled === true, !agent.phone_number), agent.sms_enabled ? (money || (agent.phone_number ? `Answering texts to ${pretty(agent.phone_number)}.` : 'Add the business number.')) : 'Off. Needs a business number approved by the carriers for texting.', true),
    item('calls', 'Phone calls', paid(!!agent.call_mode && agent.call_mode !== 'off', !agent.phone_number), agent.call_mode && agent.call_mode !== 'off' ? (money || (CALL_MODES.find(([k]) => k === agent.call_mode)?.[1] || '')) : 'Off: callers hear busy.', true),
    item('missed_text', 'Text back after a missed call', paid(agent.missed_call_text === true, agent.sms_enabled !== true), agent.missed_call_text ? (agent.sms_enabled ? money || 'One text per caller per day.' : 'Needs text messages on.') : 'Off.', true),
    item('ai', 'AI answers (Claude, GPT or Gemini)', agent.ai_enabled ? (!aiReady ? 'waiting' : paid(true, false)) : 'off', agent.ai_enabled ? (!aiReady ? 'Waiting: Nova\'s AI switch or model key is not set.' : money || 'Answers customers\' questions on every channel and on calls; checked before sending.') : 'Off: the rules answer, and a person takes anything else.', true),
    item('premium_voice', 'Premium voice', agent.voice_provider === 'elevenlabs' ? (agent.voice_provider_agent_id && agent.voice_key_set ? paid(true, false) : 'needs') : 'off', agent.voice_provider === 'elevenlabs' ? (agent.voice_key_set ? money || 'Answers with the business\'s premium voice agent.' : 'Make the voice key and add the tools to the voice agent.') : 'Off: the standard assistant answers.', true),
    item('whatsapp', 'WhatsApp', paid(agent.whatsapp_enabled === true, !agent.whatsapp_number), agent.whatsapp_enabled ? money || `Answering on ${pretty(agent.whatsapp_number)}.` : 'Off.', true),
    item('rcs', 'RCS (rich texts on Android)', paid(agent.rcs_enabled === true, !agent.messaging_service_sid), agent.rcs_enabled ? money || 'Answering through the business\'s Messaging Service.' : 'Off.', true),
    item('apple', 'Apple Messages', paid(agent.apple_enabled === true, !agent.apple_business_id), agent.apple_enabled ? money || 'Answering in Apple Messages.' : 'Off. Needs an approved Apple Messages for Business account.', true),
    item('facebook', 'Facebook Messenger', agent.facebook_enabled ? (agent.meta_connected && live ? 'ready' : 'needs') : 'off', agent.facebook_enabled ? (agent.meta_connected ? 'Answering Page messages. Free.' : 'Connect the Page.') : 'Off.'),
    item('instagram', 'Instagram messages', agent.instagram_enabled ? (agent.meta_connected && live ? 'ready' : 'needs') : 'off', agent.instagram_enabled ? (agent.meta_connected ? 'Answering Instagram messages. Free.' : 'Connect the Page.') : 'Off.'),
    item('card_payments', 'Card payments', payments?.ready ? 'ready' : payments?.connected ? 'needs' : 'off', payments ? payments.note : 'Open Money owed to check.'),
    item('email', 'Email (come-back emails, weekly report)', agent.email_enabled ? 'ready' : 'off', agent.email_enabled ? `Replies go to ${agent.reply_email || 'the business'}.` : 'Off.'),
    item('reviews', 'Review link', agent.review_url ? 'ready' : 'off', agent.review_url ? 'Offered to every customer who rates a job.' : 'Add the business\'s review page link.'),
    item('team', 'Team and pay split', team ? (team.workers?.some((w) => w.active) && team.rule?.approved ? 'ready' : 'needs') : 'off', team ? `${(team.workers || []).filter((w) => w.active).length} active worker(s); split ${team.rule?.approved ? 'approved' : 'not approved'}.` : 'Open Team & pay to check.'),
  ];
}
export const STATE_LABELS = { ready: 'On', needs: 'Needs setup', waiting: 'Waiting', off: 'Off' };
