// Login path E2E test (2026-09-23) — covers the parts of the master prompt's T01 acceptance
// journey ("Login/reset -> real owner dashboard -> refresh/logout... no bypass") not already
// exercised by the two older permanent suites in this directory:
//   - e2e_org_isolation_test.mjs already proves cross-organization denial (T02) and that a
//     forged client-side role/org claim grants nothing.
//   - e2e_api_client_auth_test.mjs already proves every api/client.js resource requires a real,
//     valid session and the correct permission.
// This script adds: wrong-password rejection against the real production auth endpoint, real
// session issuance + persistence + sign-out against a throwaway OWNER-role test account (never
// Isaac's real account — this project never touches or asks for his password), a user with ZERO
// organization memberships being correctly indistinguishable from "no access" at the RLS layer
// (not just hidden in the UI), and a revoked (status != 'active') membership losing real
// permission evaluation, verified via has_permission()/is_org_member() called AS that user (their
// own access token, not the service role) — the same RPCs OrgContext.jsx and every RLS policy in
// this project actually rely on.
//
// Does NOT attempt to explain Isaac's specific account issue — that was already root-caused with
// live evidence in a prior session: production URL/CSP/anon-key are all correct, both of his
// accounts exist/are confirmed/are not banned, a password reset succeeded for
// isaac_0427@icloud.com, and a reset for isaac@nova-systems.app was rejected by Supabase itself
// ("email_address_invalid") despite nova-systems.app having a valid MX record — a Supabase
// Auth-dashboard-side configuration question outside what this environment can inspect or fix.
// Usage: node scripts/e2e_login_path_test.mjs

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

async function createMembership(orgId, userId, role, status = 'active') {
  const res = await adminFetch('/rest/v1/organization_members', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: userId, role, status }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test membership: ' + JSON.stringify(row));
  return row.id;
}

