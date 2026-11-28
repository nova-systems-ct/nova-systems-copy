// Aura 0.1, the morning brief (api/_brief.js). In-memory store, TEST FIXTURES; nothing is sent.
import crypto from 'node:crypto';
import { briefFor, briefText } from '../api/_brief.js';
import { handleJourney } from '../api/_journey.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = new Date('2026-11-24T12:00:00Z'); // 7 a.m. in Connecticut
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [c, d] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const full = { id: crypto.randomUUID(), created_at: NOW.toISOString(), ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, p) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, p) })),
  };
}
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const ago = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();

const db = memoryDb();
await db.insert('organizations', { id: CC, name: 'Crystal Clear' });
const svc = await db.insert('business_services', { organization_id: CC, name: 'Car detail' });
const svc2 = await db.insert('business_services', { organization_id: CC, name: 'Outside windows' });
const c = async (name) => db.insert('crm_contacts', { organization_id: CC, name });
const dana = await c('Dana Ruiz'), eli = await c('Eli Park'), fay = await c('Fay Moss'), gus = await c('Gus Lee');
await db.insert('journeys', { organization_id: CC, contact_id: dana.id, service_id: svc.id, stage: 'quoted', created_at: ago(3) });
await db.insert('journeys', { organization_id: CC, contact_id: eli.id, service_id: svc2.id, stage: 'qualified', waiting_on: 'owner', waiting_reason: 'price_needs_approval', created_at: ago(30) });
const slotToday = await db.insert('voice_calendar_slots', { organization_id: CC, start_at: '2026-11-24T15:00:00Z', end_at: '2026-11-24T17:00:00Z', status: 'booked' });
const slotTomorrow = await db.insert('voice_calendar_slots', { organization_id: CC, start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z', status: 'booked' });
await db.insert('journeys', { organization_id: CC, contact_id: fay.id, service_id: svc.id, stage: 'scheduled', slot_id: slotToday.id, service_address: '12 Shore Rd, Westport', created_at: ago(72) });
await db.insert('journeys', { organization_id: CC, contact_id: gus.id, service_id: svc.id, stage: 'scheduled', slot_id: slotTomorrow.id, created_at: ago(72) });
const owed = await db.insert('journeys', { organization_id: CC, contact_id: gus.id, service_id: svc.id, stage: 'balance_due', total_cents: 19900, paid_cents: 5000, created_at: ago(200) });
await db.insert('journey_documents', { organization_id: CC, journey_id: owed.id, kind: 'balance_invoice', amount_cents: 14900, status: 'issued', created_at: ago(24 * 9) });
await db.insert('journey_documents', { organization_id: CC, journey_id: owed.id, kind: 'receipt', amount_cents: 5000, created_at: ago(5) });
await db.insert('customer_feedback', { organization_id: CC, journey_id: crypto.randomUUID(), contact_id: eli.id, rating: 2, comment: 'Missed a spot', follow_up: 'owner_to_call' });
await db.insert('revive_outreach', { organization_id: CC, contact_id: gus.id, status: 'ready', kind: 'overdue' });
await db.insert('journeys', { organization_id: OTHER, contact_id: crypto.randomUUID(), stage: 'inquiry', created_at: ago(1) });

const b = await briefFor(db, CC, { now: NOW, timeZone: 'America/New_York' });
check('new requests since yesterday, by first name', b.new_requests.length === 1 && b.new_requests[0].customer === 'Dana' && b.new_requests[0].service === 'Car detail');
check('today\'s jobs only, in local time, with the address', b.jobs_today.length === 1 && b.jobs_today[0].time === '10:00 AM' && b.jobs_today[0].customer === 'Fay' && b.jobs_today[0].address === '12 Shore Rd, Westport');
check('what is waiting on the owner, in plain words', b.needs_you.length === 1 && b.needs_you[0].reason === 'a price to approve' && b.needs_you[0].service === 'Outside windows');
check('money: collected since yesterday and owed now, with the oldest invoice\'s age', b.money.collected_last_day_cents === 5000 && b.money.owed_cents === 14900 && b.money.oldest_days === 9);
check('customers to call and messages ready to send', b.customers_to_call.length === 1 && b.customers_to_call[0].rating === 2 && b.come_back_messages_ready === 1);
check('another business\'s requests never appear', !JSON.stringify(b).includes(OTHER));
check('the brief reads in plain words', b.text.startsWith('Crystal Clear:') && b.text.includes('1 new request since yesterday (Dana, Car detail).') && b.text.includes('Today: 10:00 AM Fay, Car detail at 12 Shore Rd, Westport.') && b.text.includes('Waiting on you: Eli needs a price to approve (Outside windows).') && b.text.includes('Call Eli (rated 2 of 5).') && b.text.includes('Collected $50 since yesterday.') && b.text.includes('Owed to you: $149 on 1 invoice, the oldest 9 days.') && b.text.includes('1 come-back message is ready to send.'));
check('a quiet day says so', briefText({ business: 'Flare', new_requests: [], jobs_today: [], needs_you: [], customers_to_call: [], card_payments_to_check: 0, money: { collected_last_day_cents: 0, owed_cents: 0 }, come_back_messages_ready: 0 }) === 'Flare:\nNothing new and nothing waiting on you.');

process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
globalThis.fetch = async (url) => {
  const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
  for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = decodeURIComponent(v.slice(3));
  return { ok: true, status: 200, json: async () => db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }) };
};
const perms = [];
const deps = (allowed) => ({ requireStaff: async () => ({ id: 'u1' }), requireOrgAccess: async (_r, res, _o, p) => { perms.push(p); if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true });
const call = async (d) => { const res = { code: 200, body: null, setHeader() {}, status(x) { this.code = x; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method: 'GET', query: { organization_id: CC, tz: 'America/New_York' }, body: undefined }, res, 'brief', d); return res; };
let r = await call(deps(false));
check('someone without access to the business gets no brief for it', r.code === 403 && perms.at(-1) === 'growth.view');
r = await call(deps(true));
check('a member reads the brief', r.code === 200 && r.body.brief.business === 'Crystal Clear');

console.log(`\n${pass}/${pass + fail} morning brief checks passed (in-memory store, test data — nothing sent)`);
process.exit(fail ? 1 : 0);
