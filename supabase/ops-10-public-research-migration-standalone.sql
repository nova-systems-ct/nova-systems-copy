-- Public-first audit research (owner brief 2026-10-30 §4). Additive and idempotent.
--  * audit_research_runs: one row per research run with visible step-by-step progress; resumable/inspectable; at most one
--    active run per audit (partial unique index), so a double tap or a retry never starts two.
--  * public_research_cache: cached public lookups (OpenStreetMap geocoder / map queries, competitor home pages) to respect
--    provider usage policies and keep repeat demos fast. Holds public data only, never client-private material.
--  * audit_findings.module_key: which Nova module would address the finding (prescription mapping in the report).
CREATE TABLE IF NOT EXISTS audit_research_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id          UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  scope            TEXT NOT NULL DEFAULT 'demo' CHECK (scope IN ('demo', 'full')),
  steps            JSONB NOT NULL DEFAULT '[]',
  summary          JSONB,
  error            TEXT,
  requested_by     UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  heartbeat_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS audit_research_runs_case ON audit_research_runs (case_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS audit_research_runs_one_active ON audit_research_runs (case_id) WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS public_research_cache (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS module_key TEXT;

ALTER TABLE audit_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_research_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_research_runs, public_research_cache FROM anon, authenticated;
GRANT ALL ON audit_research_runs, public_research_cache TO service_role;
