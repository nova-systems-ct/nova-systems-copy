-- Nova Revive and Nova Proof. Run AFTER customer-journey-migration-standalone.sql.
-- Adds one column and one table. Safe to re-run. Changes no existing row.

-- How long before a customer normally needs this service again (a haircut: 21 days; a furnace
-- check: 365). NULL means the service does not repeat on a schedule, so Revive ignores it.
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS return_days INTEGER;
DO $$ BEGIN
  ALTER TABLE business_services ADD CONSTRAINT business_services_return_days_check CHECK (return_days IS NULL OR return_days BETWEEN 1 AND 1825);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per person per reason per step. "blocked" means the message was prepared and NOT sent,
-- with the reason; "sent" is set only after a provider accepted it.
CREATE TABLE IF NOT EXISTS revive_outreach (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  contact_id         UUID NOT NULL REFERENCES crm_contacts(id),
  journey_id         UUID REFERENCES journeys(id) ON DELETE SET NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('overdue', 'cold_lead', 'empty_slot')),
  service_id         UUID REFERENCES business_services(id),
  offer_id           UUID REFERENCES business_offers(id),
  slot_id            UUID REFERENCES voice_calendar_slots(id),
  channel            TEXT CHECK (channel IS NULL OR channel IN ('sms', 'email')),
  status             TEXT NOT NULL CHECK (status IN ('ready', 'sent', 'blocked')),
  blocked_reason     TEXT,
  message            TEXT NOT NULL,
  days_since         INTEGER,
  provider_reference TEXT,
  sent_at            TIMESTAMPTZ,
  idempotency_key    TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'sent' OR provider_reference IS NOT NULL),
  CHECK (status <> 'blocked' OR blocked_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS revive_outreach_org_idx ON revive_outreach (organization_id, created_at);

ALTER TABLE revive_outreach ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_revive_outreach ON revive_outreach;
CREATE POLICY members_read_revive_outreach ON revive_outreach FOR SELECT TO authenticated USING (is_org_member(organization_id));
