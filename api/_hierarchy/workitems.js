// Nova organizational hierarchy — work & reporting (Phase D): the durable work-item lifecycle,
// truthful worker presence, evidence/output/review, Venture Lab stage, Owner Brief/Executive
// Packet generation, and operational memory. Same plumbing as registry.js/governance.js.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm } from '../_sales/core.js';
import { canTransitionWorkItem, isWorkerActuallyWorking, workItemReviewProblems, isSelfApproval, killSwitchBlocks, ventureTransitionAllowed, ventureOverrideProblems } from './rules.js';
import { killSwitchStateFor } from './governance.js';
import { checkAuthority } from './authority.js';

async function recordDecision({ decisionType, subjectType, subjectId, decidedBy, rationale, outcome }) {
  await dbInsert('decision_records', { decision_type: decisionType, subject_type: subjectType, subject_id: subjectId || null, decided_by: decidedBy, rationale, outcome });
}

// The one true "is this worker working right now" answer — always re-checked against the linked
// work item's CURRENT status, never trusted from a possibly-stale heartbeat row alone.
async function presenceFor(workerId) {
  const heartbeat = await dbOne(`worker_heartbeats?worker_id=eq.${enc(workerId)}&order=created_at.desc&select=*`);
  let workItemStatus = null;
  if (heartbeat?.work_item_id) { const wi = await dbOne(`work_items?id=eq.${enc(heartbeat.work_item_id)}&select=status`); workItemStatus = wi?.status || null; }
  const working = isWorkerActuallyWorking({ heartbeat, workItemStatus, now: new Date() });
  return { working, heartbeat: heartbeat || null, work_item_status: workItemStatus };
}

