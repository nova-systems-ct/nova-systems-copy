-- =============================================================================================
-- Nova Sales Team platform — part 5 of 6: PROPOSALS, CLIENT SIGNATURE, PAYMENTS, SALE VERIFICATION, FULFILLMENT HANDOFF.
-- Additive. NOT applied to production. Depends on: parts 1 and 4, crm-order-audit-migration-standalone.sql.
-- Principle: five DIFFERENT facts are stored separately and each can only be written by its own server path —
--   rep-reported close (crm_deals.rep_reported_close_at), signed agreement (proposal signature, client-side event),
--   payment received (verified provider event or owner-recorded evidence), owner-verified sale, fulfillment started.
-- =============================================================================================

-- ---- proposals: versioned, priced ONLY from approved catalog prices, immutable once sent ------------------------
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]';        -- [{product_id, slug, name, quantity, unit_price_cents|null, price_source: catalog|owner, readiness, label}]
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS discount_status TEXT NOT NULL DEFAULT 'none' CHECK (discount_status IN ('none', 'requested', 'approved', 'denied'));
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS discount_decided_by UUID;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS discount_decided_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS total_cents INTEGER;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS payment_due_cents INTEGER;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS custom_scope_approved_by UUID;                   -- owner approval for pilot / custom scope
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS content_hash TEXT;                              -- set at send; what the client saw
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS client_token_hash TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS sent_by UUID;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signature_image TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signer_ip TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS esign_consent_version TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS signature_hash TEXT;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS decline_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS crm_proposals_token_idx ON crm_proposals (client_token_hash) WHERE client_token_hash IS NOT NULL;

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'crm_proposals'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) ILIKE '%superseded%' LOOP
    EXECUTE format('ALTER TABLE crm_proposals DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE crm_proposals ADD CONSTRAINT crm_proposals_status_check CHECK (status IN ('draft', 'pending_approval', 'sent', 'viewed', 'signed', 'accepted', 'declined', 'superseded', 'expired', 'void'));
END $$;

-- What the client saw and signed cannot change afterwards.
CREATE OR REPLACE FUNCTION crm_proposal_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'proposals are never deleted (void or supersede them)'; END IF;
  IF OLD.status IN ('sent', 'viewed', 'signed', 'accepted') THEN
    IF NEW.line_items IS DISTINCT FROM OLD.line_items OR NEW.total_cents IS DISTINCT FROM OLD.total_cents OR NEW.subtotal_cents IS DISTINCT FROM OLD.subtotal_cents
       OR NEW.discount_cents IS DISTINCT FROM OLD.discount_cents OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.payment_due_cents IS DISTINCT FROM OLD.payment_due_cents THEN
      RAISE EXCEPTION 'a proposal that has been sent cannot be edited; supersede it with a new version';
    END IF;
  END IF;
  IF OLD.signed_at IS NOT NULL THEN   -- once the client has signed, the signature record is frozen whatever the status becomes (accepted, superseded…)
    IF NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.signer_name IS DISTINCT FROM OLD.signer_name OR NEW.signature_hash IS DISTINCT FROM OLD.signature_hash OR NEW.signature_image IS DISTINCT FROM OLD.signature_image THEN
      RAISE EXCEPTION 'a signed proposal record is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS crm_proposals_guard ON crm_proposals;
CREATE TRIGGER crm_proposals_guard BEFORE UPDATE OR DELETE ON crm_proposals FOR EACH ROW EXECUTE FUNCTION crm_proposal_guard();

-- ---- provider events: every webhook is recorded once; duplicates are detected by (provider, event_id) -------------
CREATE TABLE IF NOT EXISTS sales_provider_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);

-- ---- payments: amount comes from the proposal, status from a verified event (or an owner's evidence-backed record) --
CREATE TABLE IF NOT EXISTS sales_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id            UUID NOT NULL REFERENCES crm_deals(id),
  proposal_id        UUID NOT NULL REFERENCES crm_proposals(id),
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  currency           TEXT NOT NULL DEFAULT 'USD',
  method             TEXT NOT NULL CHECK (method IN ('stripe_checkout', 'manual_owner')),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'disputed')),
  provider_session_id TEXT,
  provider_payment_intent TEXT,
  checkout_url       TEXT,
  provider_event_id  TEXT,                       -- the verified event that confirmed it
  manual_method      TEXT,                       -- owner-recorded: check | ach | cash | wire | other
  evidence           TEXT,                       -- owner-recorded: what proves it (reference, deposit date)
  recorded_by        UUID,                       -- owner who recorded a manual payment
  created_by         UUID,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (method <> 'manual_owner' OR (evidence IS NOT NULL AND length(evidence) >= 15 AND recorded_by IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_payments_session_idx ON sales_payments (provider_session_id) WHERE provider_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_payments_one_open ON sales_payments (proposal_id) WHERE status IN ('pending', 'paid');
CREATE INDEX IF NOT EXISTS sales_payments_deal_idx ON sales_payments (deal_id);

-- ---- sale verification: the rep CLAIMS; the owner VERIFIES --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_deal_verifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        UUID NOT NULL REFERENCES crm_deals(id),
  proposal_id    UUID REFERENCES crm_proposals(id),
  rep_user_id    UUID NOT NULL,
  evidence_kind  TEXT NOT NULL CHECK (evidence_kind IN ('system_signature', 'rep_supplied')),
  rep_evidence   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn')),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by    UUID, reviewed_at TIMESTAMPTZ, review_notes TEXT,
  snapshot       JSONB NOT NULL DEFAULT '{}'      -- what the owner saw: proposal totals, payment state, signature state at decision time
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_deal_verifications_one_open ON sales_deal_verifications (deal_id) WHERE status = 'submitted';

-- ---- fulfillment handoff without duplicates ------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_per_deal_product ON orders (deal_id, product_id) WHERE deal_id IS NOT NULL;

ALTER TABLE sales_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deal_verifications ENABLE ROW LEVEL SECURITY;

-- ---- owner-approved exceptions: an offering that is not "available" may appear in ONE deal's proposal only with this ----
CREATE TABLE IF NOT EXISTS sales_scope_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES crm_deals(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  label       TEXT NOT NULL,                 -- shown to the client, e.g. "pilot: one location, 30 days"
  approved_by UUID NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, product_id)
);
ALTER TABLE sales_scope_exceptions ENABLE ROW LEVEL SECURITY;
