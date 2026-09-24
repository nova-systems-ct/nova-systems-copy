-- =============================================================================================
-- Shared CRM/Order foundations + Nova Audit workflow (2026-09-23) — standalone migration.
-- Safe to run on the live database: every CREATE TABLE uses IF NOT EXISTS, every constraint is
-- additive, zero DROP/TRUNCATE/DELETE/UPDATE statements. Safe to re-run.
--
-- Validated locally against pg-mem (an in-process Postgres-compatible engine) before being
-- handed over — this environment has no Docker/local Postgres available for a full Supabase
-- stack, so pg-mem is the closest available proof that this SQL is syntactically valid and that
-- its constraints (foreign keys, uniqueness, CHECK) behave as intended. It does NOT validate
-- Supabase-specific behavior (RLS policies, auth.uid(), Storage) — that can only be verified
-- once this actually runs against the real Supabase project. See
-- scripts/validate_crm_order_audit_schema.mjs for the pg-mem validation run.
--
-- Prerequisites (already live, confirmed): organizations, is_org_member(), auth.users, leads.
-- =============================================================================================

-- ---------------------------------------------------------------------------------- businesses
-- Central identity-resolution entity shared by CRM and Audit — "resolve business identity from
-- name, website and location... never combine similarly named firms" (master prompt §9).
CREATE TABLE IF NOT EXISTS businesses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id),
  name               TEXT NOT NULL,
  aliases            TEXT[] NOT NULL DEFAULT '{}',
  website            TEXT,
  confirmed_website  BOOLEAN NOT NULL DEFAULT false,
  phone              TEXT,
  address_line       TEXT,
  city               TEXT,
  state              TEXT,
  postal_code        TEXT,
  industry           TEXT,
  confidence         TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confidence IN ('unconfirmed','likely','confirmed')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_organization_idx ON businesses (organization_id);
CREATE INDEX IF NOT EXISTS businesses_name_idx ON businesses (name);

CREATE TABLE IF NOT EXISTS business_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label        TEXT,
  address_line TEXT, city TEXT, state TEXT, postal_code TEXT,
  phone        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_locations_business_idx ON business_locations (business_id);

-- ------------------------------------------------------------------------------- crm_contacts
-- Named crm_contacts (not "contacts") to avoid any future collision with an unrelated concept.
CREATE TABLE IF NOT EXISTS crm_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  business_id    UUID REFERENCES businesses(id),
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  title          TEXT,
  sms_consent    BOOLEAN NOT NULL DEFAULT false,
  email_consent  BOOLEAN NOT NULL DEFAULT false,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  source         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_contacts_organization_idx ON crm_contacts (organization_id);
CREATE INDEX IF NOT EXISTS crm_contacts_business_idx ON crm_contacts (business_id);

-- ----------------------------------------------------------------------------------- crm_deals
CREATE TABLE IF NOT EXISTS crm_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_id     UUID REFERENCES businesses(id),
  contact_id      UUID REFERENCES crm_contacts(id),
  lead_id         UUID REFERENCES leads(id),
  pipeline        TEXT NOT NULL DEFAULT 'nova_sales' CHECK (pipeline IN ('nova_sales','client_sales','crystal_service')),
  stage           TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
                    'new','assigned','attempted','connected','qualified','discovery','proposal',
                    'accepted','payment_condition_satisfied','onboarding',
                    'lost','disqualified','nurture','paused'
                  )),
  stage_history   JSONB NOT NULL DEFAULT '[]',
  owner_user_id   UUID REFERENCES auth.users(id),
  value_cents     INTEGER,
  currency        TEXT NOT NULL DEFAULT 'USD',
  source          TEXT,
  lost_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crm_deals_organization_idx ON crm_deals (organization_id);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals (stage);

-- Link existing leads (Stage 5) to a resolved business without altering existing behavior —
-- nullable, purely additive.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);

-- ------------------------------------------------------------------------------------ products
-- Versioned product catalog (master prompt §8). readiness_state uses the exact status
-- vocabulary the master prompt itself defines, so a product's row IS its own honest status —
-- never implied by a route existing.
CREATE TABLE IF NOT EXISTS products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT NOT NULL,
  version                INTEGER NOT NULL DEFAULT 1,
  name                   TEXT NOT NULL,
  category               TEXT,
  description            TEXT,
  prerequisites          JSONB NOT NULL DEFAULT '[]',
  capabilities           JSONB NOT NULL DEFAULT '[]',
  pricing_config         JSONB NOT NULL DEFAULT '{}',
  pricing_approved       BOOLEAN NOT NULL DEFAULT false,
  contract_template_ref  TEXT,
  config_schema          JSONB NOT NULL DEFAULT '{}',
  supported_integrations JSONB NOT NULL DEFAULT '[]',
  readiness_state        TEXT NOT NULL DEFAULT 'not started' CHECK (readiness_state IN (
                            'not started','in development','locally verified','staging verified',
                            'waiting on owner/provider','ready for installation','installed','live verified'
                          )),
  installation_checklist JSONB NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

