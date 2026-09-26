// Sales Team management: representative roster, activation checklist, owner-only activation/suspension, manager assignment, notes.
// Training completion NEVER activates anyone. Activation = explicit owner action that re-derives the checklist from stored facts.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, inList, nowIso, audit, bad, wrap, requirePerm, isOwner, visibleRepUserIds, displayNameOf, notify, authUserById, userHasPerm } from './core.js';
import { documentStatesFor } from './documents.js';
import { DEFAULT_ACTIVATION_POLICY, normalizeActivationPolicy, buildChecklist, REP_TRANSITIONS } from './documentRules.js';

export async function activationPolicy() {
  const [approved, pending] = await Promise.all([dbOne('sales_config?key=eq.activation_policy&status=eq.approved&select=*'), dbOne('sales_config?key=eq.activation_policy&status=in.(draft,pending_approval)&order=version.desc&select=*')]);
  if (approved) return { policy: normalizeActivationPolicy(approved.value), provisional: false, version: approved.version, config_id: approved.id };
  return { policy: normalizeActivationPolicy(pending?.value || DEFAULT_ACTIVATION_POLICY), provisional: true, version: pending?.version || 0, config_id: pending?.id || null, status: pending?.status || 'default' };
}

export async function checklistFor(rep) {
  const [{ policy, provisional }, programs, enrollments, application, docStates, activation] = await Promise.all([
    activationPolicy(), dbGet('academy_programs?select=id,slug,title,requires_practical&order=order_index.asc'), dbGet(`academy_enrollments?staff_user_id=eq.${enc(rep.user_id)}&select=program_id,status,practical_approved_at`),
    rep.application_id ? dbOne(`applications?id=eq.${enc(rep.application_id)}&select=id,status`) : null, documentStatesFor(rep.user_id), dbOne(`sales_activation_approvals?rep_id=eq.${enc(rep.id)}&order=approved_at.desc&select=id,approved_at`),
  ]);
  const approvedActivation = rep.status === 'active' || rep.status === 'suspended' ? activation : null;
  return { ...buildChecklist({ policy, rep, application, programs, enrollments, docStates, approvedActivation }), policy, policy_provisional: provisional };
}

const publicRep = (r) => ({ id: r.id, user_id: r.user_id, display_name: r.display_name, status: r.status, manager_user_id: r.manager_user_id, activated_at: r.activated_at, suspended_at: r.suspended_at, created_at: r.created_at });

