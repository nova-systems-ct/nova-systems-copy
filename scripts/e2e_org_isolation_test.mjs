// Stage 4 tenant-isolation E2E test — creates two throwaway organizations and two throwaway
// Supabase Auth users (member_type='staff', role='client_owner' — the corrected identity model:
// every real user is 'staff', the business relationship is determined by role + which
// organization(s) they have an active membership row for, not by a separate member_type), signs
// in as each with a REAL password (not the service-role key), and queries
// organizations/organization_members directly to prove RLS actually enforces isolation — not
// just that the UI hides things. Everything created is deleted at the end, success or failure.
// Matches this project's existing e2e_*.mjs pattern (see
// nova-wave-one/scripts/e2e_client_portal_test.mjs, e2e_audit_request_test.mjs).
//
// PREREQUISITE: the Stage 4 migration in supabase/schema-update.sql (the "STAGE 4 — MULTI-COMPANY
// ARCHITECTURE + RBAC" section) must already be applied via the Supabase SQL Editor. This script
// will fail fast with a clear message if it isn't.
//
// Usage: node scripts/e2e_org_isolation_test.mjs

import fs from 'node:fs';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
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

async function main() {
  // Fail fast if the migration hasn't been run yet.
  const check = await admin('/rest/v1/permissions?select=key&limit=1');
  if (check.status === 404) {
    console.error('The Stage 4 migration has not been applied yet (permissions table not found).');
    console.error('Run the "STAGE 4 — MULTI-COMPANY ARCHITECTURE + RBAC" section of');
    console.error('supabase/schema-update.sql in the Supabase SQL Editor first, then re-run this script.');
    process.exit(1);
  }

  const suffix = Date.now();
  const cleanup = [];

  try {
    // Create two throwaway orgs, clearly labeled.
    const orgAId = await createOrg(`TEST — Stage 4 Isolation A ${suffix}`, `test-stage4-a-${suffix}`);
    const orgBId = await createOrg(`TEST — Stage 4 Isolation B ${suffix}`, `test-stage4-b-${suffix}`);
    cleanup.push(() => deleteOrg(orgAId), () => deleteOrg(orgBId));

    // Create two throwaway Supabase Auth users with real random passwords.
    const passwordA = `Ax${Math.random().toString(36).slice(2)}!9`;
    const passwordB = `Bx${Math.random().toString(36).slice(2)}!9`;
    const userA = await createAuthUser(`test-stage4-a-${suffix}@example.invalid`, passwordA);
    const userB = await createAuthUser(`test-stage4-b-${suffix}@example.invalid`, passwordB);
    cleanup.push(() => deleteAuthUser(userA.id), () => deleteAuthUser(userB.id));

    // Membership: every real user is member_type='staff' — the corrected identity model.
    // User A -> client_owner on Org A only. User B -> client_owner on Org B only. Their business
    // relationship (which org, what role) comes entirely from this row, not from member_type.
    await createMembership(orgAId, userA.id, 'client_owner');
    await createMembership(orgBId, userB.id, 'client_owner');

    // Sign in as each user with their real password via the anon key (not service role) — this
    // is the actual code path the app uses, and RLS applies exactly as it would in production.
    const sessionA = await signIn(userA.email, passwordA);
    const sessionB = await signIn(userB.email, passwordB);

    // TEST: User A can read Org A.
    const aReadsA = await readOrgsAs(sessionA.access_token);
    log('Test Client A can read Org A', aReadsA.some((o) => o.id === orgAId), `orgs visible: ${aReadsA.length}`);

    // TEST: User A cannot read Org B (real cross-tenant check, not URL/UI hiding).
    log('Test Client A cannot read Org B', !aReadsA.some((o) => o.id === orgBId), `orgs visible: ${JSON.stringify(aReadsA.map(o=>o.name))}`);

    // TEST: User B can read Org B, not Org A (mirror check).
    const bReadsB = await readOrgsAs(sessionB.access_token);
    log('Test Client B can read Org B', bReadsB.some((o) => o.id === orgBId));
    log('Test Client B cannot read Org A', !bReadsB.some((o) => o.id === orgAId), `orgs visible: ${JSON.stringify(bReadsB.map(o=>o.name))}`);

    // TEST: changing selected organization client-side grants nothing — User A explicitly
    // requests Org B by id in the query string (simulates the frontend's "current org" selector
    // being forged/tampered with). RLS must still return zero rows regardless of what the client
    // asks for.
    const forged = await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${orgBId}&select=id,name`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionA.access_token}` },
    }).then((r) => r.json());
    log('Changing selected organization client-side (forged org id filter) grants nothing', Array.isArray(forged) && forged.length === 0, JSON.stringify(forged));

    // TEST: User A's own membership row is visible; User B's membership row on Org B is not.
    const aMembers = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?select=id,organization_id`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionA.access_token}` },
    }).then((r) => r.json());
    log('Test Client A sees only their own membership row(s)', Array.isArray(aMembers) && aMembers.every((m) => m.organization_id === orgAId), JSON.stringify(aMembers));

    // TEST: changing frontend role state grants nothing — User A (role=client_owner) asks
    // has_permission() about 'members.manage', a permission NOT present in client_owner's live
    // role_permissions bundle (verified separately: client_owner has 11 of 16 permission keys,
    // none of the *.manage ones). The RPC looks up the REAL role from organization_members
    // server-side; there is no client-supplied role parameter to forge in the first place.
    const fakeElevated = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_permission`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionA.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_org_id: orgAId, permission_key: 'members.manage' }),
    }).then((r) => r.json());
    log('Changing frontend role state grants nothing (has_permission ignores client claims, checks real DB role)', fakeElevated === false, `has_permission(members.manage) as client_owner = ${JSON.stringify(fakeElevated)}`);

    // TEST: attempting to directly UPDATE own role to an elevated one is rejected (no UPDATE
    // policy exists for 'authenticated' on organization_members — only SELECT — so RLS default-
    // denies the write entirely).
    const escalateAttempt = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${orgAId}&staff_user_id=eq.${userA.id}`, {
      method: 'PATCH',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionA.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ role: 'nova_super_admin' }),
    });
    const escalateBody = await escalateAttempt.json().catch(() => null);
    const stillClientOwner = await admin(`/rest/v1/organization_members?organization_id=eq.${orgAId}&staff_user_id=eq.${userA.id}&select=role`).then((r) => r.json());
    log('Direct role-escalation write attempt does not change the real DB row', stillClientOwner[0]?.role === 'client_owner', `write status=${escalateAttempt.status} body=${JSON.stringify(escalateBody)} actual role now=${stillClientOwner[0]?.role}`);

  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { console.error('cleanup error:', e.message); }
    }
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

async function createOrg(name, slug) {
  const res = await admin('/rest/v1/organizations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, slug, kind: 'client', status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test org: ' + JSON.stringify(row));
  return row.id;
}

async function deleteOrg(id) {
  await admin(`/rest/v1/organizations?id=eq.${id}`, { method: 'DELETE' });
}

async function createAuthUser(email, password) {
  const res = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const row = await res.json();
  if (!row?.id) throw new Error('Failed to create test auth user: ' + JSON.stringify(row));
  return row;
}

async function deleteAuthUser(id) {
  await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
}

async function createMembership(orgId, userId, role) {
  const res = await admin('/rest/v1/organization_members', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, member_type: 'staff', staff_user_id: userId, role, status: 'active' }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('Failed to create test membership: ' + JSON.stringify(row));
  return row.id;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data?.access_token) throw new Error('Sign-in failed: ' + JSON.stringify(data));
  return data;
}

async function readOrgsAs(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/organizations?select=id,name`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err);
  process.exit(1);
});
