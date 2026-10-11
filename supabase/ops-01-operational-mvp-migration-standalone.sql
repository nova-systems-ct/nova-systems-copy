-- =============================================================================================
-- NOVA OPERATIONS — operational MVP (Core, Harvest, Sentry, weekly scoreboard). 2026-10-11.
--
-- The customer journey a CLIENT BUSINESS runs for ITS customers:
--   inquiry → consent check → response → qualification → approved price (or owner quote) →
--   booking → versioned agreement → signature → Stripe test deposit → fulfillment → completion →
--   permitted review/referral follow-up → weekly scoreboard.
--
-- Extends existing tables wherever they already exist: organizations (tenancy), crm_contacts
-- (contacts, consent, suppression), wave1_org_settings (timezone, quiet hours, pause switches,
-- escalation contacts), wave1_conversations/wave1_messages (every message), voice_configurations /
-- voice_call_sessions (voice), jobs (durable queue). New tables only where nothing existed.
--
-- Every tenant row carries organization_id. RLS is ON for every table; signed-in members can READ
-- their own organization's rows; every write goes through server handlers using the service role,
-- which re-check tenant permission per object. The anonymous role gets nothing.
--
-- Separate state machines (never collapsed into one "won"/"complete" flag): opportunity
-- (ops_jobs.state), appointment (ops_bookings.status), agreement (ops_agreements.status), payment
-- (ops_deposits.status), fulfillment (ops_jobs.fulfillment_status), campaign, incident. Every
-- transition is recorded in ops_transitions.
--
-- Additive and idempotent: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, guarded constraints.
-- Requires: 00-base-identity-tables, schema-update.sql (is_org_member), crm-order-audit (crm_contacts,
-- crm_deals), durable-jobs (jobs), voice-agent, wave1-pilot. STATUS: local disposable PostgreSQL
-- only. NOT applied to staging or production.
-- =============================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- overlap exclusion for bookings (Supabase supports it)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- permissions (tenant-scoped; checked per organization through has_permission) -----------
INSERT INTO permissions (key, description) VALUES
  ('ops.view',      'View this organization''s operations: inquiries, conversations, bookings, jobs, reports'),
  ('ops.manage',    'Act on operations: reply, take over, book, send agreements, complete jobs'),
  ('ops.configure', 'Approve prices, agreement templates, payment setup, campaigns and policies')
ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions (role, permission_id)
SELECT v.role, p.id FROM permissions p JOIN (VALUES
  ('nova_super_admin','ops.view'), ('nova_super_admin','ops.manage'), ('nova_super_admin','ops.configure'),
  ('nova_admin','ops.view'), ('nova_admin','ops.manage'),
  ('client_owner','ops.view'), ('client_owner','ops.manage'), ('client_owner','ops.configure'),
  ('client_admin','ops.view'), ('client_admin','ops.manage'),
  ('client_employee','ops.view'), ('client_employee','ops.manage'),
  ('client_viewer','ops.view')
) AS v(role, key) ON v.key = p.key
ON CONFLICT DO NOTHING;

-- ---- per-business operating configuration ------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_business_settings (
  organization_id        UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  display_name           TEXT,
  industry               TEXT,
  service_area           TEXT,
  calendar_provider      TEXT NOT NULL DEFAULT 'nova' CHECK (calendar_provider IN ('nova', 'calcom')),
  calcom_event_types     JSONB NOT NULL DEFAULT '{}',      -- {service_key: event_type_id}
  slot_interval_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 240),
  hold_minutes           INTEGER NOT NULL DEFAULT 20 CHECK (hold_minutes BETWEEN 5 AND 120),
  lead_time_hours        INTEGER NOT NULL DEFAULT 12 CHECK (lead_time_hours BETWEEN 0 AND 336),
  booking_horizon_days   INTEGER NOT NULL DEFAULT 21 CHECK (booking_horizon_days BETWEEN 1 AND 120),
  review_url             TEXT,                               -- shown to EVERY customer asked for feedback, never filtered by rating
  referral_terms_status  TEXT NOT NULL DEFAULT 'none' CHECK (referral_terms_status IN ('none', 'draft', 'approved')),
  referral_terms         TEXT,
  missed_call_policy     TEXT NOT NULL DEFAULT 'recorded_consent_only' CHECK (missed_call_policy IN ('recorded_consent_only', 'owner_attested_single_reply')),
  missed_call_policy_attestation JSONB,                      -- {by, at, text} — flagged for legal review, never set by default
  ai_extraction_enabled  BOOLEAN NOT NULL DEFAULT false,     -- model use is opt-in; deterministic path always works without it
  scoreboard_enabled     BOOLEAN NOT NULL DEFAULT true,
  scoreboard_recipient_phone TEXT,                           -- owner's number for the weekly SMS (still consent/allowlist gated)
  nova_fee_cents_monthly INTEGER,                            -- for ROI; NULL means ROI is "not calculable"
  labor_minutes_per_inquiry INTEGER,                         -- baseline for "estimated time avoided"; must be approved
  labor_baseline_approved BOOLEAN NOT NULL DEFAULT false,
  attribution_method     TEXT,                               -- documented method; NULL means no "recovered revenue" figure
  go_live_approved_at    TIMESTAMPTZ,
  is_test                BOOLEAN NOT NULL DEFAULT false,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approved, versioned pricing. Only an APPROVED row can be quoted; one approved version per service.
