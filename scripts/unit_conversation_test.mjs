// The conversation worker (api/_conversation.js): a customer is taken from "hi" to a booked,
// deposit-paid job by message alone. In-memory store, test prices; no model, carrier or database.
import crypto from 'node:crypto';
import { converse } from '../api/_conversation.js';
import { recordPayment } from '../api/_journey.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-16T15:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const u = UNIQUE[n]; if (u && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const db = memoryDb();
await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', keywords: ['mow', 'grass'], price_cents: 4000, price_approved: true, deposit_cents: 1000, terms_text: 'Pay the balance on the day.', terms_approved: true, active: true });
await db.insert('business_services', { organization_id: ORG, name: 'Car detailing', keywords: ['detail'], price_cents: null, price_approved: false, active: true });
await db.insert('business_services', { organization_id: OTHER, name: 'Teeth cleaning', keywords: [], price_cents: 9000, price_approved: true, active: true });
await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-18T15:00:00Z', end_at: '2026-11-18T16:00:00Z', status: 'open' });
const slotB = await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-19T15:00:00Z', end_at: '2026-11-19T16:00:00Z', status: 'open' });
await db.insert('voice_calendar_slots', { organization_id: OTHER, start_at: '2026-11-17T15:00:00Z', end_at: '2026-11-17T16:00:00Z', status: 'open' });

let n = 0;
const sms = (text, who = '+18605550101', extra = {}) => converse(db, { orgId: ORG, channel: 'sms', customerKey: who, phone: who, messageId: extra.id || `m${++n}`, text, now: NOW });
const journey = (id) => db.t.journeys.find((j) => j.id === id);

let r = await sms('hi there');
check('an unclear first message is asked which service, by number', /1\. Lawn mowing\n2\. Car detailing/.test(r.reply) && !/Teeth/.test(r.reply));
check('the list never shows a price', !/\$|40/.test(r.reply));
const jid = r.journey_id;
r = await sms('umm');
check('an answer that is not understood repeats the question', /did not catch/.test(r.reply) && /1\. Lawn mowing/.test(r.reply) && journey(jid).stage === 'inquiry');
r = await sms('1');
check('choosing by number produces the quote from the approved price', /\$40\.00/.test(r.reply) && /ACCEPT/.test(r.reply) && journey(jid).stage === 'quoted');
const issuedCode = r.reply.match(/ACCEPT ([A-F0-9]{12})/)[1];
check('the actual approved terms are visible before signing', r.reply.includes('Pay the balance on the day.'));
r = await sms('yes');
check('a bare "yes" is not an acceptance: a full name is required', /full name/.test(r.reply) && journey(jid).stage === 'quoted');
r = await sms('can you do it cheaper?');
check('a question the rules cannot answer goes to a person, and says so', r.handed_to_person && /passed your message/.test(r.reply) && db.t.journey_events.some((e) => e.journey_id === jid && e.action === 'question_for_a_person' && e.status === 'waiting_staff'));
check('the worker does not negotiate: the price is unchanged', journey(jid).total_cents === 4000);
r = await sms('ACCEPT ABCDEF000000 Dana Reyes');
check('a stale version cannot accept another agreement', journey(jid).stage === 'quoted');
r = await sms('ACCEPT ' + issuedCode + ' Dana Reyes');
const accepted = db.t.journey_documents.find((d) => d.journey_id === jid && d.kind === 'quote');
check('ACCEPT with a name records the acceptance under that name', journey(jid).stage === 'deposit_due' && JSON.stringify(accepted).includes('Dana Reyes') && /\$10\.00/.test(r.reply));
check('the acceptance evidence names the channel and message it came in on', /via text message \(message m\d+\)/.test(accepted.acceptance_evidence) && !/customer link/.test(accepted.acceptance_evidence));
check('a contact saved under a phone number takes the name typed at acceptance', db.t.crm_contacts.find((c) => c.id === journey(jid).contact_id).name === 'Dana Reyes');
r = await sms('paid it!');
check('the customer saying "paid" does not mark anything paid', journey(jid).stage === 'deposit_due' && journey(jid).paid_cents === 0 && r.handed_to_person);
await recordPayment(db, journey(jid), { amountCents: 1000, source: 'owner_recorded', reference: 'cash' });
r = await sms('ok what now');
check('after the business records the deposit, the customer is offered real open times', /1\. .*Nov 18/.test(r.reply) && /2\. .*Nov 19/.test(r.reply) && !/Nov 17/.test(r.reply));
const asksBefore = db.t.journey_events.filter((e) => e.action === 'question_for_a_person').length;
r = await sms('what times do you have?');
check('asking which times are open lists them, without passing the customer to a person', /1\. .*Nov 18/.test(r.reply) && !/passed your message/.test(r.reply) && !r.handed_to_person && db.t.journey_events.filter((e) => e.action === 'question_for_a_person').length === asksBefore);
r = await sms('2');
check('choosing a time books that exact slot', journey(jid).slot_id === slotB.id && db.t.voice_calendar_slots.find((s) => s.id === slotB.id).status === 'booked' && /booked/i.test(r.reply));
check('the booking reply states the booked time from the slot record', /You are booked for Thu, Nov 19, 10:00\sAM\. See you then\./.test(r.reply));

