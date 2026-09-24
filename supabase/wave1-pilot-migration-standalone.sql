-- =============================================================================================
-- Wave One + Pilot foundation (2026-09-24, pilot execution order). Standalone migration.
-- DEPENDS ON: crm-order-audit-migration-standalone.sql (crm_contacts, businesses, organizations).
-- Rerun-safe: CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Contains no DROP/TRUNCATE/DELETE/UPDATE. NOTE: "additive" is not the same as "safe" — review:
--   * The partial UNIQUE index on crm_contacts(organization_id, phone_e164) will FAIL if you
--     already have two contacts in one org with the same phone_e164. phone_e164 is a NEW column
--     (all NULL on existing rows), and the index ignores NULLs, so it cannot fail on existing data.
--   * All new tables are organization-scoped; RLS lets members SELECT their own org only. All
--     writes go through service-role handlers in api/client.js that re-check organization access.
--   * Webhook-created rows have no user session, so they are written by the service role only.
-- Consent model: a number existing is NOT consent. sms_consent requires a recorded source + time.
-- =============================================================================================

-- ---- Consent / suppression / normalized phone on the shared CRM contact ----
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS sms_consent_source TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS suppressed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS suppression_source TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
-- Same phone in the same org = same contact (dedupe). Partial so NULL phones never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_org_phone_uniq ON crm_contacts (organization_id, phone_e164) WHERE phone_e164 IS NOT NULL;

-- ---- Per-organization messaging/automation settings (separate from voice_configurations) ----
CREATE TABLE IF NOT EXISTS wave1_org_settings (
  organization_id       UUID PRIMARY KEY REFERENCES organizations(id),
  timezone              TEXT,                      -- NULL blocks automated sends; never guessed
  quiet_hours           JSONB NOT NULL DEFAULT '{"start":21,"end":8}',
  max_automated_per_day INTEGER NOT NULL DEFAULT 3,
  min_gap_minutes       INTEGER NOT NULL DEFAULT 10,
  paused                BOOLEAN NOT NULL DEFAULT false,      -- org-wide kill switch
  channels_paused       TEXT[] NOT NULL DEFAULT '{}',        -- per-channel switches: sms, voice, email
  sms_number_ref        TEXT,                                -- reference to the provider number, not a secret
  escalation_contacts   JSONB NOT NULL DEFAULT '[]',
  business_hours        JSONB NOT NULL DEFAULT '{}',
  templates             JSONB NOT NULL DEFAULT '{}',         -- {missed_call: "...", reminder: "..."} reviewed before use
  provider_registration TEXT NOT NULL DEFAULT 'unknown' CHECK (provider_registration IN ('unknown', 'not_started', 'pending', 'approved', 'rejected')),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wave1_org_settings ADD COLUMN IF NOT EXISTS calcom_event_type_id INTEGER;  -- Cal.com event type that supplies this organization's availability
ALTER TABLE wave1_org_settings ADD COLUMN IF NOT EXISTS form_token TEXT;  -- public identifier for the intake form; rotate to revoke
-- One number belongs to exactly one organization (webhook routing depends on this), and a form token
-- resolves to exactly one organization. Partial so unset values never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS wave1_settings_number_uniq ON wave1_org_settings (sms_number_ref) WHERE sms_number_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wave1_settings_form_token_uniq ON wave1_org_settings (form_token) WHERE form_token IS NOT NULL;

-- ---- Webhook de-duplication: one row per provider event, ever. ----
CREATE TABLE IF NOT EXISTS wave1_source_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,            -- 'twilio_sms', 'twilio_call_status', 'twilio_sms_status', 'web_form'
  source_event_id  TEXT NOT NULL,            -- MessageSid / CallSid+status / form submission id
  organization_id  UUID REFERENCES organizations(id),
  payload_summary  JSONB NOT NULL DEFAULT '{}',   -- minimal, no full bodies of third-party content
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_event_id)
);

CREATE TABLE IF NOT EXISTS wave1_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  contact_id            UUID NOT NULL REFERENCES crm_contacts(id),
  channel               TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'voice', 'email', 'form')),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'snoozed')),
  staff_takeover        BOOLEAN NOT NULL DEFAULT false,
  takeover_by           UUID REFERENCES auth.users(id),
  contact_replied_since_trigger BOOLEAN NOT NULL DEFAULT false,
  appointment_confirmed BOOLEAN NOT NULL DEFAULT false,
  last_inbound_at       TIMESTAMPTZ,
  last_outbound_at      TIMESTAMPTZ,
  is_test               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contact_id, channel)
);
CREATE INDEX IF NOT EXISTS wave1_conversations_org_status_idx ON wave1_conversations (organization_id, status);

