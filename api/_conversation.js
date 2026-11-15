// The conversation worker: one customer, any channel (text message, direct message, chat), taken
// through the same journey as the request page — which service, quote, acceptance, deposit,
// appointment — one message at a time.
//
// Every reply is produced by fixed rules from saved records. No language model is called, so a
// reply costs nothing to write and can never state a price, time or term that is not on file.
// Anything the rules do not understand is passed to a person and the customer is told so.
//
// This module only decides WHAT to reply. Whether a reply may be sent (consent, spending cap,
// connected channel) is decided by the channel code that calls it.
import { startJourney, advance, chooseService, acceptQuote, chooseSlot, cancelJourney, setPaused, recordStep, matchService } from './_journey.js';

const OPEN = (j) => !['closed', 'cancelled'].includes(j.stage);
const money = (c) => '$' + (c / 100).toFixed(2);
const WANTS_PERSON = /\b(person|human|someone|somebody|representative|manager|owner|call me|speak to|talk to)\b/i;

function slotLabel(iso, timezone) {
  return new Date(iso).toLocaleString('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Turns "what the journey is waiting for" into the words the customer reads.
export function replyFor(next, { timezone = 'America/New_York' } = {}) {
  if (next.stage === 'cancelled') return 'Your request is cancelled. Message us any time to start a new one.';
  if (next.stage === 'closed' || next.stage === 'paid') return 'You are all set. Thank you! Message us any time you need us again.';
  switch (next.reason) {
    case 'choose_service': return next.options.length ? `Which service do you need? Reply with a number:\n${next.options.map((o, i) => `${i + 1}. ${o.name}`).join('\n')}` : 'Thanks for your message. The team will get back to you.';
    case 'accept_quote': return `${next.quote.text}\n\nTo accept, reply ACCEPT and your full name. Example: ACCEPT Dana Reyes`;
    case 'pay_deposit': case 'pay_balance': return `${next.reason === 'pay_deposit' ? 'A deposit' : 'The balance'} of ${money(next.invoice.amount_cents)} is due. The business will confirm how to pay.`;
    case 'choose_time': return next.options.length ? `Choose a time. Reply with a number:\n${next.options.slice(0, 6).map((o, i) => `${i + 1}. ${slotLabel(o.start_at, timezone)}`).join('\n')}` : 'No open times are published right now. The team will contact you to arrange one.';
    default: return next.message || 'Thanks. The team will be in touch.';
  }
}

// Handles one inbound message. Returns { reply, journey_id, repeated, handed_to_person }.
// reply is null when the message was already handled (a retried delivery) or needs no answer.
export async function converse(db, { orgId, channel, customerKey, messageId, text, name, phone, email, timezone = 'America/New_York', now = new Date() }) {
  const body = String(text || '').trim().slice(0, 2000);
  if (!orgId || !channel || !customerKey || !messageId || !body) return { reply: null, journey_id: null };
  const prefix = `conv:${customerKey}:`;
  const mine = (await db.select('journeys', { organization_id: orgId, source_channel: channel }, { order: 'created_at.desc', limit: 500 })).filter((j) => String(j.source_event_id).startsWith(prefix));
  let j = mine.find(OPEN);

  if (!j) {
    // A business with nothing to sell has no journey to start; a person answers instead.
    if (!(await db.select('business_services', { organization_id: orgId, active: true }, { limit: 1 })).length) return { reply: null, journey_id: null, handed_to_person: true };
    const out = await startJourney(db, { orgId, channel, eventId: prefix + messageId, name: name || customerKey, phone, email, text: body, now });
    if (out.repeated) return { reply: null, journey_id: out.journey.id, repeated: true };
    return { reply: replyFor(out.next, { timezone }), journey_id: out.journey.id };
  }

  // The same delivery arriving twice changes nothing and is not answered twice.
  if (!(await recordStep(db, j, { agent: 'customer', action: 'message_received', key: `msg:${messageId}`, detail: { text: body } }))) return { reply: null, journey_id: j.id, repeated: true };

  const say = (next, lead = '') => ({ reply: (lead ? lead + '\n\n' : '') + replyFor(next, { timezone }), journey_id: j.id });
  const toPerson = async (next) => {
    await recordStep(db, j, { agent: 'front_desk', handed_to: 'staff', action: 'question_for_a_person', status: 'waiting_staff', key: `ask:${messageId}`, detail: { text: body } });
    return { ...say(next, 'I have passed your message to the team and someone will reply.'), handed_to_person: true };
  };

  try {
    if (j.paused) return { reply: null, journey_id: j.id, handed_to_person: true }; // a person owns this conversation now
    if (/^cancel\b/i.test(body)) return say(await cancelJourney(db, j, 'customer'));
    if (WANTS_PERSON.test(body)) { await setPaused(db, j, true, 'customer_asked'); return { reply: 'No problem. A team member will get back to you.', journey_id: j.id, handed_to_person: true }; }

    const next = await advance(db, j, { now });
    const pick = (list) => { const m = body.match(/^#?\s*(\d{1,2})\b/); return m ? list[Number(m[1]) - 1] : null; };

    if (next.reason === 'choose_service') {
      const services = await db.select('business_services', { organization_id: orgId, active: true });
      const chosen = pick(next.options) ? { id: pick(next.options).service_id } : matchService(body, services);
      return chosen ? say(await chooseService(db, j, chosen.id, { now })) : (body.includes('?') ? toPerson(next) : say(next, 'Sorry, I did not catch which one.'));
    }
    if (next.reason === 'accept_quote') {
      const m = body.match(/^(?:i\s+)?accept[,:]?\s+(.{2,120})$/i);
      if (m) return say(await acceptQuote(db, j, { quoteId: next.quote.id, typedName: m[1].trim() }, { now }), 'Thank you. Your acceptance is recorded.');
      if (/^(yes|yep|ok|okay|accept|i accept|sounds good|deal)\W*$/i.test(body)) return { reply: 'To accept, reply ACCEPT and your full name. Example: ACCEPT Dana Reyes', journey_id: j.id };
      return toPerson(next);
    }
    if (next.reason === 'choose_time') {
      const slot = pick(next.options.slice(0, 6));
      return slot ? say(await chooseSlot(db, j, slot.slot_id, { now })) : (body.includes('?') ? toPerson(next) : say(next, 'Sorry, I did not catch which time.'));
    }
    // Waiting on the business, on a payment, or already booked: nothing the customer types can
    // move it, so a person sees the message.
    return toPerson(next);
  } catch (err) {
    if (!err.expected) throw err;
    return say(await advance(db, j, { now }), err.message);
  }
}