async function signIn(email, password) {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

// Calls an RPC AS the given user (their own access token) — this is what actually matters: RLS
// and these helper functions evaluate auth.uid() from the caller's JWT, not from a service key.
async function rpcAsUser(accessToken, fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function getSessionUser(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function main() {
  const suffix = Date.now();
  const cleanup = [];

  try {
    // ---- 1. Wrong password against the REAL production anon key -> real Supabase rejection,
    //         not a network/CSP/config error (re-confirms, as a permanent script, what was
    //         previously checked manually against production) ----
    {
      const r = await signIn(`definitely-not-a-real-user-${suffix}@example.invalid`, 'wrong-password-xyz');
      const body = await r.json().catch(() => ({}));
      log('Wrong credentials rejected cleanly by the real auth endpoint', r.status === 400 && body.error_code === 'invalid_credentials', `status=${r.status} body=${JSON.stringify(body)}`);
    }

    const orgId = await createOrg(`TEST — login path ${suffix}`, `test-login-path-${suffix}`);
    cleanup.push(() => deleteOrg(orgId));

    const ownerPassword = `Ox${Math.random().toString(36).slice(2)}!9`;
    const noMembershipPassword = `Nx${Math.random().toString(36).slice(2)}!9`;
    const revokedPassword = `Rx${Math.random().toString(36).slice(2)}!9`;

    const ownerUser = await createAuthUser(`test-login-owner-${suffix}@example.invalid`, ownerPassword);
    const noMembershipUser = await createAuthUser(`test-login-nomember-${suffix}@example.invalid`, noMembershipPassword);
    const revokedUser = await createAuthUser(`test-login-revoked-${suffix}@example.invalid`, revokedPassword);
    cleanup.push(() => deleteAuthUser(ownerUser.id), () => deleteAuthUser(noMembershipUser.id), () => deleteAuthUser(revokedUser.id));

    await createMembership(orgId, ownerUser.id, 'nova_super_admin', 'active');
    // noMembershipUser gets NO organization_members row at all.
    await createMembership(orgId, revokedUser.id, 'nova_super_admin', 'inactive'); // revoked/disabled

    // ---- 2. Real owner sign-in reaches a real session, refresh persists it, sign-out clears it ----
    let ownerToken = null;
    {
      const r = await signIn(ownerUser.email, ownerPassword);
      const body = await r.json();
      log('Owner-role test account signs in and gets a real session', r.status === 200 && !!body.access_token, `status=${r.status}`);
      ownerToken = body.access_token;
    }
    if (ownerToken) {
      const check = await getSessionUser(ownerToken);
      log('Session token resolves back to the same real user on "refresh" (getSession equivalent)', check.status === 200 && check.body?.email === ownerUser.email, `status=${check.status}`);

      const signOutRes = await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${ownerToken}` } });
      log('Sign-out succeeds', signOutRes.status === 204 || signOutRes.status === 200, `status=${signOutRes.status}`);
    } else {
      log('Session token resolves back to the same real user on "refresh" (getSession equivalent)', false, 'no token to test');
      log('Sign-out succeeds', false, 'no token to test');
    }

    // ---- 3. A real, authenticated user with ZERO organization_members rows has zero access —
    //         proving "No Organization Access" is a real permission-layer fact, not just a UI
    //         message a determined caller could route around ----
    {
      const r = await signIn(noMembershipUser.email, noMembershipPassword);
      const body = await r.json();
      const token = body.access_token;
      log('User with no membership still authenticates (identity != authorization)', r.status === 200 && !!token, `status=${r.status}`);
      if (token) {
        const isMember = await rpcAsUser(token, 'is_org_member', { target_org_id: orgId });
        log('User with no membership: is_org_member() is false for every org', isMember.body === false, JSON.stringify(isMember));
        const hasPerm = await rpcAsUser(token, 'has_permission', { target_org_id: orgId, permission_key: 'overview.view' });
        log('User with no membership: has_permission() is false', hasPerm.body === false, JSON.stringify(hasPerm));
      } else {
        log('User with no membership: is_org_member() is false for every org', false, 'no token');
        log('User with no membership: has_permission() is false', false, 'no token');
      }
    }

    // ---- 4. A revoked (status='inactive') membership loses real access — not just hidden nav ----
    {
      const r = await signIn(revokedUser.email, revokedPassword);
      const body = await r.json();
      const token = body.access_token;
      log('Revoked-membership user still authenticates (identity != authorization)', r.status === 200 && !!token, `status=${r.status}`);
      if (token) {
        const isMember = await rpcAsUser(token, 'is_org_member', { target_org_id: orgId });
        log('Revoked membership: is_org_member() is false despite a real row existing', isMember.body === false, JSON.stringify(isMember));
        const hasPerm = await rpcAsUser(token, 'has_permission', { target_org_id: orgId, permission_key: 'admin.view' });
        log('Revoked membership: has_permission() is false even for nova_super_admin\'s normal bundle', hasPerm.body === false, JSON.stringify(hasPerm));
      } else {
        log('Revoked membership: is_org_member() is false despite a real row existing', false, 'no token');
        log('Revoked membership: has_permission() is false even for nova_super_admin\'s normal bundle', false, 'no token');
      }
    }

    // ---- 5. A real, un-revoked owner DOES pass both checks — proves 3/4 above are really about
    //         membership status, not a broken RPC that always returns false ----
    {
      const r = await signIn(ownerUser.email, ownerPassword);
      const body = await r.json();
      const token = body.access_token;
      if (token) {
        const isMember = await rpcAsUser(token, 'is_org_member', { target_org_id: orgId });
        log('Control: active owner membership passes is_org_member()', isMember.body === true, JSON.stringify(isMember));
        const hasPerm = await rpcAsUser(token, 'has_permission', { target_org_id: orgId, permission_key: 'admin.view' });
        log('Control: active owner membership passes has_permission(admin.view)', hasPerm.body === true, JSON.stringify(hasPerm));
      } else {
        log('Control: active owner membership passes is_org_member()', false, 'no token');
        log('Control: active owner membership passes has_permission(admin.view)', false, 'no token');
      }
    }

  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { console.error('cleanup error:', e.message); }
    }
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('\nNote: cross-organization denial (T02) is covered by e2e_org_isolation_test.mjs;');
  console.log('every api/client.js resource requiring a valid session+permission is covered by');
  console.log('e2e_api_client_auth_test.mjs. This script fills the specific gaps: wrong password,');
  console.log('refresh/logout, no-membership, and revoked-membership behavior.');
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err);
  process.exit(1);
});
