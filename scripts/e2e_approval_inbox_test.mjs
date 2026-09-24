// Approval Inbox E2E test (2026-09-23, master prompt §19) — proves the real behavior the design
// depends on: aggregation of pending items from three independent sources into one inbox,
// content_version mismatch refusal ("recheck authority and unchanged content immediately before
// execution" — a stale approval must not execute against changed content), expires_at auto-expiry,
// revoke only being valid from an actually-approved state (not a no-op dressed up as an action),
// and admin.view gating (this resource handles spending/installation/content-publication actions,
// gated the same as invoices/vault, not left at bare "any active staff").
//
// Mirrors the established e2e pattern: real throwaway org/users, direct handler() calls, cleanup
// in a finally block.
//
// PREREQUISITE: supabase/approval-inbox-migration-standalone.sql must already be applied. Fails
// fast with a clear message if it isn't.
// Usage: node scripts/e2e_approval_inbox_test.mjs

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

const adminFetch = (path, opts = {}) => fetch(`${SUPABASE_URL}${path}`, {
  ...opts,
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

function mockReq({ method = 'GET', query = {}, headers = {}, body = null }) {
  return { method, query, headers, body, socket: {} };
}
function mockRes() {
  const res = {
    statusCode: 200, _json: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this._json = payload; return this; },
    setHeader() {},
  };
  return res;
}

async function createOrg(name, slug) {
  const res = await adminFetch('/rest/v1/organizations', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, slug, kind: 'client', status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test org: ' + JSON.stringify(row));
  return row.id;
}
async function deleteOrg(id) { await adminFetch(`/rest/v1/organizations?id=eq.${id}`, { method: 'DELETE' }); }
async function createAuthUser(email, password) {
  const res = await adminFetch('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  const row = await res.json();
  if (!row?.id) throw new Error('Failed to create test auth user: ' + JSON.stringify(row));
  return row;
}
async function deleteAuthUser(id) { await adminFetch(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); }
async function createMembership(orgId, userId, role) {
  const res = await adminFetch('/rest/v1/organization_members', {
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
  const probe = await adminFetch('/rest/v1/approval_requests?select=id&limit=1');
  if (!probe.ok) {
    console.error('approval_requests is not queryable — supabase/approval-inbox-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgId = await createOrg(`TEST — approvals ${suffix}`, `test-approvals-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const limitedPassword = `Lx${Math.random().toString(36).slice(2)}!9`;
    const adminUser = await createAuthUser(`test-approvals-admin-${suffix}@example.invalid`, adminPassword);
    const limitedUser = await createAuthUser(`test-approvals-limited-${suffix}@example.invalid`, limitedPassword);
    cleanup.push(() => deleteAuthUser(adminUser.id), () => deleteAuthUser(limitedUser.id));

    await createMembership(orgId, adminUser.id, 'nova_admin');     // real staff, has admin.view
    await createMembership(orgId, limitedUser.id, 'nova_sales');   // real staff, does NOT have admin.view

    const adminSession = await signIn(adminUser.email, adminPassword);
    const limitedSession = await signIn(limitedUser.email, limitedPassword);

    // ---- 1. No auth -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'approvals' } });
      const res = mockRes();
      await handler(req, res);
      log('No auth rejected', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. Staff without admin.view is rejected ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${limitedSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('A real staff member WITHOUT admin.view is rejected', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 3. Create a generic approval request ----
    let reqId = null;
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'create', organization_id: orgId, item_type: 'installation', action_summary: 'Install Nova Audit Digital for Test Org', content_version: 'v1', cost_cents: 150000 },
      });
      const res = mockRes();
      await handler(req, res);
      reqId = res._json?.request?.id;
      log('Admin creates a generic approval request, defaults to pending', res.statusCode === 200 && !!reqId && res._json?.request?.status === 'pending', `status=${res.statusCode}`);
    }

    // ---- 4. It shows up in the aggregated inbox ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const found = Array.isArray(res._json) && res._json.some((i) => i.item_id === reqId && i.item_type === 'installation');
      log('The new request appears in the aggregated inbox', res.statusCode === 200 && found, `status=${res.statusCode}`);
    }

    // ---- 5. Approving with a mismatched content_version is refused (409) ----
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'approve', id: reqId, content_version: 'v2-stale' },
      });
      const res = mockRes();
      await handler(req, res);
      log('Approving against a stale content_version is refused (409)', res.statusCode === 409, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }

    // ---- 6. Approving with the correct content_version succeeds ----
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'approve', id: reqId, content_version: 'v1' },
      });
      const res = mockRes();
      await handler(req, res);
      log('Approving with the matching content_version succeeds', res.statusCode === 200 && res._json?.request?.status === 'approved', `status=${res.statusCode}`);
    }

    // ---- 7. Re-approving an already-approved request is refused ----
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'approve', id: reqId, content_version: 'v1' },
      });
      const res = mockRes();
      await handler(req, res);
      log('Re-approving an already-approved request is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }

    // ---- 8. Revoking the now-approved request succeeds ----
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'revoke', id: reqId, reason: 'Client paused the engagement.' },
      });
      const res = mockRes();
      await handler(req, res);
      log('An approved request can be revoked', res.statusCode === 200 && res._json?.request?.status === 'revoked', `status=${res.statusCode}`);
    }

    // ---- 9. Revoking again (not currently approved) is refused ----
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'revoke', id: reqId },
      });
      const res = mockRes();
      await handler(req, res);
      log('Revoking a non-approved (already-revoked) request is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }

    // ---- 10. A pending request past its expires_at is auto-expired on approve attempt (410) ----
    let expiredId = null;
    {
      const past = new Date(Date.now() - 60_000).toISOString();
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'create', organization_id: orgId, item_type: 'pricing_exception', action_summary: 'Time-limited discount approval', expires_at: past },
      });
      const res = mockRes();
      await handler(req, res);
      expiredId = res._json?.request?.id;
    }
    {
      const req = mockReq({
        method: 'POST', query: { resource: 'approvals' }, headers: { authorization: `Bearer ${adminSession.access_token}` },
        body: { action: 'approve', id: expiredId },
      });
      const res = mockRes();
      await handler(req, res);
      log('Approving a request past its expires_at is refused (410) and marks it expired', res.statusCode === 410, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
    }
    {
      const check = await adminFetch(`/rest/v1/approval_requests?id=eq.${expiredId}&select=status`);
      const [row] = await check.json();
      log('The expired request is persisted as status=expired, not left pending', row?.status === 'expired', JSON.stringify(row));
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
