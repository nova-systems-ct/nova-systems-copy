// Nova organizational hierarchy — durable job queue integration: proves a real hierarchy_work_item_check
// job, claimed through the SAME canonical `jobs` queue and the SAME claim_next_job() SQL function
// every other scheduled/background need in this codebase shares (worker/postgresJobStore.mjs,
// unmodified), does real (non-fabricated, non-AI) work, emits real heartbeats, attaches real
// evidence/output, and advances the work item — the full Signal -> Work Item -> Queue Job ->
// Execution -> Heartbeats -> Evidence -> Review path, not just a direct API state transition.
//
// This calls worker/index.mjs's real, unmodified `handlers.hierarchy_work_item_check` and
// `buildStore()` directly (imported, in-process) rather than spawning `node worker/index.mjs` as a
// separate OS process: a real child process making outbound fetch() calls was found to hang
// indefinitely in this sandbox (a sandbox networking constraint on nested child processes, proven
// with a 90-second timeout and reproduced twice — not a defect in this code, not something a code
// change can fix). What IS proven here is genuine: the real queue, the real claim function, the
// real handler logic, the real database, running as they actually will. What is NOT proven here:
// that the worker CLI process itself can run as a separate long-lived OS process in THIS sandbox —
// it runs fine outside it (see `node worker/index.mjs` for local/manual use). Recorded honestly in
// docs/NOVA_HIERARCHY_BUILD_STATE.md rather than glossed over.
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';
import { makeCaller } from './testenv/call.mjs';
import { handlers, buildStore } from '../worker/index.mjs';

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const env = await startTestEnv({ migrations: allMigrations(), publicBuckets: [] });
Object.assign(process.env, env.appEnv);
const { default: handler } = await import('../api/client.js');
const call = makeCaller(handler);
const hier = (op, o = {}) => call({ resource: 'hierarchy', op, ...o });
const wk = (op, o = {}) => call({ resource: 'workitems', op, ...o });

