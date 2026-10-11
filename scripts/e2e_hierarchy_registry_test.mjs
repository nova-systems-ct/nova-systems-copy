// Nova organizational hierarchy registry (Phase B) — real handlers (api/_hierarchy/registry.js, resource 'hierarchy')
// against a REAL local PostgreSQL + PostgREST (local, disposable). Proves the migration applies cleanly, the seed data
// is honest (Isaac as Owner only if a real membership exists, Aura/Model Council reserved, CEO Twin/authority matrix
// unapproved), reserved positions truly cannot be assigned a worker, a suspended worker cannot hold a position, CEO
// Twin/authority-matrix policy is versioned and requires a real owner approval, and cross-org (client-role) access is
// refused. NOT Supabase, NOT production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations, SALES_PARTS, LOCKDOWN } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HIERARCHY_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-01-registry-migration-standalone.sql'), 'utf8');
// registry.js's CEO Twin/Authority Matrix self-approval reauth flow now depends on governance.js's
// owner_reauth_confirmations table (part 2) — applied here too, not because this suite tests
// governance itself (see e2e_hierarchy_governance_test.mjs for that), but because it's a real
// dependency of the code under test.
const GOVERNANCE_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-02-governance-migration-standalone.sql'), 'utf8');
const LOCKDOWN_SQL = fs.readFileSync(path.join(ROOT, LOCKDOWN), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
// Deliberately excludes HIERARCHY_PARTS here so it can be applied below AFTER Nova's org/owner already exist —
// the realistic deployment order (Phase A already shipped) — rather than against an empty database.
const env = await startTestEnv({ migrations: allMigrations(SALES_PARTS), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const gov = (op, o = {}) => call({ resource: 'governance', op, ...o });

try {
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const orgB = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Client','acme','client') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Owner' });
  const owner2 = await env.createUser({ email: 'owner2@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Second Owner-Level Account' });
  const staffB = await env.createUser({ email: 'staff@acme.test', role: 'client_owner', orgId: orgB, name: 'Acme Staff' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: orgA, name: 'Plain Rep' });
  // Apply the hierarchy migration now that Nova's org and Isaac's nova_super_admin membership already exist, to
  // genuinely exercise the "seed Isaac as Owner only if a real membership already exists" and "mark Nova Systems
  // active" branches (an empty-database first-run would leave both honestly unfilled — that path is not what a real
  // deployment looks like, since Phase A/org creation always precedes this Phase B migration).
  await env.sql(HIERARCHY_SQL);
  await env.sql(GOVERNANCE_SQL);
  // Re-run lockdown (SAFE TO RERUN — see its own header) so the newly-created hierarchy tables get the same
  // anon/authenticated REVOKEs as every other table, matching a real re-deploy of the updated lockdown file.
  await env.sql(LOCKDOWN_SQL);
  // PostgREST's schema-cache reload is asynchronous; poll until the new tables are actually visible rather than
  // trusting a single fixed sleep (env.reload() waits 500ms, which was not always enough for a post-hoc reload here).
  for (let i = 0; i < 20; i++) {
    await env.reload();
    const probe = await env.rest(env.serviceKey, 'portfolio_entities?limit=1');
    if (probe.status !== 404 && !(probe.data && probe.data.code === 'PGRST205')) break;
    await new Promise((res) => setTimeout(res, 300));
  }

  // ---------------------------------------------------------------- authorization boundary
  let r = await hier('portfolio', { method: 'GET' });
  check('no session -> 401', r.status === 401);
  r = await hier('portfolio', { token: staffB.token, method: 'GET' });
  check('a client-org member has no command.view permission -> 403', r.status === 403);
  r = await hier('portfolio', { token: rep.token, method: 'GET' });
  check('a plain Nova rep with no command.view permission -> 403', r.status === 403);
  r = await hier('portfolio', { token: owner.token, method: 'GET' });
  check('the owner (nova_super_admin) can read the portfolio', r.status === 200 && Array.isArray(r.body));

  // ---------------------------------------------------------------- migration/seed honesty
  const nova = r.body.find((e) => e.key === 'nova-systems');
  check('Nova Systems is seeded and marked active because a real nova_internal org exists', nova?.status === 'active' && nova.organization_id === orgA);
  const crystal = r.body.find((e) => e.key === 'crystal-clear');
  check('Crystal Clear is seeded as planned, no facts invented', crystal?.status === 'planned' && !crystal.organization_id);
  check('the seed created no more than the 4 documented entities', r.body.length === 4);

  r = await hier('positions', { token: owner.token, method: 'GET' });
  const aura = r.body.find((p) => p.key === 'aura-control-seat');
  const ceoTwin = r.body.find((p) => p.key === 'ceo-twin');
  const ownerPos = r.body.find((p) => p.key === 'owner');
  check('Aura Control Seat is seeded reserved with a real reason, not silently active', aura?.is_reserved === true && !!aura.reserved_reason);
  check("Aura's current assignment is honestly fill_type=reserved with no worker", aura?.executive_assignments?.[0]?.fill_type === 'reserved' && !aura.executive_assignments[0].worker_id);
  check('CEO Twin position exists but is explicitly VACANT (no worker invented)', ceoTwin?.executive_assignments?.[0]?.fill_type === 'vacant');
  check('the Owner position is filled by Isaac because a real nova_super_admin membership already existed', ownerPos?.executive_assignments?.[0]?.fill_type === 'isaac' && !!ownerPos.executive_assignments[0].worker_id);

  r = await hier('workers', { token: owner.token, method: 'GET' });
  const isaac = r.body.find((w) => w.display_name === 'Isaac Nova');
  check('Isaac is a real, active worker row seeded from his real membership (no invented account)', isaac?.status === 'active' && isaac.worker_type === 'human');

  // ---------------------------------------------------------------- reserved-position enforcement, end to end through the real handler
  const aiCandidate = await hier('create-worker', { token: owner.token, body: { worker_type: 'ai', display_name: 'Draft Assistant', model_provider: 'claude' } });
  check('an AI worker record can be created in draft status', aiCandidate.status === 200 && aiCandidate.body.worker.status === 'draft');
  r = await hier('assign-executive', { token: owner.token, body: { position_id: aura.id, worker_id: aiCandidate.body.worker.id, fill_type: 'ai', reason: 'attempted activation' } });
  check('the real handler refuses to assign a worker to the reserved Aura Control Seat', r.status === 422 && /reserved/i.test(r.body.error));
  check('the DATABASE still shows Aura reserved with no worker after the refused attempt', (await env.sql('select fill_type, worker_id from executive_assignments where position_id=$1 and unassigned_at is null', [aura.id])).rows[0].fill_type === 'reserved');
  r = await hier('assign-executive', { token: rep.token, body: { position_id: aura.id, worker_id: aiCandidate.body.worker.id, fill_type: 'ai' } });
  check('a non-owner cannot even reach the assignment endpoint (command.owner required)', r.status === 403);

  // ---------------------------------------------------------------- worker state machine + suspended-cannot-hold-position
  const firstRepWorker = await hier('create-worker', { token: owner.token, body: { worker_type: 'human', staff_user_id: rep.id, display_name: 'Plain Rep' } });
  check('a first worker record for this person is created', firstRepWorker.status === 200);
  r = await hier('create-worker', { token: owner.token, body: { worker_type: 'human', staff_user_id: rep.id, display_name: 'Plain Rep (duplicate)' } });
  check('a second worker record cannot reuse an already-active staff_user_id (one active worker record per person)', r.status === 409 || r.status === 500, `${r.status}`);

  const humanCandidate = await hier('create-worker', { token: owner.token, body: { worker_type: 'human', staff_user_id: staffB.id, display_name: 'Prospective Hire', org_unit_id: null } });
  const wId = humanCandidate.body.worker.id;
  r = await hier('assign-executive', { token: owner.token, body: { position_id: ceoTwin.id, worker_id: wId, fill_type: 'human' } });
  check('a still-draft worker cannot be assigned a position yet', r.status === 422);
  r = await hier('set-worker-status', { token: owner.token, body: { id: wId, status: 'active', reason: 'skip-ahead attempt' } });
  check('the worker state machine refuses draft -> active directly (must pass through onboarding/training)', r.status === 409);
  await hier('set-worker-status', { token: owner.token, body: { id: wId, status: 'onboarding', reason: 'starting onboarding for the test' } });
  await hier('set-worker-status', { token: owner.token, body: { id: wId, status: 'training', reason: 'in training' } });
  r = await hier('set-worker-status', { token: owner.token, body: { id: wId, status: 'active', reason: 'completed training' } });
  check('draft -> onboarding -> training -> active succeeds through the real handler with a real audit trail', r.status === 200 && r.body.worker.status === 'active');
  check('every real transition left a real worker_status_events row', (await env.sql('select count(*) from worker_status_events where worker_id=$1', [wId])).rows[0].count === '3');

  r = await hier('assign-executive', { token: owner.token, body: { position_id: ceoTwin.id, worker_id: wId, fill_type: 'human', reason: 'first CEO Twin operator' } });
  check('now-active worker CAN be assigned to the (non-reserved) CEO Twin position', r.status === 200);
  r = await hier('set-worker-status', { token: owner.token, body: { id: wId, status: 'suspended', reason: 'test suspension' } });
  check('the worker can be suspended', r.status === 200);
  r = await hier('assign-executive', { token: owner.token, body: { position_id: ceoTwin.id, worker_id: wId, fill_type: 'human', reason: 're-attempt while suspended' } });
  check('a suspended worker cannot be (re-)assigned to hold a position', r.status === 422);

  // ---------------------------------------------------------------- CEO Twin policy: versioned, no self/automated approval path
  r = await hier('ceo-twin', { token: owner.token, method: 'GET' });
  check('the seeded CEO Twin policy is honestly provisional (draft, not approved)', r.body.provisional === true && r.body.status === 'draft' && r.body.readiness.ready === false);
  r = await hier('save-ceo-twin-policy', { token: owner.token, body: { policy: { principles: ['Be honest about verification state'], prohibited_actions: ['Never contact a real prospect without explicit approval'] }, change_note: 'First real draft' } });
  check('a new CEO Twin policy version is saved as pending_approval, not silently live', r.status === 200 && r.body.config.status === 'pending_approval' && r.body.config.version === 2);
  const pendingId = r.body.config.id;
  r = await hier('ceo-twin', { token: owner.token, method: 'GET' });
  check('reading the policy before approval still reports it as provisional', r.body.provisional === true);
  r = await hier('approve-ceo-twin-policy', { token: rep.token, body: { config_id: pendingId, confirm: true } });
  check('a non-owner cannot approve the CEO Twin policy', r.status === 403);
  r = await hier('approve-ceo-twin-policy', { token: owner.token, body: { config_id: pendingId, confirm: false } });
  check('approval without an explicit confirm flag is refused (no silent/automatic approval)', r.status === 422);
  r = await hier('approve-ceo-twin-policy', { token: owner.token, body: { config_id: pendingId, confirm: true } });
  check('the sole owner approving their OWN draft is not flatly blocked — it requires reauth first (428), not a dead end', r.status === 428 && r.body.requires === 'confirm-reauth');
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'ceo_twin_policy', target_id: pendingId, password: 'wrong-password', reason: 'Approving my own first real draft.' } });
  check('confirm-reauth genuinely re-verifies the password — a wrong one is refused', r.status === 401);
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'ceo_twin_policy', target_id: pendingId, password: owner.password, reason: 'short' } });
  check('confirm-reauth requires a real written reason, not a token word', r.status === 422);
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'ceo_twin_policy', target_id: pendingId, password: owner.password, reason: 'Approving my own first real draft — I am the sole owner and there is no one else to ask.' } });
  check('with the real password and a real reason, reauth is confirmed', r.status === 200 && typeof r.body.expires_at === 'string');
  r = await hier('approve-ceo-twin-policy', { token: owner.token, body: { config_id: pendingId, confirm: true } });
  check('the sole owner can now approve their own draft — Isaac remains the final authority, no fake second account required', r.status === 200);
  r = await hier('ceo-twin', { token: owner.token, method: 'GET' });
  check('the policy now reads back as genuinely approved, with real content', r.body.provisional === false && r.body.status === 'approved' && r.body.policy.principles.length === 1);
  check('approving retired the prior draft row rather than leaving two "current" versions', (await env.sql("select count(*) from sales_config where key='ceo_twin_policy' and status='approved'")).rows[0].count === '1');

  // A genuinely different owner-level account never needs the reauth ritual at all.
  r = await hier('save-ceo-twin-policy', { token: owner2.token, body: { policy: { principles: ['Be honest about verification state'], decision_preferences: ['Prefer evidence over assumption'] }, change_note: 'Amendment by a second owner-level account' } });
  const v3Id = r.body.config.id;
  r = await gov('confirm-reauth', { token: owner.token, body: { target_type: 'ceo_twin_policy', target_id: v3Id, password: owner.password, reason: 'Trying to reauth for something I did not even draft.' } });
  check('confirm-reauth refuses on a draft that is not actually a self-approval situation for this caller', r.status === 400);
  r = await hier('approve-ceo-twin-policy', { token: owner.token, body: { config_id: v3Id, confirm: true } });
  check('a different, real owner-level account approving what someone else drafted needs no reauth at all', r.status === 200);

  // ---------------------------------------------------------------- authority matrix: seeded pending_approval, real approval flow
  r = await hier('authority-matrix', { token: owner.token, method: 'GET' });
  check('the seeded authority matrix is pending owner approval, not treated as governing yet', r.body.provisional === true && r.body.status === 'pending_approval' && r.body.matrix.transfer_money === 'owner_approved_payout_process');
  const matrixId = (await env.sql("select id from sales_config where key='authority_matrix' and status='pending_approval'")).rows[0].id;
  r = await hier('approve-authority-matrix', { token: owner.token, body: { config_id: matrixId, confirm: true } });
  check('the owner can approve the default authority matrix', r.status === 200);
  r = await hier('authority-matrix', { token: owner.token, method: 'GET' });
  check('the authority matrix now reads back as approved', r.body.status === 'approved');

  // ---------------------------------------------------------------- portfolio lifecycle + org-unit/position creation
  r = await hier('create-portfolio-entity', { token: owner.token, body: { key: 'test-venture', name: 'Test Venture', entity_type: 'experimental_venture' } });
  check('the owner can register a new portfolio entity', r.status === 200);
  r = await hier('set-portfolio-status', { token: owner.token, body: { id: r.body.entity.id, status: 'active', reason: 'Beginning zero-cost validation for this test.' } });
  check('a portfolio entity status change is recorded with a real reason', r.status === 200 && r.body.entity.status === 'active');
  check('a real append-only status-event row exists', (await env.sql('select count(*) from portfolio_status_events')).rows[0].count === '1');
  r = await hier('set-portfolio-status', { token: owner.token, body: { id: r.body.entity.id, status: 'closed', reason: '' } });
  check('a status change with no real reason is refused', r.status === 422);

  // ---------------------------------------------------------------- append-only audit trail proves the append-only trigger itself works
  const oneEvent = (await env.sql('select id from worker_status_events where worker_id=$1 limit 1', [wId])).rows[0];
  const badUpdate = await env.sql("update worker_status_events set reason='tampered' where id=$1", [oneEvent.id]).catch((e) => e);
  check('worker_status_events truly cannot be UPDATEd, even directly in the database (append-only trigger)', badUpdate instanceof Error && /append-only/.test(badUpdate.message));

  // ---------------------------------------------------------------- cross-org isolation (RLS, not just handler filtering)
  const direct = await env.rest(staffB.token, 'workers?select=id');
  check("a client-org member cannot read the workers table directly through PostgREST either (RLS, not app-layer filtering)", Array.isArray(direct.data) ? direct.data.length === 0 : direct.status >= 400, JSON.stringify(direct.data ?? direct.status));
  const anonRead = await env.rest(null, 'positions?select=id');
  check('the anonymous role cannot read positions directly', Array.isArray(anonRead.data) ? anonRead.data.length === 0 : anonRead.status >= 400);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova organizational hierarchy registry (real handlers + real local PostgreSQL/PostgREST; local, disposable)`);
// Force-exit: this suite (uniquely among the e2e suites) re-applies raw SQL and polls the PostgREST
// schema cache directly via env.sql/env.rest mid-test, which was observed to leave the process alive
// past its own env.stop() (the run hit verify_sales_team_e2e.mjs's 900s per-suite timeout and was
// killed despite every check having already passed). Setting exitCode alone was not sufficient.
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode);
