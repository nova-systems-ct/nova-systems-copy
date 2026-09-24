// Production job store — real Supabase Postgres via the service-role key, using the
// claim_next_job() SQL function from supabase/durable-jobs-migration-standalone.sql for safe
// concurrent leasing (FOR UPDATE SKIP LOCKED). Same claim/complete/fail/enqueue contract as
// worker/localJobStore.mjs, so worker/index.mjs's poll loop and job handlers are identical in
// both modes — only which store gets constructed differs.

export function createPostgresJobStore({ url, serviceKey }) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  return {
    async enqueue({ job_type, organization_id = null, payload = {}, scheduled_at, max_attempts = 5, idempotency_key = null }) {
      const r = await fetch(`${url}/rest/v1/jobs`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation,resolution=ignore-duplicates' },
        body: JSON.stringify({ job_type, organization_id, payload, scheduled_at: scheduled_at || new Date().toISOString(), max_attempts, idempotency_key }),
      });
      if (!r.ok) {
        const text = await r.text();
        // A duplicate idempotency_key hits the real UNIQUE constraint — treated as a successful
        // dedup, not an error, matching worker/localJobStore.mjs's behavior exactly.
        if (r.status === 409 || /duplicate key/i.test(text)) return { deduped: true };
        throw new Error(`Failed to enqueue job: ${r.status} ${text}`);
      }
      const rows = await r.json();
      return { job: rows[0], deduped: rows.length === 0 };
    },

    async claimNext({ workerId, jobTypes = null, leaseSeconds = 60 }) {
      const r = await fetch(`${url}/rest/v1/rpc/claim_next_job`, {
        method: 'POST', headers,
        body: JSON.stringify({ p_worker_id: workerId, p_job_types: jobTypes, p_lease_seconds: leaseSeconds }),
      });
      if (!r.ok) throw new Error(`claim_next_job failed: ${r.status} ${await r.text()}`);
      const rows = await r.json();
      return rows[0] || null;
    },

    async complete(jobId, result) {
      const r = await fetch(`${url}/rest/v1/jobs?id=eq.${encodeURIComponent(jobId)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'completed', result, completed_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`Failed to complete job: ${r.status} ${await r.text()}`);
      const rows = await r.json();
      return rows[0];
    },

    async fail(jobId, error) {
      // Read the job back to decide dead_letter vs. backoff retry using the SAME thresholds the
      // pure engine uses — re-implemented here rather than imported because this store talks to
      // Postgres, not an in-memory array, but the decision logic is identical by design and
      // covered by the shared behavioral contract scripts/unit_job_queue_test.mjs proves.
      const getRes = await fetch(`${url}/rest/v1/jobs?id=eq.${encodeURIComponent(jobId)}&select=attempts,max_attempts`, { headers });
      const [job] = getRes.ok ? await getRes.json() : [];
      const message = String(error?.message || error || 'Unknown error');
      const patch = job && job.attempts >= job.max_attempts
        ? { status: 'dead_letter', last_error: message }
        : { status: 'pending', last_error: message, leased_by: null, leased_until: null, scheduled_at: new Date(Date.now() + 30_000 * Math.pow(2, (job?.attempts || 1) - 1)).toISOString() };
      const r = await fetch(`${url}/rest/v1/jobs?id=eq.${encodeURIComponent(jobId)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`Failed to record job failure: ${r.status} ${await r.text()}`);
      const rows = await r.json();
      return rows[0];
    },
  };
}
