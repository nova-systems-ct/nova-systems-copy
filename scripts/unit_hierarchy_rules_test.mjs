// Pure-logic unit test for api/_hierarchy/rules.js — no database, no network. Real database/RLS behavior is
// proven separately in scripts/e2e_hierarchy_registry_test.mjs.
import { canTransitionWorker, assignmentProblems, isSelfApproval, selfApprovalPolicy, authoritySufficient, authorityLevelForRoles, normalizeCeoTwinPolicy, ceoTwinReadiness, nextEscalationLevel, killSwitchBlocks, contractReadiness, canTransitionWorkItem, isWorkerActuallyWorking, workItemReviewProblems, meetingParticipantAvailability, ventureTransitionAllowed, ventureOverrideProblems } from '../api/_hierarchy/rules.js';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

// ---------------------------------------------------------------- worker state machine
check('draft -> onboarding is allowed', canTransitionWorker('draft', 'onboarding'));
check('draft -> active is NOT allowed (must pass through onboarding/training)', !canTransitionWorker('draft', 'active'));
check('training -> active is allowed', canTransitionWorker('training', 'active'));
check('active -> suspended is allowed', canTransitionWorker('active', 'suspended'));
check('suspended -> active is allowed (reinstatement)', canTransitionWorker('suspended', 'active'));
check('suspended -> onboarding is NOT allowed', !canTransitionWorker('suspended', 'onboarding'));
check('inactive is a terminal state — no transitions out', !canTransitionWorker('inactive', 'active') && !canTransitionWorker('inactive', 'draft'));
check('unknown from-state has no allowed transitions', !canTransitionWorker('bogus', 'active'));

// ---------------------------------------------------------------- reserved-position enforcement (Aura, Model Council)
const aura = { key: 'aura-control-seat', is_reserved: true, reserved_reason: 'Reserved — Aura is not active yet.', position_type: 'aura_control_seat' };
const activeAiWorker = { id: 'w1', worker_type: 'ai', status: 'active' };
check('a reserved position cannot be assigned a real worker', assignmentProblems({ position: aura, worker: activeAiWorker, fillType: 'ai' }).length > 0);
check('a reserved position CAN be recorded as fill_type=reserved with no worker', assignmentProblems({ position: aura, worker: null, fillType: 'reserved' }).length === 0);
check('fill_type=reserved with a worker attached is rejected (must have no worker)', assignmentProblems({ position: aura, worker: activeAiWorker, fillType: 'reserved' }).length > 0);

