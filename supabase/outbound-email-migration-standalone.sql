-- Email from client businesses (Nova systems 20 and 23): Revive come-back emails to customers
-- and the weekly scorecard to the owner.
--
--   * business_agents gets the owner's switch for email, the address replies and the weekly report
--     go to, and the mailing address printed in marketing emails (US law requires one).
--   * crm_contacts gets a random unsubscribe token for the link in every marketing email.
--   * scorecard_sends records each scorecard email the provider accepted, once per business per day.
--
-- Depends on: business-agents-migration-standalone.sql, crm-order-audit-migration-standalone.sql.
-- Run before zz-public-schema-lockdown-standalone.sql. Safe to re-run. Changes no existing row.

ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS reply_email TEXT;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS mailing_address TEXT;

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_unsubscribe_token_idx ON crm_contacts (unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS scorecard_sends (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  period_start        DATE NOT NULL,          -- the day it was sent; one scorecard per business per day
  period_end          TIMESTAMPTZ NOT NULL,
  sent_to             TEXT NOT NULL,
  provider_reference  TEXT NOT NULL,          -- set only after the email provider accepted it
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_start)
);

ALTER TABLE scorecard_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_scorecard_sends ON scorecard_sends;
CREATE POLICY members_read_scorecard_sends ON scorecard_sends FOR SELECT TO authenticated USING (is_org_member(organization_id));
