// Nova organizational hierarchy — governance (Phase C): worker operating contracts, decision
// records, the escalation chain, and kill switches. Reuses the same plumbing as registry.js
// (api/_sales/core.js) — no second auth/audit/versioned-config mechanism.
import crypto from 'node:crypto';
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm, env, canonicalJson, sha256 } from '../_sales/core.js';
import { nextEscalationLevel, killSwitchBlocks, isSelfApproval, selfApprovalPolicy, contractReadiness } from './rules.js';

export const fingerprintPolicy = (value) => sha256(canonicalJson(value ?? null));

// Real password re-verification against Supabase Auth's own password grant — not a rubber stamp.
// Used only for the sole-owner self-approval protocol (see confirm-reauth below).
async function verifyPassword(email, password) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  return r.ok;
}
const REAUTH_TTL_MS = 5 * 60_000;

// Consumes (single-use) a real, unexpired reauth confirmation matching this exact (owner, content)
// pair, or reports none exists. Exported for reuse by api/_hierarchy/registry.js's CEO Twin
// policy / Authority Matrix approval, which share this same protocol.
export async function checkSelfApprovalReauth({ staffUserId, fingerprint }) {
  const row = await dbOne(`owner_reauth_confirmations?staff_user_id=eq.${enc(staffUserId)}&policy_fingerprint=eq.${enc(fingerprint)}&used_at=is.null&expires_at=gt.${enc(nowIso())}&order=confirmed_at.desc&select=*`);
  if (!row) return { ok: false };
  await dbPatch('owner_reauth_confirmations', `id=eq.${enc(row.id)}`, { used_at: nowIso() });
  return { ok: true, reason: row.reason };
}

// Was `staffUserId` a real, currently-active owner-level (command.owner) account at draft time?
// Only relevant to decide whether a self-approval may proceed via reauth at all — a draft by a
// worker or a lower-privileged delegate must stay blocked outright, never reauth-able.
export async function isActiveOwner(staffUserId) {
  if (!staffUserId) return false;
  const row = await dbOne(`organization_members?staff_user_id=eq.${enc(staffUserId)}&role=eq.nova_super_admin&status=eq.active&select=staff_user_id`);
  return !!row;
}

// Every governance decision (policy/contract approval, escalation resolution, kill-switch toggle)
// is recorded permanently here, in addition to the mutable state change itself and the generic
// sales_audit_log entry — this is the table the Daily Owner Brief / Weekly Executive Packet
// (Phase D) will read from.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function recordDecision({ decisionType, subjectType, subjectId, decidedBy, authorityLabel = null, rationale, outcome }) {
  // decision_records.subject_id is a UUID column, but a kill switch's scope_id can be a non-UUID provider key
  // (e.g. 'claude') for scope_type='model_provider' — only pass a genuine UUID, never let that insert crash.
  await dbInsert('decision_records', { decision_type: decisionType, subject_type: subjectType, subject_id: subjectId && UUID_RE.test(subjectId) ? subjectId : null, decided_by: decidedBy, authority_label: authorityLabel, rationale, outcome });
}

// Whether the Aura Control Seat is genuinely active right now (a real, non-reserved assignment) —
// used to decide whether an escalation from ceo_twin routes through Aura or skips straight to Owner.
async function auraIsActive() {
  const pos = await dbOne("positions?portfolio_entity_id=is.null&key=eq.aura-control-seat&select=id,is_reserved");
  if (!pos || pos.is_reserved) return false;
  const a = await dbOne(`executive_assignments?position_id=eq.${enc(pos.id)}&unassigned_at=is.null&select=fill_type`);
  return !!a && a.fill_type !== 'reserved' && a.fill_type !== 'vacant';
}

// Look up the engaged kill switches relevant to one worker's scope chain (global, its portfolio
// entity, its org unit, itself, and — if it's an AI/hybrid worker — its model provider). Exported
// for reuse by api/_hierarchy/workitems.js, which is the actual enforcement point for "a paused
// worker cannot be given or continue real work" — this module owns the kill_switches table.
export async function killSwitchStateFor(worker) {
  const rows = await dbGet('kill_switches?engaged=eq.true&select=scope_type,scope_id');
  const has = (type, id) => rows.some((r) => r.scope_type === type && (id == null ? !r.scope_id : r.scope_id === String(id)));
  return {
    global: has('global', null),
    portfolioEntity: worker?.portfolio_entity_id ? has('portfolio_entity', worker.portfolio_entity_id) : false,
    orgUnit: worker?.org_unit_id ? has('org_unit', worker.org_unit_id) : false,
    worker: worker ? has('worker', worker.id) : false,
    provider: worker?.model_provider ? has('model_provider', worker.model_provider) : false,
  };
}

