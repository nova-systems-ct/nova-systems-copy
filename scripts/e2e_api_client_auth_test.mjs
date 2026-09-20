// Stage 6 security-fix E2E test — verifies api/client.js's staff-auth gate (api/_auth.js),
// added 2026-09-20 after the Phase 0 audit found the file had ZERO authentication anywhere: every
// invoices/referrals/intake-requests/vault/portfolio-write/blog-admin/documents/site-content-write
// call was reachable by anyone who could reach the endpoint directly, not just through the gated
// /dashboard/* routes, because every handler uses the Supabase SERVICE ROLE key internally.
//
// Creates one throwaway org + two throwaway Supabase Auth users (nova_admin — has every
// permission checked below; nova_sales — has growth.view but NOT admin.view/intelligence.view,
// used to prove insufficient-permission is rejected, not just missing-auth), calls the real
// handler() export from api/client.js directly with a mocked req/res (no HTTP server needed —
// matches this repo's existing direct-handler-test pattern), and deletes everything in a finally
// block. Safe to re-run; no real SMS/email/Claude-API side effects.
//
// PREREQUISITE: the Stage 4 migration in supabase/schema-update.sql must already be applied.
// Usage: node scripts/e2e_api_client_auth_test.mjs

import fs from 'node:fs';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY']) {
  if (env[k] && !process.env[k]) process.env[k] = env[k];
}
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const admin = (path, opts = {}) => fetch(`${SUPABASE_URL}${path}`, {
  ...opts,
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
  return pass;
}

function mockReq({ method = 'GET', query = {}, headers = {}, body = null }) {
  return { method, query, headers, body, socket: {} };
}
function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this._json = payload; return this; },
    setHeader() {},
  };
  return res;
}

async function createOrg(name, slug) {
  const res = await admin('/rest/v1/organizations', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, slug, kind: 'client', status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test org: ' + JSON.stringify(row));
  return row.id;
}
async function deleteOrg(id) { await admin(`/rest/v1/organizations?id=eq.${id}`, { method: 'DELETE' }); }

async function createAuthUser(email, password) {
  const res = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  const row = await res.json();
  if (!row?.id) throw new Error('Failed to create test auth user: ' + JSON.stringify(row));
  return row;
}
async function deleteAuthUser(id) { await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); }

async function createMembership(orgId, userId, role) {
  const res = await admin('/rest/v1/organization_members', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: userId, role, status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test membership: ' + JSON.stringify(row));
  return row.id;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data?.access_token) throw new Error('Sign-in failed: ' + JSON.stringify(data));
  return data;
}

async function main() {
  const { default: handler } = await import('../api/client.js');

  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — api client auth ${suffix}`, `test-client-auth-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const adminUser = await createAuthUser(`test-client-auth-admin-${suffix}@example.invalid`, adminPassword);
    const salesUser = await createAuthUser(`test-client-auth-sales-${suffix}@example.invalid`, salesPassword);
    cleanup.push(() => deleteAuthUser(adminUser.id), () => deleteAuthUser(salesUser.id));

    await createMembership(orgId, adminUser.id, 'nova_admin');   // has admin.view, growth.view, intelligence.view
    await createMembership(orgId, salesUser.id, 'nova_sales');   // has growth.view only

    const adminSession = await signIn(adminUser.email, adminPassword);
    const salesSession = await signIn(salesUser.email, salesPassword);

    // ---- 1. No Authorization header at all -> 401 on every staff-only resource/op ----
    const noAuthCases = [
      { resource: 'invoices', query: { resource: 'invoices' } },
      { resource: 'referrals', query: { resource: 'referrals' } },
      { resource: 'intake-requests', query: { resource: 'intake-requests' } },
      { resource: 'vault list', query: { resource: 'vault', op: 'list' } },
      { resource: 'portfolio upload', query: { resource: 'portfolio', op: 'upload' }, method: 'POST' },
      { resource: 'portfolio mutate', query: { resource: 'portfolio', op: 'mutate' }, method: 'POST' },
      { resource: 'blog admin', query: { resource: 'blog', op: 'admin' }, method: 'POST' },
      { resource: 'blog posts admin=true', query: { resource: 'blog', op: 'posts', admin: 'true' } },
      { resource: 'documents', query: { resource: 'documents' }, method: 'POST' },
      { resource: 'site-content POST', query: { resource: 'site-content' }, method: 'POST' },
    ];
    for (const c of noAuthCases) {
      const req = mockReq({ method: c.method || 'GET', query: c.query, body: {} });
      const res = mockRes();
      await handler(req, res);
      log(`No Authorization header rejected: ${c.resource}`, res.statusCode === 401, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 2. Garbage/invalid bearer token -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'invoices' }, headers: { authorization: 'Bearer not-a-real-token' } });
      const res = mockRes();
      await handler(req, res);
      log('Invalid bearer token rejected: invoices', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 3. Real staff session WITH the required permission -> not blocked by auth (not 401/403) ----
    const authedCases = [
      { resource: 'invoices', query: { resource: 'invoices' } },
      { resource: 'referrals', query: { resource: 'referrals' } },
      { resource: 'intake-requests', query: { resource: 'intake-requests' } },
      { resource: 'vault list', query: { resource: 'vault', op: 'list' } },
    ];
    for (const c of authedCases) {
      const req = mockReq({ method: 'GET', query: c.query, headers: { authorization: `Bearer ${adminSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log(`nova_admin (has permission) passes auth gate: ${c.resource}`, res.statusCode !== 401 && res.statusCode !== 403, `status=${res.statusCode}`);
    }

    // ---- 4. Real staff session WITHOUT the required permission -> 403 ----
    const insufficientCases = [
      { resource: 'invoices (needs admin.view, nova_sales lacks it)', query: { resource: 'invoices' } },
      { resource: 'intake-requests (needs intelligence.view, nova_sales lacks it)', query: { resource: 'intake-requests' } },
      { resource: 'documents (needs admin.view)', query: { resource: 'documents' }, method: 'POST' },
    ];
    for (const c of insufficientCases) {
      const req = mockReq({ method: c.method || 'GET', query: c.query, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: {} });
      const res = mockRes();
      await handler(req, res);
      log(`nova_sales (insufficient permission) rejected: ${c.resource}`, res.statusCode === 403, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 5. Public resources remain public (no token, still 200-range) ----
    const publicCases = [
      { resource: 'portfolio items', query: { resource: 'portfolio', op: 'items' } },
      { resource: 'blog posts (no admin flag)', query: { resource: 'blog', op: 'posts' } },
      { resource: 'site-content GET', query: { resource: 'site-content' } },
    ];
    for (const c of publicCases) {
      const req = mockReq({ method: 'GET', query: c.query });
      const res = mockRes();
      await handler(req, res);
      log(`Public resource still works with no auth: ${c.resource}`, res.statusCode === 200, `status=${res.statusCode}`);
    }

    // ---- 6. Retired 'auth' resource always 410, with or without a token ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'auth' }, body: { email: 'x@example.invalid', password_hash: 'x' } });
      const res = mockRes();
      await handler(req, res);
      log('Retired auth resource returns 410', res.statusCode === 410, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { console.error('cleanup error:', e.message); }
    }
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err);
  process.exit(1);
});
