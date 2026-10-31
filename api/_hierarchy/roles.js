// Executable workforce roles (owner brief 2026-10-30 §11). Isaac remains CEO; the executive assistant, COO, CFO and CMO
// act within his playbook (owner_preferences). A role does work only when its worker is registered and active (titles
// confer nothing); each run is a durable task — a work item with assignee, prerequisites, state, result, error, cost and
// handoff history (work_item_events), driven by a queued job (lease, attempts, bounded retries). Decisions are
// deterministic (roleRules.js). No role sends a message, moves money or invents financial data; what needs authority is
// escalated to the owner in the app.
import { dbGet, dbOne, dbInsert, dbPatch, dbFetch, enc, nowIso, bad, wrap, requirePerm, notifyOwners, usersWithRoles } from '../_sales/core.js';
import { sanitize } from '../_sanitize.js';
import { cfoDecision, cooRetry, eaPrioritize, cmoProposals } from './roleRules.js';

export const ROLES = {
  executive_assistant: { job_type: 'role_ea_brief', every_minutes: 60, title: 'Owner brief: decisions waiting and priorities' },
  coo: { job_type: 'role_coo_check', every_minutes: 30, title: 'Workflow health: failures, assignment, dependencies, evidence' },
  cfo: { job_type: 'role_cfo_review', every_minutes: 60, title: 'Spending review: funds, commitments and expense decisions' },
  cmo: { job_type: 'role_cmo_review', every_minutes: 360, title: 'Growth review: Revive candidates, campaign results, proposals' },
};
export const ROLE_OF_JOB = Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [v.job_type, k]));
const DAY = 86400_000;

