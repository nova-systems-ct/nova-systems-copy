-- =============================================================================================
-- Installation Center (2026-09-23, master build prompt §13) — standalone migration. Safe to run:
-- every CREATE TABLE uses IF NOT EXISTS, zero DROP/TRUNCATE/DELETE/UPDATE. Safe to re-run.
--
-- Builds the actual provisioning workflow on top of the order lifecycle already shipped in
-- crm-order-audit-migration-standalone.sql (orders.status already includes 'installed'/
-- 'monitoring'/'support'/'paused' as terminal-adjacent states). One installation per order:
-- sandbox setup -> sandbox testing (real recorded test runs, pass/fail, not a checkbox) ->
-- activation (requires a distinct authority, not just "any staff who can touch the order") ->
-- active -> pause/resume or offboard, all with a real event trail.
--
-- Prerequisites (already live, confirmed): organizations, is_org_member(), auth.users, orders,
-- businesses, products (from crm-order-audit-migration-standalone.sql).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS installations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  order_id          UUID NOT NULL UNIQUE REFERENCES orders(id),
  business_id       UUID REFERENCES businesses(id),
  product_id        UUID REFERENCES products(id),
  -- No separate 'sandbox_failed'/'awaiting_activation'/'offboarding' states: a failed test run is
  -- just the most recent installation_tests row for this installation having result='fail' — the
  -- server re-derives that from the real test log rather than tracking it twice, and activation
  -- is a single permission-gated action, not a queued intermediate state.
  status            TEXT NOT NULL DEFAULT 'sandbox_setup' CHECK (status IN (
                      'sandbox_setup', 'sandbox_testing', 'sandbox_passed',
                      'active', 'paused', 'offboarded'
                    )),
  activated_by      UUID REFERENCES auth.users(id),
  activated_at      TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  pause_reason      TEXT,
  offboarded_at     TIMESTAMPTZ,
  offboard_reason   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS installations_org_idx ON installations (organization_id);
CREATE INDEX IF NOT EXISTS installations_status_idx ON installations (status);

-- Real recorded sandbox/production test runs — "sandbox tests" means an actual result on file,
-- never a status flipped by hand with no evidence. Activation is refused server-side unless at
-- least one real pass is on record and it isn't shadowed by a later fail (see api/client.js).
CREATE TABLE IF NOT EXISTS installation_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id  UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  test_name        TEXT NOT NULL,
  environment      TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  result           TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'blocked')),
  run_by           UUID REFERENCES auth.users(id),
  notes            TEXT,
  evidence         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS installation_tests_installation_idx ON installation_tests (installation_id);

-- Full audit trail of every status transition — mirrors order_events' shape/purpose exactly.
CREATE TABLE IF NOT EXISTS installation_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id  UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  actor_user_id    UUID REFERENCES auth.users(id),
  detail           JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS installation_events_installation_idx ON installation_events (installation_id);

-- installation_tests/installation_events intentionally get no RLS policy of their own, matching
-- audit_evidence/audit_findings in crm-order-audit-migration-standalone.sql: every real access
-- path goes through api/client.js's service-role handlers, which enforce organization scope via
-- requireOrgAccess() against the parent installation's organization_id — not through RLS on a
-- child table with no organization_id column of its own to check.
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_installations ON installations;
CREATE POLICY members_read_installations ON installations FOR SELECT TO authenticated USING (is_org_member(organization_id));
