// Client websites (system 5): api/_site.js and the /b/<slug> op. In-memory store, TEST FIXTURES.
import crypto from 'node:crypto';
import { siteFor, hoursRows } from '../api/_site.js';
import { handleJourney } from '../api/_journey.js';

const ORG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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
const NOW = new Date('2026-11-24T14:00:00Z');

const db = memoryDb();
await db.insert('organizations', { id: ORG, name: 'Crystal Clear', slug: 'crystal-clear-a1b2c3', kind: 'client', status: 'active' });
let out = await siteFor(db, 'crystal-clear-a1b2c3', { now: NOW });
check('a business with no active service has no public page yet', out.status === 404);
await db.insert('business_services', { organization_id: ORG, name: 'Car detail', description: 'Inside and out, by hand.', price_cents: 19900, price_approved: true, active: true });
await db.insert('business_services', { organization_id: ORG, name: 'Window cleaning', description: 'Outside windows, up to 20.', price_cents: 19900, price_approved: false, active: true });
await db.insert('business_services', { organization_id: ORG, name: 'Lawn mowing', price_cents: 4500, price_approved: false, active: false });
out = await siteFor(db, 'crystal-clear-a1b2c3', { now: NOW });
check('as soon as one service is on, the site works with no code written', out.status === 200 && out.html.includes('<h1>Crystal Clear</h1>'));
check('active services are listed; a switched-off one is not', out.html.includes('Car detail') && out.html.includes('Window cleaning') && !out.html.includes('Lawn mowing'));
check('a price shows only where the owner approved it', out.html.includes('<span class="price">$199</span><strong>Car detail') && !out.html.includes('<span class="price">$199</span><strong>Window cleaning'));
check('every button goes to the business\'s own request page', (out.html.match(new RegExp(`href="/start\\?org=${ORG}"`, 'g')) || []).length === 2);
check('nothing that is not on file is shown (no hours, no phone, no offer)', !out.html.includes('<h2>Hours</h2>') && !out.html.includes('tel:') && !out.html.includes('class="offer"'));
check('the page can be found by search engines', !out.html.includes('noindex'));

await db.insert('business_agents', { organization_id: ORG, business_name: 'Crystal Clear <Detailing>', industry: 'Car detailing', service_area: 'Fairfield County, CT', greeting: 'Home and car care, done properly.', phone_number: '+12035550100' });
await db.insert('voice_configurations', { organization_id: ORG, business_hours: { mon: [{ start: '08:00', end: '17:30' }], sat: [{ start: '09:00', end: '13:00' }], sun: [] }, timezone: 'America/New_York' });
await db.insert('business_offers', { organization_id: ORG, trigger_type: 'web_visit', code: 'HOLIDAY', description: 'Holiday Ready: detail plus outside windows for $299', percent_off: 25, approved: true, active: true, expires_at: '2026-12-16T04:59:00Z' });
await db.insert('business_offers', { organization_id: ORG, trigger_type: 'web_visit', code: 'SECRET', description: 'Not approved', percent_off: 50, approved: false, active: true, expires_at: null });
out = await siteFor(db, 'crystal-clear-a1b2c3', { now: NOW });
check('the business\'s own words, area and phone are used', out.html.includes('Home and car care, done properly.') && out.html.includes('Fairfield County, CT') && out.html.includes('href="tel:+12035550100"') && out.html.includes('Call (203) 555-0100'));
check('names are shown safely (no HTML can be injected)', out.html.includes('Crystal Clear &lt;Detailing&gt;') && !out.html.includes('<Detailing>'));
check('only the approved website offer is shown, and its code rides along to the request page', out.html.includes('Holiday Ready') && !out.html.includes('SECRET') && out.html.includes(`/start?org=${ORG}&amp;code=HOLIDAY`));
check('opening hours read plainly; a day with no hours says Closed', out.html.includes('<td>Monday</td><td>8 a.m. to 5:30 p.m.</td>') && out.html.includes('<td>Saturday</td><td>9 a.m. to 1 p.m.</td>') && out.html.includes('<td>Sunday</td><td>Closed</td>'));
check('days with no record at all are left out, never assumed open', !out.html.includes('Tuesday'));
check('hours are skipped when none are recorded', hoursRows(null).length === 0 && hoursRows({}).length === 0);
check('an unknown or malformed address shows a plain not-found page', (await siteFor(db, 'nope', { now: NOW })).status === 404 && (await siteFor(db, '../etc', { now: NOW })).status === 404);
db.t.organizations[0].status = 'paused';
check('a business that is not active has no public page', (await siteFor(db, 'crystal-clear-a1b2c3', { now: NOW })).status === 404);
db.t.organizations[0].status = 'active';

// HTTP: GET /b/<slug> is rewritten to this op.
process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
globalThis.fetch = async (url) => {
  const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
  for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v.slice(3) === 'true' ? true : decodeURIComponent(v.slice(3));
  return { ok: true, status: 200, json: async () => db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }) };
};
const deps = { requireStaff: async () => null, requireOrgAccess: async () => false, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => v, rateLimit: () => true };
const res = { code: 200, html: '', headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; }, end(x) { this.html = x; return this; } };
await handleJourney({ method: 'GET', query: { slug: 'Crystal-Clear-A1B2C3' }, body: undefined }, res, 'site', deps);
check('the public address needs no login and serves the page as HTML, cached briefly', res.code === 200 && res.headers['Content-Type'].startsWith('text/html') && res.headers['Cache-Control'] === 'public, max-age=300' && res.html.includes('Crystal Clear'));

console.log(`\n${pass}/${pass + fail} client website checks passed (in-memory store, test data — no database contacted)`);
process.exit(fail ? 1 : 0);
