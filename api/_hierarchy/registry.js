// Nova organizational hierarchy — registry (Phase B). Reuses api/_sales/core.js's generic DB/auth/audit plumbing (it is not
// sales-specific despite its path — dbGet/dbInsert/requirePerm/audit/etc. are plain helpers). No second auth system, no second
// audit log, no second versioned-config mechanism: this reuses sales_config for CEO Twin / authority matrix / Model Council.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm, displayNameOf } from '../_sales/core.js';
import { canTransitionWorker, assignmentProblems, normalizeCeoTwinPolicy, ceoTwinReadiness, isSelfApproval, selfApprovalPolicy } from './rules.js';
import { fingerprintPolicy, checkSelfApprovalReauth, isActiveOwner } from './governance.js';

async function policy(key) {
  const [approved, pending] = await Promise.all([dbOne(`sales_config?key=eq.${enc(key)}&status=eq.approved&select=*`), dbOne(`sales_config?key=eq.${enc(key)}&status=in.(draft,pending_approval)&order=version.desc&select=*`)]);
  const row = approved || pending;
  return { row, provisional: !approved, status: approved ? 'approved' : (pending?.status || 'none') };
}

export const handleHierarchy = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['create-portfolio-entity', 'set-portfolio-status', 'create-org-unit', 'create-position', 'create-worker', 'set-worker-status', 'assign-executive', 'save-ceo-twin-policy', 'approve-ceo-twin-policy', 'save-authority-matrix', 'approve-authority-matrix'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'command.owner' : 'command.view'); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;

  // ================================================================== read (command.view)
  if (op === 'portfolio') return res.status(200).json(await dbGet('portfolio_entities?order=created_at.asc&select=*'));
  if (op === 'org-units') return res.status(200).json(await dbGet('org_units?order=unit_type.asc,name.asc&select=*'));
  if (op === 'positions') {
    const rows = await dbGet('positions?order=authority_level.asc,title.asc&select=*,executive_assignments(id,worker_id,fill_type,assigned_at,unassigned_at,portfolio_entity_id)');
    for (const p of rows) p.executive_assignments = (p.executive_assignments || []).filter((a) => !a.unassigned_at);
    return res.status(200).json(rows);
  }
  if (op === 'workers') {
    const rows = await dbGet('workers?order=created_at.asc&select=*,positions(title,authority_level,position_type),org_units(name)');
    const out = []; for (const w of rows) out.push({ ...w, email: w.staff_user_id ? (await displayNameOf(w.staff_user_id)) : null });
    return res.status(200).json(out);
  }
  if (op === 'worker') {
    const w = await dbOne(`workers?id=eq.${enc(sanitize(req.query?.id, 60))}&select=*,positions(title,authority_level,position_type,is_reserved),org_units(name)`); if (!w) return bad(res, 404, 'Worker not found');
    const events = await dbGet(`worker_status_events?worker_id=eq.${enc(w.id)}&order=created_at.desc&select=*`);
    return res.status(200).json({ worker: w, status_history: events });
  }
  if (op === 'ceo-twin') { const p = await policy('ceo_twin_policy'); const value = normalizeCeoTwinPolicy(p.row?.value); return res.status(200).json({ policy: value, provisional: p.provisional, status: p.status, version: p.row?.version || 0, config_id: p.row?.id || null, readiness: ceoTwinReadiness(value) }); }
  if (op === 'authority-matrix') { const p = await policy('authority_matrix'); return res.status(200).json({ matrix: p.row?.value || {}, provisional: p.provisional, status: p.status, version: p.row?.version || 0, config_id: p.row?.id || null }); }
  if (op === 'model-council') { const p = await policy('model_council'); return res.status(200).json({ config: p.row?.value || { providers: {}, fallback_order: [] }, provisional: p.provisional, status: p.status }); }

  // ================================================================== owner-only writes
  if (op === 'create-portfolio-entity') {
    if (!need('POST')) return;
    const key = sanitize(b.key, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-'); const name = sanitize(b.name, 200);
    const entityType = ['owned_company', 'internal_project', 'managed_client', 'pilot_client', 'experimental_venture', 'partner', 'archived'].includes(b.entity_type) ? b.entity_type : null;
    if (!key || !name || !entityType) return bad(res, 422, 'key, name and a valid entity_type are required.');
    const ins = await dbInsert('portfolio_entities', { key, name, entity_type: entityType, industry: sanitize(b.industry, 200) || null, purpose: sanitize(b.purpose, 2000) || null, parent_entity_id: sanitize(b.parent_entity_id, 60) || null, created_by: caller.id });
    if (!ins.row) return bad(res, 409, 'That key is already in use.');
    await audit(caller, 'portfolio_entity', ins.row.id, 'created', { key });
    return res.status(200).json({ ok: true, entity: ins.row });
  }
  if (op === 'set-portfolio-status') {
    if (!need('POST')) return;
    const entity = await dbOne(`portfolio_entities?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!entity) return bad(res, 404, 'Not found');
    const to = sanitize(b.status, 20); if (!['planned', 'active', 'paused', 'closed'].includes(to)) return bad(res, 422, 'Invalid status.');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why.');
    const patch = { status: to }; if (to === 'active') patch.activated_at = nowIso(); if (to === 'paused') patch.paused_at = nowIso(); if (to === 'closed') patch.closed_at = nowIso();
    const [row] = await dbPatch('portfolio_entities', `id=eq.${enc(entity.id)}`, patch);
    await dbInsert('portfolio_status_events', { portfolio_entity_id: entity.id, from_status: entity.status, to_status: to, changed_by: caller.id, reason });
    await audit(caller, 'portfolio_entity', entity.id, 'status_changed', { from: entity.status, to, reason });
    return res.status(200).json({ ok: true, entity: row });
  }
  if (op === 'create-org-unit') {
    if (!need('POST')) return;
    const key = sanitize(b.key, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-'); const name = sanitize(b.name, 200);
    const unitType = ['department', 'committee', 'shared_service'].includes(b.unit_type) ? b.unit_type : null;
    if (!key || !name || !unitType) return bad(res, 422, 'key, name and a valid unit_type are required.');
    const ins = await dbInsert('org_units', { portfolio_entity_id: sanitize(b.portfolio_entity_id, 60) || null, key, name, unit_type: unitType, parent_unit_id: sanitize(b.parent_unit_id, 60) || null, mission: sanitize(b.mission, 1000) || null }, { onConflict: 'portfolio_entity_id,key' });
    if (!ins.row) return bad(res, 409, 'That key already exists for this scope.');
    await audit(caller, 'org_unit', ins.row.id, 'created', { key }); return res.status(200).json({ ok: true, unit: ins.row });
  }
  if (op === 'create-position') {
    if (!need('POST')) return;
    const key = sanitize(b.key, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-'); const title = sanitize(b.title, 200);
    const level = Number(b.authority_level); const type = ['owner', 'aura_control_seat', 'ceo_twin', 'model_council_seat', 'executive', 'worker', 'shared_service'].includes(b.position_type) ? b.position_type : null;
    if (!key || !title || !type || !Number.isInteger(level) || level < 0 || level > 6) return bad(res, 422, 'key, title, a valid position_type and authority_level (0-6) are required.');
    if (['aura_control_seat'].includes(type) && b.is_reserved === false) return bad(res, 422, 'The Aura Control Seat position type must stay reserved.');
    const ins = await dbInsert('positions', { portfolio_entity_id: sanitize(b.portfolio_entity_id, 60) || null, org_unit_id: sanitize(b.org_unit_id, 60) || null, key, title, authority_level: level, position_type: type, is_reserved: !!b.is_reserved, reserved_reason: b.is_reserved ? sanitize(b.reserved_reason, 500) || null : null }, { onConflict: 'portfolio_entity_id,key' });
    if (!ins.row) return bad(res, 409, 'That key already exists for this scope.');
    await audit(caller, 'position', ins.row.id, 'created', { key }); return res.status(200).json({ ok: true, position: ins.row });
  }
  if (op === 'create-worker') {
    if (!need('POST')) return;
    const displayName = sanitize(b.display_name, 200); const type = ['human', 'ai', 'hybrid', 'service_account'].includes(b.worker_type) ? b.worker_type : null;
    if (!displayName || !type) return bad(res, 422, 'display_name and a valid worker_type are required.');
    if (type === 'human' && !sanitize(b.staff_user_id, 60)) return bad(res, 422, 'A human worker needs a real staff_user_id (an existing account) — Nova never invents a second identity.');
    const ins = await dbInsert('workers', {
      portfolio_entity_id: sanitize(b.portfolio_entity_id, 60) || null, org_unit_id: sanitize(b.org_unit_id, 60) || null, position_id: sanitize(b.position_id, 60) || null,
      worker_type: type, staff_user_id: type === 'human' ? sanitize(b.staff_user_id, 60) : null, display_name: displayName, manager_worker_id: sanitize(b.manager_worker_id, 60) || null,
      model_provider: ['ai', 'hybrid'].includes(type) && ['chatgpt', 'claude', 'gemini'].includes(b.model_provider) ? b.model_provider : null,
      mission: sanitize(b.mission, 1000) || null, responsibilities: sanitize(b.responsibilities, 2000) || null, created_by: caller.id,
    });
    if (!ins.row) return bad(res, 409, 'That person already has an active worker record, or another conflict occurred.');
    await audit(caller, 'worker', ins.row.id, 'created', { worker_type: type }); return res.status(200).json({ ok: true, worker: ins.row });
  }
  if (op === 'set-worker-status') {
    if (!need('POST')) return;
    const worker = await dbOne(`workers?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!worker) return bad(res, 404, 'Worker not found');
    const to = sanitize(b.status, 20); if (!canTransitionWorker(worker.status, to)) return bad(res, 409, `A ${worker.status} worker cannot become ${to}.`);
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why.');
    const [row] = await dbPatch('workers', `id=eq.${enc(worker.id)}&status=eq.${enc(worker.status)}`, { status: to, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This worker just changed.');
    await dbInsert('worker_status_events', { worker_id: worker.id, from_status: worker.status, to_status: to, changed_by: caller.id, reason });
    await audit(caller, 'worker', worker.id, 'status_changed', { from: worker.status, to, reason });
    return res.status(200).json({ ok: true, worker: row });
  }
  if (op === 'assign-executive') {
    if (!need('POST')) return;
    const position = await dbOne(`positions?id=eq.${enc(sanitize(b.position_id, 60))}&select=*`); if (!position) return bad(res, 404, 'Position not found');
    const fillType = sanitize(b.fill_type, 20);
    const worker = b.worker_id ? await dbOne(`workers?id=eq.${enc(sanitize(b.worker_id, 60))}&select=*`) : null;
    const problems = assignmentProblems({ position, worker, fillType }); if (problems.length) return res.status(422).json({ error: problems[0], problems });
    const portfolioEntityId = sanitize(b.portfolio_entity_id, 60) || null;
    const reason = sanitize(b.reason, 500);
    const current = await dbOne(`executive_assignments?position_id=eq.${enc(position.id)}&unassigned_at=is.null${portfolioEntityId ? `&portfolio_entity_id=eq.${enc(portfolioEntityId)}` : '&portfolio_entity_id=is.null'}&select=*`);
    if (current) await dbPatch('executive_assignments', `id=eq.${enc(current.id)}&unassigned_at=is.null`, { unassigned_at: nowIso() });
    const ins = await dbInsert('executive_assignments', { position_id: position.id, portfolio_entity_id: portfolioEntityId, worker_id: worker?.id || null, fill_type: fillType, assigned_by: caller.id, reason: reason || null });
    if (!ins.row) return bad(res, 409, 'Someone just changed this assignment — reload and try again.');
    if (worker) await dbPatch('workers', `id=eq.${enc(worker.id)}`, { position_id: position.id, updated_at: nowIso() });
    await audit(caller, 'executive_assignment', ins.row.id, 'assigned', { position: position.key, fill_type: fillType, worker: worker?.id || null });
    return res.status(200).json({ ok: true, assignment: ins.row });
  }
  if (op === 'save-ceo-twin-policy') {
    if (!need('POST')) return;
    const value = normalizeCeoTwinPolicy(b.policy || {}); const last = await dbOne('sales_config?key=eq.ceo_twin_policy&order=version.desc&select=version');
    const ins = await dbInsert('sales_config', { key: 'ceo_twin_policy', version: (last?.version || 0) + 1, status: 'pending_approval', value, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, 'ceo_twin_policy', ins.row.id, 'proposed', {}); return res.status(200).json({ ok: true, config: ins.row });
  }
  if (op === 'approve-ceo-twin-policy') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that this is the CEO Twin policy you are approving.');
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.ceo_twin_policy&select=*`); if (!cfg) return bad(res, 404, 'Not found');
    if (cfg.status === 'approved') return res.status(200).json({ ok: true }); // idempotent — already approved, no reauth needed to no-op
    // Server-enforced, not just "only owners can reach this endpoint": a DIFFERENT owner-level account may
    // approve directly; the SAME account that drafted it may approve only via the reauth protocol below —
    // Isaac remains the final authority and a single-owner company is never forced to fake a second account.
    const policy = selfApprovalPolicy({ isSelfApproval: isSelfApproval(cfg.created_by, caller.id), drafterIsOwner: await isActiveOwner(cfg.created_by) });
    if (policy === 'blocked') return bad(res, 403, 'The account that drafted this policy version cannot also approve it — have an owner approve it instead.');
    if (policy === 'requires_reauth') {
      const reauth = await checkSelfApprovalReauth({ staffUserId: caller.id, fingerprint: fingerprintPolicy(cfg.value) });
      if (!reauth.ok) return res.status(428).json({ error: 'You drafted this policy version yourself. Call governance?op=confirm-reauth (real password re-verification, a written reason, and the exact content fingerprint) before approving it.', requires: 'confirm-reauth' });
    }
    await dbPatch('sales_config', 'key=eq.ceo_twin_policy&status=eq.approved', { status: 'retired' }); await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() }); await audit(caller, 'ceo_twin_policy', cfg.id, 'approved', {});
    return res.status(200).json({ ok: true });
  }
  if (op === 'save-authority-matrix' || op === 'save-model-council') {
    if (!need('POST')) return;
    const key = op === 'save-authority-matrix' ? 'authority_matrix' : 'model_council';
    const value = b.value && typeof b.value === 'object' ? b.value : {};
    const last = await dbOne(`sales_config?key=eq.${key}&order=version.desc&select=version`);
    const ins = await dbInsert('sales_config', { key, version: (last?.version || 0) + 1, status: 'pending_approval', value, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, key, ins.row.id, 'proposed', {}); return res.status(200).json({ ok: true, config: ins.row });
  }
  if (op === 'approve-authority-matrix') {
    if (!need('POST')) return;
    if (b.confirm !== true) return bad(res, 422, 'Confirm that these are the authority rules Nova will enforce.');
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.authority_matrix&select=*`); if (!cfg) return bad(res, 404, 'Not found');
    if (cfg.status === 'approved') return res.status(200).json({ ok: true });
    const policy = selfApprovalPolicy({ isSelfApproval: isSelfApproval(cfg.created_by, caller.id), drafterIsOwner: await isActiveOwner(cfg.created_by) });
    if (policy === 'blocked') return bad(res, 403, 'The account that drafted this matrix version cannot also approve it — have an owner approve it instead.');
    if (policy === 'requires_reauth') {
      const reauth = await checkSelfApprovalReauth({ staffUserId: caller.id, fingerprint: fingerprintPolicy(cfg.value) });
      if (!reauth.ok) return res.status(428).json({ error: 'You drafted this matrix version yourself. Call governance?op=confirm-reauth before approving it.', requires: 'confirm-reauth' });
    }
    await dbPatch('sales_config', 'key=eq.authority_matrix&status=eq.approved', { status: 'retired' }); await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() }); await audit(caller, 'authority_matrix', cfg.id, 'approved', {});
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown hierarchy operation: ${op}`);
});