export const handleGovernance = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['save-worker-contract', 'approve-worker-contract', 'confirm-reauth', 'route-escalation', 'resolve-escalation', 'cancel-escalation', 'engage-kill-switch', 'disengage-kill-switch'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'command.owner' : 'command.view'); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;

  // ================================================================== worker operating contracts
  if (op === 'worker-contract') {
    const workerId = sanitize(req.query?.worker_id, 60); if (!workerId) return bad(res, 422, 'worker_id is required.');
    const [approved, pending] = await Promise.all([
      dbOne(`worker_contracts?worker_id=eq.${enc(workerId)}&status=eq.approved&select=*`),
      dbOne(`worker_contracts?worker_id=eq.${enc(workerId)}&status=eq.pending_approval&order=version.desc&select=*`),
    ]);
    const current = approved || pending;
    return res.status(200).json({ contract: current || null, provisional: !approved, status: current?.status || 'none', readiness: current ? contractReadiness(current.content) : { ready: false } });
  }
  if (op === 'save-worker-contract') {
    if (!need('POST')) return;
    const workerId = sanitize(b.worker_id, 60); const worker = workerId && await dbOne(`workers?id=eq.${enc(workerId)}&select=id`);
    if (!worker) return bad(res, 404, 'Worker not found');
    const content = b.content && typeof b.content === 'object' && !Array.isArray(b.content) ? b.content : {};
    if (JSON.stringify(content).length > 20000) return bad(res, 422, 'Contract content is too large.');
    const last = await dbOne(`worker_contracts?worker_id=eq.${enc(workerId)}&order=version.desc&select=version`);
    const ins = await dbInsert('worker_contracts', { worker_id: workerId, version: (last?.version || 0) + 1, status: 'pending_approval', content, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, 'worker_contract', ins.row.id, 'proposed', { worker_id: workerId });
    return res.status(200).json({ ok: true, contract: ins.row });
  }
  if (op === 'confirm-reauth') {
    if (!need('POST')) return;
    const password = typeof b.password === 'string' ? b.password : ''; if (!password) return bad(res, 422, 'password is required.');
    const targetType = sanitize(b.target_type, 30); const targetId = sanitize(b.target_id, 60);
    if (!['ceo_twin_policy', 'authority_matrix', 'worker_contract'].includes(targetType) || !targetId) return bad(res, 422, 'target_type and target_id are required.');
    const reason = sanitize(b.reason, 1000); if (reason.length < 10) return bad(res, 422, 'A real written reason (10+ characters) is required to approve your own draft.');
    const row = targetType === 'worker_contract' ? await dbOne(`worker_contracts?id=eq.${enc(targetId)}&select=content,created_by`) : await dbOne(`sales_config?id=eq.${enc(targetId)}&select=value,created_by`);
    if (!row) return bad(res, 404, 'Not found');
    if (!isSelfApproval(row.created_by, caller.id)) return bad(res, 400, 'This is not a self-approval — no reauthentication is needed; approve it directly.');
    if (!(await verifyPassword(caller.email, password))) return bad(res, 401, 'Password verification failed.');
    const fingerprint = fingerprintPolicy(targetType === 'worker_contract' ? row.content : row.value);
    const ins = await dbInsert('owner_reauth_confirmations', { staff_user_id: caller.id, policy_fingerprint: fingerprint, reason, expires_at: new Date(Date.now() + REAUTH_TTL_MS).toISOString() });
    await audit(caller, targetType, targetId, 'reauth_confirmed', {});
    return res.status(200).json({ ok: true, expires_at: ins.row.expires_at, valid_for_seconds: REAUTH_TTL_MS / 1000 });
  }
  if (op === 'approve-worker-contract') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that this is the operating contract you are approving.');
    const contract = await dbOne(`worker_contracts?id=eq.${enc(sanitize(b.contract_id, 60))}&select=*`); if (!contract) return bad(res, 404, 'Not found');
    if (contract.status === 'approved') return res.status(200).json({ ok: true });
    const policy = selfApprovalPolicy({ isSelfApproval: isSelfApproval(contract.created_by, caller.id), drafterIsOwner: await isActiveOwner(contract.created_by) });
    if (policy === 'blocked') return bad(res, 403, 'The person who drafted this contract cannot also approve it — have an owner approve it instead.');
    let reauthReason = null;
    if (policy === 'requires_reauth') {
      const fingerprint = fingerprintPolicy(contract.content);
      const reauth = await checkSelfApprovalReauth({ staffUserId: caller.id, fingerprint });
      if (!reauth.ok) return res.status(428).json({ error: 'You drafted this contract yourself. Call confirm-reauth (real password re-verification, a written reason, and the exact content fingerprint) before approving it.', requires: 'confirm-reauth' });
      reauthReason = reauth.reason;
    }
    await dbPatch('worker_contracts', `worker_id=eq.${enc(contract.worker_id)}&status=eq.approved`, { status: 'retired' });
    const [row] = await dbPatch('worker_contracts', `id=eq.${enc(contract.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() });
    await audit(caller, 'worker_contract', contract.id, 'approved', reauthReason ? { self_approved_by_sole_owner: true, reason: reauthReason } : {});
    await recordDecision({ decisionType: 'contract_approval', subjectType: 'worker', subjectId: contract.worker_id, decidedBy: caller.id, rationale: reauthReason || contract.change_note || 'Worker operating contract approved.', outcome: 'approved' });
    return res.status(200).json({ ok: true, contract: row });
  }

  // ================================================================== escalation chain
  if (op === 'escalations') {
    const status = sanitize(req.query?.status, 20);
    return res.status(200).json(await dbGet(`escalations?${status ? `status=eq.${enc(status)}&` : ''}order=created_at.desc&select=*`));
  }
  if (op === 'raise-escalation') {
    if (!need('POST')) return;
    const reason = sanitize(b.reason, 1000); if (reason.length < 5) return bad(res, 422, 'Describe why this is being escalated.');
    const subjectType = sanitize(b.subject_type, 40); if (!subjectType) return bad(res, 422, 'subject_type is required.');
    const ins = await dbInsert('escalations', { subject_type: subjectType, subject_id: sanitize(b.subject_id, 60) || null, raised_by_worker_id: sanitize(b.raised_by_worker_id, 60) || null, level: 'worker', reason, created_by: caller.id });
    await audit(caller, 'escalation', ins.row.id, 'raised', { subject_type: subjectType });
    return res.status(200).json({ ok: true, escalation: ins.row });
  }
  if (op === 'route-escalation') {
    if (!need('POST')) return;
    const esc = await dbOne(`escalations?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!esc) return bad(res, 404, 'Not found');
    if (esc.status !== 'open' && esc.status !== 'routed') return bad(res, 409, `Cannot route a ${esc.status} escalation.`);
    const to = nextEscalationLevel(esc.level, { auraActive: await auraIsActive() });
    if (!to) return bad(res, 409, 'This escalation is already at Owner — the top of the chain.');
    const [row] = await dbPatch('escalations', `id=eq.${enc(esc.id)}`, { level: to, status: 'routed' });
    await dbInsert('escalation_events', { escalation_id: esc.id, from_level: esc.level, to_level: to, from_status: esc.status, to_status: 'routed', changed_by: caller.id, note: sanitize(b.note, 500) || null });
    await audit(caller, 'escalation', esc.id, 'routed', { from: esc.level, to });
    return res.status(200).json({ ok: true, escalation: row });
  }
  if (op === 'resolve-escalation') {
    if (!need('POST')) return;
    const esc = await dbOne(`escalations?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!esc) return bad(res, 404, 'Not found');
    if (esc.status === 'resolved' || esc.status === 'cancelled') return bad(res, 409, `This escalation is already ${esc.status}.`);
    const resolution = sanitize(b.resolution, 2000); if (resolution.length < 5) return bad(res, 422, 'Record the real resolution.');
    if (esc.raised_by_worker_id) {
      const raiser = await dbOne(`workers?id=eq.${enc(esc.raised_by_worker_id)}&select=staff_user_id`);
      if (raiser?.staff_user_id && isSelfApproval(raiser.staff_user_id, caller.id)) return bad(res, 403, 'The person who raised this escalation cannot also resolve it.');
    }
    const [row] = await dbPatch('escalations', `id=eq.${enc(esc.id)}`, { status: 'resolved', resolved_by: caller.id, resolved_at: nowIso(), resolution });
    await dbInsert('escalation_events', { escalation_id: esc.id, from_level: esc.level, to_level: esc.level, from_status: esc.status, to_status: 'resolved', changed_by: caller.id, note: resolution });
    await audit(caller, 'escalation', esc.id, 'resolved', {});
    await recordDecision({ decisionType: 'escalation_resolution', subjectType: esc.subject_type, subjectId: esc.subject_id, decidedBy: caller.id, rationale: resolution, outcome: 'resolved' });
    return res.status(200).json({ ok: true, escalation: row });
  }
  if (op === 'cancel-escalation') {
    if (!need('POST')) return;
    const esc = await dbOne(`escalations?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!esc) return bad(res, 404, 'Not found');
    if (esc.status === 'resolved' || esc.status === 'cancelled') return bad(res, 409, `This escalation is already ${esc.status}.`);
    const [row] = await dbPatch('escalations', `id=eq.${enc(esc.id)}`, { status: 'cancelled', resolved_by: caller.id, resolved_at: nowIso(), resolution: sanitize(b.reason, 500) || null });
    await dbInsert('escalation_events', { escalation_id: esc.id, from_level: esc.level, to_level: esc.level, from_status: esc.status, to_status: 'cancelled', changed_by: caller.id, note: sanitize(b.reason, 500) || null });
    await audit(caller, 'escalation', esc.id, 'cancelled', {});
    return res.status(200).json({ ok: true, escalation: row });
  }

  // ================================================================== kill switches
  if (op === 'kill-switches') return res.status(200).json(await dbGet('kill_switches?order=updated_at.desc&select=*'));
  if (op === 'kill-switch-status') {
    const workerId = sanitize(req.query?.worker_id, 60);
    const worker = workerId ? await dbOne(`workers?id=eq.${enc(workerId)}&select=id,portfolio_entity_id,org_unit_id,model_provider`) : null;
    if (workerId && !worker) return bad(res, 404, 'Worker not found');
    const engaged = await killSwitchStateFor(worker);
    return res.status(200).json({ ...killSwitchBlocks(engaged), engaged });
  }
  if (op === 'engage-kill-switch') {
    if (!need('POST')) return;
    const scopeType = sanitize(b.scope_type, 30); if (!['global', 'portfolio_entity', 'org_unit', 'worker', 'model_provider'].includes(scopeType)) return bad(res, 422, 'Invalid scope_type.');
    const scopeId = scopeType === 'global' ? null : sanitize(b.scope_id, 60);
    if (scopeType !== 'global' && !scopeId) return bad(res, 422, 'scope_id is required for this scope_type.');
    const reason = sanitize(b.reason, 1000); if (reason.length < 5) return bad(res, 422, 'A real, specific reason is required to engage a kill switch.');
    const existing = await dbOne(`kill_switches?scope_type=eq.${enc(scopeType)}&${scopeId ? `scope_id=eq.${enc(scopeId)}` : 'scope_id=is.null'}&select=*`);
    let row;
    if (existing) [row] = await dbPatch('kill_switches', `id=eq.${enc(existing.id)}`, { engaged: true, reason, engaged_by: caller.id, engaged_at: nowIso(), updated_at: nowIso() });
    else ({ row } = await dbInsert('kill_switches', { scope_type: scopeType, scope_id: scopeId, engaged: true, reason, engaged_by: caller.id, engaged_at: nowIso() }));
    await audit(caller, 'kill_switch', row.id, 'engaged', { scope_type: scopeType, scope_id: scopeId });
    await recordDecision({ decisionType: 'kill_switch', subjectType: scopeType, subjectId: scopeId, decidedBy: caller.id, rationale: reason, outcome: 'activated' });
    return res.status(200).json({ ok: true, kill_switch: row });
  }
  if (op === 'disengage-kill-switch') {
    if (!need('POST')) return;
    const existing = await dbOne(`kill_switches?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!existing) return bad(res, 404, 'Not found');
    if (!existing.engaged) return res.status(200).json({ ok: true, kill_switch: existing });
    const reason = sanitize(b.reason, 1000); if (reason.length < 5) return bad(res, 422, 'Record why this is being restored.');
    const [row] = await dbPatch('kill_switches', `id=eq.${enc(existing.id)}`, { engaged: false, disengaged_by: caller.id, disengaged_at: nowIso(), updated_at: nowIso() });
    await audit(caller, 'kill_switch', existing.id, 'disengaged', {});
    await recordDecision({ decisionType: 'kill_switch', subjectType: existing.scope_type, subjectId: existing.scope_id, decidedBy: caller.id, rationale: reason, outcome: 'deactivated' });
    return res.status(200).json({ ok: true, kill_switch: row });
  }

  // ================================================================== decision records (read-only)
  if (op === 'decisions') {
    const subjectType = sanitize(req.query?.subject_type, 40);
    return res.status(200).json(await dbGet(`decision_records?${subjectType ? `subject_type=eq.${enc(subjectType)}&` : ''}order=created_at.desc&limit=200&select=*`));
  }

  return bad(res, 400, `Unknown governance operation: ${op}`);
});