CREATE TABLE IF NOT EXISTS ops_price_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_key      TEXT NOT NULL CHECK (service_key ~ '^[a-z0-9_]{2,40}$'),
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 10 AND 720),
  buffer_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 240),
  price_cents      INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),   -- NULL with quote_required
  deposit_cents    INTEGER NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  tax_bps          INTEGER NOT NULL DEFAULT 0 CHECK (tax_bps BETWEEN 0 AND 3000),
  currency         TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  options          JSONB NOT NULL DEFAULT '[]',   -- [{key, name, price_cents}] fixed, pre-approved add-ons only
  quote_required   BOOLEAN NOT NULL DEFAULT false, -- unknown scope → "owner quote required"
  version          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  created_by       UUID,
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, service_key, version),
  CHECK (quote_required OR price_cents IS NOT NULL),
  CHECK (price_cents IS NULL OR deposit_cents <= price_cents),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_price_rules_one_approved ON ops_price_rules (organization_id, service_key) WHERE status = 'approved';

-- Agreement templates. Draft text is blocked from customer use; "approved" is the owner's business
-- approval, NOT a legal review (legal_review records that separately and defaults to not reviewed).
CREATE TABLE IF NOT EXISTS ops_agreement_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_key     TEXT NOT NULL CHECK (template_key ~ '^[a-z0-9_]{2,40}$'),
  version          INTEGER NOT NULL DEFAULT 1,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  legal_review     TEXT NOT NULL DEFAULT 'not_reviewed' CHECK (legal_review IN ('not_reviewed', 'attorney_reviewed')),
  created_by       UUID,
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_key, version),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_agreement_templates_one_approved ON ops_agreement_templates (organization_id, template_key) WHERE status = 'approved';

-- Who receives deposit money. Default blocks deposits. Nova does not route customer funds by default
-- and no Stripe Connect arrangement is assumed.
CREATE TABLE IF NOT EXISTS ops_payment_accounts (
  organization_id     UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL DEFAULT 'not_configured' CHECK (mode IN ('not_configured', 'nova_test_platform', 'client_connected_account')),
  stripe_account_ref  TEXT,           -- e.g. acct_… for a connected account (not a secret)
  funds_recipient     TEXT,           -- plain statement of who receives the money
  live_enabled        BOOLEAN NOT NULL DEFAULT false,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (mode <> 'nova_test_platform' OR live_enabled = false)   -- the platform test mode can never take live money
);

-- ---- the customer journey ------------------------------------------------------------------------
-- One row per customer request (opportunity) and, once confirmed, its fulfillment.
CREATE TABLE IF NOT EXISTS ops_jobs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES crm_contacts(id),
  conversation_id      UUID REFERENCES wave1_conversations(id),
  deal_id              UUID REFERENCES crm_deals(id),
  source_channel       TEXT NOT NULL CHECK (source_channel IN ('sms', 'voice', 'form', 'staff', 'missed_call', 'campaign')),
  state                TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'qualifying', 'owner_quote_required', 'quoted', 'booking', 'awaiting_agreement', 'awaiting_deposit', 'confirmed', 'escalated', 'lost', 'cancelled')),
  qualification        JSONB NOT NULL DEFAULT '{}',   -- {service_key, preferred_window, notes, extracted_by, confidence}
  price_rule_id        UUID REFERENCES ops_price_rules(id),
  price_snapshot       JSONB,                         -- immutable terms copied at quote time
  total_cents          INTEGER,
  deposit_cents        INTEGER,
  currency             TEXT,
  fulfillment_status   TEXT NOT NULL DEFAULT 'not_ready' CHECK (fulfillment_status IN ('not_ready', 'ready', 'in_progress', 'completed', 'no_show', 'cancelled')),
  completed_at         TIMESTAMPTZ,
  completed_by         UUID,
  completion_notes     TEXT,
  customer_token_hash  TEXT UNIQUE,                   -- secure customer link (agreement/deposit/status); only the hash is stored
  customer_token_expires_at TIMESTAMPTZ,
  escalation_reason    TEXT,
  lost_reason          TEXT,
  referral_code_used   TEXT,
  is_test              BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_jobs_org_state ON ops_jobs (organization_id, state);
