// Nova hierarchy handoffs (master prompt §4): what each person must do next, results they must receive, and the
// escalation of unacknowledged or overdue work. Management by exception: routine work proceeds; a missed
// acknowledgment or deadline becomes an escalation routed to a named next person (the worker's escalation contact,
// else their manager, else the owner) and appears in that person's queue and inbox.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, bad, wrap, requirePerm, notify, usersWithRoles, isOwner } from '../_sales/core.js';

const OPEN = ['assigned', 'in_progress', 'blocked', 'in_review', 'approved'];

// Who handles an exception about this worker: escalation contact → manager → owner(s). Returns {worker, userIds, level}.
async function routeFor(worker) {
  for (const [field, level] of [['escalation_worker_id', 'manager'], ['manager_worker_id', 'manager']]) {
    const id = worker?.[field];
    const w = id && await dbOne(`workers?id=eq.${enc(id)}&select=id,staff_user_id,status,display_name`);
    if (w?.staff_user_id && ['active', 'restricted'].includes(w.status)) return { worker: w, userIds: [w.staff_user_id], level };
  }
  return { worker: null, userIds: (await usersWithRoles(['nova_super_admin'])).map((u) => u.id), level: 'owner' };
}

async function escalate({ wi, worker, cause, reason, now }) {
  const route = await routeFor(worker);
  const ins = await dbInsert('escalations', { subject_type: 'work_item', subject_id: wi.id, raised_by_worker_id: worker?.id || null, level: route.level, status: 'routed', reason, routed_to_worker_id: route.worker?.id || null, routed_to_user_id: route.userIds[0] || null, dedupe_key: `work_item:${wi.id}:${cause}` }, { onConflict: 'dedupe_key' });
  if (ins.conflict || !ins.row) return null; // already escalated for this cause
  await dbInsert('escalation_events', { escalation_id: ins.row.id, from_level: null, to_level: route.level, from_status: null, to_status: 'routed', changed_by: null, note: reason });
  await dbInsert('work_item_events', { work_item_id: wi.id, from_status: wi.status, to_status: wi.status, changed_by: null, reason: `Escalated to ${route.worker?.display_name || route.level}: ${reason}` });
  for (const u of route.userIds) await notify({ userId: u, kind: 'work_item_escalation', subject: `Needs attention: ${wi.title}`, body: reason, link: '/dashboard/my-work', channels: ['in_app'], idempotencyKey: `esc:${ins.row.id}:${u}` });
  return ins.row;
}

// Run by the worker every few minutes (inside ops_sentry_sweep). Idempotent: one escalation per item per cause.
export async function sweepWorkItems({ now = new Date() } = {}) {
  const iso = now.toISOString(); let ack = 0, overdue = 0;
  const workers = new Map();
  const workerOf = async (id) => { if (!id) return null; if (!workers.has(id)) workers.set(id, await dbOne(`workers?id=eq.${enc(id)}&select=*`)); return workers.get(id); };
  for (const wi of await dbGet(`work_items?status=in.(assigned,in_progress)&acknowledged_at=is.null&ack_due_at=lt.${enc(iso)}&select=*&limit=500`)) {
    if (await escalate({ wi, worker: await workerOf(wi.worker_id), cause: 'not_acknowledged', reason: `Not acknowledged by ${new Date(wi.ack_due_at).toUTCString()}`, now })) ack++;
  }
  for (const wi of await dbGet(`work_items?status=in.(${OPEN.join(',')})&due_at=lt.${enc(iso)}&select=*&limit=500`)) {
    if (await escalate({ wi, worker: await workerOf(wi.worker_id), cause: 'overdue', reason: `Past its deadline (${new Date(wi.due_at).toUTCString()}) while ${wi.status.replace(/_/g, ' ')}`, now })) overdue++;
  }
  return { escalated_unacknowledged: ack, escalated_overdue: overdue };
}

