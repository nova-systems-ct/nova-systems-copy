// Live-browser harness: real Vite frontend + the REAL api/*.js handlers + a REAL local PostgreSQL/PostgREST, with Supabase Auth/Storage,
// Resend and Stripe replaced by local stand-ins. Lets a browser (Playwright) exercise the actual screens end to end.
// NOT Supabase, NOT production. Disposable. Nothing leaves this machine.
import http from 'node:http';
import { createServer } from 'vite';
import { startTestEnv } from './env.mjs';
import { allMigrations } from './migrations.mjs';

export async function startHarness({ vitePort = 5199, apiPort = 8799, seed } = {}) {
  const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [], quiet: true });
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
  const ctx = { env, apiPort, vitePort, base: `http://localhost:${vitePort}` };
  if (seed) await seed(ctx);
  return { ...ctx, async stop() { await vite.close(); await new Promise((r) => api.close(r)); await env.stop(); } };
}
