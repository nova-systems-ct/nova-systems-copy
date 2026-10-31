-- Executable workforce roles (owner brief 2026-10-30 §11): the executive assistant, COO, CFO and CMO perform real work as
-- durable tasks. A task is a work item (assignee, state, prerequisites, result, error, cost, handoff history in
-- work_item_events) driven by a queued job (lease, attempts, bounded retries). Financial inputs are only what the owner
-- enters or a connected source provides; without them the CFO's answer is "unknown". Additive and idempotent.
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS role_key TEXT;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS depends_on UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS work_items_role_open ON work_items (organization_id, role_key, status);

-- The owner's playbook settings the roles read (priorities, escalation timing, spending policy). Exact thresholds are
-- the owner's; nothing here is a standing spending authorization unless the owner sets it.
CREATE TABLE IF NOT EXISTS owner_preferences (
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  value            JSONB NOT NULL,
  updated_by       UUID,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);

-- Balances the CFO may use: entered by the owner or read from a connected source, always with "as of".
CREATE TABLE IF NOT EXISTS finance_balance_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_label    TEXT NOT NULL,
  balance_cents    BIGINT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  as_of            TIMESTAMPTZ NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('owner_entered', 'connected_account')),
  entered_by       UUID,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_balance_latest ON finance_balance_snapshots (organization_id, as_of DESC);

-- Proposed spending: CMO (or a person) proposes -> CFO checks funds, commitments and policy -> the required authority
-- decides -> the expense is recorded. Nothing here moves money.
CREATE TABLE IF NOT EXISTS expense_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_role  TEXT NOT NULL,
  purpose            TEXT NOT NULL,
  amount_cents       BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'USD',
  category           TEXT,
  campaign_ref       TEXT,
  status             TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'needs_owner', 'approved', 'denied', 'recorded', 'cancelled')),
  cfo_check          JSONB,
  authority          JSONB,
  decided_by         UUID,
  decided_at         TIMESTAMPTZ,
  recorded_at        TIMESTAMPTZ,
  work_item_id       UUID REFERENCES work_items(id) ON DELETE SET NULL,
  idempotency_key    TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_requests_org_status ON expense_requests (organization_id, status);

ALTER TABLE owner_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON owner_preferences, finance_balance_snapshots, expense_requests FROM anon, authenticated;
GRANT ALL ON owner_preferences, finance_balance_snapshots, expense_requests TO service_role;
