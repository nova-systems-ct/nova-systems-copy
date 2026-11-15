// Proves the three endpoints closed on 2026-11-13 stay closed. No database, provider or network:
// global fetch is replaced with a stand-in that records every outbound request.
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local';
process.env.STRIPE_API_BASE = 'https://stripe.test/v1';
process.env.RESEND_API_KEY = 're_local';

const INVOICE = '11111111-1111-4111-8111-111111111111';
const CLIENT = '22222222-2222-4222-8222-222222222222';
let calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); calls.push({ url: u, method: opts.method || 'GET', body: opts.body });
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  if (u.includes('/auth/v1/user')) return json(401, {});
  if (u.includes('/rest/v1/client_invoices') && (opts.method || 'GET') === 'GET') return json(200, [{ total: 500 }]);
  if (u.includes('/rest/v1/')) return json(200, []);
  if (u.startsWith('https://stripe.test')) return json(200, { id: 'x_1', url: 'https://pay.test', client_secret: 'cs' });
  return json(200, {});
};

const { default: stripe } = await import('../api/stripe.js');
const { default: notify } = await import('../api/notify.js');
const { uploadContentType, default: intake } = await import('../api/business-intake.js');

function call(handler, { query = {}, headers = {}, body, raw = true, method = 'POST' }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const req = raw ? Readable.from([Buffer.from(text)]) : {};
  Object.assign(req, { method, query, headers: { origin: 'https://nova-systems.app', ...headers }, socket: {} });
  if (!raw) req.body = body;
  return new Promise((resolve) => {
    const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; },
      json(d) { resolve({ status: this.statusCode, data: d }); }, end() { resolve({ status: this.statusCode }); }, send(d) { resolve({ status: this.statusCode, data: d }); } };
    handler(req, res);
  });
}
function signed(event) {
  const raw = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', 'whsec_local').update(`${t}.${raw}`).digest('hex');
  return { body: raw, headers: { 'stripe-signature': `t=${t},v1=${v1}` } };
}
const paidPatches = () => calls.filter((c) => c.method === 'PATCH' && c.url.includes('client_invoices'));
const stripeBody = () => new URLSearchParams(calls.find((c) => c.url.startsWith('https://stripe.test'))?.body || '');

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

let r = await call(notify, { query: { action: 'send-invoice' }, raw: false, body: { client_email: 'victim@example.com', pay_link: 'https://evil.test' } });
check('send-invoice without a staff session is refused', r.status === 401 && !calls.some((c) => c.url.includes('resend.com')));

calls = [];
r = await call(stripe, { query: { action: 'checkout-session' }, body: { amount: 1, invoice_id: INVOICE } });
check('checkout for an invoice without a staff session is refused', r.status === 401 && !calls.some((c) => c.url.startsWith('https://stripe.test')));

calls = [];
r = await call(stripe, { query: { action: 'payment-intent' }, body: { amount: 1, client_id: CLIENT, tier_name: 'Tier 1 — Website Only' } });
check('onboarding charge uses the server price, not the $1 the browser sent', r.status === 200 && stripeBody().get('amount') === '50000');

calls = [];
r = await call(stripe, { query: { action: 'payment-intent' }, body: { amount: 1, client_id: CLIENT, tier_name: 'Made Up Plan' } });
check('onboarding charge with an unknown plan is refused', r.status === 400 && !calls.some((c) => c.url.startsWith('https://stripe.test')));

calls = [];
r = await call(stripe, { query: { action: 'payment-intent' }, body: { amount: 25 } });
check('a charge linked to nothing still works and carries no record ids', r.status === 200 && stripeBody().get('amount') === '2500' && stripeBody().get('metadata[client_id]') === '');

const session = (cents) => ({ id: 'evt_' + cents, type: 'checkout.session.completed', data: { object: { payment_status: 'paid', amount_total: cents, currency: 'usd', metadata: { invoice_id: INVOICE }, customer_details: {} } } });
calls = [];
r = await call(stripe, signed(session(100)));
check('a $1 payment does not mark a $500 invoice paid', r.status === 200 && paidPatches().length === 0);
calls = [];
r = await call(stripe, signed(session(50000)));
check('a full $500 payment marks the invoice paid', r.status === 200 && paidPatches().length === 1);
calls = [];
r = await call(stripe, signed({ id: 'evt_pi', type: 'payment_intent.succeeded', data: { object: { amount_received: 100, currency: 'usd', metadata: { invoice_id: INVOICE } } } }));
check('a $1 payment intent does not mark the invoice paid', r.status === 200 && paidPatches().length === 0);

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
check('a real PNG is accepted as image/png', uploadContentType('logo.png', png) === 'image/png');
check('an HTML file is refused', uploadContentType('page.html', Buffer.from('<html></html>')) === '');
check('HTML renamed to .png is refused', uploadContentType('page.png', Buffer.from('<html></html>')) === '');
check('a script inside a .txt is refused', uploadContentType('note.txt', Buffer.from('<script>alert(1)</script>')) === '');
check('plain text is accepted', uploadContentType('prices.csv', Buffer.from('item,price\nA,10\n')) === 'text/csv');
check('an SVG is refused', uploadContentType('logo.svg', Buffer.from('<svg/>')) === '');

calls = [];
r = await call(intake, { query: { action: 'upload-file' }, raw: false, body: { filename: 'logo.png', category: 'logo', email: 'owner@example.com', file_base64: png.toString('base64') } });
check('an uploaded file is stored under an unguessable private path, with no public link returned', r.status === 200 && !/object\/public/.test(JSON.stringify(r.data)) && /^nova-intake-files\/owner_example_com\/logo\/\d+-[0-9a-f]{16}-logo\.png$/.test(r.data.url));
calls = [];
r = await call(intake, { query: { action: 'file-url' }, raw: false, body: { path: r.data.path } });
check('opening an uploaded file needs a staff session', r.status === 401 && !calls.some((c) => c.url.includes('/object/sign/')));
const vercel = JSON.parse((await import('node:fs')).readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
check('the browser security policy allows the staging database as well as production, and nothing else new', /connect-src[^;]*xizmgruvuazmummotzkp\.supabase\.co[^;]*ubjnddxmdaxnbpzcmxnc\.supabase\.co/.test(csp) && (csp.match(/supabase\.co/g) || []).length % 2 === 0);

console.log(`\n${pass}/${pass + fail} security endpoint checks passed (stand-in fetch — no provider contacted, no database touched)`);
process.exit(fail ? 1 : 0);
