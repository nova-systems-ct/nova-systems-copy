// Pure rules for the Nova organizational hierarchy registry. No I/O — unit-tested in scripts/unit_hierarchy_rules_test.mjs.
export const WORKER_STATES = ['draft', 'onboarding', 'training', 'restricted', 'active', 'suspended', 'inactive'];
const WORKER_TRANSITIONS = {
  draft: ['onboarding', 'inactive'],
  onboarding: ['training', 'restricted', 'inactive'],
  training: ['restricted', 'active', 'inactive'],
  restricted: ['active', 'suspended', 'inactive'],
  active: ['restricted', 'suspended', 'inactive'],
  suspended: ['active', 'inactive'],
  inactive: [],
};
export const canTransitionWorker = (from, to) => (WORKER_TRANSITIONS[from] || []).includes(to);
// Only these states may perform a protected action (act with real authority). Draft/onboarding/training/suspended/inactive cannot.
export const PROTECTED_ACTION_STATES = new Set(['restricted', 'active']);
export const canActProtected = (status) => PROTECTED_ACTION_STATES.has(status);

// A reserved position (Aura Control Seat, Model Council seats until a real integration exists) may never receive a worker
// assignment through the ordinary API — this is the concrete, testable form of "Aura appears reserved and cannot act."
export function assignmentProblems({ position, worker, fillType }) {
  const p = [];
  if (!position) { p.push('Position not found.'); return p; }
  if (position.is_reserved && fillType !== 'reserved') p.push(`This position is reserved (${position.reserved_reason || 'not active yet'}) and cannot be assigned a worker.`);
  if (fillType === 'vacant' || fillType === 'reserved') { if (worker) p.push(`fill_type "${fillType}" must not include a worker.`); return p; }
  if (!worker) { p.push('A worker is required unless fill_type is vacant or reserved.'); return p; }
  if (!canActProtected(worker.status) && worker.status !== 'suspended') p.push(`This worker is ${worker.status} and is not ready to hold a position yet.`);
  if (worker.status === 'suspended') p.push('This worker is suspended and cannot be assigned a position.');
  if (fillType === 'ai' && worker.worker_type !== 'ai' && worker.worker_type !== 'hybrid') p.push('fill_type "ai" requires an AI or hybrid worker.');
  if (fillType === 'human' && worker.worker_type !== 'human') p.push('fill_type "human" requires a human worker.');
  if (fillType === 'isaac' && position.position_type !== 'owner') p.push('fill_type "isaac" is only for the Owner position.');
  return p;
}

// A work item / spending / permission-increase request may not be approved by the same identity that requested it.
export const isSelfApproval = (requesterId, approverId) => !!requesterId && !!approverId && requesterId === approverId;

// Self-approval policy for governance-level drafts (CEO Twin policy, Authority Matrix, worker
// contracts). A non-owner drafter (a worker, a delegated/lower-privileged account) may NEVER
// approve their own draft — blocked outright, no exception. The Owner approving their OWN draft is
// allowed — Isaac remains the final authority and a single-owner company is never forced to
// fabricate a second account to unblock itself — but only through the heightened
// reauthentication+fingerprint+reason protocol (api/_hierarchy/governance.js confirm-reauth). A
// different real owner-level account approving needs no extra step.
export function selfApprovalPolicy({ isSelfApproval, drafterIsOwner }) {
  if (!isSelfApproval) return 'allowed';
  return drafterIsOwner ? 'requires_reauth' : 'blocked';
}

// Authority-matrix lookup: is `actorLevel` (0=Owner..6) sufficient to take `action` given the approved matrix's authority label
// for it? This intentionally stays simple — the matrix stores a human-readable authority label (e.g. "owner",
// "manager", "worker_or_manager"); enforcement of any SPECIFIC action lives in that action's own handler (proposals, payouts,
// documents, etc., all already enforce their own authority). This helper exists for the hierarchy's own read-only display and
// for generic actions that don't yet have a dedicated handler.
const LEVEL_FOR_LABEL = { worker: 6, worker_or_manager: 5, manager: 4, owner_or_ciso_process: 1, owner_or_authorized_signer: 1, owner_approved_payout_process: 1, authorized_human_approval: 4, experiment_owner_within_policy_or_owner: 5, prohibited: -1 };
export function authoritySufficient(actorLevel, label) {
  if (label === 'prohibited') return false;
  if (label === 'owner') return actorLevel === 0;
  const need = LEVEL_FOR_LABEL[label]; if (need === undefined) return actorLevel === 0; // unknown label: fail closed to owner-only
  return actorLevel <= need;
}

