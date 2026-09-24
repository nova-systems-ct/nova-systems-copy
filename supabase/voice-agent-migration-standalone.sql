-- =============================================================================================
-- Provider-independent voice/call agent foundation (2026-09-24, master build prompt §11).
-- Standalone migration. Safe to run: every CREATE TABLE uses IF NOT EXISTS, zero
-- DROP/TRUNCATE/DELETE/UPDATE.
--
-- Builds everything §11 specifies that does NOT depend on which telephony/voice runtime Isaac
-- picks (see docs/RUNTIME_HOSTING_RECOMMENDATION.md §4 for that decision): per-org call
-- configuration, an approved knowledge base, a minimal calendar-slot primitive scoped to what the
-- typed tools below need (NOT the full general-purpose calendar engine from §12 — that's separate,
-- larger scope), call sessions, and a structured per-call tool-invocation audit log. Nothing here
-- calls Twilio or any other provider — api/client.js's `voice` resource implements the 9 typed
-- tools §11 specifies (get_business_information, create_or_update_lead, find_slots, hold_slot,
-- confirm_booking, reschedule/cancel, request_transfer, create_callback, record_consent,
-- log_outcome) as real, independently callable, independently tested functions a future provider
-- adapter invokes — the tool logic and the transport are deliberately decoupled, so building this
-- now is not wasted regardless of which voice runtime is eventually chosen.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS voice_configurations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id),
  business_hours          JSONB NOT NULL DEFAULT '{}', -- {mon: [{start,end}], ...} — unknown/unset hours block the affected action, never assumed 24/7
  holidays                JSONB NOT NULL DEFAULT '[]', -- [{date, name}]
  timezone                TEXT,
  transfer_destinations   JSONB NOT NULL DEFAULT '[]', -- [{label, number_ref}] — number references, never a raw number stored in app-readable config
  after_hours_action      TEXT NOT NULL DEFAULT 'voicemail' CHECK (after_hours_action IN ('voicemail', 'callback', 'transfer')),
  wait_limit_seconds      INTEGER,
  disclosure_script       TEXT, -- what the agent says about being AI / being recorded — required before any recording is enabled
  recording_enabled       BOOLEAN NOT NULL DEFAULT false,
  transcript_retention_days INTEGER,
  language                TEXT NOT NULL DEFAULT 'en',
  concurrency_limit       INTEGER,
  spend_cap_cents         INTEGER, -- NULL = no spend authorized yet, never defaulted to a number
  emergency_script        TEXT,
  outbound_enabled        BOOLEAN NOT NULL DEFAULT false, -- "separately configured and activation-gated; do not turn on by default"
  status                  TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'configured', 'active', 'paused')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approved FAQ/knowledge entries — get_business_information only ever returns something from here,
-- never invents an answer. Unapproved entries exist (draft) but are not servable.
CREATE TABLE IF NOT EXISTS voice_knowledge_base (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  topic             TEXT NOT NULL,
  question          TEXT NOT NULL,
  answer            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_kb_org_idx ON voice_knowledge_base (organization_id);
CREATE INDEX IF NOT EXISTS voice_kb_status_idx ON voice_knowledge_base (status);

-- Minimal slot-based availability primitive for find_slots/hold_slot/confirm_booking — scoped to
-- what those three tools need, not a general calendar/resource-booking engine (§12's own, larger,
-- separate scope). A slot is created by staff (representing real availability), held with an
-- expiry (so an abandoned call doesn't lock a slot forever), then confirmed into a real booking.
CREATE TABLE IF NOT EXISTS voice_calendar_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  service_name      TEXT NOT NULL,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'held', 'booked', 'cancelled')),
  held_by_session   UUID, -- FK added below, once voice_call_sessions exists
  held_until        TIMESTAMPTZ, -- a hold with no confirm_booking before this expires reverts to 'open'
  booking_contact_id UUID, -- FK added below, once voice_call_bookings exists — kept nullable/loose on purpose
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_slots_org_idx ON voice_calendar_slots (organization_id);
CREATE INDEX IF NOT EXISTS voice_slots_status_idx ON voice_calendar_slots (status);
CREATE INDEX IF NOT EXISTS voice_slots_start_idx ON voice_calendar_slots (start_at);

CREATE TABLE IF NOT EXISTS voice_call_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  direction             TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  caller_ref            TEXT, -- opaque reference (last 4 digits, hashed, or similar) — never the raw number in app-readable logs by default
  contact_id            UUID REFERENCES crm_contacts(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ,
  outcome               TEXT, -- open vocabulary: 'booked' | 'callback_created' | 'transferred' | 'voicemail' | 'resolved' | 'abandoned' | ...
  transferred_to        TEXT,
  transcript_ref        TEXT, -- private storage reference, never a public URL
  recording_ref         TEXT,
  cost_cents            INTEGER,
  consent_recorded       BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_sessions_org_idx ON voice_call_sessions (organization_id);

ALTER TABLE voice_calendar_slots ADD COLUMN IF NOT EXISTS held_by_session UUID REFERENCES voice_call_sessions(id);

-- One row per typed-tool invocation during a call — "each has schema, tenant scope, permission,
-- idempotency, result contract and failure behavior" (§11) is enforced in application code; this
-- table is the audit trail proving what actually happened, tool by tool, call by call.
CREATE TABLE IF NOT EXISTS voice_call_tool_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES voice_call_sessions(id) ON DELETE CASCADE,
  tool_name         TEXT NOT NULL,
  input             JSONB NOT NULL DEFAULT '{}',
  output            JSONB,
  succeeded         BOOLEAN,
  error             TEXT,
  idempotency_key   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_tool_events_session_idx ON voice_call_tool_events (session_id);
-- An idempotency_key, when supplied, must be unique PER SESSION — the same tool call retried
-- within one call (e.g. a network blip) must not double-book/double-callback; a DIFFERENT call
-- reusing the same key is a different session and not blocked by this.
CREATE UNIQUE INDEX IF NOT EXISTS voice_tool_events_session_idempotency_idx ON voice_call_tool_events (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE voice_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_voice_configurations ON voice_configurations;
CREATE POLICY members_read_voice_configurations ON voice_configurations FOR SELECT TO authenticated USING (is_org_member(organization_id));

ALTER TABLE voice_call_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_voice_call_sessions ON voice_call_sessions;
CREATE POLICY members_read_voice_call_sessions ON voice_call_sessions FOR SELECT TO authenticated USING (is_org_member(organization_id));
