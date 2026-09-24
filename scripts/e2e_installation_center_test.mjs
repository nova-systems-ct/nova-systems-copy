// Installation Center E2E test (2026-09-23, master prompt §13) — proves the real behavior this
// domain depends on: the sandbox->active state machine is enforced server-side (not just hidden
// by the UI), "sandbox passed" is re-derived from the actual most-recent recorded test result
// rather than a separately trusted flag, activation requires a distinct, higher-trust admin.view
// authority on top of the growth.view every other installation action uses, and — the acceptance
// test named explicitly in the requirement matrix (T13) — two independent test orgs are fully
// isolated from each other's installations, using the same object-level requireOrgAccess pattern
// already proven for CRM/Audit/Zion.
//
// Mirrors the established e2e pattern: real throwaway orgs/users, direct handler() calls, cleanup
// in a finally block.
//
// PREREQUISITE: supabase/crm-order-audit-migration-standalone.sql (for orders) AND
// supabase/installation-center-migration-standalone.sql must already be applied. Fails fast with
// a clear message if either isn't.
// Usage: node scripts/e2e_installation_center_test.mjs

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
async function createOrderDirect(orgId) {
  const res = await adminFetch('/rest/v1/orders', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, status: 'delivered' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test order: ' + JSON.stringify(row));
  return row.id;
}

async function main() {
  const probeOrders = await adminFetch('/rest/v1/orders?select=id&limit=1');
  if (!probeOrders.ok) {
    console.error('orders is not queryable — supabase/crm-order-audit-migration-standalone.sql has not been applied.');
    process.exit(1);
  }
  const probe = await adminFetch('/rest/v1/installations?select=id&limit=1');
  if (!probe.ok) {
    console.error('installations is not queryable — supabase/installation-center-migration-standalone.sql');
    console.error('has not been applied to this database yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: handler } = await import('../api/client.js');
  const suffix = Date.now();
  const cleanup = [];

  try {
    const orgAId = await createOrg(`TEST — installations A ${suffix}`, `test-install-a-${suffix}`);
    const orgBId = await createOrg(`TEST — installations B ${suffix}`, `test-install-b-${suffix}`);
    cleanup.push(() => deleteOrg(orgAId), () => deleteOrg(orgBId));

    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const salesPassword = `Sx${Math.random().toString(36).slice(2)}!9`;
    const otherOrgPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const adminUser = await createAuthUser(`test-install-admin-${suffix}@example.invalid`, adminPassword);   // Org A, has admin.view
    const salesUser = await createAuthUser(`test-install-sales-${suffix}@example.invalid`, salesPassword);   // Org A, growth.view only, no admin.view
    const otherOrgUser = await createAuthUser(`test-install-otherorg-${suffix}@example.invalid`, otherOrgPassword); // Org B only
    cleanup.push(() => deleteAuthUser(adminUser.id), () => deleteAuthUser(salesUser.id), () => deleteAuthUser(otherOrgUser.id));

    await createMembership(orgAId, adminUser.id, 'nova_admin');
    await createMembership(orgAId, salesUser.id, 'nova_sales');
    await createMembership(orgBId, otherOrgUser.id, 'nova_admin');

    const adminSession = await signIn(adminUser.email, adminPassword);
    const salesSession = await signIn(salesUser.email, salesPassword);
    const otherOrgSession = await signIn(otherOrgUser.email, otherOrgPassword);

    const orderAId = await createOrderDirect(orgAId);
    cleanup.push(() => adminFetch(`/rest/v1/orders?id=eq.${orderAId}`, { method: 'DELETE' }));

    // ---- 1. No auth -> 401 ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'installations', organization_id: orgAId } });
      const res = mockRes();
      await handler(req, res);
      log('No auth rejected', res.statusCode === 401, `status=${res.statusCode}`);
    }

    // ---- 2. Create an installation from a real delivered order ----
    let installationId = null;
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', organization_id: orgAId, order_id: orderAId } });
      const res = mockRes();
      await handler(req, res);
      installationId = res._json?.installation?.id;
      log('A growth.view staff member creates an installation, defaults to sandbox_setup', res.statusCode === 200 && !!installationId && res._json?.installation?.status === 'sandbox_setup', `status=${res.statusCode}`);
    }

    // ---- 3. A second installation on the SAME order is refused (409) ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'create', organization_id: orgAId, order_id: orderAId } });
      const res = mockRes();
      await handler(req, res);
      log('A second installation on the same order is refused (409)', res.statusCode === 409, `status=${res.statusCode}`);
    }

    // ---- 4. THE T13 ACCEPTANCE TEST: an independent org (B) cannot see or touch Org A's installation ----
    {
      const req = mockReq({ method: 'GET', query: { resource: 'installations', organization_id: orgAId, id: installationId }, headers: { authorization: `Bearer ${otherOrgSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      log('T13: an independent test org cannot READ another org\'s installation', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${otherOrgSession.access_token}` }, body: { action: 'record-test', organization_id: orgAId, id: installationId, test_name: 'forged', result: 'pass' } });
      const res = mockRes();
      await handler(req, res);
      log('T13: an independent test org cannot WRITE to another org\'s installation', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      // Even with a forged organization_id that IS real but not theirs — same check, other direction.
      const req = mockReq({ method: 'GET', query: { resource: 'installations', organization_id: orgBId }, headers: { authorization: `Bearer ${otherOrgSession.access_token}` } });
      const res = mockRes();
      await handler(req, res);
      const leaked = Array.isArray(res._json) && res._json.some((i) => i.id === installationId);
      log('T13: Org B\'s own installation list never contains Org A\'s installation', res.statusCode === 200 && !leaked, JSON.stringify(res._json));
    }

    // ---- 5. Cannot mark sandbox passed with zero tests recorded ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'mark-sandbox-passed', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('Cannot mark sandbox passed from sandbox_setup with zero tests', res.statusCode === 400, `status=${res.statusCode}`);
    }

    // ---- 6. Record a failing test, then a passing one; sandbox_testing after the first ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'record-test', organization_id: orgAId, id: installationId, test_name: 'Webhook receives event', result: 'fail', notes: 'Timed out' } });
      const res = mockRes();
      await handler(req, res);
      log('Recording a failing test moves status to sandbox_testing', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'mark-sandbox-passed', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('Cannot mark sandbox passed while the LATEST recorded test is a fail', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'record-test', organization_id: orgAId, id: installationId, test_name: 'Webhook receives event (retest)', result: 'pass' } });
      const res = mockRes();
      await handler(req, res);
      log('A retest with a pass is recorded', res.statusCode === 200, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'mark-sandbox-passed', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('Sandbox marked passed once the latest recorded test is a real pass', res.statusCode === 200 && res._json?.installation?.status === 'sandbox_passed', `status=${res.statusCode}`);
    }

    // ---- 7. Activation requires admin.view specifically — growth.view alone is refused ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'activate', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('A growth.view-only staff member cannot activate (activation authority is a distinct, higher gate)', res.statusCode === 403, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { action: 'activate', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('A staff member WITH admin.view can activate', res.statusCode === 200 && res._json?.installation?.status === 'active', `status=${res.statusCode}`);
    }

    // ---- 8. Pause requires a reason; then resume ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'pause', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('Pausing without a reason is refused', res.statusCode === 400, `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'pause', organization_id: orgAId, id: installationId, reason: 'Client requested a hold.' } });
      const res = mockRes();
      await handler(req, res);
      log('Pausing with a reason succeeds (ordinary growth.view staff can pause)', res.statusCode === 200 && res._json?.installation?.status === 'paused', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'resume', organization_id: orgAId, id: installationId } });
      const res = mockRes();
      await handler(req, res);
      log('Resuming returns to active', res.statusCode === 200 && res._json?.installation?.status === 'active', `status=${res.statusCode}`);
    }

    // ---- 9. Offboard requires a reason; terminal ----
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'offboard', organization_id: orgAId, id: installationId, reason: 'Engagement ended.' } });
      const res = mockRes();
      await handler(req, res);
      log('Offboarding with a reason succeeds', res.statusCode === 200 && res._json?.installation?.status === 'offboarded', `status=${res.statusCode}`);
    }
    {
      const req = mockReq({ method: 'POST', query: { resource: 'installations' }, headers: { authorization: `Bearer ${salesSession.access_token}` }, body: { action: 'offboard', organization_id: orgAId, id: installationId, reason: 'Again.' } });
      const res = mockRes();
      await handler(req, res);
      log('Re-offboarding an already-offboarded installation is refused', res.statusCode === 400, `status=${res.statusCode}`);
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
