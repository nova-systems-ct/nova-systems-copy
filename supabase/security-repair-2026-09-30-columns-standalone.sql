-- =============================================================================================
-- SECURITY REPAIR 2026-09-30 — additive columns the repaired handlers write (audit F-05, F-26)
--
-- Purely additive: ADD COLUMN IF NOT EXISTS, one NOT VALID check constraint and one partial
-- unique index. Drops nothing, rewrites no rows, changes no access. Safe to run more than once.
--
-- Why: the repaired payment and signing code records WHERE a "Paid" status came from and WHAT was
-- signed. Without these columns the handlers still work (they retry with the original columns),
-- but the evidence is lost and the owner-only "record payment" action refuses with 409.
--
-- ORDER: apply BEFORE deploying the repaired code (see docs/SECURITY_REPAIR_2026-09-30.md).
-- STATUS: proven on a disposable local PostgreSQL only. NOT applied to staging or production.
-- =============================================================================================

-- Legacy invoices: provider-confirmed vs owner-recorded payments stay distinguishable.
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS payment_source    TEXT;  -- 'stripe' | 'owner_recorded'
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS payment_method    TEXT;  -- owner-recorded only (check, wire, cash...)
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS payment_evidence  TEXT;  -- owner-recorded only (reference / note)
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS provider_event_id TEXT;  -- Stripe event id that confirmed payment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_invoices_payment_source_chk') THEN
    ALTER TABLE client_invoices ADD CONSTRAINT client_invoices_payment_source_chk
      CHECK (payment_source IS NULL OR payment_source IN ('stripe', 'owner_recorded')) NOT VALID;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS client_invoices_provider_event_uniq
  ON client_invoices (provider_event_id) WHERE provider_event_id IS NOT NULL;

-- Onboarding clients: same provenance for the first payment.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_source    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

-- Contracts: what exactly was signed, and a tamper-evident hash of the signing record.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS content_sha256 TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_hash TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signer_ip      TEXT;
