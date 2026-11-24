// Quote, invoice and reminder emails for each request (api/_journeyEmail.js). In-memory store and a
// stubbed email provider: nothing is sent and no database is contacted.
import crypto from 'node:crypto';
import { startJourney, acceptQuote, recordPayment, chooseSlot, tokenMatches } from '../api/_journey.js';
import { sendJourneyEmails, dailyJourneyEmails } from '../api/_journeyEmail.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-11-24T15:00:00Z');
const ENV = { RESEND_API_KEY: 're_test', NOVA_EMAIL_SENDING: 'on', NOVA_FROM_EMAIL: 'noreply@nova-systems.app' };
const UNIQUE = { journeys: [['organization_id', 'source_channel', 'source_event_id']], journey_events: [['idempotency_key']], journey_documents: [['journey_id', 'kind', 'seq']] };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : v && typeof v === 'object' && 'gte' in v ? r[k] >= v.gte : r[k] === v));
  let clock = 0;
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [col, dir] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : a._n - b._n) * (dir === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { for (const u of UNIQUE[n] || []) if (u.every((k) => row[k] != null) && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + ++clock).toISOString(), updated_at: NOW.toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const sent = []; let failNext = false;
globalThis.fetch = async (url, opts) => {
  if (!String(url).endsWith('/emails')) throw new Error('unexpected request ' + url);
  if (failNext) { failNext = false; return { ok: false, status: 500, json: async () => ({ message: 'down' }) }; }
  sent.push({ headers: opts.headers, body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ id: 'em_' + sent.length }) };
};

async function setup(agentExtra = {}, contactEmail = 'dana@example.com') {
  const db = memoryDb();
  await db.insert('business_services', { organization_id: ORG, name: 'Full detail, sedan', keywords: ['sedan'], price_cents: 19900, price_approved: true, deposit_cents: 5000, terms_text: null, active: true });
  await db.insert('business_agents', { organization_id: ORG, business_name: 'Crystal Clear', email_enabled: true, reply_email: 'hello@crystalclear.example', mailing_address: '1 Main St, Fairfield, CT', status: 'active', ...agentExtra });
  const slot = await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z', status: 'open' });
  const out = await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name: 'Dana Smith', email: contactEmail, phone: null, text: 'sedan detail please', now: NOW });
  return { db, j: out.journey, token: out.token, slot };
}
const svcPick = async (db, j) => { const { chooseService } = await import('../api/_journey.js'); const s = (await db.select('business_services', { organization_id: ORG }))[0]; if (j.stage === 'inquiry') await chooseService(db, j, s.id, { now: NOW }); };

let { db, j, token, slot } = await setup();
await svcPick(db, j);
let r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
const quote = sent.at(-1);
check('the quote is emailed once the request is quoted', j.stage === 'quoted' && r.sent.join() === 'quote' && quote.body.to[0] === 'dana@example.com');
check('it comes from the business name, replies go to the business', quote.body.from === 'Crystal Clear <noreply@nova-systems.app>' && quote.body.reply_to === 'hello@crystalclear.example' && quote.body.subject === 'Your quote from Crystal Clear');
check('it holds the quote, a private link and the business\'s address', /Full detail, sedan/.test(quote.body.text) && /\$199\.00/.test(quote.body.text) && /#j=[0-9a-f-]{36}&k=[0-9a-f]{64}/.test(quote.body.text) && /1 Main St, Fairfield, CT/.test(quote.body.text) && /^Hi Dana,/.test(quote.body.text));
const linkKey = quote.body.text.match(/&k=([0-9a-f]{64})/)[1];
const fresh = db.t.journeys.find((x) => x.id === j.id);
check('the emailed link opens the request, and the customer\'s own session still works', tokenMatches(fresh, linkKey) && tokenMatches(fresh, token));
check('the provider gets an idempotency key, so a retry cannot send it twice', /^[0-9a-f-]{36}:email:quote:[0-9a-f-]{36}$/.test(quote.headers['Idempotency-Key']));
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('the same quote is never emailed twice', r.sent.length === 0 && sent.length === 1);

const q = (await db.select('journey_documents', { journey_id: j.id, kind: 'quote' }))[0];
await acceptQuote(db, j, { quoteId: q.id, typedName: 'Dana Smith', now: NOW });
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('after accepting, the deposit invoice is emailed with the amount in the subject', j.stage === 'deposit_due' && r.sent.join() === 'deposit_invoice' && sent.at(-1).body.subject === 'Deposit from Crystal Clear: $50.00' && /See how to pay here/.test(sent.at(-1).body.text));
await recordPayment(db, j, { amountCents: 5000, source: 'owner_recorded', reference: 'cash' }, { now: NOW });
await chooseSlot(db, j, slot.id, { now: NOW });
r = await sendJourneyEmails(db, j, { env: ENV, now: new Date('2026-11-23T15:00:00Z') });
check('no reminder two days before the appointment', j.stage === 'scheduled' && r.sent.length === 0);
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('a reminder the day before, with the time in Connecticut', r.sent.join() === 'reminder' && /Reminder: Full detail, sedan with Crystal Clear/.test(sent.at(-1).body.subject) && /Wednesday, November 25 at 10:00 AM/.test(sent.at(-1).body.text));
r = await sendJourneyEmails(db, j, { env: ENV, now: new Date('2026-11-24T20:00:00Z') });
check('the reminder is sent only once', r.sent.length === 0);

// Nothing is sent unless every switch allows it.
({ db, j } = await setup()); await svcPick(db, j);
let count = sent.length;
r = await sendJourneyEmails(db, j, { env: { ...ENV, NOVA_EMAIL_SENDING: 'off' }, now: NOW });
check('Nova\'s email switch off: nothing sent', r.skipped === 'email_off' && sent.length === count);
({ db, j } = await setup({ email_enabled: false })); await svcPick(db, j);
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('the business has email off: nothing sent', r.skipped === 'business_email_off' && sent.length === count);
({ db, j } = await setup({}, null)); await svcPick(db, j);
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('no customer email: nothing sent', r.skipped === 'no_customer_email' && sent.length === count);
({ db, j } = await setup()); await svcPick(db, j);
failNext = true;
r = await sendJourneyEmails(db, j, { env: ENV, now: NOW });
check('a provider failure is recorded and not counted as sent', r.sent.length === 0 && db.t.journey_events.some((e) => e.action === 'email_failed' && e.status === 'failed'));
r = await dailyJourneyEmails(db, { env: ENV, now: NOW });
check('the daily run sends what could not go out before', r.sent === 1 && sent.at(-1).body.subject === 'Your quote from Crystal Clear');
({ db, j } = await setup()); await svcPick(db, j);
const second = await startJourney(db, { orgId: ORG, channel: 'web', eventId: crypto.randomUUID(), name: 'Sam Lee', email: 'sam@example.com', text: 'sedan', now: NOW });
await svcPick(db, second.journey);
await sendJourneyEmails(db, j, { env: { ...ENV, NOVA_EMAIL_DAILY_CAP_PER_BUSINESS: '1' }, now: NOW });
count = sent.length;
r = await sendJourneyEmails(db, second.journey, { env: { ...ENV, NOVA_EMAIL_DAILY_CAP_PER_BUSINESS: '1' }, now: NOW });
check('the daily cap per business stops further emails', r.skipped === 'daily_cap' && sent.length === count);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
