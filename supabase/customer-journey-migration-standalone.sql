-- Customer journey: the four agents that take one customer from first contact to a closed job
-- for a client business. Front desk → contracts → accounting → finance.
--
-- This is process state layered on the EXISTING customer records, not a second CRM:
--   * the customer is a crm_contacts row,
--   * the opportunity is a crm_deals row (pipeline 'client_sales'),
--   * appointments are voice_calendar_slots rows,
--   * owner decisions are approval_requests rows.
-- What did not exist anywhere: a business's own priced services, its approved offers, the
-- step-by-step journey, its event trail, and the quote / agreement / invoice / receipt / report
-- documents produced along the way. Those are the five tables below.
--
-- Depends on: organizations, is_org_member(), crm-order-audit-migration-standalone.sql,
-- voice-agent-migration-standalone.sql. Safe to re-run. Alters no existing table or row.

-- What a business sells. A price exists for customers only when the owner has approved it.
CREATE TABLE IF NOT EXISTS business_services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  name             TEXT NOT NULL,
  description      TEXT,
  keywords         TEXT[] NOT NULL DEFAULT '{}', -- words a customer might use for this service
  price_cents      INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  price_approved   BOOLEAN NOT NULL DEFAULT false,
  deposit_cents    INTEGER CHECK (deposit_cents IS NULL OR deposit_cents > 0),
  terms_text       TEXT,                           -- agreement wording; NULL = no agreement needed
  terms_approved   BOOLEAN NOT NULL DEFAULT false,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  CHECK (deposit_cents IS NULL OR price_cents IS NULL OR deposit_cents <= price_cents)
);

-- Discounts the owner has approved, and what earns them (for example, a comment on a post).
CREATE TABLE IF NOT EXISTS business_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  trigger_type     TEXT NOT NULL CHECK (trigger_type IN ('social_comment', 'social_like', 'social_follow', 'message', 'web_visit', 'manual')),
  channel          TEXT, -- NULL = any channel
  code             TEXT NOT NULL,
  description      TEXT NOT NULL,
  percent_off      INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  approved         BOOLEAN NOT NULL DEFAULT false,
  active           BOOLEAN NOT NULL DEFAULT true,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS journeys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  contact_id          UUID NOT NULL REFERENCES crm_contacts(id),
  deal_id             UUID REFERENCES crm_deals(id),
  service_id          UUID REFERENCES business_services(id),
  offer_id            UUID REFERENCES business_offers(id),
  stage               TEXT NOT NULL DEFAULT 'inquiry' CHECK (stage IN (
                        'inquiry', 'qualified', 'quoted', 'agreed', 'deposit_due', 'scheduling',
                        'scheduled', 'fulfilled', 'balance_due', 'paid', 'closed', 'cancelled')),
  agent               TEXT NOT NULL DEFAULT 'front_desk' CHECK (agent IN ('front_desk', 'contracts', 'accounting', 'finance')),
  waiting_on          TEXT CHECK (waiting_on IS NULL OR waiting_on IN ('customer', 'owner', 'staff', 'provider')),
  waiting_reason      TEXT,
  paused              BOOLEAN NOT NULL DEFAULT false, -- a person has taken over; the agents stand down
  source_channel      TEXT NOT NULL,
  source_event_id     TEXT NOT NULL,                  -- the channel's own id for the first contact
  request_text        TEXT,
  quote_cents         INTEGER,
  discount_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents         INTEGER,
  paid_cents          INTEGER NOT NULL DEFAULT 0,
  slot_id             UUID REFERENCES voice_calendar_slots(id),
  customer_token_hash TEXT NOT NULL,                  -- SHA-256 of the customer's private link token
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at           TIMESTAMPTZ,
  UNIQUE (organization_id, source_channel, source_event_id) -- a retried first contact is one journey
);
CREATE INDEX IF NOT EXISTS journeys_org_stage_idx ON journeys (organization_id, stage);

-- Every step an agent took, in order. This is the handoff trail the owner sees.
CREATE TABLE IF NOT EXISTS journey_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  journey_id       UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  agent            TEXT NOT NULL CHECK (agent IN ('front_desk', 'contracts', 'accounting', 'finance', 'customer', 'owner')),
  handed_to        TEXT,
  action           TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('done', 'waiting_customer', 'waiting_owner', 'waiting_staff', 'blocked', 'failed')),
  detail           JSONB NOT NULL DEFAULT '{}',
  idempotency_key  TEXT NOT NULL UNIQUE, -- repeating a step cannot record or perform it twice
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journey_events_journey_idx ON journey_events (journey_id, created_at);

CREATE TABLE IF NOT EXISTS journey_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  journey_id          UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('quote', 'agreement', 'deposit_invoice', 'balance_invoice', 'receipt', 'completion', 'owner_report')),
  seq                 INTEGER NOT NULL DEFAULT 1,
  body                TEXT NOT NULL,
  amount_cents        INTEGER,
  status              TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'accepted', 'paid', 'void')),
  accepted_at         TIMESTAMPTZ,
  acceptance_evidence TEXT,
  -- For a receipt: where the payment was confirmed. 'owner_recorded' is a person's entry, never
  -- presented as a provider-verified payment.
  payment_source      TEXT CHECK (payment_source IS NULL OR payment_source IN ('provider_verified', 'owner_recorded')),
  payment_reference   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (journey_id, kind, seq)
);

ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_services ON business_services;
CREATE POLICY members_read_business_services ON business_services FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE business_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_offers ON business_offers;
CREATE POLICY members_read_business_offers ON business_offers FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_journeys ON journeys;
CREATE POLICY members_read_journeys ON journeys FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE journey_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_journey_events ON journey_events;
CREATE POLICY members_read_journey_events ON journey_events FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE journey_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_journey_documents ON journey_documents;
CREATE POLICY members_read_journey_documents ON journey_documents FOR SELECT TO authenticated USING (is_org_member(organization_id));
