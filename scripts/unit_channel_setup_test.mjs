// The Business desk's calls/messages helpers (src/lib/channelSetup.js): the install checklist, the
// inbox order and the plain-language reasons. Pure functions; nothing is contacted.
import { readiness, inbox, heldText, customerLabel, messageWho, embedSnippet, STATE_LABELS } from '../src/lib/channelSetup.js';

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const state = (list, key) => list.find((i) => i.key === key)?.state;

const services = [{ active: true, price_approved: true, price_cents: 4000 }, { active: true, price_approved: false, price_cents: null }];
let r = readiness({ agent: { status: 'draft' }, services: [], spending: false });
check('a new business: services, request page and website need setup; channels are off', state(r, 'services') === 'needs' && state(r, 'request_page') === 'needs' && state(r, 'website') === 'needs' && state(r, 'calls') === 'off' && state(r, 'web_chat') === 'off');
r = readiness({ agent: { status: 'active', web_chat_enabled: true }, services, spending: false, slug: 'green-lawns' });
check('website chat and the free pages are on without any spending', state(r, 'services') === 'ready' && state(r, 'request_page') === 'ready' && state(r, 'website') === 'ready' && state(r, 'web_chat') === 'ready');
r = readiness({ agent: { status: 'active', sms_enabled: true, phone_number: '+12035550100', call_mode: 'assistant_first', monthly_spend_cap_cents: 2500 }, services, spending: false });
check('texts and calls wait while spending is off for all businesses, and say why', state(r, 'texts') === 'waiting' && state(r, 'calls') === 'waiting' && /spending is switched off/.test(r.find((i) => i.key === 'calls').detail));
r = readiness({ agent: { status: 'active', sms_enabled: true, phone_number: '+12035550100', call_mode: 'assistant_first', monthly_spend_cap_cents: '' }, services, spending: true });
check('with spending on but no cap, paid channels still wait', state(r, 'texts') === 'waiting' && /no monthly spending cap/.test(r.find((i) => i.key === 'texts').detail));
r = readiness({ agent: { status: 'active', sms_enabled: true, phone_number: '+12035550100', call_mode: 'assistant_first', missed_call_text: true, monthly_spend_cap_cents: 2500 }, services, spending: true });
check('with spending on and a cap: texts, calls and the missed-call text are on', state(r, 'texts') === 'ready' && state(r, 'calls') === 'ready' && state(r, 'missed_text') === 'ready');
r = readiness({ agent: { status: 'draft', sms_enabled: true, phone_number: '+12035550100', monthly_spend_cap_cents: 2500 }, services, spending: true });
check('a channel switched on for a business that is not live needs setup', state(r, 'texts') === 'needs');
r = readiness({ agent: { status: 'active', missed_call_text: true, sms_enabled: false, monthly_spend_cap_cents: 2500 }, services, spending: true });
check('the missed-call text needs text messages on', state(r, 'missed_text') === 'needs');
r = readiness({ agent: { status: 'active', voice_provider: 'elevenlabs', voice_provider_agent_id: 'a1', voice_key_set: false }, services, spending: true });
check('premium voice needs its key before it counts as on', state(r, 'premium_voice') === 'needs');
r = readiness({ agent: { status: 'active', facebook_enabled: true, meta_connected: false } , services });
check('Facebook needs the Page connected', state(r, 'facebook') === 'needs');
r = readiness({ agent: {}, services, payments: { ready: true, note: 'Customers can pay invoices by card.' }, team: { workers: [{ active: true }], rule: { approved: true } } });
check('card payments and the team split read from their own records', state(r, 'card_payments') === 'ready' && state(r, 'team') === 'ready');
check('every checklist item has a state label', r.every((i) => STATE_LABELS[i.state]));
check('paid systems are marked as costing money; chat is not', r.find((i) => i.key === 'calls').costs === true && r.find((i) => i.key === 'web_chat').costs === false);

const threads = [
  { id: 't1', channel: 'sms', customer_phone: '+12035550199', customer_ref: '+12035550199', needs_human: false, last_inbound_at: '2026-11-16T15:00:00Z' },
  { id: 't2', channel: 'web_chat', customer_ref: 'v_abcdef', needs_human: true, last_inbound_at: '2026-11-15T15:00:00Z' },
  { id: 't3', channel: 'instagram', customer_ref: '178414000001234', needs_human: false, last_inbound_at: '2026-11-16T16:00:00Z' },
];
const messages = [
  { id: 'm1', thread_id: 't1', direction: 'inbound', body: 'hi', state: 'received', created_at: '2026-11-16T15:00:00Z' },
  { id: 'm2', thread_id: 't1', direction: 'outbound', body: '(no reply sent)', state: 'held', held_reason: 'spending_locked', created_at: '2026-11-16T15:00:01Z' },
  { id: 'm3', thread_id: 't2', direction: 'inbound', body: 'can I talk to someone', state: 'received', created_at: '2026-11-15T15:00:00Z' },
];
const box = inbox(threads, messages);
check('the inbox puts conversations that need a person first, then the newest', box.map((t) => t.id).join() === 't2,t3,t1');
check('a held note is never shown as the last message', box.find((t) => t.id === 't1').last.id === 'm1');
check('customers are labelled without exposing ids', customerLabel(threads[0]) === '(203) 555-0199' && customerLabel(threads[1]) === 'Website visitor abcd' && customerLabel(threads[2]) === 'Instagram 1234');
check('who wrote each message', messageWho(messages[0]) === 'Customer' && messageWho(messages[1]) === 'Not sent' && messageWho({ direction: 'outbound', state: 'sent', model: 'staff' }) === 'Team' && messageWho({ direction: 'outbound', state: 'sent', model: 'journey_rules' }) === 'Assistant');
check('reasons are in plain words', heldText('spending_locked') === 'spending is switched off' && heldText('text_not_sent:customer_opted_out') === 'no text was sent because the customer opted out' && heldText('') === '');
check('the website chat code names the business page', embedSnippet('green-lawns') === '<script src="https://nova-systems.app/chat/embed.js" data-business="green-lawns" async></script>' && embedSnippet('') === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
