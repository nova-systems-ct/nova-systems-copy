-- Team and job dispatch (Nova system 24) and the pay split (system 25).
--
--   * business_workers: the people who do a business's jobs (employees or independent pros). Each
--     gets a private link to a phone page with their jobs; only a SHA-256 of the link is stored.
--   * job_assignments: which worker does which job. "Done" on the worker's phone records the
--     completion evidence through the same journey step the owner uses.
--   * pay_split_rules: each business's own split, approved by the owner. Never defaulted.
--   * pay_split_entries: each person's share of the money actually received on a paid job.
--     A record only: paying anyone is done by a person, who marks it paid out.
--   * journeys.service_address: where the job is, when the customer gives it.
--
-- Depends on: organizations, is_org_member(), customer-journey-migration-standalone.sql.
-- Run before zz-public-schema-lockdown-standalone.sql. Safe to re-run. Changes no existing row.

ALTER TABLE journeys ADD COLUMN IF NOT EXISTS service_address TEXT;

CREATE TABLE IF NOT EXISTS business_workers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  kind             TEXT NOT NULL DEFAULT 'contractor' CHECK (kind IN ('employee', 'contractor')),
  active           BOOLEAN NOT NULL DEFAULT true,
  link_token_hash  TEXT UNIQUE,                 -- SHA-256 of the worker's private phone-page link
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_workers_org_idx ON business_workers (organization_id);

CREATE TABLE IF NOT EXISTS job_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  journey_id       UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  worker_id        UUID NOT NULL REFERENCES business_workers(id),
  status           TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'done', 'cancelled')),
  note             TEXT,
  assigned_by      TEXT,
  done_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'done' OR done_at IS NOT NULL)
);
-- One live assignment per job; reassigning cancels the old one first.
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_one_live_idx ON job_assignments (journey_id) WHERE status = 'assigned';
CREATE INDEX IF NOT EXISTS job_assignments_worker_idx ON job_assignments (worker_id, status);

CREATE TABLE IF NOT EXISTS pay_split_rules (
  organization_id  UUID PRIMARY KEY REFERENCES organizations(id),
  shares           JSONB NOT NULL,              -- [{ "label": "Pro", "percent": 50, "to_worker": true }, …] totalling 100
  approved         BOOLEAN NOT NULL DEFAULT false,
  approved_by      TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pay_split_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  journey_id       UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES business_workers(id),
  label            TEXT NOT NULL,
  percent          NUMERIC(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  basis_cents      INTEGER NOT NULL CHECK (basis_cents > 0),   -- money actually received on the job
  amount_cents     INTEGER NOT NULL CHECK (amount_cents >= 0),
  rule_snapshot    JSONB NOT NULL,                             -- the approved rule used, as it was
  paid_out_at      TIMESTAMPTZ,
  paid_out_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (journey_id, label)
);
CREATE INDEX IF NOT EXISTS pay_split_entries_org_idx ON pay_split_entries (organization_id, created_at);

ALTER TABLE business_workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_workers ON business_workers;
CREATE POLICY members_read_business_workers ON business_workers FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_job_assignments ON job_assignments;
CREATE POLICY members_read_job_assignments ON job_assignments FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE pay_split_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_pay_split_rules ON pay_split_rules;
CREATE POLICY members_read_pay_split_rules ON pay_split_rules FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE pay_split_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_pay_split_entries ON pay_split_entries;
CREATE POLICY members_read_pay_split_entries ON pay_split_entries FOR SELECT TO authenticated USING (is_org_member(organization_id));
