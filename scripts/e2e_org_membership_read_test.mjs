// Proves the 2026-09-29 Gap A-2 fix at the database layer, against a real, disposable local
// PostgreSQL + PostgREST: two throwaway orgs, two real authenticated users (one per org), signed
// in with a real JWT (role=authenticated, not service_role) — confirms each can read only their
// OWN organizations/organization_members rows through PostgREST directly, the same way the old
// staff_read_all_organizations/staff_read_all_members policy (never present in this repo, only in
// production, inherited from nova-wave-one's 2026-08-12 migration) would have let ANY staff-typed
// row read EVERY org. This repo's local harness never had that old policy, so this test proves
// the REPLACEMENT policy (own_org_read/own_membership_read) is itself correct, not that a
// regression was reverted — the production-side regression can only be re-tested by re-running
// this same read pattern against staging/production after the migration is applied there.
//
// Usage: node scripts/e2e_org_membership_read_test.mjs
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

async function main() {
  const env = await startTestEnv({ migrations: allMigrations() });
  try {
    const bad = env.migrationErrors.filter((e) => !/already exists|duplicate/i.test(e.message));
    log('Migrations applied without unexpected errors', bad.length === 0, JSON.stringify(bad.slice(0, 3)));

    const suffix = Date.now();
    const orgA = await env.sql(`insert into organizations (name, slug, kind, status) values ($1,$2,'client','active') returning id`, [`TEST A2 A ${suffix}`, `test-a2-a-${suffix}`]);
    const orgB = await env.sql(`insert into organizations (name, slug, kind, status) values ($1,$2,'client','active') returning id`, [`TEST A2 B ${suffix}`, `test-a2-b-${suffix}`]);
    const orgAId = orgA.rows[0].id, orgBId = orgB.rows[0].id;

    const userA = await env.createUser({ email: `test-a2-a-${suffix}@example.invalid`, role: 'client_owner', orgId: orgAId });
    const userB = await env.createUser({ email: `test-a2-b-${suffix}@example.invalid`, role: 'client_owner', orgId: orgBId });

    const aOrgs = await env.rest(userA.token, 'organizations?select=id,name');
    log('User A can read Org A', Array.isArray(aOrgs.data) && aOrgs.data.some((o) => o.id === orgAId), `status=${aOrgs.status} visible=${JSON.stringify(aOrgs.data)}`);
    log('User A cannot read Org B', Array.isArray(aOrgs.data) && !aOrgs.data.some((o) => o.id === orgBId), `visible=${JSON.stringify(aOrgs.data)}`);

    const bOrgs = await env.rest(userB.token, 'organizations?select=id,name');
    log('User B can read Org B', Array.isArray(bOrgs.data) && bOrgs.data.some((o) => o.id === orgBId), `status=${bOrgs.status}`);
    log('User B cannot read Org A', Array.isArray(bOrgs.data) && !bOrgs.data.some((o) => o.id === orgAId), `visible=${JSON.stringify(bOrgs.data)}`);

    // Forged filter: User A explicitly asks for Org B by id — RLS must still return zero rows.
    const forged = await env.rest(userA.token, `organizations?id=eq.${orgBId}&select=id,name`);
    log('Forged org-id filter grants User A nothing', Array.isArray(forged.data) && forged.data.length === 0, JSON.stringify(forged.data));

    // organization_members: each user sees only their own membership row(s).
    const aMembers = await env.rest(userA.token, 'organization_members?select=id,organization_id,staff_user_id');
    log('User A sees only their own membership row(s)', Array.isArray(aMembers.data) && aMembers.data.length > 0 && aMembers.data.every((m) => m.organization_id === orgAId), JSON.stringify(aMembers.data));

    const bMembers = await env.rest(userB.token, 'organization_members?select=id,organization_id,staff_user_id');
    log('User B cannot see User A\'s membership row', Array.isArray(bMembers.data) && !bMembers.data.some((m) => m.staff_user_id === userA.id), JSON.stringify(bMembers.data));

    // Anonymous role gets nothing at all.
    const anonOrgs = await env.rest(null, 'organizations?select=id,name');
    log('Anonymous role reads no organizations', anonOrgs.status >= 400 || (Array.isArray(anonOrgs.data) && anonOrgs.data.length === 0), `status=${anonOrgs.status} body=${JSON.stringify(anonOrgs.data).slice(0, 150)}`);

    // Service role (what every real api/*.js handler uses) still sees everything — proves the fix
    // does not break any legitimate server-side code path.
    const serviceOrgs = await env.rest(env.serviceKey, `organizations?select=id&id=in.(${orgAId},${orgBId})`);
    log('Service role can still read both orgs', Array.isArray(serviceOrgs.data) && serviceOrgs.data.length === 2, `status=${serviceOrgs.status}`);
  } finally {
    await env.stop();
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error('SCRIPT ERROR:', err); process.exit(1); });
