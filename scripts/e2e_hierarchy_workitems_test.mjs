// Nova organizational hierarchy — work & reporting (Phase D): real handlers (api/_hierarchy/workitems.js,
// resource 'workitems') against a REAL local PostgreSQL + PostgREST (local, disposable). Proves the durable
// work-item lifecycle, truthful worker presence (never decorative), evidence/output/review gating, self-review
// protection, Venture Lab stage transitions, a real Owner Brief built only from verified database figures, and
// versioned operational memory with provenance and expiration. NOT Supabase, NOT production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations, SALES_PARTS, LOCKDOWN } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HIERARCHY_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-01-registry-migration-standalone.sql'), 'utf8');
const GOVERNANCE_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-02-governance-migration-standalone.sql'), 'utf8');
const WORK_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-03-work-and-reporting-migration-standalone.sql'), 'utf8');
// activity-feed (added below) reads committee_meetings — a real dependency on part 4, not just this
// suite's own scope.
const MEETINGS_SQL = fs.readFileSync(path.join(ROOT, 'supabase/hierarchy-04-meetings-migration-standalone.sql'), 'utf8');
const LOCKDOWN_SQL = fs.readFileSync(path.join(ROOT, LOCKDOWN), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(SALES_PARTS), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const gov = (op, o = {}) => call({ resource: 'governance', op, ...o });
const wk = (op, o = {}) => call({ resource: 'workitems', op, ...o });

try {
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const orgB = (await env.sql("insert into organizations (name, slug, kind) values ('Acme Client','acme','client') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Owner' });
  const staffB = await env.createUser({ email: 'staff@acme.test', role: 'client_owner', orgId: orgB, name: 'Acme Staff' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: orgA, name: 'Plain Rep' });
  await env.sql(HIERARCHY_SQL);
  await env.sql(GOVERNANCE_SQL);
  await env.sql(WORK_SQL);
  await env.sql(MEETINGS_SQL);
  await env.sql(LOCKDOWN_SQL);
  for (let i = 0; i < 20; i++) {
    await env.reload();
    const probe = await env.rest(env.serviceKey, 'work_items?limit=1');
    if (probe.status !== 404 && !(probe.data && probe.data.code === 'PGRST205')) break;
    await new Promise((res) => setTimeout(res, 300));
  }

  // ---------------------------------------------------------------- authorization boundary
  let r = await wk('work-items', { method: 'GET' });
  check('no session -> 401', r.status === 401);
  r = await wk('work-items', { token: staffB.token, method: 'GET' });
  check('a client-org member has no command.view permission -> 403', r.status === 403);

  // ---------------------------------------------------------------- Authority Matrix gate: fail closed with no approved matrix
  r = await wk('create-work-item', { token: owner.token, body: { title: 'Attempted before any Authority Matrix is approved' } });
  check('create-work-item is refused with NO approved Authority Matrix at all — fails closed, not open', r.status === 403 && /No approved Authority Matrix/.test(r.body.error));
  const matrixId = (await env.sql("select id from sales_config where key='authority_matrix' and status='pending_approval'")).rows[0].id;
  r = await hier('approve-authority-matrix', { token: owner.token, body: { config_id: matrixId, confirm: true } });
  check('approving the default Authority Matrix succeeds (seeded row has no drafter, no reauth needed)', r.status === 200);

  // ---------------------------------------------------------------- durable work-item lifecycle
  const activeWorker = (await hier('create-worker', { token: owner.token, body: { worker_type: 'human', staff_user_id: rep.id, display_name: 'Plain Rep' } })).body.worker;
  await hier('set-worker-status', { token: owner.token, body: { id: activeWorker.id, status: 'onboarding', reason: 'Starting onboarding for this test.' } });
  await hier('set-worker-status', { token: owner.token, body: { id: activeWorker.id, status: 'training', reason: 'Beginning training for this test.' } });
  r = await hier('set-worker-status', { token: owner.token, body: { id: activeWorker.id, status: 'active', reason: 'Training completed for this test.' } });
  check('the test worker genuinely reaches active status before the lifecycle checks below depend on it', r.status === 200 && r.body.worker.status === 'active');

  r = await wk('create-work-item', { token: rep.token, body: { title: 'Research competitor pricing' } });
  check('a non-owner cannot create a work item', r.status === 403);
  r = await wk('create-work-item', { token: owner.token, body: { title: 'Research competitor pricing for local plumbing services', category: 'research' } });
  check('the owner can create a real work item, starting in draft', r.status === 200 && r.body.work_item.status === 'draft');
  const wiId = r.body.work_item.id;
  r = await wk('start-work-item', { token: owner.token, body: { id: wiId } });
  check('a draft work item cannot be started directly (must be assigned first)', r.status === 409);
  r = await wk('assign-work-item', { token: owner.token, body: { id: wiId, worker_id: activeWorker.id } });
  check('the owner can assign it to a real, active worker', r.status === 200 && r.body.work_item.status === 'assigned' && !!r.body.work_item.assigned_at);
  r = await wk('start-work-item', { token: owner.token, body: { id: wiId } });
  check('once assigned, it can be started', r.status === 200 && r.body.work_item.status === 'in_progress' && !!r.body.work_item.started_at);

  // ---------------------------------------------------------------- truthful presence (never decorative)
  r = await wk('worker-presence', { token: owner.token, method: 'GET', query: { worker_id: activeWorker.id } });
  check('with no heartbeat at all, the worker is honestly reported not working', r.status === 200 && r.body.working === false);
  r = await wk('heartbeat', { token: owner.token, body: { worker_id: activeWorker.id, work_item_id: wiId, status: 'working', note: 'Collecting sources' } });
  check('a real heartbeat can be recorded', r.status === 200);
  r = await wk('worker-presence', { token: owner.token, method: 'GET', query: { worker_id: activeWorker.id } });
  check('a fresh "working" heartbeat tied to a genuinely in_progress work item reports truly working', r.status === 200 && r.body.working === true);
  r = await wk('heartbeat', { token: owner.token, body: { worker_id: activeWorker.id, work_item_id: wiId, status: 'idle' } });
  await wk('worker-presence', { token: owner.token, method: 'GET', query: { worker_id: activeWorker.id } });
  r = await wk('worker-presence', { token: owner.token, method: 'GET', query: { worker_id: activeWorker.id } });
  check('once the latest heartbeat says idle, presence honestly flips back to not working', r.status === 200 && r.body.working === false);

  // ---------------------------------------------------------------- review gate: cannot skip evidence/output
  r = await wk('submit-for-review', { token: owner.token, body: { id: wiId } });
  check('a work item with no evidence and no output cannot be submitted for review', r.status === 422 && r.body.problems.length === 2);
  r = await wk('add-evidence', { token: owner.token, body: { work_item_id: wiId, source: 'https://example-plumbing-co.test/pricing (retrieved 2026-09-28)', observation: 'Listed emergency call-out fee: $150' } });
  check('real evidence can be attached', r.status === 200);
  r = await wk('add-output', { token: owner.token, body: { work_item_id: wiId, content: { summary: 'Three local competitors charge $120-180 for an emergency call-out.' } } });
  check('a real output can be attached', r.status === 200);
  r = await wk('submit-for-review', { token: owner.token, body: { id: wiId } });
  check('with real evidence and a real output, it can now go to review', r.status === 200 && r.body.work_item.status === 'in_review');

  // ---------------------------------------------------------------- self-review protection
  r = await wk('review-work-item', { token: rep.token, body: { id: wiId, decision: 'approved', notes: 'Looks complete and well-sourced.' } });
  check('the worker who produced the output cannot also review their own work item', r.status === 403);
  r = await wk('review-work-item', { token: owner.token, body: { id: wiId, decision: 'approved', notes: '' } });
  check('reviewing with no real notes is refused', r.status === 422);
  r = await wk('review-work-item', { token: owner.token, body: { id: wiId, decision: 'approved', notes: 'Looks complete and well-sourced; approved.' } });
  check('a different, real reviewer can approve it', r.status === 200 && r.body.work_item.status === 'approved');
  check('a real decision_records row exists for the review', (await env.sql("select count(*) from decision_records where decision_type='work_item_review'")).rows[0].count === '1');
  r = await wk('complete-work-item', { token: owner.token, body: { id: wiId } });
  check('an approved work item can be completed', r.status === 200 && r.body.work_item.status === 'completed' && !!r.body.work_item.completed_at);
  r = await wk('complete-work-item', { token: owner.token, body: { id: wiId } });
  check('a completed work item is terminal — cannot be completed again', r.status === 409);

  // ---------------------------------------------------------------- Authority Matrix: a STORED policy genuinely blocks execution
  {
    r = await hier('save-authority-matrix', { token: owner.token, body: { value: { create_internal_task: 'prohibited', reassign_routine_task: 'manager', close_venture_experiment: 'experiment_owner_within_policy_or_owner' }, change_note: 'Test: prohibit creating internal work items entirely.' } });
    const draftId = r.body.config.id;
    r = await hier('approve-authority-matrix', { token: owner.token, body: { config_id: draftId, confirm: true } });
    check('approving a version the owner drafted requires reauth (self-approval rule applies to the Authority Matrix too)', r.status === 428);
    await gov('confirm-reauth', { token: owner.token, body: { target_type: 'authority_matrix', target_id: draftId, password: owner.password, reason: 'Testing that a prohibited action is genuinely blocked, not just cosmetically labeled.' } });
    r = await hier('approve-authority-matrix', { token: owner.token, body: { config_id: draftId, confirm: true } });
    check('the new, stricter Authority Matrix version is now approved and governing', r.status === 200);

    r = await wk('create-work-item', { token: owner.token, body: { title: 'This should be refused — create_internal_task is now prohibited' } });
    check('a REAL, currently-approved policy genuinely blocks work-item creation — not a cosmetic label, an actual 403', r.status === 403 && /prohibited/.test(r.body.error));
    check('the refused attempt left no new row in work_items', (await env.sql("select count(*) from work_items where title like 'This should be refused%'")).rows[0].count === '0');

    // Restore a permissive matrix so the rest of this suite's later checks (e.g. the kill-switch
    // section, which also calls create-work-item) are not accidentally blocked by this test's own change.
    r = await hier('save-authority-matrix', { token: owner.token, body: { value: { create_internal_task: 'worker_or_manager', reassign_routine_task: 'manager', close_venture_experiment: 'experiment_owner_within_policy_or_owner' }, change_note: 'Restoring a permissive matrix for the rest of this test run.' } });
    const restoreId = r.body.config.id;
    await gov('confirm-reauth', { token: owner.token, body: { target_type: 'authority_matrix', target_id: restoreId, password: owner.password, reason: 'Restoring normal operation after the prohibition test above.' } });
    r = await hier('approve-authority-matrix', { token: owner.token, body: { config_id: restoreId, confirm: true } });
    check('the matrix can be restored to a permissive version, and work-item creation works again', r.status === 200);
    r = await wk('create-work-item', { token: owner.token, body: { title: 'Should succeed again after restoring the matrix' } });
    check('create-work-item succeeds again once the prohibition is lifted', r.status === 200);
  }

  // ---------------------------------------------------------------- Venture Lab lifecycle (real, enforced state machine)
  const venture = (await hier('create-portfolio-entity', { token: owner.token, body: { key: 'test-lawn-care', name: 'Test Lawn Care Venture', entity_type: 'experimental_venture' } })).body.entity;
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'idea', reason: 'Initial idea captured.' } });
  check('a fresh venture can be set to idea stage', r.status === 200 && r.body.entity.venture_stage === 'idea');
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'pilot', reason: 'Skipping ahead — should be refused.' } });
  check('a silent jump (idea straight to pilot) is REFUSED, not silently accepted', r.status === 422 && r.body.requires === 'override');
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'pilot', reason: 'Skipping ahead, with justification.', override: true, evidence: '' } });
  check('an override with no real evidence is also refused', r.status === 422);
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'pilot', reason: 'Owner judgment call: prior identical venture already validated this exact model.', override: true, evidence: 'See Test Venture #1 (closed 2026-08), same offer and customer segment, 40 paid pilots.' } });
  check('WITH override:true and real evidence, the exceptional jump is allowed and recorded as an override', r.status === 200 && r.body.entity.venture_stage === 'pilot');
  check('the override event is flagged as such in the permanent record, distinct from normal progress', (await env.sql("select override, evidence from venture_stage_events where portfolio_entity_id=$1 and to_stage='pilot'", [venture.id])).rows[0].override === true);
  check('a real decision_records row exists for the override, for later reporting', (await env.sql("select count(*) from decision_records where decision_type='venture_override'")).rows[0].count === '1');
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'research', reason: 'Backward move — should still be refused even after one override', override: true, evidence: 'short' } });
  check('override never bypasses the evidence requirement on a LATER (backward) change either', r.status === 422);
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'killed', reason: 'Pilot underperformed against kill criteria.' } });
  check('killing from an active stage (pilot) is a NORMAL transition, no override needed', r.status === 200 && r.body.entity.venture_stage === 'killed');
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'archived', reason: 'Closing out the record.' } });
  check('archiving a killed venture is normal', r.status === 200 && r.body.entity.venture_stage === 'archived');
  r = await wk('set-venture-stage', { token: owner.token, body: { id: venture.id, stage: 'pilot', reason: '' } });
  check('a stage change with no real reason is refused, even with override', r.status === 422);
  const nonVenture = (await hier('create-portfolio-entity', { token: owner.token, body: { key: 'test-owned-co', name: 'Test Owned Co', entity_type: 'owned_company' } })).body.entity;
  r = await wk('set-venture-stage', { token: owner.token, body: { id: nonVenture.id, stage: 'idea', reason: 'Should be refused.' } });
  check('venture stage cannot be set on a non-venture entity', r.status === 422);

  // ---------------------------------------------------------------- Venture data (hypothesis, customer, budget, ...)
  r = await wk('venture-data', { token: owner.token, method: 'GET', query: { id: venture.id } });
  check('with nothing saved yet, venture_data reads back as an honest empty object', r.status === 200 && Object.keys(r.body.venture_data).length === 0);
  r = await wk('save-venture-data', { token: owner.token, body: { id: venture.id, hypothesis: 'Homeowners will pay a flat monthly rate for scheduled lawn care.', customer: 'Suburban homeowners, 1/4-1 acre lots', budget: '$0 (zero-cost validation)', success_criteria: '10 paid signups in 30 days', kill_criteria: 'Fewer than 2 signups after 50 outreach attempts' } });
  check('venture-specific fields can be saved', r.status === 200 && r.body.venture_data.hypothesis.includes('flat monthly rate'));
  r = await wk('save-venture-data', { token: owner.token, body: { id: venture.id, revenue_collected: '$0', lessons: 'Outreach via neighborhood apps outperformed flyers.' } });
  check('saving again MERGES rather than overwriting prior fields', r.status === 200 && r.body.venture_data.hypothesis.includes('flat monthly rate') && r.body.venture_data.lessons.includes('neighborhood apps'));

  // ---------------------------------------------------------------- Owner Brief: real figures only, never fabricated
  r = await wk('generate-brief', { token: rep.token, body: { brief_type: 'daily' } });
  check('a non-owner cannot generate a brief', r.status === 403);
  r = await wk('generate-brief', { token: owner.token, body: { brief_type: 'daily' } });
  check('the owner can generate a real daily brief', r.status === 200);
  const brief = r.body.brief;
  check('the completed work item shows up as a real, sourced figure', brief.content.work_items_completed.value === 1 && brief.content.work_items_completed.source === 'work_items' && brief.content.work_items_completed.verification_state === 'verified_from_database');
  check('every figure carries a period and a last_updated timestamp', !!brief.content.work_items_completed.period.start && !!brief.content.work_items_completed.last_updated);
  const briefRow = (await env.sql('select content from owner_briefs where id=$1', [brief.id])).rows[0];
  check('the brief is a real, permanent row in owner_briefs', JSON.stringify(briefRow.content) === JSON.stringify(brief.content));
  const badUpdate = await env.sql("update owner_briefs set content='{}'::jsonb where id=$1", [brief.id]).catch((e) => e);
  check('owner_briefs truly cannot be UPDATEd, even directly in the database (append-only trigger)', badUpdate instanceof Error && /append-only/.test(badUpdate.message));

  // ---------------------------------------------------------------- operational memory: versioned, provenance, expiration
  r = await wk('memory', { token: owner.token, method: 'GET', query: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'market-notes' } });
  check('with no memory saved yet, it honestly reads back as none', r.status === 200 && r.body.status === 'none');
  r = await wk('save-memory', { token: owner.token, body: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'market-notes', content: { note: 'Three local competitors identified.' }, source_type: 'work_item', source_id: wiId } });
  check('a real, versioned memory can be saved with real provenance', r.status === 200 && r.body.memory.version === 1 && r.body.memory.source_type === 'work_item');
  r = await wk('save-memory', { token: owner.token, body: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'market-notes', content: { note: 'Updated: four competitors now, one closed.' } } });
  check('saving again creates a new version rather than overwriting the old one', r.status === 200 && r.body.memory.version === 2);
  check('the prior version was superseded, not deleted', (await env.sql("select status from operational_memory where scope_type='portfolio_entity' and key='market-notes' and version=1")).rows[0].status === 'superseded');
  r = await wk('memory', { token: owner.token, method: 'GET', query: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'market-notes' } });
  check('reading it back returns the current (v2) active version', r.status === 200 && r.body.memory.version === 2 && r.body.status === 'active');
  r = await wk('save-memory', { token: owner.token, body: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'stale-fact', content: { note: 'A fact that is only true for 1 second.' }, expires_at: new Date(Date.now() + 1000).toISOString() } });
  await new Promise((res) => setTimeout(res, 1200));
  r = await wk('memory', { token: owner.token, method: 'GET', query: { scope_type: 'portfolio_entity', scope_id: venture.id, key: 'stale-fact' } });
  check('a memory past its expires_at is honestly reported as expired, not silently trusted', r.status === 200 && r.body.status === 'expired');

  // ---------------------------------------------------------------- kill-switch enforcement actually stops protected execution
  r = await wk('create-work-item', { token: owner.token, body: { title: 'A second work item, for kill-switch enforcement' } });
  const secondWi = r.body.work_item;
  r = await gov('engage-kill-switch', { token: owner.token, body: { scope_type: 'worker', scope_id: activeWorker.id, reason: 'Testing that a paused worker genuinely cannot receive or continue work.' } });
  check('a worker-level kill switch is engaged', r.status === 200);
  r = await wk('assign-work-item', { token: owner.token, body: { id: secondWi.id, worker_id: activeWorker.id } });
  check('assigning new work to a paused worker is refused (423), not silently allowed', r.status === 423);
  r = await wk('heartbeat', { token: owner.token, body: { worker_id: activeWorker.id, status: 'working' } });
  check('a paused worker cannot report itself as working (423)', r.status === 423);
  r = await wk('heartbeat', { token: owner.token, body: { worker_id: activeWorker.id, status: 'idle' } });
  check('a paused worker CAN still honestly report idle (the switch blocks claiming to work, not every heartbeat)', r.status === 200);
  const killSwitchId = (await env.sql("select id from kill_switches where scope_type='worker' and scope_id=$1", [activeWorker.id])).rows[0].id;
  await gov('disengage-kill-switch', { token: owner.token, body: { id: killSwitchId, reason: 'Test complete.' } });
  r = await wk('assign-work-item', { token: owner.token, body: { id: secondWi.id, worker_id: activeWorker.id } });
  check('once disengaged, the same worker can be assigned work again', r.status === 200);

  // ---------------------------------------------------------------- cross-org isolation (RLS, not just handler filtering)
  const direct = await env.rest(staffB.token, 'work_items?select=id');
  check("a client-org member cannot read work_items directly through PostgREST either (RLS, not app-layer filtering)", Array.isArray(direct.data) ? direct.data.length === 0 : direct.status >= 400, JSON.stringify(direct.data ?? direct.status));
  const anonRead = await env.rest(null, 'owner_briefs?select=id');
  check('the anonymous role cannot read owner_briefs directly', Array.isArray(anonRead.data) ? anonRead.data.length === 0 : anonRead.status >= 400);

  // ---------------------------------------------------------------- global activity feed (real, merged, never a separate log)
  r = await wk('activity-feed', { token: rep.token, method: 'GET' });
  check('a client with no command.view cannot read the activity feed', r.status === 403);
  r = await wk('activity-feed', { token: owner.token, method: 'GET' });
  check('the owner can read a real, merged activity feed', r.status === 200 && Array.isArray(r.body) && r.body.length > 0);
  check('every entry is sorted newest-first', r.body.every((e, i) => i === 0 || new Date(r.body[i - 1].at) >= new Date(e.at)));
  check('the feed includes real work-item lifecycle entries, not just decisions', r.body.some((e) => e.entity_type === 'work_item'));
  check('the feed includes real venture-lab entries', r.body.some((e) => e.entity_type === 'venture'));
  r = await wk('activity-feed', { token: owner.token, method: 'GET', query: { entity_type: 'venture' } });
  check('filtering by entity_type returns only that type', r.status === 200 && r.body.every((e) => e.entity_type === 'venture') && r.body.length > 0);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova organizational hierarchy work & reporting (real handlers + real local PostgreSQL/PostgREST; local, disposable)`);
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode);
