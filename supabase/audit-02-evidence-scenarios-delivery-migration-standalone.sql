-- =============================================================================================
-- NOVA AUDIT — evidence, test plans, benchmarks, software review, financial scenarios, secure delivery.
-- 2026-10-11. Extends the audit engine (crm-order-audit migration). Additive and idempotent.
--
-- • Intake: identity/channels/hours/contact/requested scope, assigned reviewer, promised deadline terms, and
--   the OWNER-APPROVED clock policy (start event, business vs elapsed hours, missing-input treatment, extension
--   notice). The clock cannot start until that policy is approved.
-- • Active tests (phone/form/SMS) only under a recorded authorization with channels, frequency and an end date;
--   results record conditions so a closed business is not scored as a failure.
-- • Up to three competitors, each with a selection rationale and the KIND of evidence (advertised / observed /
--   untested assumption).
-- • Software review from owner-supplied inventories only; never an automatic cancellation recommendation.
-- • Financial scenarios: every input carries its source; only records can be "verified"; double counting is
--   prevented by an overlap group; gross opportunity is separate from contribution margin.
-- • Findings gain period, customer impact, financial-impact status, limitations, whether Nova can implement the
--   remedy, and the owner decision required.
-- • Secure delivery: a random link (hash stored) to the exact approved version, with an expiry and view record.
-- STATUS: local disposable PostgreSQL only. NOT applied to staging or production.
-- =============================================================================================

ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS intake JSONB NOT NULL DEFAULT '{}';
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS reviewer_user_id UUID;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS deadline_terms TEXT;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS clock_policy JSONB;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS clock_policy_approved_by UUID;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS clock_policy_approved_at TIMESTAMPTZ;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS active_test_authorization JSONB;   -- {authorized_by_name, role, at, channels[], max_per_day, ends_on, cancelled_at}
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT false;  -- a short public preview is never the full audit

ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS customer_impact TEXT;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS financial_impact_status TEXT CHECK (financial_impact_status IS NULL OR financial_impact_status IN ('verified', 'scenario', 'unknown', 'none'));
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS limitations TEXT;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS nova_can_implement TEXT CHECK (nova_can_implement IS NULL OR nova_can_implement IN ('yes', 'partial', 'no', 'unknown'));
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS owner_decision TEXT;

CREATE TABLE IF NOT EXISTS audit_test_plan (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL CHECK (channel IN ('phone', 'form', 'sms', 'public_review')),
  target             TEXT NOT NULL,             -- the public number/URL tested (the business's own published channel)
  is_competitor      BOOLEAN NOT NULL DEFAULT false,
  planned_at         TIMESTAMPTZ NOT NULL,
  test_identity      TEXT,                      -- clear test identity used (never a fabricated urgent customer)
  conditions         TEXT,                      -- e.g. "weekday 10:15, within published hours"
  status             TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'cancelled')),
  performed_at       TIMESTAMPTZ,
  within_published_hours BOOLEAN,
  response_seconds   INTEGER CHECK (response_seconds IS NULL OR response_seconds >= 0),
  outcome            TEXT CHECK (outcome IS NULL OR outcome IN ('answered', 'responded', 'no_response', 'voicemail', 'auto_reply', 'not_applicable')),
  notes              TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_test_plan_case ON audit_test_plan (case_id, planned_at);

CREATE TABLE IF NOT EXISTS audit_competitors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  url              TEXT,
  rationale        TEXT NOT NULL,               -- why this competitor is relevant
  observations     JSONB NOT NULL DEFAULT '[]', -- [{kind: advertised|observed|untested, text, source, captured_at, conditions}]
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_software_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT,
  monthly_cost_cents INTEGER CHECK (monthly_cost_cents IS NULL OR monthly_cost_cents >= 0),  -- NULL = unknown, never guessed
  cost_source        TEXT NOT NULL DEFAULT 'unknown' CHECK (cost_source IN ('owner_supplied', 'authorized_export', 'unknown')),
  usage              TEXT NOT NULL DEFAULT 'unknown' CHECK (usage IN ('used', 'rarely_used', 'unused', 'unknown')),
  classification     TEXT NOT NULL DEFAULT 'unknown_usage' CHECK (classification IN ('confirmed_duplicate', 'possible_overlap', 'unknown_usage', 'cancellation_risk', 'keep')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_scenarios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  finding_id         UUID REFERENCES audit_findings(id) ON DELETE SET NULL,
  label              TEXT NOT NULL,
  overlap_group      TEXT,                       -- scenarios in the same group describe the same lost customers: count once
  inputs             JSONB NOT NULL,             -- {eligible_volume, failure_share, conversion, average_sale_cents, margin_share?} each {value, unit, source, note}
  result             JSONB NOT NULL,             -- computed server-side
  status             TEXT NOT NULL CHECK (status IN ('scenario', 'verified')),
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS link_token_hash TEXT;
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMPTZ;
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS notification_status TEXT CHECK (notification_status IS NULL OR notification_status IN ('not_requested', 'queued', 'sent', 'provider_confirmed', 'failed', 'dry_run'));
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_deliveries ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS audit_deliveries_link ON audit_deliveries (link_token_hash) WHERE link_token_hash IS NOT NULL;

-- RLS: staff read through the API only (service role); nothing for anon or the browser directly.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_test_plan', 'audit_competitors', 'audit_software_items', 'audit_scenarios'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
  END LOOP;
END $$;
