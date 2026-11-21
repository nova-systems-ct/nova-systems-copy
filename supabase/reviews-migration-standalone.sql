-- Reviews (Nova system 19): after a paid job, the customer is asked "How did we do, 1 to 5?".
-- 4 or 5 is shown the owner's own review page; 1 to 3 becomes a call for the owner. Nova never
-- writes or posts a review for anyone.
--
--   * business_agents.review_url: the owner's review page (for example their Google review link).
--   * customer_feedback: one row per finished job, with the private rating link's SHA-256 when
--     the question was sent by email or text.
--   * revive_outreach.kind also allows 'review_request' (the question, sent like a come-back message).
--
-- Depends on: business-agents, customer-journey and revive-proof migrations. Run before
-- zz-public-schema-lockdown-standalone.sql. Safe to re-run. Changes no existing row.

ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS review_url TEXT;

CREATE TABLE IF NOT EXISTS customer_feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  journey_id         UUID NOT NULL UNIQUE REFERENCES journeys(id) ON DELETE CASCADE,
  contact_id         UUID REFERENCES crm_contacts(id),
  token_hash         TEXT UNIQUE,
  rating             INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment            TEXT,
  review_link_given  BOOLEAN NOT NULL DEFAULT false,
  follow_up          TEXT NOT NULL DEFAULT 'none' CHECK (follow_up IN ('none', 'owner_to_call', 'resolved')),
  answered_at        TIMESTAMPTZ,
  resolved_by        TEXT,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (rating IS NULL OR answered_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS customer_feedback_org_idx ON customer_feedback (organization_id, created_at);

ALTER TABLE revive_outreach DROP CONSTRAINT IF EXISTS revive_outreach_kind_check;
ALTER TABLE revive_outreach ADD CONSTRAINT revive_outreach_kind_check CHECK (kind IN ('overdue', 'cold_lead', 'empty_slot', 'review_request'));

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_customer_feedback ON customer_feedback;
CREATE POLICY members_read_customer_feedback ON customer_feedback FOR SELECT TO authenticated USING (is_org_member(organization_id));
