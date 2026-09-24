-- =============================================================================================
-- Durable job queue (2026-09-24, master build prompt §20) — standalone migration. Safe to run:
-- CREATE TABLE IF NOT EXISTS, zero DROP/TRUNCATE/DELETE/UPDATE.
--
-- This is the ONE durable runtime primitive every scheduled/background need in this codebase
-- shares: marketing scheduled publishing (§17), audit research steps (§9), Zion render-status
-- polling (§16), CRM follow-up sequences (§12) — one real, tested queue instead of a bespoke timer
-- per feature. See docs/RUNTIME_HOSTING_RECOMMENDATION.md for why this table lives in the existing
-- Supabase Postgres (zero new infrastructure for the queue itself) while a small always-on worker
-- process (not a Vercel serverless function — see that doc for why) is what actually polls it.
--
-- job_type is an open vocabulary, not a CHECK-constrained enum — new job types are added by
-- registering a handler in worker/index.mjs, not by altering this table, matching how the rest of
-- this codebase treats "resource"/"op" as open dispatch keys rather than a fixed list baked into
-- the schema.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type          TEXT NOT NULL,
  organization_id   UUID REFERENCES organizations(id),
  payload           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'completed', 'failed', 'dead_letter', 'cancelled')),
  scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  leased_by         TEXT,
  leased_until      TIMESTAMPTZ,
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  last_error        TEXT,
  -- Prevents the same logical job (e.g. "publish post X") from ever being enqueued twice, even if
  -- the enqueue call itself is retried — real duplicate-side-effect prevention, not just a UNIQUE
  -- id which a caller could trivially bypass by generating a new one.
  idempotency_key   TEXT UNIQUE,
  result            JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jobs_status_scheduled_idx ON jobs (status, scheduled_at);
CREATE INDEX IF NOT EXISTS jobs_org_idx ON jobs (organization_id);
CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs (job_type);

-- Atomically claims the next eligible job for a worker: either a genuinely pending job whose
-- scheduled_at has arrived, or a 'leased' job whose lease expired (its worker crashed or was
-- killed mid-processing — real recovery, not just a retry-on-restart hope). FOR UPDATE SKIP LOCKED
-- makes concurrent workers safe: two workers polling at once can never claim the same row, each
-- just skips rows the other already has locked rather than blocking or double-claiming.
CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT, p_job_types TEXT[] DEFAULT NULL, p_lease_seconds INTEGER DEFAULT 60)
RETURNS SETOF jobs AS $$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT id INTO v_job_id
  FROM jobs
  WHERE status = 'pending'
    AND scheduled_at <= now()
    AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
  ORDER BY scheduled_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
    FROM jobs
    WHERE status = 'leased'
      AND leased_until < now()
      AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY leased_until ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  END IF;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE jobs
  SET status = 'leased', leased_by = p_worker_id, leased_until = now() + (p_lease_seconds || ' seconds')::interval, attempts = attempts + 1
  WHERE id = v_job_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_jobs ON jobs;
CREATE POLICY members_read_jobs ON jobs FOR SELECT TO authenticated USING (organization_id IS NULL OR is_org_member(organization_id));
