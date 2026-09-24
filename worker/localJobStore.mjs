// A fully local, file-backed job store — zero external services required. Wraps the exact same
// worker/jobQueueEngine.mjs algorithm proven in scripts/unit_job_queue_test.mjs against a JSON
// file on disk, so `node worker/index.mjs --local` is a genuinely runnable, persistent (jobs
// survive a process restart, since they're read back from the file) local implementation — not a
// scaffold that only pretends to work. This is what production-mode worker/postgresJobStore.mjs
// replaces with real Postgres once the durable-jobs migration is applied; both stores expose the
// identical claim/complete/fail/enqueue contract.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { claimNextJob, completeJob, failJob, enqueueJob, cancelJob } from './jobQueueEngine.mjs';

export function createLocalJobStore(filePath = '.data/jobs.local.json') {
  const dir = filePath.split(/[\\/]/).slice(0, -1).join('/');
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  function load() {
    if (!fs.existsSync(filePath)) return [];
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
  }
  function save(jobs) {
    fs.writeFileSync(filePath, JSON.stringify(jobs, null, 2));
  }

  return {
    async enqueue(spec) {
      const jobs = load();
      const result = enqueueJob(jobs, { id: crypto.randomUUID(), ...spec });
      save(jobs);
      return result;
    },
    async claimNext({ workerId, jobTypes, leaseSeconds }) {
      const jobs = load();
      const claimed = claimNextJob(jobs, { workerId, jobTypes, leaseSeconds, now: new Date() });
      if (claimed) save(jobs);
      return claimed;
    },
    async complete(jobId, result) {
      const jobs = load();
      const job = completeJob(jobs, jobId, result);
      save(jobs);
      return job;
    },
    async fail(jobId, error) {
      const jobs = load();
      const job = failJob(jobs, jobId, error, { now: new Date() });
      save(jobs);
      return job;
    },
    async cancel(jobId, reason) {
      const jobs = load();
      const result = cancelJob(jobs, jobId, reason);
      save(jobs);
      return result;
    },
    async listAll() {
      return load();
    },
  };
}