CREATE INDEX IF NOT EXISTS ops_jobs_org_fulfillment ON ops_jobs (organization_id, fulfillment_status);
-- at most one open request per contact+conversation (a second inbound continues the same request)
CREATE UNIQUE INDEX IF NOT EXISTS ops_jobs_one_open_per_conversation ON ops_jobs (conversation_id)
  WHERE conversation_id IS NOT NULL AND state IN ('new', 'qualifying', 'owner_quote_required', 'quoted', 'booking', 'awaiting_agreement', 'awaiting_deposit', 'escalated');

-- Appointments. A tentative hold or confirmed booking can never overlap another for the same
-- business (capacity 1 per organization in this MVP), enforced by the database itself.
CREATE TABLE IF NOT EXISTS ops_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id              UUID NOT NULL REFERENCES ops_jobs(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES crm_contacts(id),
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,            -- includes the service buffer
  status              TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show')),
  hold_expires_at     TIMESTAMPTZ,
  provider            TEXT NOT NULL DEFAULT 'nova' CHECK (provider IN ('nova', 'calcom')),
  provider_booking_id TEXT,
  provider_status     TEXT,                            -- raw provider state; "confirmed" only from the provider's own answer
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  rescheduled_from    UUID REFERENCES ops_bookings(id),
  is_test             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ops_bookings_no_overlap') THEN
    ALTER TABLE ops_bookings ADD CONSTRAINT ops_bookings_no_overlap
      EXCLUDE USING gist (organization_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (status IN ('held', 'confirmed'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ops_bookings_provider_uid ON ops_bookings (organization_id, provider, provider_booking_id) WHERE provider_booking_id IS NOT NULL;

-- Versioned agreements bound to exact text.
CREATE TABLE IF NOT EXISTS ops_agreements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id             UUID NOT NULL REFERENCES ops_jobs(id) ON DELETE CASCADE,
  template_id        UUID NOT NULL REFERENCES ops_agreement_templates(id),
  template_version   INTEGER NOT NULL,
  title              TEXT NOT NULL,
  body_rendered      TEXT NOT NULL,
  content_sha256     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'signed', 'void', 'expired')),
  expires_at         TIMESTAMPTZ NOT NULL,
  esign_consent_text TEXT NOT NULL,
  signer_name        TEXT,
  signed_at          TIMESTAMPTZ,
  signer_ip          TEXT,
  signer_user_agent  TEXT,
  signature_hash     TEXT,
  signed_pdf_path    TEXT,                             -- private storage path; served only through short-lived links
  supersedes_id      UUID REFERENCES ops_agreements(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'signed' OR (signer_name IS NOT NULL AND signed_at IS NOT NULL AND signature_hash IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_agreements_one_live ON ops_agreements (job_id) WHERE status IN ('sent', 'signed');

-- Deposits. Paid only from a signature-verified provider event that matches amount, currency, mode and record.
CREATE TABLE IF NOT EXISTS ops_deposits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id                  UUID NOT NULL REFERENCES ops_jobs(id) ON DELETE CASCADE,
  amount_cents            INTEGER NOT NULL CHECK (amount_cents > 0),
  currency                TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'checkout_open', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded', 'cancelled')),
  livemode                BOOLEAN NOT NULL DEFAULT false,
  account_mode            TEXT NOT NULL,
  provider_session_id     TEXT UNIQUE,
  provider_payment_intent TEXT UNIQUE,
  provider_event_id       TEXT UNIQUE,
  checkout_url            TEXT,
  paid_at                 TIMESTAMPTZ,
  refunded_cents          INTEGER NOT NULL DEFAULT 0,
  refunded_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_deposits_one_active ON ops_deposits (job_id) WHERE status IN ('created', 'checkout_open', 'paid');

-- Every state change of every entity: actor, tenant, time, prior/new state, reason, evidence, version.
CREATE TABLE IF NOT EXISTS ops_transitions (
  id               BIGSERIAL PRIMARY KEY,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity           TEXT NOT NULL CHECK (entity IN ('job', 'booking', 'agreement', 'deposit', 'fulfillment', 'campaign', 'incident', 'price_rule', 'template', 'payment_account', 'settings', 'followup', 'report', 'voice')),
  entity_id        UUID NOT NULL,
  from_state       TEXT,
  to_state         TEXT NOT NULL,
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('user', 'customer', 'system', 'provider', 'model')),
  actor_id         TEXT,
  reason           TEXT,
  evidence         JSONB NOT NULL DEFAULT '{}',
  version          TEXT,
  at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_transitions_entity ON ops_transitions (entity, entity_id, at);
CREATE INDEX IF NOT EXISTS ops_transitions_org_at ON ops_transitions (organization_id, at);

-- Review / referral invitations: neutral, never rating-gated, never incentive-for-review.
CREATE TABLE IF NOT EXISTS ops_followups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES ops_jobs(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES crm_contacts(id),
  kind            TEXT NOT NULL CHECK (kind IN ('review_request', 'referral_invite')),
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'blocked', 'dry_run', 'provider_accepted', 'delivered', 'failed', 'cancelled')),
  blocked_reason  TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  message_id      UUID REFERENCES wave1_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, kind)
);

CREATE TABLE IF NOT EXISTS ops_referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referrer_contact_id UUID NOT NULL REFERENCES crm_contacts(id),
  source_job_id       UUID REFERENCES ops_jobs(id),
  code                TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'verified', 'void')),
  referred_job_id     UUID UNIQUE REFERENCES ops_jobs(id),    -- one referral credit per referred job (no double counting)
  verified_deposit_id UUID REFERENCES ops_deposits(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Harvest: owner-approved reactivation campaigns over authorized imports.
CREATE TABLE IF NOT EXISTS ops_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  purpose           TEXT NOT NULL CHECK (purpose IN ('past_customer_reactivation', 'dormant_quote_followup')),
  message_template  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'running', 'paused', 'completed', 'cancelled')),
  batch_size        INTEGER NOT NULL DEFAULT 25 CHECK (batch_size BETWEEN 1 AND 100),
  min_gap_seconds   INTEGER NOT NULL DEFAULT 30 CHECK (min_gap_seconds BETWEEN 5 AND 3600),
  max_gap_seconds   INTEGER NOT NULL DEFAULT 90 CHECK (max_gap_seconds BETWEEN 5 AND 3600),
  start_at          TIMESTAMPTZ,
  message_budget    INTEGER CHECK (message_budget IS NULL OR message_budget >= 0),
  approval_snapshot JSONB,              -- {eligible_count, copy_sha256, schedule, budget} exactly as approved
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  created_by        UUID,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_gap_seconds >= min_gap_seconds),
  CHECK (status NOT IN ('approved', 'running', 'completed') OR (approved_by IS NOT NULL AND approval_snapshot IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS ops_campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES ops_campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES crm_contacts(id),
  phone_e164      TEXT,
  display_name    TEXT,
  last_service_date DATE,
  eligibility     TEXT NOT NULL CHECK (eligibility IN ('eligible', 'blocked')),
  blocked_reason  TEXT,
  send_status     TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'scheduled', 'dry_run', 'provider_accepted', 'delivered', 'failed', 'blocked_at_send', 'stopped', 'cancelled')),
  stop_reason     TEXT,
  scheduled_at    TIMESTAMPTZ,
  message_id      UUID REFERENCES wave1_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone_e164)
);