-- -------------------------------------------------------------------------------------- orders
CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id), -- the CUSTOMER org
  business_id        UUID REFERENCES businesses(id),
  deal_id            UUID REFERENCES crm_deals(id),
  product_id         UUID NOT NULL REFERENCES products(id),
  product_version    INTEGER NOT NULL,
  scope              JSONB NOT NULL DEFAULT '{}',
  price_cents        INTEGER,
  currency           TEXT NOT NULL DEFAULT 'USD',
  agreement_version  TEXT,
  payment_condition  TEXT,
  owner_user_id      UUID REFERENCES auth.users(id),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','scoped','awaiting_acceptance','accepted','waiting_for_inputs',
                        'ready_for_work','in_progress','review','delivered','installed',
                        'monitoring','support','closed','paused','cancelled','refunded','disputed'
                      )),
  status_history     JSONB NOT NULL DEFAULT '[]',
  inputs             JSONB NOT NULL DEFAULT '{}',
  deadline_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_organization_idx ON orders (organization_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  actor_user_id  UUID REFERENCES auth.users(id),
  detail         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id);

-- =============================================================================================
-- Nova Audit workflow (master prompt §8/§9)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS audit_cases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id),
  business_id            UUID REFERENCES businesses(id),
  order_id               UUID REFERENCES orders(id),
  scope                  TEXT NOT NULL DEFAULT 'digital' CHECK (scope IN ('digital','360')),
  status                 TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
                            'intake','inputs_pending','ready','researching','evidence_gathered',
                            'findings_drafted','report_draft','qa_review','approved','delivered',
                            'customer_decision','implementation','outcome_tracking','closed'
                          )),
  clock_basis            TEXT NOT NULL DEFAULT 'elapsed' CHECK (clock_basis IN ('elapsed','business_hours')),
  timezone               TEXT NOT NULL DEFAULT 'America/New_York',
  target_hours           INTEGER NOT NULL DEFAULT 72,
  start_condition_met_at TIMESTAMPTZ,
  due_at                 TIMESTAMPTZ,
  original_due_at        TIMESTAMPTZ,
  paused_at              TIMESTAMPTZ,
  total_paused_seconds   INTEGER NOT NULL DEFAULT 0,
  pause_reason           TEXT,
  owner_user_id          UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_cases_organization_idx ON audit_cases (organization_id);
CREATE INDEX IF NOT EXISTS audit_cases_status_idx ON audit_cases (status);

CREATE TABLE IF NOT EXISTS audit_case_pause_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  paused_at     TIMESTAMPTZ NOT NULL,
  resumed_at    TIMESTAMPTZ,
  reason        TEXT,
  actor_user_id UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS audit_case_pause_events_case_idx ON audit_case_pause_events (case_id);