async function prefsOf(orgId) {
  const rows = await dbGet(`owner_preferences?organization_id=eq.${enc(orgId)}&select=key,value`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function ownerId() { return (await usersWithRoles(['nova_super_admin']))[0]?.id || null; }
async function event(itemId, from, to, reason, by) { await dbInsert('work_item_events', { work_item_id: itemId, from_status: from, to_status: to, changed_by: by, reason: String(reason).slice(0, 1000) }); }
async function move(item, to, reason, by, patch = {}) {
  const [row] = await dbPatch('work_items', `id=eq.${enc(item.id)}&status=eq.${enc(item.status)}`, { status: to, updated_at: nowIso(), ...patch });
  if (!row) throw new Error(`task ${item.id} changed state concurrently (expected ${item.status})`);
  await event(item.id, item.status, to, reason, by); return row;
}

// ---------------------------------------------------------------------------------------------------- role handlers
// Each returns { summary, evidence: [{source, observation}], output, escalations: [{subject, body}] }.
const HANDLERS = {
  async executive_assistant(orgId, { now }) {
    const prefs = await prefsOf(orgId);
    const [esc, exp, appr, review, overdue, blocked] = await Promise.all([
      dbGet(`ops_jobs?organization_id=eq.${enc(orgId)}&state=eq.escalated&select=id,escalation_reason,updated_at&order=updated_at.asc&limit=50`),
      dbGet(`expense_requests?organization_id=eq.${enc(orgId)}&status=eq.needs_owner&select=id,purpose,amount_cents,cfo_check,requested_by_role,updated_at&limit=50`),
      dbGet(`approval_requests?organization_id=eq.${enc(orgId)}&status=eq.pending&select=id,action_summary,created_at&limit=50`).catch(() => []),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&status=eq.in_review&role_key=neq.executive_assistant&select=id,title,role_key,updated_at&limit=50`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&due_at=lt.${enc(now.toISOString())}&status=not.in.(completed,cancelled,approved)&select=id,title,due_at&limit=50`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&status=eq.blocked&select=id,title,last_error,updated_at&limit=50`),
    ]);
    const items = [
      ...esc.map((x) => ({ kind: 'escalation', ref: `ops_job:${x.id}`, title: `A customer conversation needs a person: ${x.escalation_reason || 'reason not recorded'}`, since: x.updated_at, prep: 'Open the conversation in Operations and reply, or hand it to a named person.' })),
      ...exp.map((x) => ({ kind: 'expense', ref: `expense:${x.id}`, title: `${x.requested_by_role.toUpperCase()} asks to spend $${(x.amount_cents / 100).toFixed(2)}: ${x.purpose}`, since: x.updated_at, prep: `CFO: ${x.cfo_check?.recommendation === 'approve' ? 'recommends approving' : x.cfo_check?.recommendation === 'deny' ? 'recommends against' : 'cannot tell (funds unknown)'}. ${(x.cfo_check?.reasons || []).join(' ')}` })),
      ...appr.map((x) => ({ kind: 'approval', ref: `approval:${x.id}`, title: x.action_summary, since: x.created_at, prep: 'Approve or decline in the Approval Inbox.' })),
      ...review.map((x) => ({ kind: 'review', ref: `work_item:${x.id}`, title: `${(x.role_key || 'worker').toUpperCase()} result to review: ${x.title}`, since: x.updated_at, prep: 'Read the result and approve it, or send it back with a note.' })),
      ...overdue.map((x) => ({ kind: 'overdue', ref: `work_item:${x.id}`, title: `Overdue: ${x.title}`, since: x.due_at, prep: 'Reassign it or move the due date.' })),
      ...blocked.map((x) => ({ kind: 'blocked', ref: `work_item:${x.id}`, title: `Blocked: ${x.title}`, since: x.updated_at, prep: x.last_error || 'See the task for what it waits on.' })),
    ];
    const ordered = eaPrioritize(items, prefs, now);
    const priorities = Array.isArray(prefs.priorities) ? prefs.priorities : [];
    const late = ordered.filter((x) => x.escalate);
    return {
      summary: ordered.length ? `${ordered.length} item(s) wait for the owner: ${ordered.slice(0, 3).map((x) => x.title).join('; ')}${late.length ? `. ${late.length} waited longer than ${Number(prefs.escalate_after_hours) || 24} h.` : '.'}` : 'Nothing waits for the owner.',
      evidence: [{ source: `Nova records for this business (read ${now.toISOString()})`, observation: `Escalated conversations ${esc.length}; expense decisions ${exp.length}; approvals ${appr.length}; results to review ${review.length}; overdue ${overdue.length}; blocked ${blocked.length}.` }],
      output: { priorities, decisions: ordered.slice(0, 25) },
      escalations: late.slice(0, 5).map((x) => ({ subject: `Waiting ${x.waited_hours} h: ${x.title}`.slice(0, 160), body: x.prep, key: x.ref })),
    };
  },

  async coo(orgId, { now, actor }) {
    const [failed, stuck, unassigned, active, completed, workers] = await Promise.all([
      dbGet(`jobs?organization_id=eq.${enc(orgId)}&status=in.(failed,dead_letter)&select=id,job_type,status,attempts,max_attempts,last_error,payload&limit=100`),
      dbGet(`jobs?organization_id=eq.${enc(orgId)}&status=eq.leased&leased_until=lt.${enc(new Date(now - 10 * 60_000).toISOString())}&select=id,job_type,leased_by,leased_until&limit=50`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&status=eq.draft&worker_id=is.null&select=id,title,category,status,role_key&limit=50`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&status=in.(assigned,in_progress)&select=id,title,status,worker_id,depends_on&limit=200`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&status=eq.completed&completed_at=gt.${enc(new Date(now - 7 * DAY).toISOString())}&select=id,title,work_item_evidence(count)&limit=100`),
      dbGet('workers?status=in.(active,restricted)&capability_key=not.is.null&select=id,display_name,capability_key'),
    ]);
    const actions = []; const escalations = [];
    // bounded recovery of failed repeatable jobs; anything that can send, charge or book goes to the owner
    for (const j of failed) {
      const r = cooRetry(j, { now });
      if (r.retry) { await dbPatch('jobs', `id=eq.${enc(j.id)}&status=eq.failed`, { status: 'pending', scheduled_at: nowIso(), payload: { ...(j.payload || {}), coo_retried_at: now.toISOString() } }); actions.push(`Put failed ${j.job_type} job back in the queue (${r.reason}).`); }
      else escalations.push({ subject: `A ${j.job_type} job failed and was not retried`, body: `${r.reason}. Last error: ${j.last_error || 'none recorded'}.`, key: `job:${j.id}` });
    }
    // assignment by role (a proposal task waits for the owner; it is not assigned to a worker)
    const byCap = (k) => workers.find((w) => w.capability_key === k);
    for (const w of unassigned) {
      const target = w.role_key && !String(w.category).startsWith('proposal:') ? byCap(w.role_key) : null;
      if (target) { const row = await dbOne(`work_items?id=eq.${enc(w.id)}&select=*`); await move(row, 'assigned', `Assigned by the COO to ${target.display_name}`, actor, { worker_id: target.id, assigned_at: nowIso() }); actions.push(`Assigned "${w.title}" to ${target.display_name}.`); }
    }
    // prerequisites: work that started before its prerequisites finished is blocked, with the reason
    const ids = [...new Set(active.flatMap((x) => x.depends_on || []))];
    const deps = ids.length ? await dbGet(`work_items?id=in.(${ids.map(enc).join(',')})&select=id,status,title`) : [];
    for (const it of active.filter((x) => x.status === 'in_progress' && (x.depends_on || []).length)) {
      const open = deps.filter((d) => it.depends_on.includes(d.id) && d.status !== 'completed');
      if (open.length) { const row = await dbOne(`work_items?id=eq.${enc(it.id)}&select=*`); await move(row, 'blocked', `Blocked by the COO: waits on ${open.map((d) => `"${d.title}"`).join(', ')}`, actor, { last_error: `Waits on: ${open.map((d) => d.title).join(', ')}` }); actions.push(`Blocked "${it.title}" until its prerequisites finish.`); }
    }
    const noEvidence = completed.filter((c) => !(c.work_item_evidence?.[0]?.count > 0));
    for (const c of noEvidence.slice(0, 5)) escalations.push({ subject: `Completed without evidence: ${c.title}`.slice(0, 160), body: 'A completed task has no evidence record. Ask for the proof or reopen it.', key: `noevidence:${c.id}` });
    const load = workers.map((w) => ({ worker: w.display_name, open: active.filter((a) => a.worker_id === w.id).length }));
    return {
      summary: `${failed.length} failed job(s) (${actions.filter((a) => a.startsWith('Put')).length} retried), ${stuck.length} with an expired lease, ${unassigned.length} unassigned task(s), ${noEvidence.length} completed without evidence.`,
      evidence: [{ source: `Job queue and task records (read ${now.toISOString()})`, observation: `Failed or dead-lettered jobs: ${failed.length}; expired leases: ${stuck.length}; open tasks: ${active.length}; unassigned: ${unassigned.length}; completed in 7 days: ${completed.length}.` }],
      output: { actions, capacity: load, stuck_leases: stuck.map((s) => ({ job: s.id, type: s.job_type, leased_by: s.leased_by })) },
      escalations,
    };
  },

  async cfo(orgId, { now, actor }) {
    const prefs = await prefsOf(orgId);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [bal, approved, recorded, proposed] = await Promise.all([
      dbOne(`finance_balance_snapshots?organization_id=eq.${enc(orgId)}&select=account_label,balance_cents,as_of,source&order=as_of.desc`),
      dbGet(`expense_requests?organization_id=eq.${enc(orgId)}&status=eq.approved&select=amount_cents`),
      dbGet(`expense_requests?organization_id=eq.${enc(orgId)}&status=eq.recorded&recorded_at=gte.${enc(monthStart)}&select=amount_cents`),
      dbGet(`expense_requests?organization_id=eq.${enc(orgId)}&status=eq.proposed&select=*&order=created_at.asc`),
    ]);
    const sum = (rows) => rows.reduce((t, r) => t + Number(r.amount_cents || 0), 0);
    let committed = sum(approved); const spent = sum(recorded);
    const decisions = []; const escalations = [];
    for (const e of proposed) {
      const d = cfoDecision({ amountCents: Number(e.amount_cents), balance: bal, commitmentsCents: committed, spentThisMonthCents: spent, prefs, now });
      const status = d.decision === 'approved_by_policy' ? 'approved' : 'needs_owner';
      const authority = d.decision === 'approved_by_policy' ? { by: 'owner policy', auto_approve_cents: prefs.auto_approve_cents, monthly_budget_cents: prefs.monthly_budget_cents, at: now.toISOString() } : { required: 'owner', at: now.toISOString() };
      await dbPatch('expense_requests', `id=eq.${enc(e.id)}&status=eq.proposed`, { status, cfo_check: d, authority, updated_at: nowIso() });
      if (status === 'approved') committed += Number(e.amount_cents);
      decisions.push({ id: e.id, purpose: e.purpose, amount_cents: e.amount_cents, status, recommendation: d.recommendation, reasons: d.reasons });
      if (status === 'needs_owner') escalations.push({ subject: `Spending decision: $${(e.amount_cents / 100).toFixed(2)} for ${e.purpose}`.slice(0, 160), body: `CFO ${d.recommendation === 'approve' ? 'recommends approving' : d.recommendation === 'deny' ? 'recommends against' : 'cannot check funds'}: ${d.reasons.join(' ')}`, key: `expense:${e.id}` });
    }
    const age = bal ? Math.floor((now - new Date(bal.as_of)) / DAY) : null; const fresh = bal && age <= (Number(prefs.balance_freshness_days) || 7);
    return {
      summary: `${bal ? `Balance ${fresh ? 'current' : `${age} days old`} (${bal.source === 'owner_entered' ? 'entered by the owner' : 'connected account'})` : 'No balance on record: available funds unknown'}; committed $${(committed / 100).toFixed(2)}; spent this month $${(spent / 100).toFixed(2)}; ${decisions.length} expense request(s) checked.`,
      evidence: [{ source: `Finance records entered in Nova (read ${now.toISOString()})`, observation: bal ? `Latest balance ${bal.balance_cents} cents for "${bal.account_label}" as of ${bal.as_of} (${bal.source}). No bank account is connected unless the source says so.` : 'No balance snapshot exists. No bank account is connected.' }],
      output: { balance: bal ? { cents: bal.balance_cents, as_of: bal.as_of, source: bal.source, fresh } : null, available_cents: fresh ? Number(bal.balance_cents) - committed : null, committed_cents: committed, spent_this_month_cents: spent, monthly_budget_cents: prefs.monthly_budget_cents ?? null, decisions },
      escalations,
    };
  },

  async cmo(orgId, { now, actor }) {
    const prefs = await prefsOf(orgId);
    const cutoff = new Date(now - 7 * DAY).toISOString();
    const [stalledRows, campaigns] = await Promise.all([
      dbGet(`ops_jobs?organization_id=eq.${enc(orgId)}&state=in.(quoted,awaiting_agreement,awaiting_deposit,booking)&updated_at=lt.${enc(cutoff)}&select=id&limit=500`),
      dbGet(`ops_campaigns?organization_id=eq.${enc(orgId)}&select=id,name,status,ops_campaign_recipients(send_status,stop_reason,sent_at)&order=created_at.desc&limit=10`),
    ]);
    const perf = campaigns.map((c) => { const r = c.ops_campaign_recipients || []; return { name: c.name, sent: r.filter((x) => x.sent_at || x.send_status === 'sent').length, replied: r.filter((x) => x.stop_reason === 'replied').length, booked: r.filter((x) => ['booked', 'purchased'].includes(x.stop_reason)).length }; }).filter((c) => c.sent > 0);
    const plan = cmoProposals({ stalled: stalledRows.length, campaigns: perf, prefs });
    const created = [];
    const owner = actor;
    for (const p of plan.proposals) {
      // one proposal per kind per week: an idempotent task for the owner's decision (it is not executed by the CMO)
      const week = Math.floor(now.getTime() / (7 * DAY));
      const ins = await dbInsert('work_items', { organization_id: orgId, role_key: 'cmo', title: p.title.slice(0, 300), description: p.detail, category: `proposal:${p.kind}`, status: 'draft', created_by: owner, source_ref: `cmo:${p.kind}:${orgId}:${week}`, cost_cents: 0 });
      if (ins.row) { await event(ins.row.id, null, 'draft', 'Proposed by the CMO worker for the owner\'s decision', owner); created.push(ins.row.id); }
    }
    let expense = null;
    if (plan.expense) {
      const month = now.toISOString().slice(0, 7);
      const ins = await dbInsert('expense_requests', { organization_id: orgId, requested_by_role: 'cmo', purpose: plan.expense.purpose, amount_cents: plan.expense.amount_cents, category: plan.expense.category, status: 'proposed', idempotency_key: `cmo:test-budget:${orgId}:${month}` });
      expense = ins.row ? { id: ins.row.id, amount_cents: ins.row.amount_cents, status: 'proposed (sent to the CFO)' } : { status: 'already proposed this month' };
    }
    return {
      summary: `${stalledRows.length} stalled inquiry(ies); ${perf.length} campaign(s) with sends; ${created.length} new proposal(s) for the owner${expense?.id ? `; expense of $${(expense.amount_cents / 100).toFixed(2)} sent to the CFO` : ''}.`,
      evidence: [{ source: `Inquiry and campaign records (read ${now.toISOString()})`, observation: `Inquiries stalled 7+ days in quoted/agreement/deposit/booking: ${stalledRows.length}. Campaigns with recorded sends: ${perf.length}.` }],
      output: { proposals: plan.proposals, proposal_tasks: created, performance: plan.performance, expense, notes: plan.notes },
      escalations: [],
    };
  },
};

// ---------------------------------------------------------------------------------------------------- the task runner
// Runs one role task for one business. Idempotent per job: a redelivered or retried job resumes the same task.
export async function runRoleTask(roleKey, { orgId, jobId = null, workItemId = null, now = new Date() } = {}) {
  const def = ROLES[roleKey]; if (!def) throw new Error(`unknown role ${roleKey}`);
  if (!orgId) return { skipped: 'no business named' };
  const worker = await dbOne(`workers?capability_key=eq.${enc(roleKey)}&status=in.(active,restricted)&select=id,display_name`);
  if (!worker) return { skipped: `the ${roleKey} worker is not registered and active; the title alone does nothing` };
  const actor = await ownerId();
  let item = workItemId ? await dbOne(`work_items?id=eq.${enc(workItemId)}&organization_id=eq.${enc(orgId)}&select=*`) : jobId ? await dbOne(`work_items?job_id=eq.${enc(jobId)}&select=*`) : null;
  if (!item) {
    const ins = await dbInsert('work_items', { organization_id: orgId, role_key: roleKey, worker_id: worker.id, title: def.title, category: `role:${roleKey}`, status: 'assigned', job_id: jobId, created_by: actor, assigned_at: nowIso(), cost_cents: 0 });
    item = ins.row; await event(item.id, null, 'assigned', `Scheduled task received by ${worker.display_name}`, actor);
  }
  if (['in_review', 'approved', 'completed', 'cancelled'].includes(item.status)) return { work_item_id: item.id, status: item.status, resumed: true, result: item.result };
  // prerequisites first
  if ((item.depends_on || []).length) {
    const deps = await dbGet(`work_items?id=in.(${item.depends_on.map(enc).join(',')})&select=id,title,status`);
    const open = deps.filter((d) => d.status !== 'completed');
    if (open.length) { if (item.status !== 'blocked' && ['assigned', 'in_progress'].includes(item.status)) { if (item.status === 'assigned') item = await move(item, 'in_progress', 'Started', actor); item = await move(item, 'blocked', `Waits on ${open.map((d) => `"${d.title}"`).join(', ')}`, actor, { last_error: `Waits on: ${open.map((d) => d.title).join(', ')}` }); } return { work_item_id: item.id, status: 'blocked' }; }
  }
  if (item.status === 'assigned' || item.status === 'blocked' || item.status === 'failed' || item.status === 'rejected') item = await move(item, 'in_progress', item.status === 'assigned' ? `Started by ${worker.display_name}` : `Resumed by ${worker.display_name}`, actor, { started_at: item.started_at || nowIso(), attempts: (item.attempts || 0) + 1 });
  await dbInsert('worker_heartbeats', { worker_id: worker.id, work_item_id: item.id, status: 'working', note: def.title.slice(0, 200) });
  let out;
  try { out = await HANDLERS[roleKey](orgId, { now, actor, worker }); }
  catch (e) {
    await move(item, 'failed', `Failed: ${String(e.message).slice(0, 300)}`, actor, { last_error: String(e.message).slice(0, 1000) });
    await dbInsert('worker_heartbeats', { worker_id: worker.id, work_item_id: item.id, status: 'idle', note: 'failed' });
    throw e; // the queue retries within the job's attempt limit
  }
  for (const ev of out.evidence) await dbInsert('work_item_evidence', { work_item_id: item.id, source: ev.source.slice(0, 500), observation: ev.observation.slice(0, 4000), collected_by: actor });
  await dbInsert('work_item_outputs', { work_item_id: item.id, content: { summary: out.summary, ...out.output }, produced_by: actor });
  const day = now.toISOString().slice(0, 10);
  for (const x of out.escalations) {
    await notifyOwners({ kind: `role_${roleKey}_escalation`, subject: x.subject, body: x.body, link: '/dashboard/ops', channels: ['in_app'], idempotencyKey: `role:${roleKey}:${orgId}:${x.key}:${day}` });
  }
  if (out.escalations.length) await event(item.id, 'in_progress', 'in_progress', `Escalated to the owner (in the app): ${out.escalations.map((x) => x.subject).join(' | ')}`.slice(0, 1000), actor);
  // the previous unreviewed result of this role for this business is superseded (kept, with the reason), so results do
  // not pile up; the newest one waits for the owner's review
  for (const old of await dbGet(`work_items?organization_id=eq.${enc(orgId)}&role_key=eq.${enc(roleKey)}&category=eq.${enc(`role:${roleKey}`)}&status=eq.in_review&id=neq.${enc(item.id)}&select=*`)) await move(old, 'cancelled', `Superseded by the newer result of task ${item.id}`, actor);
  item = await move(item, 'in_review', `Result saved by ${worker.display_name}; waiting for the owner's review`, actor, { result: { summary: out.summary, escalations: out.escalations.length }, last_error: null });
  await dbInsert('worker_heartbeats', { worker_id: worker.id, work_item_id: item.id, status: 'idle', note: 'result saved' });
  return { work_item_id: item.id, status: item.status, summary: out.summary, escalations: out.escalations.length };
}

// ---------------------------------------------------------------------------------------------------- owner endpoints
// resource=roles: the owner's playbook (preferences), entered balances, expense decisions, and "run this role now".
export const handleRoles = wrap(async (req, res, op) => {
  const b = req.body || {}; const q = req.query || {};
  const caller = await requirePerm(req, res, 'command.owner'); if (!caller) return;
  const orgId = sanitize(req.method === 'GET' ? q.organization_id : b.organization_id, 60);
  if (!orgId || !(await dbOne(`organizations?id=eq.${enc(orgId)}&select=id`))) return bad(res, 404, 'Business not found');
  if (op === 'overview' && req.method === 'GET') {
    const [workers, tasks, expenses, bal, prefs] = await Promise.all([
      dbGet(`workers?capability_key=in.(${Object.keys(ROLES).join(',')})&status=neq.inactive&select=id,display_name,capability_key,status`),
      dbGet(`work_items?organization_id=eq.${enc(orgId)}&role_key=not.is.null&select=id,role_key,title,status,result,last_error,updated_at&order=updated_at.desc&limit=40`),
      dbGet(`expense_requests?organization_id=eq.${enc(orgId)}&select=*&order=created_at.desc&limit=20`),
      dbOne(`finance_balance_snapshots?organization_id=eq.${enc(orgId)}&select=account_label,balance_cents,as_of,source&order=as_of.desc`),
      prefsOf(orgId),
    ]);
    return res.status(200).json({ roles: Object.entries(ROLES).map(([k, v]) => ({ key: k, title: v.title, every_minutes: v.every_minutes, worker: workers.find((w) => w.capability_key === k) || null })), tasks, expenses, balance: bal, preferences: prefs });
  }
  if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
  if (op === 'set-preference') {
    const key = sanitize(b.key, 60); const ALLOWED = ['priorities', 'escalate_after_hours', 'auto_approve_cents', 'monthly_budget_cents', 'balance_freshness_days', 'cmo_test_budget_cents'];
    if (!ALLOWED.includes(key)) return bad(res, 422, `Unknown preference. Allowed: ${ALLOWED.join(', ')}`);
    const value = key === 'priorities' ? (Array.isArray(b.value) ? b.value.map((x) => sanitize(x, 200)).filter(Boolean).slice(0, 10) : []) : Number(b.value);
    if (key !== 'priorities' && (!Number.isFinite(value) || value < 0)) return bad(res, 422, 'Enter a number of 0 or more');
    const r = await dbFetch('owner_preferences?on_conflict=organization_id,key', { method: 'POST', body: { organization_id: orgId, key, value, updated_by: caller.id, updated_at: nowIso() }, prefer: 'resolution=merge-duplicates,return=minimal' });
    if (!r.ok) return bad(res, 500, 'The preference was not saved');
    return res.status(200).json({ ok: true, key, value });
  }
  if (op === 'add-balance') {
    const cents = Math.round(Number(b.balance_dollars) * 100); const asOf = b.as_of ? new Date(b.as_of) : new Date();
    if (!Number.isFinite(cents) || Number.isNaN(asOf.getTime()) || asOf > new Date()) return bad(res, 422, 'Enter the balance and a date that is not in the future');
    const ins = await dbInsert('finance_balance_snapshots', { organization_id: orgId, account_label: sanitize(b.account_label, 80) || 'Operating account', balance_cents: cents, as_of: asOf.toISOString(), source: 'owner_entered', entered_by: caller.id, note: sanitize(b.note, 300) || null });
    return res.status(200).json({ ok: true, snapshot: ins.row });
  }
  if (op === 'decide-expense') {
    const id = sanitize(b.id, 60); const decision = b.decision === 'approve' ? 'approved' : b.decision === 'deny' ? 'denied' : null;
    if (!decision) return bad(res, 422, 'decision must be approve or deny');
    const [row] = await dbPatch('expense_requests', `id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&status=in.(needs_owner,proposed)`, { status: decision, decided_by: caller.id, decided_at: nowIso(), authority: { by: 'owner', user: caller.id, at: nowIso() }, updated_at: nowIso() });
    if (!row) return bad(res, 409, 'This request is not waiting for a decision');
    return res.status(200).json({ ok: true, expense: row });
  }
  if (op === 'record-expense') {
    const id = sanitize(b.id, 60);
    const [row] = await dbPatch('expense_requests', `id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&status=eq.approved`, { status: 'recorded', recorded_at: nowIso(), updated_at: nowIso() });
    if (!row) return bad(res, 409, 'Only an approved expense can be recorded');
    return res.status(200).json({ ok: true, expense: row });
  }
  if (op === 'propose-expense') {
    const cents = Math.round(Number(b.amount_dollars) * 100); const purpose = sanitize(b.purpose, 300);
    if (!purpose || !Number.isFinite(cents) || cents < 0) return bad(res, 422, 'Enter a purpose and an amount');
    const ins = await dbInsert('expense_requests', { organization_id: orgId, requested_by_role: 'owner', purpose, amount_cents: cents, category: sanitize(b.category, 40) || null, status: 'proposed' });
    return res.status(200).json({ ok: true, expense: ins.row });
  }
  if (op === 'mark-reviewed') {
    const id = sanitize(b.id, 60);
    let item = await dbOne(`work_items?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&role_key=not.is.null&status=eq.in_review&select=*`);
    if (!item) return bad(res, 409, 'This result is not waiting for review');
    await dbInsert('work_item_reviews', { work_item_id: item.id, reviewer_id: caller.id, decision: 'approved', notes: sanitize(b.note, 500) || 'Reviewed by the owner' });
    item = await move(item, 'approved', 'Reviewed by the owner', caller.id);
    item = await move(item, 'completed', 'Closed after the owner\'s review', caller.id, { completed_at: nowIso() });
    return res.status(200).json({ ok: true, work_item: { id: item.id, status: item.status } });
  }
  if (op === 'run-now') {
    const role = sanitize(b.role, 40); const def = ROLES[role]; if (!def) return bad(res, 422, 'Unknown role');
    const job = await dbInsert('jobs', { job_type: def.job_type, organization_id: orgId, payload: { requested_by: caller.id }, scheduled_at: nowIso(), idempotency_key: `${def.job_type}:${orgId}:manual:${Date.now()}` });
    return res.status(200).json({ ok: true, job_id: job.row?.id, note: 'Queued for the background worker' });
  }
  return bad(res, 404, 'Unknown roles operation');
});
