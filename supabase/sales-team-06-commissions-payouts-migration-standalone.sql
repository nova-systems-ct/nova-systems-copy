-- =============================================================================================
-- Nova Sales Team platform — part 6 of 6: COMMISSION LEDGER + PAYOUTS. Additive. NOT applied to production.
-- Depends on: parts 1 and 5.
-- No commission rate exists anywhere in this file. Rates live in an owner-approved, versioned sales_config('commission_plan') row;
-- until the owner approves one, no commission can be calculated and reps see "plan not yet approved".
-- The ledger is append-only in spirit: entries are never deleted, status moves only along the transitions below, money fields are frozen,
-- and every change writes an immutable event.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS sales_commission_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'adjustment')),
  parent_entry_id  UUID REFERENCES sales_commission_entries(id),
  rep_user_id      UUID NOT NULL REFERENCES auth.users(id),
  deal_id          UUID NOT NULL REFERENCES crm_deals(id),
  proposal_id      UUID REFERENCES crm_proposals(id),
  plan_config_id   UUID REFERENCES sales_config(id),
  plan_snapshot    JSONB NOT NULL DEFAULT '{}',          -- the exact plan (rules + conditions) this deal is locked to
  basis_cents      INTEGER NOT NULL,                      -- amount the percentage/flat rules were applied to
  amount_cents     INTEGER NOT NULL,                      -- negative only for adjustments (clawbacks)
  currency         TEXT NOT NULL DEFAULT 'USD',
  status           TEXT NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated', 'pending_conditions', 'eligible', 'owner_approved', 'scheduled', 'paid', 'failed', 'reversed', 'cancelled')),
  status_reason    TEXT,
  eligible_after   TIMESTAMPTZ,                           -- payment received + hold-back period
  eligible_at      TIMESTAMPTZ,
  approved_by      UUID, approved_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_commission_one_sale_per_deal ON sales_commission_entries (deal_id, rep_user_id) WHERE kind = 'sale';
CREATE INDEX IF NOT EXISTS sales_commission_rep_idx ON sales_commission_entries (rep_user_id, status);

CREATE OR REPLACE FUNCTION sales_commission_entry_guard() RETURNS trigger AS $$
DECLARE ok boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'commission ledger entries are never deleted'; END IF;
  IF NEW.amount_cents <> OLD.amount_cents OR NEW.basis_cents <> OLD.basis_cents OR NEW.plan_snapshot IS DISTINCT FROM OLD.plan_snapshot OR NEW.rep_user_id <> OLD.rep_user_id OR NEW.deal_id <> OLD.deal_id OR NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'commission amounts, plan snapshot and ownership are frozen once an entry exists';
  END IF;
  IF NEW.status <> OLD.status THEN
    ok := CASE OLD.status
      WHEN 'estimated'          THEN NEW.status IN ('pending_conditions', 'cancelled')
      WHEN 'pending_conditions' THEN NEW.status IN ('eligible', 'reversed', 'cancelled')
      WHEN 'eligible'           THEN NEW.status IN ('owner_approved', 'pending_conditions', 'reversed', 'cancelled')
      WHEN 'owner_approved'     THEN NEW.status IN ('scheduled', 'eligible', 'reversed', 'cancelled')
      WHEN 'scheduled'          THEN NEW.status IN ('paid', 'failed', 'owner_approved')
      WHEN 'failed'             THEN NEW.status IN ('owner_approved', 'cancelled')
      ELSE false END;
    IF NOT ok THEN RAISE EXCEPTION 'illegal commission status change % -> %', OLD.status, NEW.status; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_commission_entries_guard ON sales_commission_entries;
CREATE TRIGGER sales_commission_entries_guard BEFORE UPDATE OR DELETE ON sales_commission_entries FOR EACH ROW EXECUTE FUNCTION sales_commission_entry_guard();

CREATE TABLE IF NOT EXISTS sales_commission_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES sales_commission_entries(id),
  from_status TEXT, to_status TEXT NOT NULL,
  actor_id    UUID, actor_kind TEXT NOT NULL DEFAULT 'system',
  detail      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_commission_events_entry_idx ON sales_commission_events (entry_id, created_at);
DROP TRIGGER IF EXISTS sales_commission_events_immutable ON sales_commission_events;
CREATE TRIGGER sales_commission_events_immutable BEFORE UPDATE OR DELETE ON sales_commission_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- A representative's hosted payout account with the provider. Nova stores the provider's account id and status ONLY —
-- never bank numbers, IDs or tax identifiers.
CREATE TABLE IF NOT EXISTS sales_payout_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  provider            TEXT NOT NULL DEFAULT 'stripe_connect',
  provider_account_id TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'onboarding', 'verified', 'restricted')),
  status_event_id     TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_payout_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'processing', 'completed', 'partially_failed', 'cancelled')),
  mode            TEXT NOT NULL CHECK (mode IN ('provider', 'external_record')),
  entry_ids       UUID[] NOT NULL DEFAULT '{}',
  total_cents     INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  approval_hash   TEXT,                       -- hash of the exact entries + amounts the owner approved
  created_by      UUID NOT NULL,
  approved_by     UUID, approved_at TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID NOT NULL REFERENCES sales_payout_batches(id),
  entry_id            UUID NOT NULL REFERENCES sales_commission_entries(id),
  rep_user_id         UUID NOT NULL,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
  currency            TEXT NOT NULL DEFAULT 'USD',
  mode                TEXT NOT NULL CHECK (mode IN ('provider', 'external_record')),
  status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  idempotency_key     TEXT NOT NULL UNIQUE,            -- the SAME key is sent to the provider on every retry
  provider_transfer_id TEXT UNIQUE,
  provider_event_id   TEXT,                            -- the verified callback that confirmed it
  needs_reconciliation BOOLEAN NOT NULL DEFAULT false, -- provider call outcome unknown (timeout)
  failure_reason      TEXT,
  external_method     TEXT, external_reference TEXT, external_evidence TEXT, recorded_by UUID,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (mode <> 'external_record' OR status <> 'paid' OR (external_evidence IS NOT NULL AND length(external_evidence) >= 15 AND recorded_by IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_payouts_one_live_per_entry ON sales_payouts (entry_id) WHERE status IN ('scheduled', 'processing', 'paid');

CREATE OR REPLACE FUNCTION sales_payout_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'payout records are never deleted'; END IF;
  IF OLD.status = 'paid' AND (NEW.status <> 'paid' OR NEW.amount_cents <> OLD.amount_cents OR NEW.paid_at IS DISTINCT FROM OLD.paid_at) THEN RAISE EXCEPTION 'a paid payout is immutable'; END IF;
  IF NEW.amount_cents <> OLD.amount_cents OR NEW.entry_id <> OLD.entry_id OR NEW.rep_user_id <> OLD.rep_user_id OR NEW.idempotency_key <> OLD.idempotency_key THEN RAISE EXCEPTION 'payout identity and amount are frozen'; END IF;
  IF OLD.status IN ('failed', 'cancelled') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'this payout is closed'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_payouts_guard ON sales_payouts;
CREATE TRIGGER sales_payouts_guard BEFORE UPDATE OR DELETE ON sales_payouts FOR EACH ROW EXECUTE FUNCTION sales_payout_guard();

ALTER TABLE sales_commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payouts ENABLE ROW LEVEL SECURITY;