export const handleSalesTeam = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['activate', 'suspend', 'reactivate', 'deactivate', 'set-manager', 'mark-setup', 'save-policy', 'approve-policy'];
  const perm = op === 'my-checklist' ? 'sales.onboarding' : ownerOps.includes(op) ? 'sales.owner' : 'sales.manage';
  const caller = await requirePerm(req, res, perm); if (!caller) return;
  if (!rateLimit(req, res, 90, 60_000)) return;

  if (op === 'my-checklist') {
    const rep = await dbOne(`sales_reps?user_id=eq.${enc(caller.id)}&select=*`); if (!rep) return bad(res, 404, 'No representative record.');
    const c = await checklistFor(rep);
    return res.status(200).json({ status: rep.status, items: c.items.map(({ key, label, done, detail }) => ({ key, label, done, detail })), ready: c.ready, note: 'Finishing training never activates an account. Nova activates you after every item is complete.' });
  }

  const scopeIds = await visibleRepUserIds(caller);
  const repOf = async (id) => {
    const rep = await dbOne(`sales_reps?id=eq.${enc(sanitize(id, 60))}&select=*`); if (!rep) { bad(res, 404, 'Representative not found'); return null; }
    if (scopeIds && !scopeIds.includes(rep.user_id)) { bad(res, 403, 'This representative is not on your team.'); return null; }
    return rep;
  };

  if (op === 'reps') {
    let q = 'sales_reps?order=created_at.desc&select=*&limit=500'; if (req.query?.status) q += `&status=eq.${enc(sanitize(req.query.status, 20))}`;
    if (scopeIds) q += scopeIds.length ? `&user_id=in.${inList(scopeIds)}` : '&user_id=eq.00000000-0000-0000-0000-000000000000';
    const reps = await dbGet(q); const out = [];
    for (const r of reps) { const c = await checklistFor(r); const u = await authUserById(r.user_id); out.push({ ...publicRep(r), email: u?.email || null, checklist_done: c.items.filter((i) => i.done).length, checklist_total: c.items.length, ready_for_activation: c.ready && r.status === 'candidate' }); }
    return res.status(200).json(out);
  }
  if (op === 'rep') {
    const rep = await repOf(req.query?.id); if (!rep) return;
    const [c, notes, history, u, application] = await Promise.all([checklistFor(rep), dbGet(`sales_rep_notes?rep_id=eq.${enc(rep.id)}&order=created_at.desc&select=*`), dbGet(`sales_rep_status_history?rep_id=eq.${enc(rep.id)}&order=created_at.desc&select=*`), authUserById(rep.user_id), rep.application_id ? dbOne(`applications?id=eq.${enc(rep.application_id)}&select=id,reference_code,status,submitted_at`) : null]);
    return res.status(200).json({ rep: { ...publicRep(rep), email: u?.email || null, operational_setup: rep.operational_setup, manager_notes: rep.manager_notes }, application, checklist: c, notes, status_history: history });
  }
  if (op === 'add-note') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    const note = sanitize(b.note, 2000); if (note.length < 3) return bad(res, 422, 'Write a note.');
    await dbInsert('sales_rep_notes', { rep_id: rep.id, author_id: caller.id, note });
    await audit(caller, 'sales_rep', rep.id, 'note_added', {});
    return res.status(200).json({ ok: true });
  }
  if (op === 'policy') {
    const [pol, versions] = await Promise.all([activationPolicy(), dbGet('sales_config?key=eq.activation_policy&order=version.desc&select=id,version,status,value,change_note,approved_at')]);
    return res.status(200).json({ current: pol, versions });
  }
  if (op === 'save-policy') {
    if (!need('POST')) return;
    const value = normalizeActivationPolicy(b.policy || {}); const last = await dbOne('sales_config?key=eq.activation_policy&order=version.desc&select=version');
    const ins = await dbInsert('sales_config', { key: 'activation_policy', version: (last?.version || 0) + 1, status: 'pending_approval', value, change_note: sanitize(b.change_note, 500) || null, created_by: caller.id });
    await audit(caller, 'activation_policy', ins.row.id, 'proposed', value); return res.status(200).json({ ok: true, config: ins.row });
  }
  if (op === 'approve-policy') {
    if (!need('POST')) return;
    const cfg = await dbOne(`sales_config?id=eq.${enc(sanitize(b.config_id, 60))}&key=eq.activation_policy&select=*`); if (!cfg) return bad(res, 404, 'Not found');
    if (cfg.status !== 'approved') { await dbPatch('sales_config', 'key=eq.activation_policy&status=eq.approved', { status: 'retired' }); await dbPatch('sales_config', `id=eq.${enc(cfg.id)}`, { status: 'approved', approved_by: caller.id, approved_at: nowIso() }); await audit(caller, 'activation_policy', cfg.id, 'approved', cfg.value); }
    return res.status(200).json({ ok: true });
  }

  // ------------------------------------------------------------------ owner-only state changes
  if (op === 'set-manager') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    const mid = b.manager_user_id ? sanitize(b.manager_user_id, 60) : null;
    if (mid && !(await userHasPerm(mid, 'sales.manage'))) return bad(res, 422, 'That person is not an active sales manager.');
    if (mid === rep.user_id) return bad(res, 422, 'A representative cannot manage themselves.');
    await dbPatch('sales_reps', `id=eq.${enc(rep.id)}`, { manager_user_id: mid, updated_at: nowIso() });
    await audit(caller, 'sales_rep', rep.id, 'manager_assigned', { from: rep.manager_user_id, to: mid }); return res.status(200).json({ ok: true });
  }
  if (op === 'mark-setup') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    const { policy } = await activationPolicy(); const key = sanitize(b.item_key, 40);
    if (!policy.operational_items.some((i) => i.key === key)) return bad(res, 422, 'That is not a configured setup item.');
    const done = b.done !== false; const evidence = sanitize(b.evidence, 500);
    if (done && evidence.length < 5) return bad(res, 422, 'Record the evidence (what you checked and how).');
    const setup = { ...(rep.operational_setup || {}), [key]: done ? { done: true, evidence, by: caller.id, at: nowIso() } : { done: false } };
    await dbPatch('sales_reps', `id=eq.${enc(rep.id)}`, { operational_setup: setup, updated_at: nowIso() });
    await audit(caller, 'sales_rep', rep.id, done ? 'setup_verified' : 'setup_unchecked', { item: key, evidence }); return res.status(200).json({ ok: true });
  }
  const setStatus = async (rep, to, reason) => {
    if (!REP_TRANSITIONS[rep.status]?.includes(to)) { bad(res, 409, `A ${rep.status} representative cannot become ${to}.`); return null; }
    const [row] = await dbPatch('sales_reps', `id=eq.${enc(rep.id)}&status=eq.${enc(rep.status)}`, { status: to, updated_at: nowIso(), ...(to === 'suspended' ? { suspended_at: nowIso(), suspended_by: caller.id, suspension_reason: reason } : {}), ...(to === 'active' ? { suspended_at: null, suspension_reason: null } : {}) });
    if (!row) { bad(res, 409, 'The status just changed.'); return null; }
    await dbInsert('sales_rep_status_history', { rep_id: rep.id, from_status: rep.status, to_status: to, changed_by: caller.id, reason });
    return row;
  };
  const setMembership = async (rep, patch) => { const r = await dbPatch('organization_members', `staff_user_id=eq.${enc(rep.user_id)}&organization_id=eq.${enc(rep.organization_id)}`, patch); return r.length > 0; };

  if (op === 'activate') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    if (rep.user_id === caller.id) return bad(res, 403, 'You cannot activate your own account.');
    if (rep.status !== 'candidate') return bad(res, 409, `This representative is ${rep.status}, not a candidate.`);
    const c = await checklistFor(rep);
    if (!c.ready) return res.status(409).json({ error: 'The activation checklist is not complete.', outstanding: c.items.filter((i) => !i.done && i.key !== 'owner_approval').map((i) => ({ key: i.key, detail: i.detail })) });
    if (b.confirm !== true) return bad(res, 422, 'Confirm that you are approving this activation.');
    const before = await dbOne(`organization_members?staff_user_id=eq.${enc(rep.user_id)}&organization_id=eq.${enc(rep.organization_id)}&select=role,status`);
    if (!before) return bad(res, 409, 'This person has no membership to activate.');
    if (!(await setMembership(rep, { role: 'nova_sales', status: 'active' }))) return bad(res, 500, 'Could not change access.');
    let row; try { row = await setStatus(rep, 'active', 'activated'); } catch (e) { await setMembership(rep, { role: before.role, status: before.status }); throw e; }
    if (!row) { await setMembership(rep, { role: before.role, status: before.status }); return; }
    await dbPatch('sales_reps', `id=eq.${enc(rep.id)}`, { activated_at: nowIso(), activated_by: caller.id });
    await dbInsert('sales_activation_approvals', { rep_id: rep.id, approved_by: caller.id, checklist_snapshot: { items: c.items, policy: c.policy, policy_provisional: c.policy_provisional }, notes: sanitize(b.notes, 500) || null });
    await audit(caller, 'sales_rep', rep.id, 'activated', { role_from: before.role, role_to: 'nova_sales', policy_provisional: c.policy_provisional });
    const au = await authUserById(rep.user_id);
    await notify({ userId: rep.user_id, email: au?.email, kind: 'rep_activated', subject: 'Your Nova sales account is active', body: 'Nova has activated your representative account. Sign in to open your workspace.', link: '/rep', channels: ['in_app', 'email'], idempotencyKey: `activated:${rep.id}:${Date.now()}` });
    return res.status(200).json({ ok: true });
  }
  if (op === 'suspend' || op === 'deactivate') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    if (rep.user_id === caller.id) return bad(res, 403, 'You cannot change your own status.');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record the reason.');
    const to = op === 'suspend' ? 'suspended' : 'inactive';
    const row = await setStatus(rep, to, reason); if (!row) return;
    await setMembership(rep, { status: 'inactive' }); // same lever team.js uses for deactivation → requireStaff rejects the next request
    await audit(caller, 'sales_rep', rep.id, op === 'suspend' ? 'suspended' : 'deactivated', { reason });
    return res.status(200).json({ ok: true, note: 'History, leads and ledger entries are kept. Reassign any open leads from the Leads view.' });
  }
  if (op === 'reactivate') {
    if (!need('POST')) return;
    const rep = await repOf(b.rep_id); if (!rep) return;
    if (rep.status !== 'suspended') return bad(res, 409, 'Only a suspended representative can be reactivated.');
    const reason = sanitize(b.reason, 500); if (reason.length < 5) return bad(res, 422, 'Record why access is restored.');
    const c = await checklistFor({ ...rep, status: 'active' });
    if (!c.ready) return res.status(409).json({ error: 'Something required has lapsed (for example a re-sign). Resolve it first.', outstanding: c.items.filter((i) => !i.done && i.key !== 'owner_approval').map((i) => ({ key: i.key, detail: i.detail })) });
    const row = await setStatus(rep, 'active', reason); if (!row) return;
    await setMembership(rep, { role: 'nova_sales', status: 'active' });
    await audit(caller, 'sales_rep', rep.id, 'reactivated', { reason });
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown salesteam operation: ${op}`);
});
void displayNameOf;
