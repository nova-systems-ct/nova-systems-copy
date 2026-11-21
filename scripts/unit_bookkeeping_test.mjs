// Bookkeeping export (system 26): api/_bookkeeping.js. In-memory store, TEST FIXTURES only; no
// database is contacted and nothing is sent.
import crypto from 'node:crypto';
import { monthExport, csvCell } from '../api/_bookkeeping.js';
import { handleJourney } from '../api/_journey.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [c, d] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, p) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, p) })),
  };
}
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const parse = (csv) => csv.trim().split('\r\n').map((line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"')));

const db = memoryDb();
await db.insert('business_agents', { organization_id: CC, business_name: 'Crystal Clear' });
const svc = await db.insert('business_services', { organization_id: CC, name: 'Car detail' });
const dana = await db.insert('crm_contacts', { organization_id: CC, name: 'Dana "DJ" Ruiz' });
const evil = await db.insert('crm_contacts', { organization_id: CC, name: '=HYPERLINK("http://x","click")' });
const j1 = await db.insert('journeys', { organization_id: CC, contact_id: dana.id, service_id: svc.id });
const j2 = await db.insert('journeys', { organization_id: CC, contact_id: evil.id, service_id: svc.id });
const pro = await db.insert('business_workers', { organization_id: CC, name: 'Marco Pro', kind: 'contractor' });
await db.insert('journey_documents', { organization_id: CC, journey_id: j1.id, kind: 'deposit_invoice', amount_cents: 5000, status: 'paid', created_at: '2026-11-03T15:00:00Z' });
await db.insert('journey_documents', { organization_id: CC, journey_id: j1.id, kind: 'receipt', amount_cents: 5000, payment_source: 'provider_verified', payment_reference: 'stripe:pi_123', created_at: '2026-11-03T15:05:00Z' });
await db.insert('journey_documents', { organization_id: CC, journey_id: j1.id, kind: 'quote', amount_cents: 19900, created_at: '2026-11-02T15:00:00Z' });
// 10:30 p.m. on Nov 30 in Connecticut is Dec 1 in UTC: it belongs to November.
await db.insert('journey_documents', { organization_id: CC, journey_id: j1.id, kind: 'receipt', amount_cents: 14900, payment_source: 'owner_recorded', payment_reference: 'cash', created_at: '2026-12-01T03:30:00Z' });
await db.insert('journey_documents', { organization_id: CC, journey_id: j2.id, kind: 'receipt', amount_cents: 1000, payment_source: 'owner_recorded', payment_reference: '+1 trick', created_at: '2026-12-02T15:00:00Z' });
await db.insert('pay_split_entries', { organization_id: CC, journey_id: j1.id, worker_id: pro.id, label: 'Pro', percent: 50, basis_cents: 19900, amount_cents: 9950, paid_out_at: null, created_at: '2026-11-30T20:00:00Z' });
await db.insert('journey_documents', { organization_id: OTHER, journey_id: crypto.randomUUID(), kind: 'receipt', amount_cents: 777, payment_source: 'owner_recorded', payment_reference: 'other', created_at: '2026-11-10T15:00:00Z' });

const nov = await monthExport(db, CC, { month: '2026-11' });
const rows = parse(nov.csv);
check('the file is named for the business and month', nov.filename === 'crystal-clear-2026-11-bookkeeping.csv');
check('a header row then one row per invoice, payment and share; quotes are not money', rows[0][0] === 'Date' && rows.length === 1 + 4 && !nov.csv.includes('19900') && nov.counts.invoices === 1 && nov.counts.payments === 2 && nov.counts.shares === 1);
check('a payment made late on Nov 30 in Connecticut counts in November', rows.some((r) => r[0] === '2026-11-30' && r[1] === 'Payment received' && r[5] === '149.00'));
check('who confirmed each payment is kept apart', rows.find((r) => r[7] === 'stripe:pi_123')[6] === 'Payment provider' && rows.find((r) => r[7] === 'cash')[6] === 'Entered by the business');
check('the pay share names who it is for and whether it was paid out', rows.some((r) => r[1] === 'Pay split share' && r[5] === '99.50' && r[8] === 'Marco Pro (independent pro)' && /not paid out yet/.test(r[4])));
check('quotes inside names survive', rows.some((r) => r[2] === 'Dana "DJ" Ruiz'));
check('another business\'s money never appears', !nov.csv.includes('7.77') && !nov.csv.includes('other'));
check('rows are in date order', rows.slice(1).every((r, i, a) => i === 0 || a[i - 1][0] <= r[0]));
const dec = await monthExport(db, CC, { month: '2026-12' });
const decRows = parse(dec.csv);
check('a cell that would run as a spreadsheet formula is made plain text', decRows.some((r) => r[2] === `'=HYPERLINK("http://x","click")`) && decRows.some((r) => r[7] === "'+1 trick"));
check('the December file holds only December', dec.counts.payments === 1 && dec.counts.invoices === 0);
check('cells are quoted the standard way', csvCell('a"b') === '"a""b"' && csvCell(null) === '""' && csvCell('-5') === `"'-5"`);
let bad = false; try { await monthExport(db, CC, { month: '2026-13' }); } catch (e) { bad = e.code === 'bad_month'; }
check('a month that does not exist is refused', bad);

// HTTP: only someone with the owner-level permission in that business can download it.
process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
globalThis.fetch = async (url) => {
  const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
  for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = decodeURIComponent(v.slice(3));
  return { ok: true, status: 200, json: async () => db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }) };
};
const perms = [];
const deps = (allowed) => ({ requireStaff: async () => ({ id: 'u1' }), requireOrgAccess: async (_r, res, _o, p) => { perms.push(p); if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true });
const call = async (q, d) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method: 'GET', query: q, body: undefined }, res, 'bookkeeping-export', d); return res; };
let r = await call({ organization_id: CC, month: '2026-11' }, deps(false));
check('staff without the owner permission in this business get nothing', r.code === 403 && perms.at(-1) === 'business.manage');
r = await call({ organization_id: CC, month: '2026-11', tz: 'America/New_York' }, deps(true));
check('the owner downloads the month', r.code === 200 && r.body.counts.payments === 2 && r.body.csv.startsWith('"Date"'));

console.log(`\n${pass}/${pass + fail} bookkeeping export checks passed (in-memory store, test data — no database contacted)`);
process.exit(fail ? 1 : 0);
