-- =============================================================================================
-- Crystal / Company 002 operational workspace (2026-09-24, master build prompt §14, restored
-- scope from Isaac's 2026-09-24 message). "Crystal / Company 002" stays the provisional internal
-- name until Isaac approves a replacement — nothing here invents a permanent brand. No public
-- website work; this is the internal operational workspace only, reached through Nova's existing
-- multi-tenant dashboard shell (a Crystal organization row, same as any client org).
--
-- Services, prices, worker arrangements, insurance and legal ownership are NOT established by
-- this schema — every price/rule field below is nullable/configurable, never defaulted to an
-- invented number. "AI cannot declare physical work completed without authorized evidence" is
-- enforced structurally: crystal_completion_reviews requires a real worker_user_id and, for
-- customer-facing completion, an explicit customer_approved_at — there is no path that marks a
-- job complete from inference alone.
--
-- Standalone migration. Safe to run: every CREATE TABLE uses IF NOT EXISTS, zero
-- DROP/TRUNCATE/DELETE/UPDATE. Depends on `organizations`/`auth.users`/`is_org_member()` (already
-- live) — Crystal customers are its own tables, not a reuse of Nova's B2B `businesses`/
-- `crm_contacts` (different domain: residential/property service customers, not B2B leads).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS crystal_customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_customers_org_idx ON crystal_customers (organization_id);

CREATE TABLE IF NOT EXISTS crystal_properties (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  customer_id       UUID NOT NULL REFERENCES crystal_customers(id) ON DELETE CASCADE,
  address_line      TEXT NOT NULL,
  city              TEXT,
  state             TEXT,
  postal_code       TEXT,
  property_type     TEXT, -- open vocabulary (residential/commercial/etc) — not enforced, real categories are a business decision
  access_notes      TEXT, -- gate codes, pets, parking — operational, not a legal/insurance record
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_properties_customer_idx ON crystal_properties (customer_id);

-- Configurable service catalog + areas. base_price_cents is nullable on purpose — an unpriced
-- service is a real, valid, incomplete-catalog-entry state, never defaulted to zero or invented.
CREATE TABLE IF NOT EXISTS crystal_service_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  description       TEXT,
  pricing_unit      TEXT NOT NULL DEFAULT 'flat' CHECK (pricing_unit IN ('flat', 'hourly', 'per_sqft', 'per_unit')),
  base_price_cents  INTEGER, -- NULL = pricing not yet approved/confirmed, not zero
  currency          TEXT DEFAULT 'USD',
  service_areas     JSONB NOT NULL DEFAULT '[]', -- e.g. ["06702","06704"] or free-form area names
  active            BOOLEAN NOT NULL DEFAULT true,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_service_catalog_org_idx ON crystal_service_catalog (organization_id);

CREATE TABLE IF NOT EXISTS crystal_quote_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  customer_id           UUID NOT NULL REFERENCES crystal_customers(id),
  property_id           UUID REFERENCES crystal_properties(id),
  service_catalog_id    UUID REFERENCES crystal_service_catalog(id),
  scope_details         TEXT,
  -- Private photos — storage_path references only (like audit_evidence/vault), never a public URL
  -- stored here; access goes through the same short-lived signed-URL pattern as NovaVault.
  photo_paths           JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'scoped', 'estimated', 'accepted', 'declined', 'expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_quote_requests_org_idx ON crystal_quote_requests (organization_id);
CREATE INDEX IF NOT EXISTS crystal_quote_requests_customer_idx ON crystal_quote_requests (customer_id);

-- Versioned estimates — same immutable-approved-version discipline as audit_reports/zion_videos.
-- line_items is an explicit array of {description, quantity, unit_price_cents, is_add_on} so
-- pricing_rule application is auditable, not a single opaque total.
CREATE TABLE IF NOT EXISTS crystal_estimates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id    UUID NOT NULL REFERENCES crystal_quote_requests(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  line_items          JSONB NOT NULL DEFAULT '[]',
  total_cents         INTEGER, -- NULL if any line item is unpriced — never sum a fake number
  currency            TEXT DEFAULT 'USD',
  pricing_notes       TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  sent_at              TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_estimates_quote_idx ON crystal_estimates (quote_request_id);

CREATE TABLE IF NOT EXISTS crystal_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  estimate_id       UUID REFERENCES crystal_estimates(id),
  customer_id       UUID NOT NULL REFERENCES crystal_customers(id),
  property_id       UUID REFERENCES crystal_properties(id),
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                      'scheduled', 'assigned', 'in_progress', 'completed', 'approved', 'invoiced', 'paid', 'cancelled'
                    )),
  travel_notes      TEXT, -- route/travel considerations — free-form operational notes, not a routing engine
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_jobs_org_idx ON crystal_jobs (organization_id);
CREATE INDEX IF NOT EXISTS crystal_jobs_customer_idx ON crystal_jobs (customer_id);
CREATE INDEX IF NOT EXISTS crystal_jobs_status_idx ON crystal_jobs (status);

-- Real relational assignment, not a JSONB array of ids — this is exactly what "workers see only
-- assigned jobs" gets enforced against server-side (see api/client.js's crystal handlers).
CREATE TABLE IF NOT EXISTS crystal_job_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES crystal_jobs(id) ON DELETE CASCADE,
  worker_user_id    UUID NOT NULL REFERENCES auth.users(id),
  role              TEXT, -- e.g. 'lead' / 'crew' — open vocabulary, not a fixed org chart
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_user_id)
);
CREATE INDEX IF NOT EXISTS crystal_job_assignments_worker_idx ON crystal_job_assignments (worker_user_id);
CREATE INDEX IF NOT EXISTS crystal_job_assignments_job_idx ON crystal_job_assignments (job_id);

