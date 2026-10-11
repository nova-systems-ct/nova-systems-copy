-- =============================================================================================
-- Nova Organizational Hierarchy — part 3: WORK & REPORTING (durable work-item lifecycle, truthful
-- worker heartbeats, evidence/output/review, Venture Lab stage, Owner Brief/Executive Packet
-- generation, operational memory). Additive. NOT applied to production. Phase D of the Nova
-- Hierarchy master prompt (2026-09-28). Depends on parts 1 and 2.
--
-- Deliberately REUSED rather than duplicated: workers/positions/portfolio_entities (part 1),
-- decision_records (part 2, read by brief/packet generation below), model_runs (part 1 — extended
-- here with a work_item_id column instead of creating a second usage-ledger table), the
-- forbid_update_delete() append-only trigger function (part 1).
--
-- Scope note: work items are advanced by authenticated API calls (a human or a supervised script),
-- not by an autonomous background process — this migration does NOT wire work items into the
-- existing `jobs` lease/retry queue. "Durable" here means every state transition is a real,
-- persisted Postgres row with an append-only history, not that a background worker executes work
-- unattended. That remains explicitly future work — see docs/NOVA_HIERARCHY_BUILD_STATE.md.
-- =============================================================================================

-- ---- Venture Lab lifecycle: a stage field on the existing portfolio_entities row (part 1) rather
-- than a parallel "ventures" table — a venture IS a portfolio_entities row with entity_type =
-- 'experimental_venture'. NULL for every non-venture entity (the CHECK only fires when set).
-- Normal lifecycle: idea -> research -> zero_cost_validation -> demand_signal -> pre_sale ->
-- sandbox_mvp -> pilot -> scale, with paused/killed reachable from any active stage and archived
-- reachable from paused/killed. A silent jump (e.g. idea straight to scale, or resuming paused
-- into an arbitrary later stage) is refused by api/_hierarchy/rules.js ventureTransitionAllowed()
-- unless the caller explicitly overrides with written reason + evidence — enforced in
-- api/_hierarchy/workitems.js, never bypassable by just calling the endpoint differently.
ALTER TABLE portfolio_entities ADD COLUMN IF NOT EXISTS venture_stage TEXT
  CHECK (venture_stage IS NULL OR venture_stage IN ('idea', 'research', 'zero_cost_validation', 'demand_signal', 'pre_sale', 'sandbox_mvp', 'pilot', 'scale', 'paused', 'killed', 'archived'));
-- Structured venture-specific tracking (hypothesis, customer, offer, budget, worker hours, revenue
-- collected, costs, evidence, success/kill criteria, lessons) — one flexible JSONB column rather
-- than eleven near-always-empty ones; api/_hierarchy/workitems.js's save-venture-data validates shape.
ALTER TABLE portfolio_entities ADD COLUMN IF NOT EXISTS venture_data JSONB NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS venture_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_entity_id UUID NOT NULL REFERENCES portfolio_entities(id),
  from_stage TEXT, to_stage TEXT NOT NULL, changed_by UUID NOT NULL, reason TEXT,
  override BOOLEAN NOT NULL DEFAULT false, evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS venture_stage_events_immutable ON venture_stage_events;
CREATE TRIGGER venture_stage_events_immutable BEFORE UPDATE OR DELETE ON venture_stage_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- work items: the real, persisted unit of assigned work.
CREATE TABLE IF NOT EXISTS work_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_entity_id UUID REFERENCES portfolio_entities(id),
  org_unit_id         UUID REFERENCES org_units(id),
  worker_id           UUID REFERENCES workers(id),
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'general',
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'assigned', 'in_progress', 'blocked', 'in_review', 'approved', 'rejected', 'completed', 'cancelled', 'failed')),
  -- Real correlation with the canonical durable job queue (supabase/durable-jobs-migration-
  -- standalone.sql, part of BASE — already applied before this file). NOT every work item uses the
  -- queue (most advance via direct, supervised API calls) — job_id is set only for the categories
  -- api/_hierarchy/workitems.js actually enqueues (currently 'url_check'). See
  -- docs/NOVA_HIERARCHY_BUILD_STATE.md for exactly what "durable execution" covers today.
  job_id              UUID REFERENCES jobs(id),
  created_by          UUID NOT NULL,
  assigned_at         TIMESTAMPTZ, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, due_at TIMESTAMPTZ,
  cost_cents          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_items_worker_idx ON work_items (worker_id);
CREATE INDEX IF NOT EXISTS work_items_status_idx ON work_items (status);
CREATE INDEX IF NOT EXISTS work_items_portfolio_idx ON work_items (portfolio_entity_id);

