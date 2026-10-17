-- Nova loyalty ledger (master prompt §10, Apple Wallet loyalty and rewards): a business-approved program, one account
-- per customer, and an append-only ledger. Points are earned once per completed job, reversed when that job's payment
-- is refunded, redeemed only at the approved threshold, and expire first-in-first-out. Every posting goes through
-- loyalty_post(), which locks the account row so balance checks and updates are atomic. No stored-value or gift-card
-- liability is created: rewards are the owner's described non-cash reward. Wallet passes need an Apple Pass Type ID
-- and certificate (owner dependency); the account carries the pass serial and an authentication token hash ready for it.
-- Idempotent. Depends on ops-01.

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paused', 'retired')),
  rules            JSONB NOT NULL,     -- {earn_type, earn_points, reward_threshold, reward_description, expiry_days, max_earns_per_day, terms_text}
  rules_sha256     TEXT,
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved', 'paused') OR (approved_by IS NOT NULL AND rules_sha256 IS NOT NULL))
);
-- one live program per business
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_programs_one_live ON loyalty_programs (organization_id) WHERE status IN ('approved', 'paused');

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id            UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  contact_id            UUID NOT NULL REFERENCES crm_contacts(id),
  balance               INTEGER NOT NULL DEFAULT 0,       -- may go below zero only through a refund reversal
  pass_serial           TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  pass_auth_token_hash  TEXT,                              -- for Apple's pass web service; the token itself is never stored
  pass_status           TEXT NOT NULL DEFAULT 'not_issued' CHECK (pass_status IN ('not_issued', 'issued', 'revoked')),
  is_test               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, contact_id)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  program_version   INTEGER NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'reverse', 'expire', 'adjust')),
  points            INTEGER NOT NULL CHECK (points <> 0),
  job_id            UUID REFERENCES ops_jobs(id),
  lot_id            UUID REFERENCES loyalty_ledger(id),   -- reverse/expire: the earn lot they reduce
  expires_at        TIMESTAMPTZ,                          -- earn lots only
  reason            TEXT NOT NULL,
  actor_id          TEXT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  balance_after     INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind IN ('earn') AND points > 0) OR (kind IN ('redeem', 'reverse', 'expire') AND points < 0) OR kind = 'adjust')
);
CREATE INDEX IF NOT EXISTS loyalty_ledger_account ON loyalty_ledger (account_id, created_at);
CREATE INDEX IF NOT EXISTS loyalty_ledger_job ON loyalty_ledger (job_id) WHERE job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION loyalty_ledger_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'loyalty_ledger is append-only; post a reversing entry instead'; END $$;
DROP TRIGGER IF EXISTS loyalty_ledger_immutable ON loyalty_ledger;
CREATE TRIGGER loyalty_ledger_immutable BEFORE UPDATE OR DELETE ON loyalty_ledger FOR EACH ROW EXECUTE FUNCTION loyalty_ledger_append_only();

-- The only way points move. Locks the account; a redemption that exceeds the balance is refused; a repeated
-- idempotency key returns the original entry unchanged.
CREATE OR REPLACE FUNCTION loyalty_post(p_account UUID, p_kind TEXT, p_points INTEGER, p_reason TEXT, p_key TEXT,
  p_job UUID DEFAULT NULL, p_lot UUID DEFAULT NULL, p_expires TIMESTAMPTZ DEFAULT NULL, p_actor TEXT DEFAULT NULL)
RETURNS loyalty_ledger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc loyalty_accounts; prog loyalty_programs; existing loyalty_ledger; out loyalty_ledger;
BEGIN
  SELECT * INTO existing FROM loyalty_ledger WHERE idempotency_key = p_key;
  IF FOUND THEN RETURN existing; END IF;
  SELECT * INTO acc FROM loyalty_accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loyalty account not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO prog FROM loyalty_programs WHERE id = acc.program_id;
  IF p_kind = 'redeem' AND acc.balance + p_points < 0 THEN RAISE EXCEPTION 'insufficient points' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO loyalty_ledger (organization_id, account_id, program_version, kind, points, job_id, lot_id, expires_at, reason, actor_id, idempotency_key, balance_after)
  VALUES (acc.organization_id, acc.id, prog.version, p_kind, p_points, p_job, p_lot, p_expires, p_reason, p_actor, p_key, acc.balance + p_points)
  RETURNING * INTO out;
  UPDATE loyalty_accounts SET balance = balance + p_points, updated_at = now() WHERE id = acc.id;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION loyalty_post(UUID, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION loyalty_post(UUID, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT) TO service_role;

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_programs FROM anon, authenticated;
REVOKE ALL ON public.loyalty_accounts FROM anon, authenticated;
REVOKE ALL ON public.loyalty_ledger FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