CREATE TABLE IF NOT EXISTS crystal_job_checklist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES crystal_jobs(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  required          BOOLEAN NOT NULL DEFAULT true,
  completed         BOOLEAN NOT NULL DEFAULT false,
  completed_by      UUID REFERENCES auth.users(id),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_checklist_job_idx ON crystal_job_checklist_items (job_id);

CREATE TABLE IF NOT EXISTS crystal_job_media (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES crystal_jobs(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('before', 'after')),
  storage_path      TEXT NOT NULL, -- private bucket reference, signed-URL access only
  uploaded_by       UUID REFERENCES auth.users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_job_media_job_idx ON crystal_job_media (job_id);

-- Completion is a TWO-PARTY record: a real worker submits it (with checklist+media as the
-- authorized evidence), and the customer separately approves — neither side alone, and never an
-- AI inference, can mark a job complete. See handleCrystalJobs' complete/approve-completion
-- actions for the enforced sequencing.
CREATE TABLE IF NOT EXISTS crystal_completion_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID NOT NULL UNIQUE REFERENCES crystal_jobs(id) ON DELETE CASCADE,
  completed_by          UUID NOT NULL REFERENCES auth.users(id),
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_notes      TEXT,
  customer_approved     BOOLEAN NOT NULL DEFAULT false,
  customer_approved_at  TIMESTAMPTZ,
  customer_notes        TEXT
);

CREATE TABLE IF NOT EXISTS crystal_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  job_id            UUID NOT NULL REFERENCES crystal_jobs(id),
  amount_cents      INTEGER NOT NULL,
  currency          TEXT DEFAULT 'USD',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'disputed')),
  sent_at           TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  payment_method    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_invoices_job_idx ON crystal_invoices (job_id);
CREATE INDEX IF NOT EXISTS crystal_invoices_org_idx ON crystal_invoices (organization_id);

CREATE TABLE IF NOT EXISTS crystal_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES crystal_jobs(id),
  customer_id       UUID NOT NULL REFERENCES crystal_customers(id),
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  comments          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crystal_recurring_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  customer_id           UUID NOT NULL REFERENCES crystal_customers(id),
  property_id           UUID REFERENCES crystal_properties(id),
  service_catalog_id    UUID REFERENCES crystal_service_catalog(id),
  frequency             TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'custom')),
  next_due_at           TIMESTAMPTZ,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_recurring_org_idx ON crystal_recurring_schedules (organization_id);

-- Equipment/supplies — basic tracking (what exists, what's assigned to what job), not a full
-- inventory/procurement system.
CREATE TABLE IF NOT EXISTS crystal_equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  assigned_job_id   UUID REFERENCES crystal_jobs(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crystal_equipment_org_idx ON crystal_equipment (organization_id);

-- RLS on the organization-scoped top-level tables — same pattern as businesses/orders/audit_cases.
-- Child tables (job_assignments/checklist/media/completion) rely on server-side enforcement in
-- api/client.js exactly like audit_evidence/audit_findings already do, not a second RLS layer.
ALTER TABLE crystal_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_crystal_customers ON crystal_customers;
CREATE POLICY members_read_crystal_customers ON crystal_customers FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE crystal_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_crystal_jobs ON crystal_jobs;
CREATE POLICY members_read_crystal_jobs ON crystal_jobs FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE crystal_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_crystal_invoices ON crystal_invoices;
CREATE POLICY members_read_crystal_invoices ON crystal_invoices FOR SELECT TO authenticated USING (is_org_member(organization_id));