CREATE TABLE IF NOT EXISTS work_item_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), work_item_id UUID NOT NULL REFERENCES work_items(id),
  from_status TEXT, to_status TEXT NOT NULL, changed_by UUID, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS work_item_events_immutable ON work_item_events;
CREATE TRIGGER work_item_events_immutable BEFORE UPDATE OR DELETE ON work_item_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- evidence: real sources/observations backing a work item's output — same shape as the Nova
-- Audit engine's audit_evidence, deliberately not merged with it since audit_evidence is scoped to
-- audit_cases specifically and this covers every other kind of work item.
CREATE TABLE IF NOT EXISTS work_item_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), work_item_id UUID NOT NULL REFERENCES work_items(id),
  -- collected_by is nullable: evidence gathered by a real durable worker/job (worker/index.mjs's
  -- hierarchy_work_item_check, for example) has no human collector to attribute it to — that is
  -- itself an honest fact worth being able to represent, not an omission to paper over.
  source TEXT NOT NULL, observation TEXT NOT NULL, collected_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS work_item_evidence_immutable ON work_item_evidence;
CREATE TRIGGER work_item_evidence_immutable BEFORE UPDATE OR DELETE ON work_item_evidence FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- outputs: append-only — a correction is a NEW output row, never an edit to a prior one, so
-- "what did the worker actually produce and when" can never be silently rewritten.
CREATE TABLE IF NOT EXISTS work_item_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), work_item_id UUID NOT NULL REFERENCES work_items(id),
  content JSONB NOT NULL, produced_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS work_item_outputs_immutable ON work_item_outputs;
CREATE TRIGGER work_item_outputs_immutable BEFORE UPDATE OR DELETE ON work_item_outputs FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

CREATE TABLE IF NOT EXISTS work_item_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), work_item_id UUID NOT NULL REFERENCES work_items(id),
  reviewer_id UUID NOT NULL, decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  notes TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS work_item_reviews_immutable ON work_item_reviews;
CREATE TRIGGER work_item_reviews_immutable BEFORE UPDATE OR DELETE ON work_item_reviews FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- truthful presence: a worker may be shown "working" ONLY when a real heartbeat exists within
-- a short, recent window AND it names a real in_progress work item — computed by
-- api/_hierarchy/rules.js isWorkerActuallyWorking(), never a decorative status flag. Append-only:
-- the presence history itself must be trustworthy.
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), worker_id UUID NOT NULL REFERENCES workers(id), work_item_id UUID REFERENCES work_items(id),
  status TEXT NOT NULL CHECK (status IN ('working', 'idle', 'blocked')), note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_heartbeats_worker_idx ON worker_heartbeats (worker_id, created_at DESC);
DROP TRIGGER IF EXISTS worker_heartbeats_immutable ON worker_heartbeats;
CREATE TRIGGER worker_heartbeats_immutable BEFORE UPDATE OR DELETE ON worker_heartbeats FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- model usage ledger (part 1's model_runs) extended to link to the work item it served —
-- still no API keys, no raw prompt/client-data text.
ALTER TABLE model_runs ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES work_items(id);

-- ---- Owner Brief / Executive Packet: a permanent, append-only snapshot of REAL figures pulled
-- from the database at generation time — never a stored narrative that could drift from the data
-- it once described. Each figure in `content` carries its own source table and verification state
-- (api/_hierarchy/reporting.js enforces this shape); "No verified data" is a legitimate value, not
-- an error, when nothing real exists yet for a section.
CREATE TABLE IF NOT EXISTS owner_briefs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_type    TEXT NOT NULL CHECK (brief_type IN ('daily', 'weekly')),
  period_start  TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL,
  generated_by  UUID NOT NULL, generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content       JSONB NOT NULL
);
DROP TRIGGER IF EXISTS owner_briefs_immutable ON owner_briefs;
CREATE TRIGGER owner_briefs_immutable BEFORE UPDATE OR DELETE ON owner_briefs FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- operational memory: versioned facts Nova has actually learned, with real provenance (what
-- produced this — a work item, a decision, a meeting) and an optional expiration, so stale
-- "knowledge" ages out instead of being trusted forever.
CREATE TABLE IF NOT EXISTS operational_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type  TEXT NOT NULL, scope_id UUID,
  key         TEXT NOT NULL,
  version     INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired')),
  content     JSONB NOT NULL,
  source_type TEXT, source_id UUID,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  UNIQUE (scope_type, scope_id, key, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS operational_memory_one_active ON operational_memory (scope_type, COALESCE(scope_id::text, ''), key) WHERE status = 'active';

ALTER TABLE venture_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_memory ENABLE ROW LEVEL SECURITY;

-- No new permissions: work/reporting reads use command.view, writes use command.owner (both
-- already granted in part 1) — consistent with parts 1-2, no permission sprawl.
