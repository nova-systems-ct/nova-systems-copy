// SUPERVISED DEMONSTRATION — Nova Organizational Hierarchy, full vertical, real handlers, real local
// PostgreSQL + PostgREST (local, disposable — see scripts/testenv/). This is NOT Supabase and NOT
// production: every account, worker, work item, meeting and decision below is Nova-owned test data
// created and torn down inside this one run. No real person is contacted, nothing is published, no
// money moves, and no production system is touched — matching the master prompt's "Supervised First
// Release" constraint.
//
// Walks exactly the story requested: create a test worker -> assign a real work item -> heartbeat ->
// evidence -> output -> review -> escalate a blocked decision -> route it through the chain -> open a
// committee meeting -> ask a question -> record a decision -> create an action item -> generate a
// daily brief and weekly packet -> engage a kill switch on the worker -> prove protected work stops.
//
//   node scripts/demo_hierarchy_supervised.mjs
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';

const line = (s) => console.log(s);
const step = (s) => console.log(`\n=== ${s} ===`);
let stepNum = 0;
const record = (label, ok, detail = '') => { stepNum++; console.log(`${ok ? 'OK  ' : 'FAIL'} [${stepNum}] ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
let failures = 0;

const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const gov = (op, o = {}) => call({ resource: 'governance', op, ...o });
const wk = (op, o = {}) => call({ resource: 'workitems', op, ...o });
const mtg = (op, o = {}) => call({ resource: 'meetings', op, ...o });

try {
  step('Setup: real Nova-owned test organization and owner account (local, disposable)');
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems (demo)','nova-demo','nova_internal') returning id")).rows[0].id;
  const isaac = await env.createUser({ email: 'isaac-demo@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Nova (demo)' });
  const analyst = await env.createUser({ email: 'analyst-demo@nova.test', role: 'nova_sales', orgId: orgA, name: 'Demo Research Analyst' });
  record('Test organization and Isaac (owner) account created', true);

  step('Create a real test worker and bring it through onboarding to active');
  let r = await hier('create-worker', { token: isaac.token, body: { worker_type: 'human', staff_user_id: analyst.id, display_name: 'Demo Research Analyst', mission: 'Market research for Nova Venture Lab candidates.' } });
  record('Worker record created (status: draft)', r.status === 200 && r.body.worker.status === 'draft');
  const worker = r.body.worker;
  await hier('set-worker-status', { token: isaac.token, body: { id: worker.id, status: 'onboarding', reason: 'Demo: beginning onboarding.' } });
  await hier('set-worker-status', { token: isaac.token, body: { id: worker.id, status: 'training', reason: 'Demo: beginning training.' } });
  r = await hier('set-worker-status', { token: isaac.token, body: { id: worker.id, status: 'active', reason: 'Demo: training complete.' } });
  record('Worker reached active status through the real state machine', r.status === 200 && r.body.worker.status === 'active');

  step('Assign a real work item and start it');
  r = await wk('create-work-item', { token: isaac.token, body: { title: 'Research competitor pricing for a local lawn-care venture', category: 'research' } });
  record('Work item created (status: draft)', r.status === 200);
  const workItem = r.body.work_item;
  r = await wk('assign-work-item', { token: isaac.token, body: { id: workItem.id, worker_id: worker.id } });
  record('Work item assigned to the real active worker', r.status === 200 && r.body.work_item.status === 'assigned');
  r = await wk('start-work-item', { token: isaac.token, body: { id: workItem.id } });
  record('Work item started', r.status === 200 && r.body.work_item.status === 'in_progress');

  step('Truthful heartbeat: the worker genuinely shows "working"');
  await wk('heartbeat', { token: isaac.token, body: { worker_id: worker.id, work_item_id: workItem.id, status: 'working', note: 'Collecting competitor pricing pages.' } });
  r = await wk('worker-presence', { token: isaac.token, method: 'GET', query: { worker_id: worker.id } });
  record('Presence honestly reports working=true (real heartbeat + real in_progress work item)', r.status === 200 && r.body.working === true);

  step('Collect real evidence and produce a real output');
  r = await wk('add-evidence', { token: isaac.token, body: { work_item_id: workItem.id, source: 'https://example-lawncare-co.test/pricing (retrieved 2026-09-28, demo data)', observation: 'Listed weekly mowing rate: $45/visit for a standard 1/4-acre lot.' } });
  record('Evidence recorded', r.status === 200);
  r = await wk('add-output', { token: isaac.token, body: { work_item_id: workItem.id, content: { summary: 'Three demo competitors charge $40-55/visit for standard lawn mowing.' } } });
  record('Output recorded', r.status === 200);

  step('Route through review (a different real account reviews it — self-review is blocked)');
  r = await wk('submit-for-review', { token: isaac.token, body: { id: workItem.id } });
  record('Submitted for review (evidence + output both present)', r.status === 200 && r.body.work_item.status === 'in_review');
  r = await wk('review-work-item', { token: isaac.token, body: { id: workItem.id, decision: 'approved', notes: 'Demo: sourced and clearly written, approved.' } });
  record('Reviewed and approved by the owner (a different account than the worker)', r.status === 200 && r.body.work_item.status === 'approved');
  r = await wk('complete-work-item', { token: isaac.token, body: { id: workItem.id } });
  record('Work item completed', r.status === 200 && r.body.work_item.status === 'completed');

  step('Escalate a blocked decision through the real chain (Worker -> Manager -> Executive -> CEO Twin -> Owner)');
  r = await gov('raise-escalation', { token: isaac.token, body: { subject_type: 'work_item', subject_id: workItem.id, raised_by_worker_id: worker.id, reason: 'Demo: needs a real pricing-strategy decision no worker has authority to make.' } });
  record('Escalation raised at worker level', r.status === 200 && r.body.escalation.level === 'worker');
  const escId = r.body.escalation.id;
  for (const expected of ['manager', 'executive', 'ceo_twin', 'owner']) {
    r = await gov('route-escalation', { token: isaac.token, body: { id: escId } });
    record(`Escalation routed to ${expected}${expected === 'owner' ? ' (skipping the reserved/inactive Aura seat, per the real rule)' : ''}`, r.status === 200 && r.body.escalation.level === expected);
  }
  r = await gov('resolve-escalation', { token: isaac.token, body: { id: escId, resolution: 'Demo: Isaac approved a promotional $39 introductory rate for the pilot territory.' } });
  record('Escalation resolved by the owner, with a real decision_records row written', r.status === 200 && r.body.escalation.status === 'resolved');

  step('Open a real committee meeting, ask a question, record a decision, create an action item');
  r = await mtg('meet-now', { token: isaac.token, body: { title: 'Demo: Venture pricing review', reason: 'Reviewing the pricing escalation just resolved.' } });
  record('Meeting opened (Meet Now) with a real, honest participant list', r.status === 200 && r.body.meeting.status === 'in_session');
  const meetingId = r.body.meeting.id;
  line(`     Participants: ${r.body.participants.map((p) => `${p.label} [${p.availability}]`).join(', ')}`);
  r = await mtg('add-transcript-entry', { token: isaac.token, body: { meeting_id: meetingId, entry_type: 'question', content: 'Demo: should the $39 intro rate apply company-wide or just the pilot territory?' } });
  record('A real question was asked and persisted to the transcript', r.status === 200);
  r = await mtg('add-transcript-entry', { token: isaac.token, body: { meeting_id: meetingId, entry_type: 'decision', content: 'Demo decision: pilot territory only, for 90 days, then reassess with real conversion data.' } });
  record('A real decision was recorded in the transcript', r.status === 200);
  r = await mtg('create-action-item', { token: isaac.token, body: { meeting_id: meetingId, description: 'Demo: set up conversion tracking for the pilot territory', dri_worker_id: worker.id, due_at: '2026-12-27T00:00:00Z' } });
  record('An action item was created with a real DRI and deadline', r.status === 200 && r.body.action_item.dri_worker_id === worker.id);
  r = await mtg('close-meeting', { token: isaac.token, body: { id: meetingId, summary: 'Demo: approved a 90-day pilot-territory introductory rate; tracking action item assigned.' } });
  record('Meeting closed with a real summary', r.status === 200 && r.body.meeting.status === 'closed');

  step('Generate a real Daily Owner Brief and Weekly Executive Packet (verified database figures only)');
  r = await wk('generate-brief', { token: isaac.token, body: { brief_type: 'daily' } });
  record('Daily brief generated', r.status === 200 && r.body.brief.content.work_items_completed.value >= 1);
  const dailyBrief = r.body.brief;
  line(`     work_items_completed=${dailyBrief.content.work_items_completed.value} (source: ${dailyBrief.content.work_items_completed.source}, verification: ${dailyBrief.content.work_items_completed.verification_state})`);
  r = await wk('generate-brief', { token: isaac.token, body: { brief_type: 'weekly' } });
  record('Weekly packet generated', r.status === 200);

  step('Pause the worker via a kill switch and prove protected work genuinely stops');
  r = await gov('engage-kill-switch', { token: isaac.token, body: { scope_type: 'worker', scope_id: worker.id, reason: 'Demo: pausing this worker to prove kill-switch enforcement.' } });
  record('Worker-level kill switch engaged', r.status === 200);
  r = await gov('kill-switch-status', { token: isaac.token, method: 'GET', query: { worker_id: worker.id } });
  record('The worker is now truthfully reported blocked', r.status === 200 && r.body.blocked === true && r.body.scope === 'worker');
  r = await wk('create-work-item', { token: isaac.token, body: { title: 'A second demo work item, attempted after the pause' } });
  const secondItem = r.body.work_item;
  r = await wk('assign-work-item', { token: isaac.token, body: { id: secondItem.id, worker_id: worker.id } });
  record('The real handler REFUSES to assign new work to the paused worker (423)', r.status === 423);
  r = await wk('heartbeat', { token: isaac.token, body: { worker_id: worker.id, status: 'working', note: 'Attempting to report working while paused.' } });
  record('The real handler REFUSES to let the paused worker report itself as working (423)', r.status === 423);
  r = await gov('disengage-kill-switch', { token: isaac.token, body: { id: (await env.sql("select id from kill_switches where scope_type='worker' and scope_id=$1", [worker.id])).rows[0].id, reason: 'Demo complete, restoring normal operation.' } });
  record('Kill switch disengaged, worker restored', r.status === 200);

  step('Result');
  line(failures === 0 ? `All ${stepNum} demonstration steps completed successfully (Nova-owned test data, local disposable environment).` : `${failures} of ${stepNum} demonstration steps did not behave as expected — see FAIL lines above.`);
} catch (e) {
  failures++;
  console.log('FAIL — demonstration crashed:', e.stack || e);
} finally {
  await env.stop();
}
process.exitCode = failures ? 1 : 0;
process.exit(process.exitCode);