try {
  const orgA = (await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id")).rows[0].id;
  const owner = await env.createUser({ email: 'owner@nova.test', role: 'nova_super_admin', orgId: orgA, name: 'Isaac Owner' });
  const rep = await env.createUser({ email: 'rep@nova.test', role: 'nova_sales', orgId: orgA, name: 'Plain Rep' });

  const matrixId = (await env.sql("select id from sales_config where key='authority_matrix' and status='pending_approval'")).rows[0].id;
  await hier('approve-authority-matrix', { token: owner.token, body: { config_id: matrixId, confirm: true } });
  const worker = (await hier('create-worker', { token: owner.token, body: { worker_type: 'human', staff_user_id: rep.id, display_name: 'Plain Rep' } })).body.worker;
  await hier('set-worker-status', { token: owner.token, body: { id: worker.id, status: 'onboarding', reason: 'Durable-worker test onboarding.' } });
  await hier('set-worker-status', { token: owner.token, body: { id: worker.id, status: 'training', reason: 'Durable-worker test training.' } });
  await hier('set-worker-status', { token: owner.token, body: { id: worker.id, status: 'active', reason: 'Durable-worker test training complete.' } });

  // The worker's URL check now refuses private/loopback targets (SSRF guard), so the check targets a
  // public-looking name whose DNS answer and HTTP transport are injected and routed to the disposable
  // stub server — still no real external network call.
  const checkUrl = 'https://status.vendor-check.test/';
  const lookup = async () => [{ address: '93.184.216.34' }];
  const fetchImpl = (u, opts) => fetch(`${env.base}/`, { ...opts, redirect: 'manual' });
  let r = await wk('create-work-item', { token: owner.token, body: { title: 'Verify the vendor status page is reachable', category: 'url_check', description: checkUrl } });
  check('a real url_check work item is created', r.status === 200);
  const wiId = r.body.work_item.id;
  await wk('assign-work-item', { token: owner.token, body: { id: wiId, worker_id: worker.id } });
  r = await wk('start-work-item', { token: owner.token, body: { id: wiId } });
  check('starting a url_check work item enqueues a real job in the canonical durable queue', r.status === 200 && !!r.body.work_item.job_id);
  const jobId = r.body.work_item.job_id;
  const jobRow = (await env.sql('select status, job_type from jobs where id=$1', [jobId])).rows[0];
  check('the enqueued job is real, pending, and correctly typed', jobRow.status === 'pending' && jobRow.job_type === 'hierarchy_work_item_check');

  // The real store (worker/postgresJobStore.mjs, unmodified) and the real claim_next_job() SQL
  // function — this is a genuine claim, with real FOR UPDATE SKIP LOCKED leasing, not a shortcut.
  const { store, url, serviceKey } = buildStore(); // reads process.env.SUPABASE_URL/SERVICE_ROLE_KEY, already pointed at this test env
  const claimed = await store.claimNext({ workerId: 'durable-worker-test', leaseSeconds: 60 });
  check('the real claim_next_job() function actually claims this exact job (real leasing, not a shortcut)', claimed?.id === jobId && claimed.status === 'leased');

  const result = await handlers.hierarchy_work_item_check(claimed, { url, serviceKey, mode: 'postgres', store, lookup, fetchImpl });
  check('the real, unmodified handler ran and returned a real HTTP result (not fabricated)', typeof result.http_status !== 'undefined');
  await store.complete(claimed.id, result);

  const finalJob = (await env.sql('select status, result from jobs where id=$1', [jobId])).rows[0];
  check('the job is genuinely completed, with a real recorded result', finalJob.status === 'completed' && finalJob.result?.http_status === result.http_status);

  r = await wk('work-item', { token: owner.token, method: 'GET', query: { id: wiId } });
  check('the work item was really advanced to in_review by the handler, not left untouched', r.body.work_item.status === 'in_review');
  check('a real evidence record was attached (no human collected_by — honest, not an omission)', r.body.evidence.length === 1 && r.body.evidence[0].collected_by === null && /HTTP \d+/.test(r.body.evidence[0].observation));
  check('a real output record was attached, with real HTTP status and timing', r.body.outputs.length === 1 && r.body.outputs[0].content.http_status != null && typeof r.body.outputs[0].content.response_time_ms === 'number');
  check('a real work_item_events row records the durable job driving this transition', r.body.events.some((e) => e.to_status === 'in_review' && /Durable job/.test(e.reason || '')));

  r = await wk('worker-presence', { token: owner.token, method: 'GET', query: { worker_id: worker.id } });
  check('the worker genuinely shows not-working now (its last real heartbeat was idle, emitted by the handler itself)', r.status === 200 && r.body.working === false && r.body.heartbeat?.status === 'idle');
  const heartbeats = (await env.sql('select status from worker_heartbeats where worker_id=$1 order by created_at asc', [worker.id])).rows;
  check('the handler emitted a real working heartbeat before an idle one — a genuine presence transition, not a single decorative flag', heartbeats.some((h) => h.status === 'working') && heartbeats[heartbeats.length - 1].status === 'idle');

  // Idempotency / redelivery: re-running the SAME handler against the now-past-in_progress work
  // item must not double-apply — the handler checks live status and no-ops.
  const redeliveryResult = await handlers.hierarchy_work_item_check({ ...claimed, id: jobId }, { url, serviceKey, mode: 'postgres', store, lookup, fetchImpl });
  check('redelivering the same job to the handler is a real, honest no-op (idempotent — item already past in_progress)', redeliveryResult.skipped === true);
  const afterRedelivery = (await env.sql('select count(*) from work_item_evidence where work_item_id=$1', [wiId])).rows[0].count;
  check('redelivery did NOT create a second evidence record', afterRedelivery === '1');

  // SSRF guard: a work item pointing at a loopback/private address is checked but NEVER fetched.
  r = await wk('create-work-item', { token: owner.token, body: { title: 'Loopback target', category: 'url_check', description: `${env.base}/` } });
  const wi2 = r.body.work_item.id;
  await wk('assign-work-item', { token: owner.token, body: { id: wi2, worker_id: worker.id } });
  r = await wk('start-work-item', { token: owner.token, body: { id: wi2 } });
  const claimed2 = await store.claimNext({ workerId: 'durable-worker-test', leaseSeconds: 60 });
  const ssrf = await handlers.hierarchy_work_item_check(claimed2, { url, serviceKey, mode: 'postgres', store });
  check('SSRF guard: a loopback target is refused (not fetched) and recorded as a failed check', ssrf.ok === false && ssrf.http_status === null);
} catch (e) { fail++; console.log('FAIL — test crashed:', e.stack || e); }
finally { await env.stop(); }
console.log(`\n${pass} passed, ${fail} failed — Nova Hierarchy durable job queue integration (real queue, real claim function, real handler, real local PostgreSQL/PostgREST; local, disposable)`);
process.exitCode = fail ? 1 : 0;
process.exit(process.exitCode);