export const handleWorkItems = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['create-work-item', 'assign-work-item', 'start-work-item', 'block-work-item', 'add-evidence', 'add-output', 'submit-for-review', 'review-work-item', 'complete-work-item', 'cancel-work-item', 'fail-work-item', 'heartbeat', 'set-venture-stage', 'save-venture-data', 'generate-brief', 'save-memory'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'command.owner' : 'command.view'); if (!caller) return;
  if (!rateLimit(req, res, 120, 60_000)) return;

  // ================================================================== work items: reads
  if (op === 'work-items') {
    const status = sanitize(req.query?.status, 20); const workerId = sanitize(req.query?.worker_id, 60);
    const filters = [status && `status=eq.${enc(status)}`, workerId && `worker_id=eq.${enc(workerId)}`].filter(Boolean).join('&');
    return res.status(200).json(await dbGet(`work_items?${filters ? `${filters}&` : ''}order=created_at.desc&select=*`));
  }
  if (op === 'work-item') {
    const id = sanitize(req.query?.id, 60); const wi = await dbOne(`work_items?id=eq.${enc(id)}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    const [events, evidence, outputs, reviews] = await Promise.all([
      dbGet(`work_item_events?work_item_id=eq.${enc(id)}&order=created_at.desc&select=*`),
      dbGet(`work_item_evidence?work_item_id=eq.${enc(id)}&order=created_at.desc&select=*`),
      dbGet(`work_item_outputs?work_item_id=eq.${enc(id)}&order=created_at.desc&select=*`),
      dbGet(`work_item_reviews?work_item_id=eq.${enc(id)}&order=created_at.desc&select=*`),
    ]);
    return res.status(200).json({ work_item: wi, events, evidence, outputs, reviews });
  }
  if (op === 'worker-presence') {
    const workerId = sanitize(req.query?.worker_id, 60); if (!workerId) return bad(res, 422, 'worker_id is required.');
    return res.status(200).json(await presenceFor(workerId));
  }

  // ================================================================== work items: writes
  if (op === 'create-work-item') {
    if (!need('POST')) return;
    const title = sanitize(b.title, 300); if (!title) return bad(res, 422, 'title is required.');
    // Authority Matrix gate — additive, on top of the command.owner permission check above (see
    // api/_hierarchy/authority.js: this can only narrow what's allowed, never widen it).
    const authz = await checkAuthority({ actor: caller, action: 'create_internal_task' });
    if (!authz.allowed) return res.status(403).json({ error: authz.reason, authority_label: authz.label });
    const ins = await dbInsert('work_items', { portfolio_entity_id: sanitize(b.portfolio_entity_id, 60) || null, org_unit_id: sanitize(b.org_unit_id, 60) || null, title, description: sanitize(b.description, 4000) || null, category: sanitize(b.category, 60) || 'general', due_at: b.due_at || null, created_by: caller.id });
    await dbInsert('work_item_events', { work_item_id: ins.row.id, from_status: null, to_status: 'draft', changed_by: caller.id, reason: 'Created' });
    await audit(caller, 'work_item', ins.row.id, 'created', {});
    return res.status(200).json({ ok: true, work_item: ins.row });
  }
  if (op === 'assign-work-item') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, 'assigned')) return bad(res, 409, `Cannot assign a ${wi.status} work item.`);
    const worker = await dbOne(`workers?id=eq.${enc(sanitize(b.worker_id, 60))}&select=*`); if (!worker) return bad(res, 404, 'Worker not found');
    if (worker.status !== 'active' && worker.status !== 'restricted') return bad(res, 422, `A ${worker.status} worker cannot be assigned work.`);
    const killed = killSwitchBlocks(await killSwitchStateFor(worker)); if (killed.blocked) return bad(res, 423, `This worker is paused (kill switch engaged at the ${killed.scope} level) and cannot be assigned new work.`);
    const authz = await checkAuthority({ actor: caller, action: 'reassign_routine_task', workerId: worker.id });
    if (!authz.allowed) return res.status(403).json({ error: authz.reason, authority_label: authz.label });
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: 'assigned', worker_id: worker.id, assigned_at: nowIso(), updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This work item just changed.');
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: 'assigned', changed_by: caller.id, reason: `Assigned to worker ${worker.id}` });
    await audit(caller, 'work_item', wi.id, 'assigned', { worker_id: worker.id });
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'start-work-item') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, 'in_progress')) return bad(res, 409, `Cannot start a ${wi.status} work item.`);
    if (wi.worker_id) {
      const assignedWorker = await dbOne(`workers?id=eq.${enc(wi.worker_id)}&select=*`);
      const killed = killSwitchBlocks(await killSwitchStateFor(assignedWorker)); if (killed.blocked) return bad(res, 423, `The assigned worker is paused (kill switch engaged at the ${killed.scope} level) and cannot start work.`);
    }
    const patch = { status: 'in_progress', updated_at: nowIso() }; if (!wi.started_at) patch.started_at = nowIso();
    // Real durable-queue integration: a 'url_check' work item's execution is handed to the SAME
    // canonical jobs queue every other scheduled/background need in this codebase shares (see
    // supabase/durable-jobs-migration-standalone.sql) — never a second, competing queue. The
    // worker/index.mjs 'hierarchy_work_item_check' handler claims it, does the real (non-AI,
    // non-fabricated) work, emits real heartbeats, attaches real evidence/output, and advances the
    // work item to in_review — a durable worker performing a real supervised job, not just a direct
    // API state transition. Every other category keeps advancing via supervised API calls only.
    if (wi.category === 'url_check' && !wi.job_id) {
      const jobIns = await dbInsert('jobs', { job_type: 'hierarchy_work_item_check', payload: { work_item_id: wi.id, worker_id: wi.worker_id, url: wi.description }, idempotency_key: `hierarchy_wi:${wi.id}` }, { onConflict: 'idempotency_key' });
      if (jobIns.row) patch.job_id = jobIns.row.id;
    }
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, patch);
    if (!row) return bad(res, 409, 'This work item just changed.');
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: 'in_progress', changed_by: caller.id, reason: sanitize(b.reason, 500) || null });
    await audit(caller, 'work_item', wi.id, 'started', {});
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'block-work-item' || op === 'fail-work-item') {
    if (!need('POST')) return;
    const to = op === 'block-work-item' ? 'blocked' : 'failed';
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, to)) return bad(res, 409, `Cannot mark a ${wi.status} work item as ${to}.`);
    const reason = sanitize(b.reason, 1000); if (reason.length < 5) return bad(res, 422, 'Record a real reason.');
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: to, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This work item just changed.');
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: to, changed_by: caller.id, reason });
    await audit(caller, 'work_item', wi.id, to, { reason });
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'add-evidence') {
    if (!need('POST')) return;
    const workItemId = sanitize(b.work_item_id, 60); const wi = workItemId && await dbOne(`work_items?id=eq.${enc(workItemId)}&select=id`);
    if (!wi) return bad(res, 404, 'Work item not found');
    const source = sanitize(b.source, 1000); const observation = sanitize(b.observation, 4000);
    if (!source || !observation) return bad(res, 422, 'source and observation are both required.');
    const ins = await dbInsert('work_item_evidence', { work_item_id: workItemId, source, observation, collected_by: caller.id });
    await audit(caller, 'work_item_evidence', ins.row.id, 'added', { work_item_id: workItemId });
    return res.status(200).json({ ok: true, evidence: ins.row });
  }
  if (op === 'add-output') {
    if (!need('POST')) return;
    const workItemId = sanitize(b.work_item_id, 60); const wi = workItemId && await dbOne(`work_items?id=eq.${enc(workItemId)}&select=id`);
    if (!wi) return bad(res, 404, 'Work item not found');
    const content = b.content && typeof b.content === 'object' ? b.content : (typeof b.content === 'string' && b.content.trim() ? { text: sanitize(b.content, 20000) } : null);
    if (!content) return bad(res, 422, 'content is required.');
    const ins = await dbInsert('work_item_outputs', { work_item_id: workItemId, content, produced_by: caller.id });
    await audit(caller, 'work_item_output', ins.row.id, 'added', { work_item_id: workItemId });
    return res.status(200).json({ ok: true, output: ins.row });
  }
  if (op === 'submit-for-review') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, 'in_review')) return bad(res, 409, `Cannot submit a ${wi.status} work item for review.`);
    const [evidenceCount, outputCount] = await Promise.all([
      dbGet(`work_item_evidence?work_item_id=eq.${enc(wi.id)}&select=id`).then((r) => r.length),
      dbGet(`work_item_outputs?work_item_id=eq.${enc(wi.id)}&select=id`).then((r) => r.length),
    ]);
    const problems = workItemReviewProblems({ workItem: wi, evidenceCount, outputCount }); if (problems.length) return res.status(422).json({ error: problems[0], problems });
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: 'in_review', updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This work item just changed.');
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: 'in_review', changed_by: caller.id, reason: null });
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'review-work-item') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (wi.status !== 'in_review') return bad(res, 409, `Cannot review a ${wi.status} work item.`);
    const decision = sanitize(b.decision, 30); if (!['approved', 'rejected', 'changes_requested'].includes(decision)) return bad(res, 422, 'Invalid decision.');
    const notes = sanitize(b.notes, 2000); if (notes.length < 5) return bad(res, 422, 'Record real review notes.');
    if (wi.worker_id) {
      const worker = await dbOne(`workers?id=eq.${enc(wi.worker_id)}&select=staff_user_id`);
      if (worker?.staff_user_id && isSelfApproval(worker.staff_user_id, caller.id)) return bad(res, 403, 'The worker who produced this output cannot also review it.');
    }
    const to = decision === 'approved' ? 'approved' : 'rejected';
    if (!canTransitionWorkItem(wi.status, to)) return bad(res, 409, `Cannot transition from ${wi.status} to ${to}.`);
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: to, updated_at: nowIso() });
    await dbInsert('work_item_reviews', { work_item_id: wi.id, reviewer_id: caller.id, decision, notes });
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: to, changed_by: caller.id, reason: notes });
    await audit(caller, 'work_item', wi.id, 'reviewed', { decision });
    await recordDecision({ decisionType: 'work_item_review', subjectType: 'work_item', subjectId: wi.id, decidedBy: caller.id, rationale: notes, outcome: decision });
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'complete-work-item') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, 'completed')) return bad(res, 409, `Cannot complete a ${wi.status} work item.`);
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: 'completed', completed_at: nowIso(), updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This work item just changed.');
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: 'completed', changed_by: caller.id, reason: null });
    await audit(caller, 'work_item', wi.id, 'completed', {});
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'cancel-work-item') {
    if (!need('POST')) return;
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (!canTransitionWorkItem(wi.status, 'cancelled')) return bad(res, 409, `Cannot cancel a ${wi.status} work item.`);
    const reason = sanitize(b.reason, 1000);
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&status=eq.${enc(wi.status)}`, { status: 'cancelled', updated_at: nowIso() });
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: 'cancelled', changed_by: caller.id, reason: reason || null });
    await audit(caller, 'work_item', wi.id, 'cancelled', {});
    return res.status(200).json({ ok: true, work_item: row });
  }
  if (op === 'heartbeat') {
    if (!need('POST')) return;
    const workerId = sanitize(b.worker_id, 60); const worker = workerId && await dbOne(`workers?id=eq.${enc(workerId)}&select=*`);
    if (!worker) return bad(res, 404, 'Worker not found');
    const status = sanitize(b.status, 20); if (!['working', 'idle', 'blocked'].includes(status)) return bad(res, 422, 'Invalid status.');
    if (status === 'working') { const killed = killSwitchBlocks(await killSwitchStateFor(worker)); if (killed.blocked) return bad(res, 423, `This worker is paused (kill switch engaged at the ${killed.scope} level) and cannot report as working.`); }
    const workItemId = sanitize(b.work_item_id, 60) || null;
    const ins = await dbInsert('worker_heartbeats', { worker_id: workerId, work_item_id: workItemId, status, note: sanitize(b.note, 500) || null });
    return res.status(200).json({ ok: true, heartbeat: ins.row, presence: await presenceFor(workerId) });
  }

  // ================================================================== Venture Lab
  if (op === 'set-venture-stage') {
    if (!need('POST')) return;
    const entity = await dbOne(`portfolio_entities?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!entity) return bad(res, 404, 'Not found');
    if (entity.entity_type !== 'experimental_venture') return bad(res, 422, 'Venture stage only applies to experimental_venture entities.');
    const to = sanitize(b.stage, 30); if (!['idea', 'research', 'zero_cost_validation', 'demand_signal', 'pre_sale', 'sandbox_mvp', 'pilot', 'scale', 'paused', 'killed', 'archived'].includes(to)) return bad(res, 422, 'Invalid stage.');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why.');
    if (to === 'killed' || to === 'archived') {
      const authz = await checkAuthority({ actor: caller, action: 'close_venture_experiment' });
      if (!authz.allowed) return res.status(403).json({ error: authz.reason, authority_label: authz.label });
    }
    const normal = ventureTransitionAllowed(entity.venture_stage, to);
    let evidence = null;
    if (!normal) {
      if (b.override !== true) return res.status(422).json({ error: `${entity.venture_stage || 'unset'} -> ${to} skips the normal Venture Lab lifecycle. Set override:true with real supporting evidence to make this an explicit, recorded owner decision — it is not silently refused forever, just never silent.`, requires: 'override' });
      evidence = sanitize(b.evidence, 4000);
      const problems = ventureOverrideProblems({ evidence }); if (problems.length) return res.status(422).json({ error: problems[0], problems });
    }
    const [row] = await dbPatch('portfolio_entities', `id=eq.${enc(entity.id)}`, { venture_stage: to });
    await dbInsert('venture_stage_events', { portfolio_entity_id: entity.id, from_stage: entity.venture_stage, to_stage: to, changed_by: caller.id, reason, override: !normal, evidence });
    await audit(caller, 'portfolio_entity', entity.id, 'venture_stage_changed', { from: entity.venture_stage, to, override: !normal });
    if (!normal) await recordDecision({ decisionType: 'venture_override', subjectType: 'portfolio_entity', subjectId: entity.id, decidedBy: caller.id, rationale: `${reason} — evidence: ${evidence}`, outcome: `${entity.venture_stage || 'unset'}->${to}` });
    return res.status(200).json({ ok: true, entity: row });
  }
  if (op === 'venture-data') {
    const id = sanitize(req.query?.id, 60); const entity = await dbOne(`portfolio_entities?id=eq.${enc(id)}&select=venture_data,entity_type`); if (!entity) return bad(res, 404, 'Not found');
    return res.status(200).json({ venture_data: entity.venture_data || {} });
  }
  if (op === 'save-venture-data') {
    if (!need('POST')) return;
    const entity = await dbOne(`portfolio_entities?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!entity) return bad(res, 404, 'Not found');
    if (entity.entity_type !== 'experimental_venture') return bad(res, 422, 'Venture data only applies to experimental_venture entities.');
    const allowed = ['hypothesis', 'customer', 'offer', 'budget', 'worker_hours', 'revenue_collected', 'costs', 'evidence', 'success_criteria', 'kill_criteria', 'lessons'];
    const patch = {}; for (const k of allowed) if (k in b) patch[k] = typeof b[k] === 'string' ? sanitize(b[k], 4000) : b[k];
    const merged = { ...(entity.venture_data || {}), ...patch };
    const [row] = await dbPatch('portfolio_entities', `id=eq.${enc(entity.id)}`, { venture_data: merged });
    await audit(caller, 'portfolio_entity', entity.id, 'venture_data_updated', { fields: Object.keys(patch) });
    return res.status(200).json({ ok: true, venture_data: row.venture_data });
  }

  // ================================================================== Owner Brief / Weekly Packet
  if (op === 'briefs') return res.status(200).json(await dbGet('owner_briefs?order=generated_at.desc&limit=50&select=*'));
  if (op === 'generate-brief') {
    if (!need('POST')) return;
    const briefType = sanitize(b.brief_type, 10); if (!['daily', 'weekly'].includes(briefType)) return bad(res, 422, 'brief_type must be daily or weekly.');
    const periodEnd = new Date(); const periodStart = new Date(periodEnd.getTime() - (briefType === 'daily' ? 1 : 7) * 24 * 60 * 60 * 1000);
    const sinceFilter = `created_at=gte.${enc(periodStart.toISOString())}`;
    const [completedWork, openEscalations, engagedSwitches, decisions, workerCounts] = await Promise.all([
      dbGet(`work_items?status=eq.completed&${sinceFilter}&select=id`),
      dbGet(`escalations?status=in.(open,routed)&select=id`),
      dbGet(`kill_switches?engaged=eq.true&select=id,scope_type`),
      dbGet(`decision_records?${sinceFilter}&select=decision_type,outcome`),
      dbGet('workers?select=status'),
    ]);
    const decisionsByType = {}; for (const d of decisions) decisionsByType[d.decision_type] = (decisionsByType[d.decision_type] || 0) + 1;
    const workersByStatus = {}; for (const w of workerCounts) workersByStatus[w.status] = (workersByStatus[w.status] || 0) + 1;
    const figure = (value, source) => ({ value, source, period: { start: periodStart.toISOString(), end: periodEnd.toISOString() }, verification_state: 'verified_from_database', last_updated: nowIso() });
    const content = {
      work_items_completed: figure(completedWork.length, 'work_items'),
      escalations_open: figure(openEscalations.length, 'escalations'),
      kill_switches_engaged: figure(engagedSwitches.length, 'kill_switches'),
      decisions_by_type: figure(Object.keys(decisionsByType).length ? decisionsByType : 'No verified data', 'decision_records'),
      workers_by_status: figure(Object.keys(workersByStatus).length ? workersByStatus : 'No verified data', 'workers'),
    };
    const ins = await dbInsert('owner_briefs', { brief_type: briefType, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), generated_by: caller.id, content });
    await audit(caller, 'owner_brief', ins.row.id, 'generated', { brief_type: briefType });
    return res.status(200).json({ ok: true, brief: ins.row });
  }

  // ================================================================== operational memory
  if (op === 'memory') {
    const scopeType = sanitize(req.query?.scope_type, 40); const scopeId = sanitize(req.query?.scope_id, 60); const key = sanitize(req.query?.key, 100);
    if (!scopeType || !key) return bad(res, 422, 'scope_type and key are required.');
    const row = await dbOne(`operational_memory?scope_type=eq.${enc(scopeType)}&${scopeId ? `scope_id=eq.${enc(scopeId)}` : 'scope_id=is.null'}&key=eq.${enc(key)}&status=eq.active&order=version.desc&select=*`);
    if (!row) return res.status(200).json({ memory: null, status: 'none' });
    const expired = row.expires_at && new Date(row.expires_at) < new Date();
    return res.status(200).json({ memory: row, status: expired ? 'expired' : 'active' });
  }
  if (op === 'save-memory') {
    if (!need('POST')) return;
    const scopeType = sanitize(b.scope_type, 40); const scopeId = sanitize(b.scope_id, 60) || null; const key = sanitize(b.key, 100);
    if (!scopeType || !key) return bad(res, 422, 'scope_type and key are required.');
    const content = b.content && typeof b.content === 'object' ? b.content : null; if (!content) return bad(res, 422, 'content is required.');
    const last = await dbOne(`operational_memory?scope_type=eq.${enc(scopeType)}&${scopeId ? `scope_id=eq.${enc(scopeId)}` : 'scope_id=is.null'}&key=eq.${enc(key)}&order=version.desc&select=version`);
    await dbPatch('operational_memory', `scope_type=eq.${enc(scopeType)}&${scopeId ? `scope_id=eq.${enc(scopeId)}` : 'scope_id=is.null'}&key=eq.${enc(key)}&status=eq.active`, { status: 'superseded' });
    const ins = await dbInsert('operational_memory', { scope_type: scopeType, scope_id: scopeId, key, version: (last?.version || 0) + 1, content, source_type: sanitize(b.source_type, 40) || null, source_id: sanitize(b.source_id, 60) || null, created_by: caller.id, expires_at: b.expires_at || null });
    await audit(caller, 'operational_memory', ins.row.id, 'saved', { scope_type: scopeType, key });
    return res.status(200).json({ ok: true, memory: ins.row });
  }

  // ================================================================== global activity feed
  // A real, append-only-sourced merge across every existing hierarchy log — decision_records
  // (governance decisions), work_item_events (work lifecycle), venture_stage_events (Venture Lab),
  // and committee_meetings (opened/closed) — never a separate parallel log of its own. Filterable
  // by `since` (ISO timestamp) and `entity_type` (one of the tags below).
  if (op === 'activity-feed') {
    const since = typeof req.query?.since === 'string' && req.query.since ? req.query.since : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [decisions, workItemEvents, ventureEvents, meetings] = await Promise.all([
      dbGet(`decision_records?created_at=gte.${enc(since)}&order=created_at.desc&limit=100&select=*`),
      dbGet(`work_item_events?created_at=gte.${enc(since)}&order=created_at.desc&limit=100&select=*`),
      dbGet(`venture_stage_events?created_at=gte.${enc(since)}&order=created_at.desc&limit=100&select=*`),
      dbGet(`committee_meetings?opened_at=gte.${enc(since)}&order=opened_at.desc&limit=100&select=id,title,meeting_type,status,opened_at,opened_by,closed_at`),
    ]);
    const entries = [
      ...decisions.map((d) => ({ entity_type: 'decision', at: d.created_at, summary: `${d.decision_type} — ${d.outcome}`, detail: d.rationale, subject_type: d.subject_type, subject_id: d.subject_id })),
      ...workItemEvents.map((e) => ({ entity_type: 'work_item', at: e.created_at, summary: `Work item ${e.from_status || 'new'} -> ${e.to_status}`, detail: e.reason, subject_type: 'work_item', subject_id: e.work_item_id })),
      ...ventureEvents.map((e) => ({ entity_type: 'venture', at: e.created_at, summary: `Venture ${e.from_stage || 'unset'} -> ${e.to_stage}${e.override ? ' (override)' : ''}`, detail: e.reason, subject_type: 'portfolio_entity', subject_id: e.portfolio_entity_id })),
      ...meetings.map((m) => ({ entity_type: 'meeting', at: m.opened_at, summary: `${m.meeting_type === 'incident' ? 'Incident' : 'Meeting'} opened: ${m.title}`, detail: m.status, subject_type: 'meeting', subject_id: m.id })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
    const entityType = sanitize(req.query?.entity_type, 30);
    return res.status(200).json(entityType ? entries.filter((e) => e.entity_type === entityType) : entries);
  }

  return bad(res, 400, `Unknown work-item operation: ${op}`);
});