CREATE TABLE IF NOT EXISTS wave1_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  conversation_id  UUID NOT NULL REFERENCES wave1_conversations(id) ON DELETE CASCADE,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body             TEXT,
  automated        BOOLEAN NOT NULL DEFAULT false,
  purpose          TEXT,                     -- missed_call | inquiry_followup | reminder | reply | ...
  -- Outbound lifecycle. 'queued' is NOT sent; 'provider_accepted' is NOT delivered;
  -- 'ambiguous' = outcome unknown, must be reconciled before any retry.
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'blocked', 'provider_accepted', 'delivered', 'failed', 'undelivered', 'received', 'ambiguous')),
  blocked_reason   TEXT,                     -- why evaluateSendEligibility refused (kept for audit)
  provider         TEXT,
  provider_sid     TEXT,
  error_code       TEXT,
  sent_by          UUID REFERENCES auth.users(id),
  idempotency_key  TEXT,
  is_test          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_sid),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS wave1_messages_conv_idx ON wave1_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS wave1_appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  contact_id          UUID NOT NULL REFERENCES crm_contacts(id),
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  -- 'requested' = asked for, NOT confirmed. Only the scheduling source (or an authorized staff
  -- member recording it) moves this to 'confirmed'; confirmed_at is only set then.
  status              TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  provider            TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'calcom')),
  provider_booking_id TEXT,
  confirmed_at        TIMESTAMPTZ,
  requested_via       TEXT,                  -- call | sms | form | staff
  notes               TEXT,
  is_test             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, provider_booking_id)
);
CREATE INDEX IF NOT EXISTS wave1_appointments_org_start_idx ON wave1_appointments (organization_id, start_at);

-- ---- Pilot record (sales → pilot → conversion) ----
CREATE TABLE IF NOT EXISTS pilots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id),   -- the CLIENT's organization
  business_id            UUID REFERENCES businesses(id),
  name                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'agreed', 'onboarding', 'active', 'review', 'converted', 'extended', 'closed')),
  agreed_services        JSONB NOT NULL DEFAULT '[]',
  start_date             DATE,
  end_date               DATE,
  baseline_start         DATE,
  baseline_end           DATE,
  success_criteria       JSONB NOT NULL DEFAULT '[]',
  channels               JSONB NOT NULL DEFAULT '[]',
  usage_limits           JSONB NOT NULL DEFAULT '{}',
  provider_cost_payer    TEXT CHECK (provider_cost_payer IN ('nova', 'client', 'shared')),   -- NULL = not yet agreed
  support_contact        TEXT,
  escalation_contacts    JSONB NOT NULL DEFAULT '[]',
  agreement_status       TEXT NOT NULL DEFAULT 'not_sent' CHECK (agreement_status IN ('not_sent', 'draft', 'sent', 'accepted', 'declined')),
  agreement_version      TEXT,               -- template version; templates are REVIEWABLE, never marked legally approved
  agreement_accepted_at  TIMESTAMPTZ,
  agreement_evidence     TEXT,               -- how acceptance was actually evidenced (signed doc ref, email ref)
  rollback_plan          TEXT,
  offboarding_plan       TEXT,
  outcome                TEXT CHECK (outcome IN ('paid', 'extended', 'closed_no_conversion')),
  outcome_reason         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pilots_org_idx ON pilots (organization_id);

-- Testimonial permission is SEPARATE from service acceptance, and each use is separate.
CREATE TABLE IF NOT EXISTS pilot_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id       UUID NOT NULL REFERENCES pilots(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('business_name', 'logo', 'quotation', 'video', 'case_study')),
  granted        BOOLEAN NOT NULL DEFAULT false,
  granted_by_name TEXT,
  evidence       TEXT,
  granted_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  UNIQUE (pilot_id, kind)
);

-- Installation preflight + supervised acceptance checks. 'passed' requires evidence.
CREATE TABLE IF NOT EXISTS pilot_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id    UUID NOT NULL REFERENCES pilots(id) ON DELETE CASCADE,
  phase       TEXT NOT NULL CHECK (phase IN ('preflight', 'acceptance', 'go_live')),
  item_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'not_applicable')),
  evidence    TEXT,
  checked_by  UUID REFERENCES auth.users(id),
  checked_at  TIMESTAMPTZ,
  UNIQUE (pilot_id, item_key)
);

ALTER TABLE wave1_org_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_wave1_settings ON wave1_org_settings;
CREATE POLICY members_read_wave1_settings ON wave1_org_settings FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE wave1_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_wave1_conversations ON wave1_conversations;
CREATE POLICY members_read_wave1_conversations ON wave1_conversations FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE wave1_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_wave1_messages ON wave1_messages;
CREATE POLICY members_read_wave1_messages ON wave1_messages FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE wave1_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_wave1_appointments ON wave1_appointments;
CREATE POLICY members_read_wave1_appointments ON wave1_appointments FOR SELECT TO authenticated USING (is_org_member(organization_id));
ALTER TABLE pilots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_pilots ON pilots;
CREATE POLICY members_read_pilots ON pilots FOR SELECT TO authenticated USING (is_org_member(organization_id));
