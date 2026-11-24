-- Calls and messages for client businesses on every channel (Nova systems 10 to 15).
--
--   * business_agent_threads: one conversation per customer per channel (texts, WhatsApp, RCS,
--     website chat, phone, Apple Messages, Instagram, Facebook), keyed by the channel's own
--     customer reference (a phone number, a chat visitor id, a Meta user id...).
--   * business_agents: how the business's phone is answered (ring the owner first, then the
--     assistant, or the assistant first), whether a missed caller gets a text, and which
--     message channels are connected. Every switch starts OFF.
--   * business_calls: one row per call to a client business's number, with what happened.
--
-- Depends on: business-agents-migration-standalone.sql, customer-journey-migration-standalone.sql.
-- Run before zz-public-schema-lockdown-standalone.sql. Safe to re-run. The only existing rows it
-- touches are text threads, which get their phone number copied into customer_ref.

-- ---- threads on every channel ----------------------------------------------------------------
ALTER TABLE business_agent_threads DROP CONSTRAINT IF EXISTS business_agent_threads_channel_check;
ALTER TABLE business_agent_threads ADD CONSTRAINT business_agent_threads_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'rcs', 'web_chat', 'voice', 'apple_messages', 'instagram', 'facebook'));
ALTER TABLE business_agent_threads ALTER COLUMN customer_phone DROP NOT NULL;
ALTER TABLE business_agent_threads ADD COLUMN IF NOT EXISTS customer_ref TEXT;
ALTER TABLE business_agent_threads ADD COLUMN IF NOT EXISTS customer_name TEXT;
UPDATE business_agent_threads SET customer_ref = customer_phone WHERE customer_ref IS NULL AND customer_phone IS NOT NULL;
-- Code that only knows the phone number (texts) still gets customer_ref filled in.
CREATE OR REPLACE FUNCTION business_agent_threads_fill_ref() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.customer_ref := COALESCE(NEW.customer_ref, NEW.customer_phone);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS business_agent_threads_fill_ref ON business_agent_threads;
CREATE TRIGGER business_agent_threads_fill_ref BEFORE INSERT OR UPDATE ON business_agent_threads
  FOR EACH ROW EXECUTE FUNCTION business_agent_threads_fill_ref();
REVOKE ALL ON FUNCTION business_agent_threads_fill_ref() FROM PUBLIC;
ALTER TABLE business_agent_threads ALTER COLUMN customer_ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_agent_threads_ref_idx ON business_agent_threads (agent_id, channel, customer_ref);
-- Planned cost of each reply we sent (not a bill), so a business never runs past its monthly cap.
ALTER TABLE business_agent_messages ADD COLUMN IF NOT EXISTS estimate_cents INTEGER NOT NULL DEFAULT 0;

-- ---- how calls are answered --------------------------------------------------------------------
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS call_mode TEXT NOT NULL DEFAULT 'off';
ALTER TABLE business_agents DROP CONSTRAINT IF EXISTS business_agents_call_mode_check;
ALTER TABLE business_agents ADD CONSTRAINT business_agents_call_mode_check
  CHECK (call_mode IN ('off', 'forward_only', 'forward_then_assistant', 'assistant_first'));
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS forward_phone TEXT;            -- rung first, E.164
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS ring_seconds INTEGER NOT NULL DEFAULT 20;
ALTER TABLE business_agents DROP CONSTRAINT IF EXISTS business_agents_ring_seconds_check;
ALTER TABLE business_agents ADD CONSTRAINT business_agents_ring_seconds_check CHECK (ring_seconds BETWEEN 5 AND 60);
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS missed_call_text BOOLEAN NOT NULL DEFAULT false;
-- A second private link key per request, for links sent by text, chat or email (api/_journey.js
-- customerLink), so sending one never ends the customer's own browser session.
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS customer_link_hash TEXT;

-- Premium voice reuses business_agents.voice_provider ('elevenlabs'; NULL = Nova's own assistant)
-- and voice_provider_agent_id from business-agents-migration-standalone.sql.
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS voice_tool_secret_hash TEXT;  -- SHA-256 of the premium voice tools key

-- ---- message channels ----------------------------------------------------------------------------
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS web_chat_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;          -- the approved WhatsApp sender, E.164
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS rcs_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS messaging_service_sid TEXT;    -- Twilio Messaging Service holding the RCS sender
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS apple_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS apple_business_id TEXT;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS facebook_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS instagram_account_id TEXT;
ALTER TABLE business_agents ADD COLUMN IF NOT EXISTS meta_token_enc TEXT;           -- page token, encrypted by the server
-- Each sender belongs to one business only, so an incoming message always finds the right one.
CREATE UNIQUE INDEX IF NOT EXISTS business_agents_whatsapp_idx ON business_agents (whatsapp_number) WHERE whatsapp_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_agents_msgsvc_idx ON business_agents (messaging_service_sid) WHERE messaging_service_sid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_agents_apple_idx ON business_agents (apple_business_id) WHERE apple_business_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_agents_meta_page_idx ON business_agents (meta_page_id) WHERE meta_page_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_agents_instagram_idx ON business_agents (instagram_account_id) WHERE instagram_account_id IS NOT NULL;

-- ---- the call log ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  agent_id         UUID NOT NULL REFERENCES business_agents(id) ON DELETE CASCADE,
  call_sid         TEXT NOT NULL UNIQUE,
  from_phone       TEXT,
  to_phone         TEXT,
  outcome          TEXT NOT NULL DEFAULT 'ringing' CHECK (outcome IN (
                     'ringing',          -- just came in
                     'answered',         -- a person at the business picked up
                     'missed',           -- nobody picked up and the assistant did not take it
                     'assistant',        -- the assistant is or was talking to the caller
                     'link_sent',        -- the caller got a text with their quote and booking link
                     'callback_requested', -- the caller asked for a call back; the owner was told
                     'not_taking_calls')), -- calls are switched off for this business
  journey_id       UUID REFERENCES journeys(id) ON DELETE SET NULL,
  service_id       UUID REFERENCES business_services(id) ON DELETE SET NULL,
  caller_said      JSONB NOT NULL DEFAULT '[]',   -- what the caller said to the assistant, turn by turn
  texted_back      BOOLEAN NOT NULL DEFAULT false, -- a text went out (provider accepted it)
  held_reason      TEXT,                           -- why the assistant or the text did not run
  turns            INTEGER NOT NULL DEFAULT 0 CHECK (turns BETWEEN 0 AND 20),
  estimate_cents   INTEGER NOT NULL DEFAULT 0,     -- planned cost of the call (not a bill)
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_calls_org_idx ON business_calls (organization_id, started_at DESC);

ALTER TABLE business_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_business_calls ON business_calls;
CREATE POLICY members_read_business_calls ON business_calls FOR SELECT TO authenticated USING (is_org_member(organization_id));
