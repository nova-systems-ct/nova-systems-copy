// Page renderer (api/_renderPage.js): real headless Chromium against a stand-in web (no network). Proves that a
// JavaScript-built page is read as a visitor sees it, and that the browser cannot reach private addresses, send
// anything but GET, open WebSockets, or follow a redirect inward.   node scripts/unit_page_renderer_test.mjs
import net from 'node:net';
const R = await import('../api/_renderPage.js');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

const avail = await R.available();
if (!avail.ok) { console.log(`SKIP — ${avail.reason}`); console.log('\n0 passed, 0 failed (renderer not installed here)'); process.exit(3); }

// a real listener on this computer: nothing the page does may ever connect to it
let inbound = 0;
const trap = net.createServer((s) => { inbound++; s.destroy(); });
await new Promise((r) => trap.listen(0, '127.0.0.1', r));
const TRAP = trap.address().port;

const PUBLIC = { 'shop.example': '93.184.216.34', 'cdn.example': '93.184.216.35', 'inward.example': '10.0.0.5' };
const lookup = async (h) => (PUBLIC[h] ? [{ address: PUBLIC[h], family: 4 }] : []);
const fetched = [];
const shell = '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Brass City Roofing</title></head><body><div id="root"></div><script src="https://cdn.example/app.js"></script></body></html>';
const app = `
  const root = document.getElementById('root');
  root.innerHTML = '<h1>Brass City Roofing</h1><p>Waterbury, CT</p><a href="tel:+12035550100">Call (203) 555-0100</a><p>Open Mon-Fri 8am-5pm</p><a href="/contact">Contact</a><img src="http://10.0.0.1/pixel.png">';
  const tries = ['http://127.0.0.1:${TRAP}/steal', 'http://169.254.169.254/latest/meta-data/', 'https://inward.example/admin', 'https://shop.example/go-inward'];
  for (const u of tries) fetch(u).catch(() => {});
  fetch('https://shop.example/api/lead', { method: 'POST', body: 'name=x' }).catch(() => {});
  try { new WebSocket('ws://127.0.0.1:${TRAP}/'); } catch (e) {}
  navigator.sendBeacon && navigator.sendBeacon('https://shop.example/beacon', 'x');
`;
const fetchImpl = async (url, opts = {}) => {
  fetched.push({ url, method: opts.method || 'GET' });
  const u = new URL(url);
  if (u.hostname === 'shop.example' && u.pathname === '/') return new Response(shell, { status: 200, headers: { 'content-type': 'text/html' } });
  if (u.hostname === 'shop.example' && u.pathname === '/go-inward') return new Response('', { status: 302, headers: { location: `http://127.0.0.1:${TRAP}/after-redirect` } });
  if (u.hostname === 'cdn.example' && u.pathname === '/app.js') return new Response(app, { status: 200, headers: { 'content-type': 'application/javascript' } });
  return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
};

const [page] = await R.renderPages(['https://shop.example/'], { fetchImpl, lookup, timeoutMs: 15000, settleMs: 800 });
check('a JavaScript-built page is rendered (no error)', page && !page.error, JSON.stringify(page?.error));
check('the rendered page shows what a visitor sees: the tap-to-call link and hours', /href="tel:\+12035550100"/.test(page.html) && /Mon-Fri 8am-5pm/.test(page.text), page.text?.slice(0, 200));
check('the script it needed came through the guarded fetcher (from a public host)', fetched.some((f) => f.url === 'https://cdn.example/app.js'));
check('nothing ever connected to a listener on this computer (fetch, redirect or WebSocket)', inbound === 0, `connections=${inbound}`);
check('the guarded fetcher was never asked for a loopback, link-local or private address', !fetched.some((f) => /127\.0\.0\.1|169\.254|10\.0\.0\./.test(f.url)), JSON.stringify(fetched));
check('a host that resolves to a private address is refused', page.blocked.some((b) => /inward\.example/.test(b.url) && /private/i.test(b.why)), JSON.stringify(page.blocked));
check('a redirect from a public page to an inward address is refused at the hop', page.blocked.some((b) => /go-inward/.test(b.url)), JSON.stringify(page.blocked));
check('nothing but GET is ever sent (form posts and beacons are refused)', !fetched.some((f) => f.method !== 'GET') && page.blocked.some((b) => /POST is never sent/.test(b.why)), JSON.stringify(page.blocked.filter((b) => /never sent/.test(b.why))));
check('images are not loaded (the private-address pixel was never requested)', !fetched.some((f) => /pixel/.test(f.url)));

// a page that never answers within the limit is reported as an error, not hung
const slow = await R.renderPages(['https://shop.example/'], { fetchImpl: () => new Promise(() => {}), lookup, timeoutMs: 3000, settleMs: 100 });
check('a page that never answers ends with an error within the time limit', !!slow[0].error, JSON.stringify(slow[0]).slice(0, 200));

trap.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
