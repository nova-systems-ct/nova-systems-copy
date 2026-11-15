-- Business agents: the call and messaging assistant Nova sells to client businesses.
--
-- Until this file, every channel, credential and prompt belonged to Nova's own internal
-- organization (see 20261110233543_launch_unified_messaging_voice.sql), so the agent could only
-- speak as Nova. These tables give EACH client organization its own agent: its own phone number,
-- its own facts, its own conversations. Nova's own agent becomes one row among many.
--
-- Depends on: organizations, is_org_member() (schema-update.sql Stage 4) and
-- voice-agent-migration-standalone.sql (voice_configurations for hours, voice_knowledge_base for
-- approved answers — both already organization-scoped and reused here, not duplicated).
--
-- Safe to re-run: every statement is IF NOT EXISTS or DROP ... IF EXISTS + CREATE. No existing
-- table or row is altered.

CREATE TABLE IF NOT EXISTS business_agents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id),
  business_name           TEXT NOT NULL,
  agent_name              TEXT NOT NULL DEFAULT 'the assistant',
  industry                TEXT,
  -- The number customers call and text. One number belongs to exactly one business.
  phone_number            TEXT UNIQUE CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  greeting                TEXT,
  services                TEXT, -- what the business does, in the owner's own words
  service_area            TEXT,
  booking_url             TEXT,
  owner_alert_phone       TEXT, -- where a human is told a customer needs them
  handoff_instructions    TEXT, -- what to do when the agent cannot answer
  never_say               TEXT, -- topics or promises the owner has ruled out
  tone                    TEXT NOT NULL DEFAULT 'friendly',
  sms_enabled             BOOLEAN NOT NULL DEFAULT false,
  voice_enabled           BOOLEAN NOT NULL DEFAULT false,
  voice_provider          TEXT CHECK (voice_provider IS NULL OR voice_provider IN ('elevenlabs', 'retell', 'vapi')),
  voice_provider_agent_id TEXT,
  voice_id                TEXT,
  -- NULL means no spending is authorized for this business: the agent saves messages and
  -- flags them for a human, and never sends. Never defaulted to a number.
  monthly_spend_cap_cents INTEGER CHECK (monthly_spend_cap_cents IS NULL OR monthly_spend_cap_cents > 0),
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_agent_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  agent_id          UUID NOT NULL REFERENCES business_agents(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms')),
  customer_phone    TEXT NOT NULL,
  opted_out         BOOLEAN NOT NULL DEFAULT false, -- STOP always wins; only START/UNSTOP clears it
  needs_human       BOOLEAN NOT NULL DEFAULT false,
  last_inbound_at   TIMESTAMPTZ,
  last_outbound_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, channel, customer_phone)
);
CREATE INDEX IF NOT EXISTS business_agent_threads_org_idx ON business_agent_threads (organization_id);

CREATE TABLE IF NOT EXISTS business_agent_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  thread_id         UUID NOT NULL REFERENCES business_agent_threads(id) ON DELETE CASCADE,
  direction         TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body              TEXT NOT NULL,
  provider_sid      TEXT, -- the carrier's message id; makes a retried webhook a no-op
  -- received: customer message saved. sent: carrier accepted our reply (acceptance, not delivery).
  -- failed: carrier refused it. held: saved for a human because the agent may not or could not reply.
  state             TEXT NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'sent', 'failed', 'held')),
  held_reason       TEXT,
  model             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_agent_messages_thread_idx ON business_agent_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS business_agent_messages_org_idx ON business_agent_messages (organization_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS business_agent_messages_sid_idx ON business_agent_messages (provider_sid) WHERE provider_sid IS NOT NULL;

-- Members of a business may read their own agent and conversations. All writes go through the
-- server (service role) after an explicit per-organization permission check; there is no
-- INSERT/UPDATE/DELETE policy on purpose.
ALTER TABLE business_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_agents ON business_agents;
CREATE POLICY members_read_business_agents ON business_agents FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE business_agent_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_agent_threads ON business_agent_threads;
CREATE POLICY members_read_business_agent_threads ON business_agent_threads FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE business_agent_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_agent_messages ON business_agent_messages;
CREATE POLICY members_read_business_agent_messages ON business_agent_messages FOR SELECT TO authenticated USING (is_org_member(organization_id));