const ordinaryPosition = { key: 'some-exec', is_reserved: false, position_type: 'executive' };
check('fill_type=vacant with a worker attached is rejected', assignmentProblems({ position: ordinaryPosition, worker: activeAiWorker, fillType: 'vacant' }).length > 0);
check('fill_type=vacant with no worker is fine', assignmentProblems({ position: ordinaryPosition, worker: null, fillType: 'vacant' }).length === 0);
check('no worker and fill_type is not vacant/reserved is rejected', assignmentProblems({ position: ordinaryPosition, worker: null, fillType: 'human' }).length > 0);
check('a suspended worker cannot be assigned to a position', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w2', worker_type: 'human', status: 'suspended' }, fillType: 'human' }).length > 0);
check('a draft (not-yet-onboarded) worker cannot be assigned to a position', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w3', worker_type: 'human', status: 'draft' }, fillType: 'human' }).length > 0);
check('an active human worker CAN be assigned with fill_type=human', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w4', worker_type: 'human', status: 'active' }, fillType: 'human' }).length === 0);
check('a restricted worker (real, but limited authority) CAN be assigned', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w5', worker_type: 'human', status: 'restricted' }, fillType: 'human' }).length === 0);
check('fill_type=ai requires an ai/hybrid worker, not human', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w6', worker_type: 'human', status: 'active' }, fillType: 'ai' }).length > 0);
check('fill_type=isaac is rejected on a non-owner position', assignmentProblems({ position: ordinaryPosition, worker: { id: 'w7', worker_type: 'human', status: 'active' }, fillType: 'isaac' }).length > 0);
const ownerPosition = { key: 'owner', is_reserved: false, position_type: 'owner' };
check('fill_type=isaac is accepted on the owner position', assignmentProblems({ position: ownerPosition, worker: { id: 'w8', worker_type: 'human', status: 'active' }, fillType: 'isaac' }).length === 0);
check('a missing position reports its own problem, not a crash', assignmentProblems({ position: null, worker: null, fillType: 'vacant' }).length === 1);

// ---------------------------------------------------------------- self-approval guard
check('a requester approving their own request is flagged', isSelfApproval('u1', 'u1'));
check('two different identities is fine', !isSelfApproval('u1', 'u2'));
check('a missing id never counts as self-approval', !isSelfApproval(null, null) && !isSelfApproval('u1', null));

// ---------------------------------------------------------------- self-approval policy (sole-owner fix)
check('a different approver never needs reauth', selfApprovalPolicy({ isSelfApproval: false, drafterIsOwner: true }) === 'allowed');
check('a non-owner drafter approving themselves is blocked outright, no reauth escape hatch', selfApprovalPolicy({ isSelfApproval: true, drafterIsOwner: false }) === 'blocked');
check('the owner approving their own draft requires reauth, not a flat block — a single owner is never deadlocked', selfApprovalPolicy({ isSelfApproval: true, drafterIsOwner: true }) === 'requires_reauth');

// ---------------------------------------------------------------- authority matrix labels
check('"prohibited" is never sufficient for any actor', !authoritySufficient(0, 'prohibited'));
check('"owner" requires authority_level exactly 0', authoritySufficient(0, 'owner') && !authoritySufficient(1, 'owner'));
check('"worker" (level 6) is satisfied by any real worker level', authoritySufficient(6, 'worker') && authoritySufficient(0, 'worker'));
check('"manager" (level 4) is not satisfied by a plain worker (level 6)', !authoritySufficient(6, 'manager') && authoritySufficient(4, 'manager'));
check('an unrecognized label fails closed to owner-only', !authoritySufficient(3, 'totally-unknown-label') && authoritySufficient(0, 'totally-unknown-label'));

// ---------------------------------------------------------------- CEO Twin policy normalization + readiness
const empty = normalizeCeoTwinPolicy({});
check('normalizing an empty policy yields all-empty arrays, not undefined', Array.isArray(empty.principles) && empty.principles.length === 0 && empty.risk_tolerance === null);
check('an empty policy is not ready to govern anything', ceoTwinReadiness(empty).ready === false);
const partial = normalizeCeoTwinPolicy({ principles: ['Be honest'], prohibited_actions: ['Never contact a real prospect without approval'] });
check('a policy with 2+ real filled sections is ready', ceoTwinReadiness(partial).ready === true);
check('normalization caps a single free-text entry length (no unbounded storage) and array length', normalizeCeoTwinPolicy({ principles: ['x'.repeat(10000)] }).principles[0].length === 500);
check('non-array input for an array field is coerced to empty, not thrown', normalizeCeoTwinPolicy({ principles: 'not an array' }).principles.length === 0);
check('approval_thresholds must be a plain object, arrays are rejected', normalizeCeoTwinPolicy({ approval_thresholds: [1, 2, 3] }).approval_thresholds && Object.keys(normalizeCeoTwinPolicy({ approval_thresholds: [1, 2, 3] }).approval_thresholds).length === 0);

// ---------------------------------------------------------------- Phase C: escalation chain
check('worker escalates to manager', nextEscalationLevel('worker') === 'manager');
check('manager escalates to executive', nextEscalationLevel('manager') === 'executive');
check('executive escalates to ceo_twin', nextEscalationLevel('executive') === 'ceo_twin');
check('ceo_twin skips the reserved/inactive Aura seat and routes straight to owner', nextEscalationLevel('ceo_twin') === 'owner');
check('ceo_twin routes to aura once Aura is genuinely active', nextEscalationLevel('ceo_twin', { auraActive: true }) === 'aura');
check('aura always routes to owner', nextEscalationLevel('aura') === 'owner');
check('owner is terminal — nothing escalates further', nextEscalationLevel('owner') === null);

// ---------------------------------------------------------------- Phase C: kill switches
check('no scope engaged -> not blocked', killSwitchBlocks({}).blocked === false);
check('a global kill switch blocks everything, reported as the global scope', killSwitchBlocks({ global: true, worker: true }).blocked === true && killSwitchBlocks({ global: true, worker: true }).scope === 'global');
check('a worker-level kill switch blocks even with nothing else engaged', killSwitchBlocks({ worker: true }).scope === 'worker');
check('priority order: portfolioEntity is reported before a lower-priority worker switch', killSwitchBlocks({ portfolioEntity: true, worker: true }).scope === 'portfolioEntity');
check('provider is the lowest priority', killSwitchBlocks({ provider: true }).scope === 'provider');

// ---------------------------------------------------------------- Phase C: worker operating contracts
check('an empty contract is not ready', contractReadiness({}).ready === false);
check('a contract with a mission but no responsibilities is not ready', contractReadiness({ mission: 'Do research' }).ready === false);
check('a contract with both a mission and real responsibilities is ready', contractReadiness({ mission: 'Do research', responsibilities: ['Read sources'] }).ready === true);

// ---------------------------------------------------------------- Phase D: work-item state machine
check('draft -> assigned is allowed', canTransitionWorkItem('draft', 'assigned'));
check('draft -> in_progress is NOT allowed (must be assigned first)', !canTransitionWorkItem('draft', 'in_progress'));
check('in_progress -> blocked is allowed', canTransitionWorkItem('in_progress', 'blocked'));
check('blocked -> in_progress is allowed (unblocked)', canTransitionWorkItem('blocked', 'in_progress'));
check('in_review -> approved is allowed', canTransitionWorkItem('in_review', 'approved'));
check('approved -> completed is allowed', canTransitionWorkItem('approved', 'completed'));
check('approved -> rejected is NOT allowed (decision is already made)', !canTransitionWorkItem('approved', 'rejected'));
check('rejected -> in_progress is allowed (rework)', canTransitionWorkItem('rejected', 'in_progress'));
check('completed is terminal', !canTransitionWorkItem('completed', 'in_progress'));
check('failed -> in_progress is allowed (retry)', canTransitionWorkItem('failed', 'in_progress'));

// ---------------------------------------------------------------- Phase D: truthful presence
const now = new Date('2026-09-28T12:00:00Z');
check('a recent "working" heartbeat on a genuinely in_progress item reports truly working', isWorkerActuallyWorking({ heartbeat: { status: 'working', created_at: '2026-09-28T11:58:00Z' }, workItemStatus: 'in_progress', now }));
check('an "idle" heartbeat never reports working, regardless of the work item', !isWorkerActuallyWorking({ heartbeat: { status: 'idle', created_at: '2026-09-28T11:59:59Z' }, workItemStatus: 'in_progress', now }));
check('a stale "working" heartbeat (older than the window) is not truthfully working', !isWorkerActuallyWorking({ heartbeat: { status: 'working', created_at: '2026-09-28T11:00:00Z' }, workItemStatus: 'in_progress', now }));
check('a "working" heartbeat whose work item is no longer in_progress (e.g. already completed) is not working', !isWorkerActuallyWorking({ heartbeat: { status: 'working', created_at: '2026-09-28T11:59:00Z' }, workItemStatus: 'completed', now }));
check('no heartbeat at all is never working', !isWorkerActuallyWorking({ heartbeat: null, workItemStatus: 'in_progress', now }));

// ---------------------------------------------------------------- Phase D: review gate
check('a work item with no evidence and no output cannot go to review', workItemReviewProblems({ workItem: { id: 'w1' }, evidenceCount: 0, outputCount: 0 }).length === 2);
check('a work item with real evidence and a real output has no review problems', workItemReviewProblems({ workItem: { id: 'w1' }, evidenceCount: 1, outputCount: 1 }).length === 0);
check('a missing work item reports its own problem, not a crash', workItemReviewProblems({ workItem: null }).length === 1);

// ---------------------------------------------------------------- Meeting Engine: honest participant availability
check('a reserved position (e.g. Aura, Model Council) reports reserved regardless of any worker data passed in', meetingParticipantAvailability({ position: { key: 'aura-control-seat' }, fillType: 'reserved', worker: null }) === 'reserved');
check('a vacant position reports vacant', meetingParticipantAvailability({ position: { key: 'ceo-twin' }, fillType: 'vacant', worker: null }) === 'vacant');
check('a filled position with an active worker reports available', meetingParticipantAvailability({ position: { key: 'x' }, fillType: 'human', worker: { status: 'active' } }) === 'available');
check('a filled position with a suspended worker reports unavailable', meetingParticipantAvailability({ position: { key: 'x' }, fillType: 'human', worker: { status: 'suspended' } }) === 'unavailable');
check('a filled position whose worker is kill-switch-blocked reports unavailable even if the worker status itself is active', meetingParticipantAvailability({ position: { key: 'x' }, fillType: 'human', worker: { status: 'active' }, workerBlocked: true }) === 'unavailable');
check('a missing position reports failed, not a crash', meetingParticipantAvailability({ position: null, fillType: 'human', worker: { status: 'active' } }) === 'failed');

// ---------------------------------------------------------------- Venture Lab governance
check('idea -> research is a normal forward step', ventureTransitionAllowed('idea', 'research'));
check('research -> zero_cost_validation is a normal forward step', ventureTransitionAllowed('research', 'zero_cost_validation'));
check('pilot -> scale is the final normal step', ventureTransitionAllowed('pilot', 'scale'));
check('idea straight to scale is NOT a normal transition — a silent jump', !ventureTransitionAllowed('idea', 'scale'));
check('idea straight to pilot is NOT a normal transition', !ventureTransitionAllowed('idea', 'pilot'));
check('any active stage can pause', ventureTransitionAllowed('demand_signal', 'paused'));
check('any active stage can be killed', ventureTransitionAllowed('sandbox_mvp', 'killed'));
check('paused can archive', ventureTransitionAllowed('paused', 'archived'));
check('killed can archive', ventureTransitionAllowed('killed', 'archived'));
check('paused resuming directly into an active stage is NOT normal — requires an explicit override', !ventureTransitionAllowed('paused', 'demand_signal'));
check('archived is terminal', !ventureTransitionAllowed('archived', 'idea'));
check('no-op (same stage twice) is never a normal transition', !ventureTransitionAllowed('idea', 'idea'));
check('unset (null) can only start at idea', ventureTransitionAllowed(null, 'idea') && !ventureTransitionAllowed(null, 'pilot'));
check('an override with no real evidence is refused', ventureOverrideProblems({ evidence: '' }).length === 1);
check('an override with a short non-answer is refused', ventureOverrideProblems({ evidence: 'because' }).length === 1);
check('an override with real evidence has no problems', ventureOverrideProblems({ evidence: 'Signed LOI from three prospective customers, see attached.' }).length === 0);

// ---------------------------------------------------------------- Authority Matrix: role -> level mapping
check('nova_super_admin is level 0 (Owner)', authorityLevelForRoles(['nova_super_admin']) === 0);
check('nova_admin is level 1', authorityLevelForRoles(['nova_admin']) === 1);
check('nova_sales_manager is level 4', authorityLevelForRoles(['nova_sales_manager']) === 4);
check('a plain nova_sales rep falls back to level 6 (worker)', authorityLevelForRoles(['nova_sales']) === 6);
check('an account with no roles falls back to level 6, never level 0', authorityLevelForRoles([]) === 6);
check('holding multiple roles uses the most senior (lowest number)', authorityLevelForRoles(['nova_sales', 'nova_super_admin']) === 0);
check('an unrecognized role never grants elevated authority', authorityLevelForRoles(['some_made_up_role']) === 6);

console.log(`\n${pass} passed, ${fail} failed — Nova Hierarchy rules (pure logic, no I/O)`);
process.exitCode = fail ? 1 : 0;
