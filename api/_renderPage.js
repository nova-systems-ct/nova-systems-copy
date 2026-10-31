// Reads public pages that are built by JavaScript, the way a visitor's browser shows them, without weakening the
// research network protections (owner brief 2026-10-30 §4, follow-up 2026-10-31):
// - the headless browser never reaches the network itself: every request it makes is intercepted and answered by
//   fetchPublicResource, which re-validates every redirect hop, refuses private/reserved addresses, non-standard ports
//   and embedded credentials, and caps size and time;
// - only GET is answered, so a page can never be made to submit a form or post data to the audited business;
// - anything that escapes interception (WebSocket, service worker) is sent to a dead proxy and fails;
// - images, media and fonts are not loaded; downloads, permissions and service workers are off; a fresh context each run.
// The rendered page is untrusted DATA: only its HTML text is kept for signal extraction. Needs Playwright + Chromium
// (local staging and a worker host); where they are missing, `available()` says so and callers report "not checked".
import { fetchPublicResource } from './_auditResearch.js';

const SKIP = new Set(['image', 'media', 'font']);
const UA = 'Mozilla/5.0 (compatible; NovaAuditResearch/2.0; +https://nova-systems.app) Chrome';

async function loadChromium() {
  try { const pw = await import('playwright'); return pw.chromium || pw.default?.chromium || null; } catch { return null; }
}

export async function available() {
  const chromium = await loadChromium(); if (!chromium) return { ok: false, reason: 'The page renderer (Playwright) is not installed on this server.' };
  try { const fs = await import('node:fs'); const exe = chromium.executablePath(); if (!exe || !fs.existsSync(exe)) return { ok: false, reason: 'Chromium is not installed for the page renderer.' }; } catch (e) { return { ok: false, reason: e.message }; }
  return { ok: true };
}

// Renders each URL (same order) and returns { url, finalUrl, status, html, text, retrievedAt, requests, blocked } or
// { url, error }. `fetchImpl`/`lookup` are injectable so tests run with no network.
export async function renderPages(urls, { fetchImpl, lookup, timeoutMs = 15000, settleMs = 1500, maxRequests = 80, maxTotalBytes = 6_000_000, now = () => new Date() } = {}) {
  const chromium = await loadChromium(); if (!chromium) throw new Error('page renderer not installed');
  const browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:9' }, args: ['--disable-background-networking', '--disable-sync', '--no-first-run', '--disable-features=ServiceWorker'] });
  const out = [];
  try {
    for (const url of urls) {
      const ctx = await browser.newContext({ userAgent: UA, acceptDownloads: false, serviceWorkers: 'block', javaScriptEnabled: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const stats = { requests: 0, bytes: 0, blocked: [] };
      await ctx.route('**/*', async (route) => {
        const req = route.request(); const u = req.url();
        if (/^(data|blob|about):/i.test(u)) return route.continue();
        const refuse = (why) => { stats.blocked.push({ url: u.slice(0, 200), why }); return route.abort('blockedbyclient'); };
        if (req.method() !== 'GET') return refuse(`${req.method()} is never sent`);
        if (SKIP.has(req.resourceType())) return route.abort('blockedbyclient');
        if (++stats.requests > maxRequests) return refuse('request limit');
        try {
          const r = await fetchPublicResource(u, { fetchImpl, lookup, timeoutMs: Math.min(timeoutMs, 8000), accept: req.headers().accept || '*/*' });
          stats.bytes += r.body.length; if (stats.bytes > maxTotalBytes) return refuse('size limit');
          return route.fulfill({ status: r.status, headers: { 'content-type': r.contentType }, body: r.body });
        } catch (e) { return refuse(e.message); }
      });
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.dismiss().catch(() => {}));
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
        await page.waitForLoadState('networkidle', { timeout: Math.max(1000, timeoutMs / 3) }).catch(() => {});
        await page.waitForTimeout(settleMs);
        const html = await page.content();
        const text = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
        out.push({ url, finalUrl: page.url(), status: resp?.status() || 0, html: html.slice(0, 1_500_000), text: String(text).slice(0, 200_000), retrievedAt: now().toISOString(), requests: stats.requests, blocked: stats.blocked });
      } catch (e) { out.push({ url, error: String(e.message || e).split('\n')[0].slice(0, 200), blocked: stats.blocked }); }
      finally { await ctx.close().catch(() => {}); }
    }
  } finally { await browser.close().catch(() => {}); }
  return out;
}