export const handleHandoffs = wrap(async (req, res, op) => {
  const b = req.body || {};
  const caller = await requirePerm(req, res, null); if (!caller) return;
  if (!caller.roles.length) return bad(res, 403, 'Nova staff only.');
  if (!rateLimit(req, res, 120, 60_000)) return;

  // Everything this person must act on: tasks assigned to them, results handed to them, escalations routed to them.
  if (op === 'my-work') {
    const mine = await dbGet(`workers?staff_user_id=eq.${enc(caller.id)}&select=id,display_name,status`);
    const ids = mine.map((w) => w.id);
    const [assigned, results, escalations] = await Promise.all([
      ids.length ? dbGet(`work_items?worker_id=in.(${ids.map(enc).join(',')})&status=in.(${OPEN.join(',')},rejected)&select=*&order=due_at.asc.nullslast`) : [],
      dbGet(`work_items?result_to_user_id=eq.${enc(caller.id)}&status=eq.completed&result_received_at=is.null&select=*&order=completed_at.desc`),
      dbGet(`escalations?routed_to_user_id=eq.${enc(caller.id)}&status=in.(open,routed)&select=*&order=created_at.desc`),
    ]);
    const subjects = escalations.map((e) => e.subject_id).filter(Boolean);
    const subjectItems = subjects.length ? await dbGet(`work_items?id=in.(${subjects.map(enc).join(',')})&select=id,title,status,worker_id,due_at`) : [];
    return res.status(200).json({ workers: mine, assigned, results_to_receive: results, escalations: escalations.map((e) => ({ ...e, work_item: subjectItems.find((w) => w.id === e.subject_id) || null })) });
  }
  if (op === 'receive-result') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    const wi = await dbOne(`work_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!wi) return bad(res, 404, 'Not found');
    if (wi.result_to_user_id !== caller.id) return bad(res, 403, 'This result was handed to someone else.');
    if (wi.status !== 'completed') return bad(res, 409, 'There is no result yet.');
    const [row] = await dbPatch('work_items', `id=eq.${enc(wi.id)}&result_received_at=is.null`, { result_received_at: nowIso(), updated_at: nowIso() });
    await dbInsert('work_item_events', { work_item_id: wi.id, from_status: 'completed', to_status: 'completed', changed_by: caller.id, reason: `Result received${sanitize(b.note, 500) ? `: ${sanitize(b.note, 500)}` : ''}` });
    return res.status(200).json({ ok: true, work_item: row || wi });
  }
  if (op === 'resolve-escalation') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    const e = await dbOne(`escalations?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!e) return bad(res, 404, 'Not found');
    if (e.routed_to_user_id !== caller.id && !isOwner(caller)) return bad(res, 403, 'This escalation is routed to someone else.');
    const resolution = sanitize(b.resolution, 1000); if (resolution.length < 5) return bad(res, 422, 'Record what was done.');
    const [row] = await dbPatch('escalations', `id=eq.${enc(e.id)}&status=in.(open,routed)`, { status: 'resolved', resolved_by: caller.id, resolved_at: nowIso(), resolution });
    if (!row) return bad(res, 409, 'Already resolved.');
    await dbInsert('escalation_events', { escalation_id: e.id, from_level: e.level, to_level: e.level, from_status: e.status, to_status: 'resolved', changed_by: caller.id, note: resolution });
    if (e.subject_type === 'work_item') await dbInsert('work_item_events', { work_item_id: e.subject_id, from_status: null, to_status: (await dbOne(`work_items?id=eq.${enc(e.subject_id)}&select=status`))?.status || 'unknown', changed_by: caller.id, reason: `Escalation resolved: ${resolution}` });
    return res.status(200).json({ ok: true, escalation: row });
  }
  if (op === 'sweep-work-items') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    if (!isOwner(caller)) return bad(res, 403, 'Owner only.');
    return res.status(200).json(await sweepWorkItems());
  }
  return bad(res, 404, 'Unknown op');
});
