// Nova hiring workflow E2E test (2026-09-23) — verifies the Careers -> application ->
// administrator review -> secure account invitation -> Academy enrollment -> practical approval
// -> working agreement -> administrator-controlled representative activation pipeline, with a
// focus on the highest-risk new surface: applicant-facing data must be scoped strictly by real
// ownership (auth_user_id), never by a client-supplied id. Mirrors this repo's established
// e2e_api_client_auth_test.mjs / e2e_academy_auth_test.mjs pattern: real throwaway org + users +
// application row, direct handler() calls, cleaned up in a finally block. Uses only
// @example.invalid addresses (RFC 2606 — guaranteed non-deliverable) so the real Supabase invite
// email this test triggers can never reach a real inbox.
//
// PREREQUISITE: supabase/hiring-workflow-migration-standalone.sql (applications.auth_user_id/
// invited_at/portfolio_file_path, contracts.application_id, the nova_sales_candidate role grant)
// must already be applied. Fails fast with a clear message if it isn't, rather than no-op'ing.
// Usage: node scripts/e2e_hiring_workflow_test.mjs

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
  return pass;
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
async function setPassword(id, password) {
  await adminFetch(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
}

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
  const probe = await adminFetch('/rest/v1/applications?select=auth_user_id&limit=1');
  if (!probe.ok) {
    console.error('applications.auth_user_id is not queryable — the hiring-workflow migration');
    console.error('(supabase/hiring-workflow-migration-standalone.sql) has not been applied yet.');
    console.error('Status:', probe.status, await probe.text());
    process.exit(1);
  }

  const { default: intakeHandler } = await import('../api/intake.js');
  const { default: contractsHandler } = await import('../api/contracts.js');
  const { default: academyHandler } = await import('../api/academy.js');

  const suffix = Date.now();
  const cleanup = [];

  try {
    const novaOrgRes = await adminFetch('/rest/v1/organizations?kind=eq.nova_internal&select=id&limit=1');
    const [novaOrg] = await novaOrgRes.json();
    if (!novaOrg?.id) throw new Error('No nova_internal organization found in this database');

    const orgId = await createOrg(`TEST — hiring workflow ${suffix}`, `test-hiring-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const adminPassword = `Ax${Math.random().toString(36).slice(2)}!9`;
    const otherPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const adminUser = await createAuthUser(`test-hiring-admin-${suffix}@example.invalid`, adminPassword);
    const otherUser = await createAuthUser(`test-hiring-other-${suffix}@example.invalid`, otherPassword); // an unrelated staff member, to prove ownership scoping
    cleanup.push(() => deleteAuthUser(adminUser.id), () => deleteAuthUser(otherUser.id));

    await createMembership(orgId, adminUser.id, 'nova_admin');
    await createMembership(orgId, otherUser.id, 'nova_sales');

    const adminSession = await signIn(adminUser.email, adminPassword);
    const otherSession = await signIn(otherUser.email, otherPassword);

    // Create a real throwaway application row directly (simulating a real /careers submission).
    const candidateEmail = `test-hiring-candidate-${suffix}@example.invalid`;
    const appRes = await adminFetch('/rest/v1/applications', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: 'E2E Test Candidate', email: candidateEmail, phone: '2035550100', position: 'Sales Representative', status: 'new' }),
    });
    const [application] = await appRes.json();
    if (!application?.id) throw new Error('Failed to create test application: ' + JSON.stringify(application));
    cleanup.push(() => adminFetch(`/rest/v1/applications?id=eq.${application.id}`, { method: 'DELETE' }));

    // ---- 1. check-applicant is retired ----
    {
      const req = mockReq({ method: 'POST', query: { action: 'check-applicant' }, body: { email: candidateEmail, password_hash: 'x' } });
      const res = mockRes();
      await intakeHandler(req, res);
      log('check-applicant retired (410)', res.statusCode === 410, `status=${res.statusCode}`);
    }

    // ---- 2. invite-applicant requires admin.view ----
    {
      const req = mockReq({ method: 'POST', query: { action: 'invite-applicant' }, headers: { authorization: `Bearer ${otherSession.access_token}` }, body: { id: application.id } });
      const res = mockRes();
      await intakeHandler(req, res);
      log('invite-applicant rejected for non-admin (nova_sales)', res.statusCode === 403, `status=${res.statusCode}`);
    }

    // ---- 3. Admin invites the candidate — real invite email sent to a guaranteed-non-
    //         deliverable @example.invalid address (RFC 2606) ----
    let candidateAuthId = null;
    {
      const req = mockReq({ method: 'POST', query: { action: 'invite-applicant' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { id: application.id } });
      const res = mockRes();
      await intakeHandler(req, res);
      log('Admin can invite an applicant', res.statusCode === 200 && !!res._json?.auth_user_id, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
      candidateAuthId = res._json?.auth_user_id;
    }
    if (candidateAuthId) cleanup.push(() => deleteAuthUser(candidateAuthId));

    if (candidateAuthId) {
      const memberRes = await adminFetch(`/rest/v1/organization_members?staff_user_id=eq.${candidateAuthId}&select=role,status`);
      const members = await memberRes.json();
      log('Invitation creates a nova_sales_candidate membership', members.some((m) => m.role === 'nova_sales_candidate' && m.status === 'active'), JSON.stringify(members));

      // Set a known password directly (bypassing the real email link, same technique used to
      // test any invite-based flow) so we can sign in as the candidate for the ownership checks.
      const candidatePassword = `Cx${Math.random().toString(36).slice(2)}!9`;
      await setPassword(candidateAuthId, candidatePassword);
      const candidateSession = await signIn(candidateEmail, candidatePassword);

      // ---- 4. Candidate can reach Academy (academy.view via nova_sales_candidate) ----
      {
        const req = mockReq({ method: 'GET', query: { action: 'programs' }, headers: { authorization: `Bearer ${candidateSession.access_token}` } });
        const res = mockRes();
        await academyHandler(req, res);
        log('Invited candidate (nova_sales_candidate) can reach Academy', res.statusCode === 200, `status=${res.statusCode}`);
      }

      // ---- 5. Candidate sees ONLY their own application via my-application ----
      {
        const req = mockReq({ method: 'GET', query: { action: 'my-application' }, headers: { authorization: `Bearer ${candidateSession.access_token}` } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('Candidate sees their own application via my-application', res.statusCode === 200 && res._json?.id === application.id, JSON.stringify(res._json));
      }

      // ---- 6. A DIFFERENT staff member (otherUser, unrelated) gets nothing from my-application
      //         — proves this is a real ownership check, not just "any staff sees the newest row" ----
      {
        const req = mockReq({ method: 'GET', query: { action: 'my-application' }, headers: { authorization: `Bearer ${otherSession.access_token}` } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('An unrelated staff member gets no application via my-application', res.statusCode === 200 && res._json === null, JSON.stringify(res._json));
      }

      // ---- 7. Candidate cannot reach admin-only actions ----
      {
        const req = mockReq({ method: 'GET', query: { action: 'applications' }, headers: { authorization: `Bearer ${candidateSession.access_token}` } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('Candidate rejected from the full applications list (admin.view)', res.statusCode === 403, `status=${res.statusCode}`);
      }

      // ---- 8. Admin creates a working agreement linked to this application ----
      let contractId = null;
      {
        const req = mockReq({ method: 'POST', query: { action: 'create' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { client_name: application.name, client_email: candidateEmail, contract_type: 'Sales Representative Agreement', application_id: application.id } });
        const res = mockRes();
        await contractsHandler(req, res);
        log('Admin can create a working agreement linked to the application', res.statusCode === 200 && res._json?.contract?.application_id === application.id, JSON.stringify(res._json));
        contractId = res._json?.contract?.id;
      }
      if (contractId) cleanup.push(() => adminFetch(`/rest/v1/contracts?id=eq.${contractId}`, { method: 'DELETE' }));

      // ---- 9. my-application surfaces the linked agreement ----
      {
        const req = mockReq({ method: 'GET', query: { action: 'my-application' }, headers: { authorization: `Bearer ${candidateSession.access_token}` } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('my-application surfaces the linked working agreement', res._json?.agreement?.id === contractId, JSON.stringify(res._json?.agreement));
      }

      // ---- 10. Activation requires admin.view ----
      {
        const req = mockReq({ method: 'POST', query: { action: 'activate-representative' }, headers: { authorization: `Bearer ${candidateSession.access_token}` }, body: { id: application.id } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('Candidate cannot self-activate', res.statusCode === 403, `status=${res.statusCode}`);
      }

      // ---- 11. Admin activates the representative ----
      {
        const req = mockReq({ method: 'POST', query: { action: 'activate-representative' }, headers: { authorization: `Bearer ${adminSession.access_token}` }, body: { id: application.id } });
        const res = mockRes();
        await intakeHandler(req, res);
        log('Admin can activate a representative', res.statusCode === 200, `status=${res.statusCode} body=${JSON.stringify(res._json)}`);
      }

      // ---- 12. Role really flipped to nova_sales in the database ----
      {
        const memberRes2 = await adminFetch(`/rest/v1/organization_members?staff_user_id=eq.${candidateAuthId}&select=role`);
        const members2 = await memberRes2.json();
        log('Activation flips the real DB role to nova_sales', members2.some((m) => m.role === 'nova_sales'), JSON.stringify(members2));
      }

      // ---- 13. Application status flipped to hired ----
      {
        const finalAppRes = await adminFetch(`/rest/v1/applications?id=eq.${application.id}&select=status`);
        const [finalApp] = await finalAppRes.json();
        log('Activation marks the application status hired', finalApp?.status === 'hired', JSON.stringify(finalApp));
      }
    } else {
      for (let i = 0; i < 9; i++) log('(skipped — invite-applicant did not return an auth_user_id)', false);
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
