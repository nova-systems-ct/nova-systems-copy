// Nova hierarchy handoffs (master prompt §4, §18 "Hierarchy") on a REAL local PostgreSQL + PostgREST through the real
// handlers: a task assigned by the owner reaches an ORDINARY staff member (no owner rights), who sees it in their own
// queue, acknowledges, does the work and submits it; someone else reviews; the result is handed to a named person who
// confirms receipt. A missed acknowledgment or deadline becomes ONE escalation routed to the worker's manager (or the
// owner when there is none), visible in that person's queue and inbox, and resolved with a record. Outsiders and
// unrelated staff are refused.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const call = makeCaller((await import('../api/client.js')).default);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const wk = (op, o = {}) => call({ resource: 'workitems', op, ...o });
const ho = (op, o = {}) => call({ resource: 'handoffs', op, ...o });
const one = async (q, p) => (await env.sql(q, p)).rows[0];
const all = async (q, p) => (await env.sql(q, p)).rows;

try {
  for (let i = 0; i < 30 && (await env.rest(env.serviceKey, 'escalations?select=dedupe_key&limit=0')).status !== 200; i++) await env.reload();
  const nova = (await one("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).id;
  const client = (await one("insert into organizations (name, slug, kind) values ('TEST Client','client','client') returning id")).id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: nova, name: 'TEST Owner' });
  const manager = await env.createUser({ email: 'manager@nova.test', role: 'nova_sales', orgId: nova, name: 'TEST Manager' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: nova, name: 'TEST Rep' });
  const other = await env.createUser({ email: 'auditor@nova.test', role: 'nova_auditor', orgId: nova, name: 'TEST Auditor' });
  const outsider = await env.createUser({ email: 'x@client.test', role: 'client_owner', orgId: client });
  const O = (body) => ({ token: owner.token, body });
  const matrixId = (await one("select id from sales_config where key='authority_matrix' and status='pending_approval'")).id;
  await hier('approve-authority-matrix', O({ config_id: matrixId, confirm: true }));
  const activate = async (w) => { for (const [s, why] of [['onboarding', 'Starting onboarding (test).'], ['training', 'Beginning training (test).'], ['active', 'Training completed (test).']]) await hier('set-worker-status', O({ id: w.id, status: s, reason: why })); return w; };
  const mgrW = await activate((await hier('create-worker', O({ worker_type: 'human', staff_user_id: manager.id, display_name: 'TEST Manager' }))).body.worker);
  const repW = await activate((await hier('create-worker', O({ worker_type: 'human', staff_user_id: rep.id, display_name: 'TEST Rep', manager_worker_id: mgrW.id }))).body.worker);
  check('an ordinary rep holds no owner or hierarchy rights', (await wk('work-items', { token: rep.token, method: 'GET' })).status === 403);

  // ---------------------------------------------------------------- assignment reaches the person
  let r = await wk('create-work-item', O({ title: 'TEST Research five Waterbury detailers for the Demand campaign', category: 'research', due_at: new Date(Date.now() + 2 * 86400_000).toISOString(), ack_within_hours: 1, result_to_user_id: manager.id, result_action: 'approve the prospects for the Demand campaign' }));
  const wi = r.body.work_item;
  check('a task records who receives its result and the acknowledgment window', r.status === 200 && wi.result_to_user_id === manager.id && wi.ack_within_hours === 1);
  r = await wk('assign-work-item', O({ id: wi.id, worker_id: repW.id }));
  check('assignment sets an acknowledgment deadline', r.status === 200 && Math.abs(new Date(r.body.work_item.ack_due_at) - Date.now() - 3600_000) < 60_000);
  check('the assigned person is told in their inbox', !!(await one("select 1 from sales_notifications where user_id=$1 and kind='work_item_assigned'", [rep.id])));
  r = await ho('my-work', { token: rep.token, method: 'GET' });
  check('the task appears in the rep\'s own queue', r.status === 200 && r.body.assigned.some((x) => x.id === wi.id));
  r = await wk('acknowledge-work-item', { token: other.token, body: { id: wi.id } });
  check('staff who are not assigned cannot act on the task', r.status === 403);
  r = await ho('my-work', { token: outsider.token, method: 'GET' });
  check('a client-organization user has no access to Nova\'s queue', r.status === 403);

  // ---------------------------------------------------------------- missed acknowledgment → one routed escalation
  await env.sql("update work_items set ack_due_at = now() - interval '5 minutes' where id=$1", [wi.id]); // TEST: the hour passed
  r = await ho('sweep-work-items', O({}));
  const again = await ho('sweep-work-items', O({}));
  const esc = await all("select * from escalations where subject_id=$1", [wi.id]);
  check('an unacknowledged task is escalated once, to the rep\'s manager', r.status === 200 && r.body.escalated_unacknowledged === 1 && again.body.escalated_unacknowledged === 0 && esc.length === 1 && esc[0].routed_to_user_id === manager.id && esc[0].level === 'manager', JSON.stringify([r.body, again.body, esc]));
  r = await ho('my-work', { token: manager.token, method: 'GET' });
  check('the escalation appears in the manager\'s queue with the task, and in their inbox', r.body.escalations.some((e) => e.id === esc[0].id && e.work_item?.id === wi.id) && !!(await one("select 1 from sales_notifications where user_id=$1 and kind='work_item_escalation'", [manager.id])));
  r = await ho('sweep-work-items', { token: rep.token, body: {} });
  check('only the owner can trigger a sweep by hand (the worker runs it every 5 minutes)', r.status === 403);

  // ---------------------------------------------------------------- the rep does the work without owner rights
  r = await wk('acknowledge-work-item', { token: rep.token, body: { id: wi.id } });
  check('the rep acknowledges; lateness is on the record', r.status === 200 && !!r.body.work_item.acknowledged_at && !!(await one("select 1 from work_item_events where work_item_id=$1 and reason like 'Acknowledged (after%'", [wi.id])));
  r = await wk('start-work-item', { token: rep.token, body: { id: wi.id } });
  const ev = await wk('add-evidence', { token: rep.token, body: { work_item_id: wi.id, source: 'https://example.test/detailers (public listing)', observation: 'Five businesses list no online booking.' } });
  const out = await wk('add-output', { token: rep.token, body: { work_item_id: wi.id, content: 'Five researched detailers with sources and fit notes.' } });
  const sub = await wk('submit-for-review', { token: rep.token, body: { id: wi.id } });
  check('the rep starts, records evidence and output, and submits for review as an ordinary user', r.status === 200 && ev.status === 200 && out.status === 200 && sub.status === 200 && sub.body.work_item.status === 'in_review', JSON.stringify([r.status, ev.status, out.status, sub.body]));
  r = await wk('review-work-item', { token: rep.token, body: { id: wi.id, decision: 'approved', notes: 'Looks good to me' } });
  const done = await wk('complete-work-item', { token: rep.token, body: { id: wi.id } });
  check('the rep cannot approve or complete their own task', r.status === 403 && done.status === 403);

  // ---------------------------------------------------------------- review, completion, handoff of the result
  await wk('review-work-item', O({ id: wi.id, decision: 'approved', notes: 'Sources checked; fit notes are specific.' }));
  r = await wk('complete-work-item', O({ id: wi.id }));
  check('completion hands the result to the named recipient and tells them', r.status === 200 && !!r.body.work_item.result_handed_at && !!(await one("select 1 from sales_notifications where user_id=$1 and kind='work_item_result'", [manager.id])));
  r = await ho('my-work', { token: manager.token, method: 'GET' });
  check('the result waits in the recipient\'s queue until received', r.body.results_to_receive.some((x) => x.id === wi.id));
  r = await ho('receive-result', { token: rep.token, body: { id: wi.id } });
  check('nobody else can confirm receipt', r.status === 403);
  r = await ho('receive-result', { token: manager.token, body: { id: wi.id, note: 'Will approve the prospects today' } });
  const after = await ho('my-work', { token: manager.token, method: 'GET' });
  check('the recipient confirms receipt; the handoff is closed and recorded', r.status === 200 && !!r.body.work_item.result_received_at && !after.body.results_to_receive.some((x) => x.id === wi.id) && !!(await one("select 1 from work_item_events where work_item_id=$1 and reason like 'Result received%'", [wi.id])));
  r = await ho('resolve-escalation', { token: manager.token, body: { id: esc[0].id, resolution: 'Spoke with the rep; acknowledged and completed.' } });
  check('the manager resolves the escalation with a record', r.status === 200 && r.body.escalation.status === 'resolved' && !!(await one("select 1 from escalation_events where escalation_id=$1 and to_status='resolved'", [esc[0].id])));

  // ---------------------------------------------------------------- overdue work; no manager → owner
  const w2 = (await wk('create-work-item', O({ title: 'TEST Call back three Revive replies', due_at: new Date(Date.now() + 3600_000).toISOString() }))).body.work_item;
  await wk('assign-work-item', O({ id: w2.id, worker_id: repW.id }));
  await wk('acknowledge-work-item', { token: rep.token, body: { id: w2.id } });
  await env.sql("update work_items set due_at = now() - interval '1 minute' where id=$1", [w2.id]); // TEST: deadline passed
  const w3 = (await wk('create-work-item', O({ title: 'TEST Manager task with no manager above' }))).body.work_item;
  await wk('assign-work-item', O({ id: w3.id, worker_id: mgrW.id }));
  await env.sql("update work_items set ack_due_at = now() - interval '1 minute' where id=$1", [w3.id]);
  r = await ho('sweep-work-items', O({}));
  const e2 = await one('select * from escalations where subject_id=$1', [w2.id]);
  const e3 = await one('select * from escalations where subject_id=$1', [w3.id]);
  check('overdue acknowledged work is escalated to the manager', r.body.escalated_overdue === 1 && e2?.routed_to_user_id === manager.id && /Past its deadline/.test(e2.reason), JSON.stringify([r.body, e2]));
  check('a worker with no manager escalates to the owner', e3?.level === 'owner' && e3.routed_to_user_id === owner.id, JSON.stringify(e3));
  r = await ho('resolve-escalation', { token: rep.token, body: { id: e2.id, resolution: 'Trying to close my own escalation' } });
  check('the person whose work was escalated cannot close the escalation', r.status === 403);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova hierarchy handoffs (real handlers + local PostgreSQL)`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