-- ---- Sentry ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_health_checks (
  id               BIGSERIAL PRIMARY KEY,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = platform-wide check
  check_key        TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'failing', 'not_configured')),
  latency_ms       INTEGER,
  detail           JSONB NOT NULL DEFAULT '{}',
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_health_checks_key_at ON ops_health_checks (check_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS ops_incidents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  check_key          TEXT NOT NULL,
  severity           TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title              TEXT NOT NULL,
  detail             JSONB NOT NULL DEFAULT '{}',
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrences        INTEGER NOT NULL DEFAULT 1,
  alerts_sent        INTEGER NOT NULL DEFAULT 0,
  last_alert_at      TIMESTAMPTZ,
  escalation_level   INTEGER NOT NULL DEFAULT 0,
  acknowledged_by    UUID,
  acknowledged_at    TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  resolution         TEXT,
  recovery_evidence  JSONB
);
-- one open incident per (tenant, check): repeats increment occurrences instead of creating alert storms
CREATE UNIQUE INDEX IF NOT EXISTS ops_incidents_one_open ON ops_incidents (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), check_key) WHERE status <> 'resolved';

CREATE TABLE IF NOT EXISTS worker_runtime_heartbeats (
  worker_id        TEXT PRIMARY KEY,
  host             TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  jobs_processed   INTEGER NOT NULL DEFAULT 0,
  last_job_type    TEXT,
  stopped_at       TIMESTAMPTZ
);

