-- Finding re-checks (owner brief follow-up 2026-10-31 §3): a recorded finding is re-checked against the business's
-- current state without rewriting what was reviewed. The result sits beside it: still observed, no longer observed,
-- or not re-checked (with the reason, e.g. a source that is not connected). Additive and idempotent.
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS recheck_status TEXT;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS recheck_note TEXT;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS rechecked_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE audit_findings ADD CONSTRAINT audit_findings_recheck_status_check
    CHECK (recheck_status IS NULL OR recheck_status IN ('still_observed', 'no_longer_observed', 'not_rechecked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
