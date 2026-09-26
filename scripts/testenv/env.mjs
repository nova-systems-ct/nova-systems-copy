// LOCAL INTEGRATION ENVIRONMENT — a real, disposable PostgreSQL + a real PostgREST + thin stand-ins for Supabase
// Auth/Storage and Resend (see stubs.mjs). Nothing here touches Supabase, Vercel, Resend or any production system.
//
//   const env = await startTestEnv({ migrations: ['supabase/x.sql', { file: 'supabase/legacy.sql', mode: 'statements' }] });
//   ... run application handlers with process.env set from env.appEnv ...
//   await env.stop();
//
// One-time setup: `cd .testenv && npm install`, and download PostgREST into .testenv/bin (see docs/SALES_TEAM_INSTALLATION.md).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStubs, signJwt, verifyJwt } from './stubs.mjs';
import { splitSql } from './sqlsplit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, '.testenv', 'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const pg = require('pg');
export const JWT_SECRET = 'local-test-jwt-secret-please-do-not-use-anywhere-else-0123456789';

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const waitFor = async (fn, ms, what) => { const t0 = Date.now(); let last; while (Date.now() - t0 < ms) { try { if (await fn()) return; } catch (e) { last = e; } await new Promise((r) => setTimeout(r, 200)); } throw new Error(`timeout waiting for ${what}: ${last?.message || ''}`); };

export async function startTestEnv({ migrations = [], publicBuckets = ['papers'], quiet = true } = {}) {
  const pgExe = path.join(ROOT, '.testenv', 'bin', 'postgrest.exe');
  if (!fs.existsSync(pgExe)) throw new Error('PostgREST binary missing: download postgrest v16.x for your OS into .testenv/bin (see docs/SALES_TEAM_INSTALLATION.md)');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-testenv-'));
  const pgPort = await freePort();
  const server = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'test', port: pgPort, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
  await server.initialise(); await server.start();
  const pool = new pg.Pool({ host: '127.0.0.1', port: pgPort, user: 'postgres', password: 'test', database: 'postgres', max: 6 });
  const q = (sql, params) => pool.query(sql, params);

  const errors = [];
  await q(fs.readFileSync(path.join(ROOT, 'scripts/testenv/bootstrap.sql'), 'utf8'));
  for (const entry of migrations) {
    const f = typeof entry === 'string' ? entry : entry.file; const mode = typeof entry === 'string' ? 'whole' : entry.mode || 'whole';
    const sql = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (mode === 'statements') { // tolerant mode for the cumulative legacy file: run each statement, record failures
      for (const st of splitSql(sql)) { try { await q(st); } catch (e) { errors.push({ file: f, statement: st.slice(0, 90).replace(/\s+/g, ' '), message: e.message }); } }
    } else {
      try { await q(sql); } catch (e) { errors.push({ file: f, message: e.message, position: e.position }); if (!quiet) console.error('migration failed:', f, e.message); }
    }
  }
  await q(`insert into storage.buckets (id, name, public) values ${publicBuckets.map((b) => `('${b}','${b}',true)`).join(',') || "('x','x',false)"} on conflict do nothing`);

  // PostgREST
  const restPort = await freePort();
  const conf = path.join(dataDir, 'postgrest.conf');
  fs.writeFileSync(conf, [`db-uri = "postgres://authenticator:test@127.0.0.1:${pgPort}/postgres"`, 'db-schemas = "public"', 'db-anon-role = "anon"', `jwt-secret = "${JWT_SECRET}"`, `server-port = ${restPort}`, 'server-host = "127.0.0.1"', 'db-pool = 5'].join('\n'));
  const libpq = path.join(ROOT, '.testenv', 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
  const proc = spawn(pgExe, [conf], { env: { ...process.env, PATH: `${libpq}${path.delimiter}${process.env.PATH}` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let restLog = ''; proc.stdout.on('data', (d) => (restLog += d)); proc.stderr.on('data', (d) => (restLog += d));
  await waitFor(async () => { const r = await fetch(`http://127.0.0.1:${restPort}/`); return r.status < 500; }, 60000, 'PostgREST').catch((e) => { throw new Error(`${e.message}\n${restLog.slice(-800)}`); });

  const stubs = createStubs({ pool, jwtSecret: JWT_SECRET, postgrestPort: restPort, publicBuckets });
  await new Promise((r) => stubs.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${stubs.server.address().port}`;
  const serviceKey = signJwt({ role: 'service_role' }, JWT_SECRET, 86400 * 365);
  const anonKey = signJwt({ role: 'anon' }, JWT_SECRET, 86400 * 365);
  const appEnv = { SUPABASE_URL: base, VITE_SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: serviceKey, VITE_SUPABASE_ANON_KEY: anonKey, RESEND_API_KEY: 're_test_local', RESEND_API_URL: `${base}/resend` };

  const reload = async () => { await q("notify pgrst, 'reload schema'"); await new Promise((r) => setTimeout(r, 500)); };
  await reload();

  const api = {
    dataDir, pgPort, restPort, base, pool, sql: q, appEnv, serviceKey, anonKey, migrationErrors: errors, stubs: stubs.state, stubServer: stubs, reload,
    jwt: (userId, email) => signJwt({ sub: userId, email, role: 'authenticated' }, JWT_SECRET),
    // Create a real auth user (in auth.users) and optionally a membership. Returns { id, email, token, password }.
    async createUser({ email, password = 'Passw0rd!test', role = null, orgId = null, status = 'active', name = null, confirm = true } = {}) {
      const r = await q('insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data) values ($1,$2,$3,$4) returning id', [email.toLowerCase(), stubs.hashPw(password), confirm ? new Date() : null, name ? { full_name: name } : {}]);
      const id = r.rows[0].id;
      if (role && orgId) await q('insert into public.organization_members (organization_id, member_type, staff_user_id, role, status) values ($1,$2,$3,$4,$5)', [orgId, 'staff', id, role, status]);
      return { id, email: email.toLowerCase(), password, token: api.jwt(id, email.toLowerCase()) };
    },
    // Direct PostgREST call AS a signed-in user (RLS applies) — proves database-level access rules.
    async rest(token, pathAndQuery, { method = 'GET', body, headers = {} } = {}) {
      const r = await fetch(`${base}/rest/v1/${pathAndQuery}`, { method, headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text; } return { status: r.status, data };
    },
    async stop() { try { await pool.end(); } catch { /* ignore */ } try { proc.kill(); } catch { /* ignore */ } await new Promise((r) => stubs.server.close(r)); try { await server.stop(); } catch { /* ignore */ } await new Promise((r) => setTimeout(r, 1200)); try { fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* ignore */ } },
  };
  return api;
}
export { signJwt, verifyJwt };