-- Weekly scoreboard: immutable, versioned, traceable to source rows.
CREATE TABLE IF NOT EXISTS ops_weekly_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start       TIMESTAMPTZ NOT NULL,
  week_end         TIMESTAMPTZ NOT NULL,
  timezone         TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  metrics          JSONB NOT NULL,
  sources          JSONB NOT NULL,          -- ids of the rows each figure came from
  content_sha256   TEXT NOT NULL,
  generated_by     TEXT NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'not_sent' CHECK (notification_status IN ('not_sent', 'blocked', 'dry_run', 'provider_accepted', 'delivered', 'failed')),
  notification_detail TEXT,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, week_start, version)
);

-- ---- extensions of existing tables -----------------------------------------------------------------
-- Customer-initiated conversations may receive replies and transactional messages about the request
-- the customer made; that is NOT marketing consent (crm_contacts.sms_consent stays as recorded).
ALTER TABLE wave1_conversations ADD COLUMN IF NOT EXISTS customer_initiated_at TIMESTAMPTZ;
ALTER TABLE wave1_conversations ADD COLUMN IF NOT EXISTS engine_state TEXT;
ALTER TABLE wave1_conversations ADD COLUMN IF NOT EXISTS engine_context JSONB NOT NULL DEFAULT '{}';
ALTER TABLE wave1_messages ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;      -- handed to the provider
ALTER TABLE wave1_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;      -- provider-confirmed delivery
ALTER TABLE wave1_messages ADD COLUMN IF NOT EXISTS trigger_at TIMESTAMPTZ;        -- the event that caused it (latency measurement)
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS marketing_consent_scope TEXT;    -- what the recorded consent covers, as captured

ALTER TABLE voice_call_sessions ADD COLUMN IF NOT EXISTS provider_call_sid TEXT;
ALTER TABLE voice_call_sessions ADD COLUMN IF NOT EXISTS engine_state TEXT;
ALTER TABLE voice_call_sessions ADD COLUMN IF NOT EXISTS turns JSONB NOT NULL DEFAULT '[]';
ALTER TABLE voice_call_sessions ADD COLUMN IF NOT EXISTS turns_ctx JSONB NOT NULL DEFAULT '{}';
ALTER TABLE voice_call_sessions ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES ops_jobs(id);
CREATE UNIQUE INDEX IF NOT EXISTS voice_call_sessions_provider_sid ON voice_call_sessions (organization_id, provider_call_sid) WHERE provider_call_sid IS NOT NULL;

-- ---- atomic slot hold: expire stale holds, then insert (the exclusion constraint settles races) ----
CREATE OR REPLACE FUNCTION ops_hold_slot(p_org UUID, p_job UUID, p_contact UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_hold_minutes INTEGER, p_is_test BOOLEAN)
RETURNS ops_bookings LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r ops_bookings;
BEGIN
  UPDATE ops_bookings SET status = 'expired'
   WHERE organization_id = p_org AND status = 'held' AND hold_expires_at < now();
  INSERT INTO ops_bookings (organization_id, job_id, contact_id, start_at, end_at, status, hold_expires_at, is_test)
  VALUES (p_org, p_job, p_contact, p_start, p_end, 'held', now() + make_interval(mins => p_hold_minutes), p_is_test)
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION ops_hold_slot(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ---- row level security: members read their own organization; nobody writes from the browser ------
DO $$
DECLARE t text;
  tenant text[] := ARRAY['ops_business_settings', 'ops_price_rules', 'ops_agreement_templates', 'ops_payment_accounts',
    'ops_jobs', 'ops_bookings', 'ops_agreements', 'ops_deposits', 'ops_transitions', 'ops_followups', 'ops_referrals',
    'ops_campaigns', 'ops_campaign_recipients', 'ops_weekly_reports'];
  platform text[] := ARRAY['ops_health_checks', 'ops_incidents', 'worker_runtime_heartbeats'];
BEGIN
  FOREACH t IN ARRAY tenant || platform LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
  END LOOP;
  FOREACH t IN ARRAY tenant LOOP
    EXECUTE format('DROP POLICY IF EXISTS members_read ON public.%I', t);
    EXECUTE format('CREATE POLICY members_read ON public.%I FOR SELECT TO authenticated USING (is_org_member(organization_id))', t);
  END LOOP;
  -- platform health/incidents/heartbeats: service role only (Nova staff read them through the API)
END $$;