// Maps a staff account's organization_members role(s) to an authority-matrix level (0=Owner..6=worker) —
// the same 0-6 scale positions.authority_level already uses. A person can hold more than one role
// (rare, but possible); their EFFECTIVE level is the most senior (lowest number) one grants. An
// unrecognized role never grants elevated authority — it falls back to 6 (ordinary worker), never 0.
const ROLE_AUTHORITY_LEVEL = {
  nova_super_admin: 0,
  nova_admin: 1,
  nova_sales_manager: 4,
  nova_finance: 4,
  nova_auditor: 4,
};
export function authorityLevelForRoles(roles = []) {
  let best = 6;
  for (const r of roles) { const lvl = ROLE_AUTHORITY_LEVEL[r]; if (lvl !== undefined && lvl < best) best = lvl; }
  return best;
}

export function normalizeCeoTwinPolicy(v = {}) {
  const arr = (x) => (Array.isArray(x) ? x.map((s) => String(s).slice(0, 500)).slice(0, 100) : []);
  return {
    principles: arr(v.principles), decision_preferences: arr(v.decision_preferences),
    risk_tolerance: v.risk_tolerance ? String(v.risk_tolerance).slice(0, 200) : null,
    brand_rules: arr(v.brand_rules), pricing_restrictions: arr(v.pricing_restrictions),
    communication_standards: arr(v.communication_standards), escalation_preferences: arr(v.escalation_preferences),
    company_priorities: arr(v.company_priorities), prohibited_actions: arr(v.prohibited_actions),
    approval_thresholds: v.approval_thresholds && typeof v.approval_thresholds === 'object' && !Array.isArray(v.approval_thresholds) ? v.approval_thresholds : {},
  };
}
// A CEO Twin policy is not ready to govern anything while it is entirely empty — the owner has to actually write it.
export function ceoTwinReadiness(policy) {
  const filled = ['principles', 'decision_preferences', 'brand_rules', 'prohibited_actions'].filter((k) => (policy[k] || []).length > 0);
  return { ready: filled.length >= 2, filled_sections: filled.length };
}

// ==================================================================== Phase C: governance
// Escalation chain per the master prompt: Worker -> Manager -> Executive -> CEO Twin -> Aura
// (reserved — while inactive it is skipped, routing straight to Owner) -> Owner. Owner is terminal.
export const ESCALATION_LEVELS = ['worker', 'manager', 'executive', 'ceo_twin', 'aura', 'owner'];
export function nextEscalationLevel(level, { auraActive = false } = {}) {
  if (level === 'owner') return null;
  if (level === 'ceo_twin') return auraActive ? 'aura' : 'owner';
  if (level === 'aura') return 'owner';
  const i = ESCALATION_LEVELS.indexOf(level);
  return i === -1 ? 'manager' : ESCALATION_LEVELS[i + 1];
}

// Kill-switch resolution: which scope (if any) currently blocks an action, in priority order —
// a global stop always wins, then company, then department, then the specific worker, then the
// model provider it would use. Pure function; the caller looks up each `engaged` flag from the
// kill_switches table for the relevant scope chain.
const KILL_SCOPE_ORDER = ['global', 'portfolioEntity', 'orgUnit', 'worker', 'provider'];
export function killSwitchBlocks(engaged = {}) {
  for (const scope of KILL_SCOPE_ORDER) if (engaged[scope]) return { blocked: true, scope };
  return { blocked: false, scope: null };
}

