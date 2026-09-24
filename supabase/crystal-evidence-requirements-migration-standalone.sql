-- =============================================================================================
-- Crystal — configurable completion evidence (2026-09-24, real correctness fix). "An uploaded
-- after-photo alone does not prove completion... Make evidence requirements configurable by
-- service instead of requiring an after-photo for every conceivable job." Standalone migration,
-- additive only. Safe to run.
-- =============================================================================================

-- Per-service evidence policy. NULL/missing fields mean "not yet configured" — the application
-- code treats an UNCONFIGURED service as the SAFE default (checklist complete + at least one
-- after photo), never as "no evidence required." A real business decision (e.g. "lawn mowing
-- doesn't need a photo, just checklist sign-off") must be explicitly set, never assumed.
ALTER TABLE crystal_service_catalog ADD COLUMN IF NOT EXISTS evidence_requirements JSONB NOT NULL DEFAULT '{}';
-- Shape: { requires_checklist_complete: bool, requires_after_photo: bool, min_after_photos: int }

-- Denormalized onto the job at creation time (same pattern already used for customer_id/
-- property_id) so completion evidence can be checked without a multi-hop join through
-- estimate -> quote_request -> service_catalog_id every time.
ALTER TABLE crystal_jobs ADD COLUMN IF NOT EXISTS service_catalog_id UUID REFERENCES crystal_service_catalog(id);
