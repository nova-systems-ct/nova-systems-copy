// Live-browser harness: real Vite frontend + the REAL api/*.js handlers + a REAL local PostgreSQL/PostgREST, with Supabase Auth/Storage,
// Resend and Stripe replaced by local stand-ins. Lets a browser (Playwright) exercise the actual screens end to end.
// NOT Supabase, NOT production. Disposable. Nothing leaves this machine.
import http from 'node:http';
import fs from 'node:fs';
import { createServer } from 'vite';
import { startTestEnv } from './env.mjs';
import { allMigrations } from './migrations.mjs';

export async function startHarness({ vitePort = 5199, apiPort = 8799, seed, manifest = false } = {}) {
  // manifest:true builds the database from supabase/migration-manifest.json on the Supabase platform emulation only (strict clean install)
  const migrations = manifest ? JSON.parse(fs.readFileSync('supabase/migration-manifest.json', 'utf8')).order : allMigrations();
  const env = await startTestEnv({ migrations, publicBuckets: [], quiet: true, ...(manifest ? { bootstrap: 'platform' } : {}) });
  Object.assign(process.env, env.appEnv, { APP_BASE_URL: `http://localhost:${vitePort}`, SALES_EMAIL_MODE: 'dry_run' });
  const modules = new Map();
  const load = async (name) => { if (!modules.has(name)) modules.set(name, await import(`../../api/${name}.js`)); return modules.get(name); };

  const api = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${apiPort}`); const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
      if (!/^[a-z-]+$/.test(name)) { res.statusCode = 404; return res.end('{}'); }
      const mod = await load(name);
      const raw = mod.config?.api?.bodyParser === false;
      req.query = Object.fromEntries(url.searchParams);
      if (!raw) { const chunks = []; for await (const c of req) chunks.push(c); const text = Buffer.concat(chunks).toString('utf8'); try { req.body = text ? JSON.parse(text) : {}; } catch { req.body = {}; } }
      let sent = false;
      const out = { statusCode: 200, setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return out; }, json(b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); sent = true; return out; }, send(b) { res.end(b); sent = true; return out; }, end(b) { res.end(b); sent = true; return out; }, get headersSent() { return sent; } };
      await mod.default(req, out);
    } catch (e) { console.error('[harness api error]', e); if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); } }
  });
  await new Promise((r) => api.listen(apiPort, '127.0.0.1', r));

  process.env.VITE_SUPABASE_URL = env.base; process.env.VITE_SUPABASE_ANON_KEY = env.anonKey;
  const vite = await createServer({ configFile: 'vite.config.js', logLevel: 'error', server: { port: vitePort, strictPort: true, proxy: { '/api': `http://127.0.0.1:${apiPort}` } } });
  await vite.listen();
  // Readiness, not a longer timeout: Vite compiles modules on first request, and on a loaded machine the first page.goto
  // of a browser suite timed out at 30 s while that compile ran (clean run 2026-10-16, e2e_sales_browser_test). Request the
  // HTML and transform the app entry (and its import graph via warmupRequest) before any test navigates.
  const t0 = Date.now();
  await fetch(`http://localhost:${vitePort}/`).then((r) => r.text());
  await vite.warmupRequest?.('/src/main.jsx').catch?.(() => {});
  await fetch(`http://localhost:${vitePort}/src/main.jsx`).then((r) => r.text()).catch(() => {});
  if (process.env.NOVA_HARNESS_DEBUG) console.log(`[harness] vite warm in ${Date.now() - t0} ms`);
  const ctx = { env, apiPort, vitePort, base: `http://localhost:${vitePort}` };
  if (seed) await seed(ctx);
  return { ...ctx, async stop() { await vite.close(); await new Promise((r) => api.close(r)); await env.stop(); } };
}