// A worker operating contract is not ready to govern anything while empty — same shape of check as
// the CEO Twin policy, applied per-worker.
export function contractReadiness(content = {}) {
  const hasMission = typeof content.mission === 'string' && content.mission.trim().length > 0;
  const hasResponsibilities = Array.isArray(content.responsibilities) && content.responsibilities.length > 0;
  return { ready: hasMission && hasResponsibilities };
}

// ==================================================================== Phase D: work & reporting
const WORK_ITEM_TRANSITIONS = {
  draft: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'in_review', 'cancelled', 'failed'],
  blocked: ['in_progress', 'cancelled', 'failed'],
  in_review: ['approved', 'rejected', 'cancelled'],
  approved: ['completed'],
  rejected: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: ['in_progress'],
};
export const canTransitionWorkItem = (from, to) => (WORK_ITEM_TRANSITIONS[from] || []).includes(to);

// Truthful presence: a worker may be shown "working" ONLY when its most recent heartbeat says
// 'working', was recorded recently (within `windowMs`), and names a work item that is genuinely
// still 'in_progress' in the database — never a decorative flag. Any one of those failing means
// "not working", full stop.
export function isWorkerActuallyWorking({ heartbeat, workItemStatus, now = new Date(), windowMs = 5 * 60 * 1000 } = {}) {
  if (!heartbeat || heartbeat.status !== 'working') return false;
  if (workItemStatus !== 'in_progress') return false;
  const age = now - new Date(heartbeat.created_at);
  return age >= 0 && age <= windowMs;
}

// A work item's evidence/output must exist before it can go to review, and a real reviewed
// decision (not the worker's own account) is required before it can be marked completed.
export function workItemReviewProblems({ workItem, evidenceCount = 0, outputCount = 0 }) {
  const p = [];
  if (!workItem) { p.push('Work item not found.'); return p; }
  if (evidenceCount === 0) p.push('At least one evidence/source record is required before review.');
  if (outputCount === 0) p.push('A real output is required before review.');
  return p;
}

// ==================================================================== Meeting Engine
// Honest participant availability for one seat, given its position and (if any) the worker
// currently filling it plus whether that worker is presently kill-switch-blocked. A reserved or
// vacant seat is reported exactly as that, never silently dropped from the room or shown present.
export function meetingParticipantAvailability({ position, fillType, worker, workerBlocked = false }) {
  if (!position) return 'failed';
  if (fillType === 'reserved') return 'reserved';
  if (fillType === 'vacant' || !worker) return 'vacant';
  if (workerBlocked) return 'unavailable';
  if (worker.status === 'active' || worker.status === 'restricted') return 'available';
  return 'unavailable';
}

// ==================================================================== Nova Venture Lab governance
export const VENTURE_ACTIVE_STAGES = ['idea', 'research', 'zero_cost_validation', 'demand_signal', 'pre_sale', 'sandbox_mvp', 'pilot', 'scale'];
// Normal, un-overridden transitions: one step forward through the active stages; pause/kill from any
// active stage; archive from paused or killed. Anything else (a skip, a resume, a backward move) is
// a real judgment call the owner must explicitly justify — see ventureOverrideProblems below.
export function ventureTransitionAllowed(from, to) {
  if (from === to) return false;
  if (from == null) return to === 'idea';
  const i = VENTURE_ACTIVE_STAGES.indexOf(from);
  if (i !== -1) {
    if (to === VENTURE_ACTIVE_STAGES[i + 1]) return true;
    if (to === 'paused' || to === 'killed') return true;
    return false;
  }
  if (from === 'paused' || from === 'killed') return to === 'archived';
  return false;
}
// What's still missing before an out-of-the-normal-lifecycle stage change may proceed as an
// explicit owner override — a written reason (already required elsewhere), supporting evidence,
// and (enforced by the caller, since it's inherent to the request shape) the exact from/to stage.
export function ventureOverrideProblems({ evidence }) {
  const p = [];
  if (!evidence || String(evidence).trim().length < 10) p.push('An owner override requires real supporting evidence (10+ characters), not just a reason.');
  return p;
}
