// Pure, framework-agnostic job-queue algorithm — the exact same claim/complete/fail/recovery
// semantics as supabase/durable-jobs-migration-standalone.sql's claim_next_job() Postgres
// function, expressed as plain JS operating on an array of job objects. This is what makes the
// leasing/retry/dead-letter/idempotency design independently, deterministically testable with
// zero database dependency (see scripts/unit_job_queue_test.mjs) — the same split this session
// already used for api/_auditClock.js (pure logic unit-tested; live-DB concurrency behavior
// proven by an e2e test once the migration is actually applied).
//
// worker/localJobStore.mjs uses these functions directly against a JSON-file-backed array for a
// fully offline, runnable local mode. worker/postgresJobStore.mjs calls the real SQL function for
// production, sharing this same algorithm by construction (not by hope) since both stores must
// pass the identical scripts/unit_job_queue_test.mjs behavioral contract.

export function claimNextJob(jobs, { workerId, now = new Date(), leaseSeconds = 60, jobTypes = null }) {
  const isEligibleType = (j) => !jobTypes || jobTypes.includes(j.job_type);

  let candidate = jobs.find((j) => j.status === 'pending' && new Date(j.scheduled_at) <= now && isEligibleType(j));
  if (!candidate) {
    // Recovery: a job whose lease expired — its worker crashed, was killed, or lost connectivity
    // mid-processing — is picked back up exactly like a fresh pending job. This is the actual
    // "tested recovery" proof: no operator intervention required for a worker crash to self-heal.
    candidate = jobs.find((j) => j.status === 'leased' && j.leased_until && new Date(j.leased_until) < now && isEligibleType(j));
  }
  if (!candidate) return null;

  candidate.status = 'leased';
  candidate.leased_by = workerId;
  candidate.leased_until = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
  candidate.attempts += 1;
  return candidate;
}

export function completeJob(jobs, jobId, result = null, { now = new Date() } = {}) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return null;
  job.status = 'completed';
  job.result = result;
  job.completed_at = now.toISOString();
  return job;
}

// Exponential backoff (30s, 60s, 120s, 240s, ...) rather than an immediate retry hammering a
// still-failing dependency. A job that has exhausted max_attempts moves to dead_letter instead of
// silently disappearing or retrying forever — it needs a human to look at it.
export function failJob(jobs, jobId, error, { now = new Date(), baseDelaySeconds = 30 } = {}) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return null;
  job.last_error = String(error?.message || error || 'Unknown error');
  if (job.attempts >= job.max_attempts) {
    job.status = 'dead_letter';
  } else {
    job.status = 'pending';
    const delayMs = baseDelaySeconds * 1000 * Math.pow(2, job.attempts - 1);
    job.scheduled_at = new Date(now.getTime() + delayMs).toISOString();
    job.leased_by = null;
    job.leased_until = null;
  }
  return job;
}

export function enqueueJob(jobs, { id, job_type, organization_id = null, payload = {}, scheduled_at, max_attempts = 5, idempotency_key = null }) {
  if (idempotency_key && jobs.some((j) => j.idempotency_key === idempotency_key)) {
    return { job: jobs.find((j) => j.idempotency_key === idempotency_key), deduped: true };
  }
  const job = {
    id, job_type, organization_id, payload,
    status: 'pending',
    scheduled_at: scheduled_at || new Date().toISOString(),
    leased_by: null, leased_until: null,
    attempts: 0, max_attempts,
    last_error: null, idempotency_key, result: null,
    created_at: new Date().toISOString(), completed_at: null,
  };
  jobs.push(job);
  return { job, deduped: false };
}