const before = JSON.stringify([db.t.journeys.length, db.t.journey_events.length]);
r = await sms('2', '+18605550101', { id: `m${n}` });
check('a message delivered twice is not handled or answered twice', r.repeated && r.reply === null && before === JSON.stringify([db.t.journeys.length, db.t.journey_events.length]));

r = await sms('I need my grass cut', '+18605550202');
check('a clear first message skips straight to the quote', /\$40\.00/.test(r.reply) && r.journey_id !== jid);
check('two customers never share a conversation', db.t.journeys.length === 2 && journey(jid).stage === 'scheduled');
const j2 = r.journey_id;
r = await sms('Can I talk to a person', '+18605550202');
check('asking for a person pauses the workers', journey(j2).paused === true && r.handed_to_person);
r = await sms('ACCEPT Sam Ortiz', '+18605550202');
check('once a person has taken over, the worker stays silent and changes nothing', r.reply === null && journey(j2).stage === 'quoted');

r = await sms('detail my car please', '+18605550303');
check('a service with no approved price gets a holding message, never a number', !/\$/.test(r.reply) && /preparing your quote/.test(r.reply) && db.t.journeys.find((j) => j.id === r.journey_id).waiting_on === 'owner');
const j3 = r.journey_id;
r = await sms('cancel', '+18605550303');
check('CANCEL cancels', journey(j3).stage === 'cancelled' && /cancelled/.test(r.reply));
r = await sms('mow my lawn', '+18605550303');
check('a later message starts a fresh request', r.journey_id !== j3 && /\$40\.00/.test(r.reply));

r = await sms('cancel');
check('a request with a recorded payment cannot be cancelled by message', journey(jid).stage === 'scheduled' && /Contact the business/.test(r.reply));
r = await converse(db, { orgId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', channel: 'sms', customerKey: '+1', messageId: 'x', text: 'hi', now: NOW });
check('a business with no services starts nothing and hands the message to a person', r.reply === null && r.handed_to_person && db.t.journeys.every((j) => j.organization_id === ORG));
r = await converse(db, { orgId: ORG, channel: 'instagram', customerKey: 'ig_991', name: 'dana.r', messageId: 'ig1', text: 'grass', now: NOW });
check('the same worker runs a direct message on another channel', /\$40\.00/.test(r.reply) && db.t.journeys.find((j) => j.id === r.journey_id).source_channel === 'instagram');
r = await sms('   ');
check('an empty message does nothing', r.reply === null && r.journey_id === null);

const known = await db.insert('crm_contacts', { organization_id: ORG, name: 'Jordan Lee', phone: '+18605550404', email: null });
r = await sms('mow my lawn', '+18605550404');
r = await sms('ACCEPT ' + r.reply.match(/ACCEPT ([A-F0-9]{12})/)[1] + ' J Lee', '+18605550404');
check('a real name already on file is never overwritten by the typed name', db.t.crm_contacts.find((c) => c.id === known.id).name === 'Jordan Lee' && db.t.journeys.find((j) => j.id === r.journey_id).contact_id === known.id);
const hugeTerms = 'Terms for the full written agreement. '.repeat(60);
await db.update('business_services', { organization_id: ORG, name: 'Lawn mowing' }, { terms_text: hugeTerms });
const long = await sms('mow', '+18605550444');
check('long wording is read and signed on the private page', long.reply.includes('/start?org=') && !long.reply.includes('ACCEPT') && !long.reply.includes('full written agreement'));
const longQuote = db.t.journey_documents.find(doc => doc.journey_id === long.journey_id && doc.kind === 'quote');
const guess = longQuote.id.replaceAll('-', '').slice(-12).toUpperCase();
const refusedLong = await sms('ACCEPT '+guess+' Dana Test', '+18605550444');
check('even the current code cannot sign unseen long terms by message', refusedLong.reply.includes('/start?org=') && journey(long.journey_id).stage === 'quoted');

console.log(`\n${pass}/${pass + fail} conversation checks passed (rules only — no model, carrier or database contacted)`);
process.exit(fail ? 1 : 0);
