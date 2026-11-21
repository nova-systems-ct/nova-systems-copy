-- Card payments for client businesses (Nova system 17).
--
-- One row per business: which Stripe account it connected, and whether Stripe says that account
-- can take payments yet. Customers' card payments are charged directly on the business's own
-- account, so no card, bank or identity detail is stored here or anywhere in Nova. Payments
-- themselves are recorded as journey receipts (journey_documents, payment_source
-- 'provider_verified') by the signed Stripe Connect webhook.
--
-- Depends on: organizations, is_org_member(). Run after customer-journey-migration-standalone.sql
-- and before zz-public-schema-lockdown-standalone.sql. Safe to re-run. Alters no existing table.

CREATE TABLE IF NOT EXISTS business_payment_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL UNIQUE REFERENCES organizations(id),
  provider           TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  account_id         TEXT NOT NULL UNIQUE,              -- Stripe's acct_… id; never a secret key
  account_type       TEXT NOT NULL CHECK (account_type IN ('standard', 'express')),
  livemode           BOOLEAN NOT NULL DEFAULT false,
  charges_enabled    BOOLEAN NOT NULL DEFAULT false,    -- as last reported by Stripe
  payouts_enabled    BOOLEAN NOT NULL DEFAULT false,
  details_submitted  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members of the business can see its status; only the server (service role) writes it.
ALTER TABLE business_payment_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_payment_accounts ON business_payment_accounts;
CREATE POLICY members_read_business_payment_accounts ON business_payment_accounts FOR SELECT TO authenticated USING (is_org_member(organization_id));