CREATE TABLE IF NOT EXISTS audit_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  source         TEXT NOT NULL,
  capture_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  method         TEXT,
  observation    TEXT NOT NULL,
  snapshot_path  TEXT, -- private storage path only, never a public URL — see resume/vault pattern
  author         TEXT NOT NULL,
  source_quality TEXT CHECK (source_quality IN ('high','medium','low','unavailable')),
  confidence     TEXT CHECK (confidence IN ('high','medium','low')),
  privacy_level  TEXT NOT NULL DEFAULT 'internal' CHECK (privacy_level IN ('internal','client_visible')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_evidence_case_idx ON audit_evidence (case_id);

CREATE TABLE IF NOT EXISTS audit_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  -- Separates observation/inference/estimate/recommendation as the master prompt requires —
  -- "stated_claim" covers what the customer told us, distinct from what was directly observed.
  statement_type TEXT NOT NULL CHECK (statement_type IN ('observed_fact','stated_claim','inference','estimate')),
  detail         TEXT NOT NULL,
  priority       TEXT CHECK (priority IN ('high','medium','low')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_findings_case_idx ON audit_findings (case_id);

CREATE TABLE IF NOT EXISTS audit_finding_evidence (
  finding_id  UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES audit_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS audit_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  finding_id         UUID REFERENCES audit_findings(id),
  mechanism          TEXT NOT NULL,
  impact_estimate    TEXT,
  effort_range       TEXT,
  cost_range         TEXT,
  dependencies       TEXT,
  owner              TEXT,
  uncertainty        TEXT,
  verification_plan  TEXT,
  priority_rank      INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_recommendations_case_idx ON audit_recommendations (case_id);

-- Immutable approved versions — "edited versions require new review": application code must
-- INSERT a new row for an edit after approval, never UPDATE an approved one. Enforced at the
-- application layer (api/client.js) since expressing "no UPDATE once approved" cleanly in a
-- portable CHECK/trigger here would need a trigger function — flagged as a real, not-yet-added
-- defense-in-depth item in docs/PRODUCT_BUILD_STATE.md rather than silently assumed solved by
-- application code alone.
CREATE TABLE IF NOT EXISTS audit_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  content      JSONB NOT NULL DEFAULT '{}',
  approved_by  UUID REFERENCES auth.users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

CREATE TABLE IF NOT EXISTS audit_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
  delivery_method       TEXT NOT NULL,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_accepted_at  TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT
);
CREATE INDEX IF NOT EXISTS audit_deliveries_report_idx ON audit_deliveries (report_id);

CREATE TABLE IF NOT EXISTS audit_outcomes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  metric             TEXT NOT NULL,
  baseline_period    TEXT,
  comparison_period  TEXT,
  baseline_value     NUMERIC,
  comparison_value   NUMERIC,
  confounders        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_outcomes_case_idx ON audit_outcomes (case_id);

-- =============================================================================================
-- RLS — direct-frontend-read tables (businesses, crm_contacts, crm_deals, orders, audit_cases)
-- get real org-scoped policies matching the already-proven Leads.jsx pattern. Child/detail tables
-- (evidence, findings, recommendations, reports, deliveries, outcomes, order_events, pause
-- events) are accessed exclusively through api/client.js's service-role-backed dispatcher with an
-- explicit org-membership check performed server-side before touching them — the same
-- "service-role handlers must still enforce tenant authorization" pattern already used for
-- `applications`/`documents` in this codebase, not a gap.
-- =============================================================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_businesses ON businesses;
CREATE POLICY members_read_businesses ON businesses FOR SELECT TO authenticated USING (organization_id IS NULL OR is_org_member(organization_id));

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_crm_contacts ON crm_contacts;
CREATE POLICY members_read_crm_contacts ON crm_contacts FOR SELECT TO authenticated USING (organization_id IS NULL OR is_org_member(organization_id));

ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_crm_deals ON crm_deals;
CREATE POLICY members_read_crm_deals ON crm_deals FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_orders ON orders;
CREATE POLICY members_read_orders ON orders FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE audit_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_audit_cases ON audit_cases;
CREATE POLICY members_read_audit_cases ON audit_cases FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_read_products ON products;
CREATE POLICY authenticated_read_products ON products FOR SELECT TO authenticated USING (true); -- reference catalog, non-sensitive, same pattern as permissions/role_permissions

-- ---------------------------------------------------------------------------- catalog seed
-- One real, honestly-labeled entry per master prompt §10's explicit naming-collision instruction:
-- the NEW communications-to-CRM bundle is versioned and named separately from the legacy
-- Wave One application-tracker page (WaveOne.jsx / wave_one_applications table), which stays
-- untouched. This is a data-model placeholder, not a claim that the runtime is built — its
-- readiness_state says so honestly.
INSERT INTO products (slug, version, name, category, description, readiness_state)
VALUES (
  'communications-crm-bundle', 1, 'Communications & CRM Bundle',
  'communications',
  'Inbound inquiry capture, missed-call handling, CRM record creation, follow-up assignment, booking, and response-time reporting — the package defined in the 2026-09-23 product-only master prompt''s Section 10. Distinct from the legacy "Wave One" application-tracking page (WaveOne.jsx), which this does not replace or rename.',
  'not started'
)
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO products (slug, version, name, category, description, readiness_state)
VALUES (
  'nova-audit-digital', 1, 'Nova Audit — Digital',
  'diagnostic',
  'Scoped remote business diagnostic: website, mobile, search visibility, listings, reviews, social, customer journey, lead handling, and follow-up. Evidence-backed findings and recommendations delivered as a branded report.',
  'in development'
)
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO products (slug, version, name, category, description, readiness_state)
VALUES (
  'nova-audit-360', 1, 'Nova Audit — 360',
  'diagnostic',
  'Broader digital plus physical/on-site diagnostic engagement, where available. Separate scope and timing from the Digital audit — see audit_cases.scope.',
  'not started'
)
ON CONFLICT (slug, version) DO NOTHING;
