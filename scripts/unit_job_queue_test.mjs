// Pure unit test for worker/jobQueueEngine.mjs — zero database dependency, deterministic (fake
// clock via an explicit `now`), same pattern as scripts/unit_audit_clock_test.mjs. Proves the
// actual claims Isaac asked for evidence of: real job persistence semantics (enqueue/claim/
// complete) AND tested recovery (a crashed worker's lease expires and another worker reclaims the
// job; a failing job retries with backoff; a job that exhausts its attempts goes to dead_letter
// instead of vanishing or retrying forever).
// Usage: node scripts/unit_job_queue_test.mjs

import { claimNextJob, completeJob, failJob, enqueueJob } from '../worker/jobQueueEngine.mjs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

// ---- 1. Enqueue + idempotency ----
{
  const jobs = [];
  const { job, deduped } = enqueueJob(jobs, { id: 'a', job_type: 'marketing_publish', payload: { post_id: 'p1' }, idempotency_key: 'publish:p1' });
  log('Enqueue creates a real pending job', jobs.length === 1 && job.status === 'pending', JSON.stringify(job));
  const second = enqueueJob(jobs, { id: 'b', job_type: 'marketing_publish', payload: { post_id: 'p1' }, idempotency_key: 'publish:p1' });
  log('A duplicate idempotency_key is deduped, not enqueued twice', jobs.length === 1 && second.deduped === true, JSON.stringify(second));
}

// ---- 2. Claim respects scheduled_at (not eligible before its time) ----
{
  const jobs = [];
  const future = new Date(Date.now() + 3600_000).toISOString();
  enqueueJob(jobs, { id: 'c', job_type: 'marketing_publish', scheduled_at: future });
  const claimed = claimNextJob(jobs, { workerId: 'w1', now: new Date() });
  log('A job scheduled in the future is not claimed early', claimed === null, JSON.stringify(claimed));
}

// ---- 3. Real claim + complete lifecycle ----
{
  const jobs = [];
  const now = new Date();
  enqueueJob(jobs, { id: 'd', job_type: 'marketing_publish', scheduled_at: now.toISOString() });
  const claimed = claimNextJob(jobs, { workerId: 'w1', now });
  log('A due job is claimed, moves to leased, attempts increments', claimed?.status === 'leased' && claimed.attempts === 1 && claimed.leased_by === 'w1', JSON.stringify(claimed));
  const second = claimNextJob(jobs, { workerId: 'w2', now });
  log('A second worker polling immediately cannot claim the same job (not yet lease-expired)', second === null, JSON.stringify(second));
  completeJob(jobs, 'd', { published: true }, { now });
  log('Completing the job marks it completed with a result recorded', jobs[0].status === 'completed' && jobs[0].result.published === true, JSON.stringify(jobs[0]));
}

// ---- 4. TESTED RECOVERY: a crashed worker's lease expires and another worker reclaims it ----
{
  const jobs = [];
  const t0 = new Date('2026-09-24T12:00:00Z');
  enqueueJob(jobs, { id: 'e', job_type: 'audit_research_step', scheduled_at: t0.toISOString() });
  const claimedByW1 = claimNextJob(jobs, { workerId: 'worker-1', now: t0, leaseSeconds: 60 });
  log('Worker 1 claims the job', claimedByW1?.leased_by === 'worker-1', JSON.stringify(claimedByW1));
  // Worker 1 crashes here and never completes/fails the job — no code path runs for it again.
  const t0plus30 = new Date(t0.getTime() + 30_000);
  const stillLeased = claimNextJob(jobs, { workerId: 'worker-2', now: t0plus30 });
  log('Before the lease expires, a second worker cannot steal the job', stillLeased === null, JSON.stringify(stillLeased));
  const t0plus90 = new Date(t0.getTime() + 90_000); // past the 60s lease
  const recovered = claimNextJob(jobs, { workerId: 'worker-2', now: t0plus90 });
  log('RECOVERY: after the lease expires (worker-1 presumed crashed), worker-2 reclaims the exact same job — no manual intervention needed', recovered?.id === 'e' && recovered.leased_by === 'worker-2' && recovered.attempts === 2, JSON.stringify(recovered));
}

// ---- 5. Failure retries with exponential backoff, not immediately ----
{
  const jobs = [];
  const t0 = new Date('2026-09-24T12:00:00Z');
  enqueueJob(jobs, { id: 'f', job_type: 'zion_render_poll', scheduled_at: t0.toISOString(), max_attempts: 3 });
  claimNextJob(jobs, { workerId: 'w1', now: t0 });
  failJob(jobs, 'f', new Error('Provider timeout'), { now: t0, baseDelaySeconds: 30 });
  const afterFirstFail = jobs.find((j) => j.id === 'f');
  const retryDelaySeconds = (new Date(afterFirstFail.scheduled_at) - t0) / 1000;
  log('First failure schedules a retry ~30s later, not immediately, and returns to pending', afterFirstFail.status === 'pending' && retryDelaySeconds === 30, `scheduled_at=${afterFirstFail.scheduled_at} delay=${retryDelaySeconds}s`);

  const t1 = new Date(afterFirstFail.scheduled_at);
  claimNextJob(jobs, { workerId: 'w1', now: t1 });
  failJob(jobs, 'f', new Error('Provider timeout again'), { now: t1, baseDelaySeconds: 30 });
  const afterSecondFail = jobs.find((j) => j.id === 'f');
  const secondDelaySeconds = (new Date(afterSecondFail.scheduled_at) - t1) / 1000;
  log('Second failure backs off further (~60s), proving exponential growth not a fixed retry', afterSecondFail.status === 'pending' && secondDelaySeconds === 60, `delay=${secondDelaySeconds}s`);
}

// ---- 6. DEAD LETTER: exhausting max_attempts stops silent infinite retry ----
{
  const jobs = [];
  const t0 = new Date('2026-09-24T12:00:00Z');
  enqueueJob(jobs, { id: 'g', job_type: 'marketing_publish', scheduled_at: t0.toISOString(), max_attempts: 2 });
  claimNextJob(jobs, { workerId: 'w1', now: t0 }); // attempt 1
  failJob(jobs, 'g', new Error('fail 1'), { now: t0 });
  const t1 = new Date(jobs[0].scheduled_at);
  claimNextJob(jobs, { workerId: 'w1', now: t1 }); // attempt 2 — reaches max_attempts
  failJob(jobs, 'g', new Error('fail 2'), { now: t1 });
  log('Exhausting max_attempts moves the job to dead_letter, not an infinite retry loop', jobs[0].status === 'dead_letter' && jobs[0].last_error === 'fail 2', JSON.stringify(jobs[0]));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} unit checks passed`);
process.exit(passed === results.length ? 0 : 1);
