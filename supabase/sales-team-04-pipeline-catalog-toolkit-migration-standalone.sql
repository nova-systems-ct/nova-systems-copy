-- =============================================================================================
-- Nova Sales Team platform — part 4 of 5: REP PIPELINE (on the existing CRM tables), PRODUCT SALES-READINESS, SALES TOOLKIT.
-- Additive. NOT applied to production. Depends on: part 1, crm-order-audit-migration-standalone.sql (crm_deals, crm_activities,
-- crm_contacts, businesses, products).
-- No second CRM: reps work the same crm_deals / crm_contacts / businesses / crm_activities rows the rest of Nova uses.
-- =============================================================================================

-- ---- crm_deals: rep assignment + the rep pipeline vocabulary ------------------------------------------------
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS assigned_rep_id UUID REFERENCES auth.users(id);
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lead_source_kind TEXT CHECK (lead_source_kind IN ('owner_assigned', 'rep_sourced', 'inbound'));
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS qualification JSONB NOT NULL DEFAULT '{}';
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS discovery_at TIMESTAMPTZ;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_reason_code TEXT;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0;
-- Separate facts that must never be conflated (each is set only by its own server path):
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS rep_reported_close_at TIMESTAMPTZ;      -- rep says it is closed (a CLAIM)
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS owner_verified_at TIMESTAMPTZ;           -- owner verified the sale
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS owner_verified_by UUID;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS signed_agreement_at TIMESTAMPTZ;         -- client signed (server-recorded)
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ;         -- verified provider event or owner-recorded evidence
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS fulfillment_started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS crm_deals_assigned_rep_idx ON crm_deals (assigned_rep_id, stage);

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'crm_deals'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%stage%' AND pg_get_constraintdef(oid) ILIKE '%payment_condition_satisfied%' LOOP
    EXECUTE format('ALTER TABLE crm_deals DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE crm_deals ADD CONSTRAINT crm_deals_stage_check CHECK (stage IN (
    'new','assigned','attempted','connected','qualified','discovery','proposal','accepted','payment_condition_satisfied','onboarding',
    'lost','disqualified','nurture','paused',
    'prospect','contacted','audit_ordered','audit_delivered','recommendation','pilot_agreement','installation','active_pilot','results_review','won_paid','won_extended','closed_no_conversion',
    -- Sales-team rep pipeline
    'discovery_scheduled','discovery_completed','awaiting_signature_payment','submitted_for_verification','won'));
END $$;

-- ---- crm_activities: real outreach kinds + outcomes -----------------------------------------------------------
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS rep_user_id UUID;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'crm_activities'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE crm_activities DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE crm_activities ADD CONSTRAINT crm_activities_kind_check CHECK (kind IN ('note','task','reminder','call','email','sms','message','in_person','discovery'));
END $$;

-- ---- de-duplication: one ACTIVE working claim per prospect identity ---------------------------------------------
CREATE TABLE IF NOT EXISTS sales_lead_keys (
  key        TEXT NOT NULL,                  -- e.g. domain:acme.com, phone:2035550100, name:acme plumbing|waterbury
  deal_id    UUID NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_lead_keys_one_active ON sales_lead_keys (key) WHERE active;
CREATE INDEX IF NOT EXISTS sales_lead_keys_deal_idx ON sales_lead_keys (deal_id);

-- ---- append-only history -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_lead_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES crm_deals(id),
  from_user  UUID,
  to_user    UUID,
  assigned_by UUID NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_lead_assignments_deal_idx ON sales_lead_assignments (deal_id);
DROP TRIGGER IF EXISTS sales_lead_assignments_immutable ON sales_lead_assignments;
CREATE TRIGGER sales_lead_assignments_immutable BEFORE UPDATE OR DELETE ON sales_lead_assignments FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

CREATE TABLE IF NOT EXISTS sales_deal_stage_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES crm_deals(id),
  from_stage TEXT,
  to_stage   TEXT NOT NULL,
  actor_id   UUID,
  actor_kind TEXT NOT NULL DEFAULT 'rep' CHECK (actor_kind IN ('rep', 'manager', 'owner', 'system', 'client')),
  reason     TEXT,
  detail     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_deal_stage_events_deal_idx ON sales_deal_stage_events (deal_id, created_at);
DROP TRIGGER IF EXISTS sales_deal_stage_events_immutable ON sales_deal_stage_events;
CREATE TRIGGER sales_deal_stage_events_immutable BEFORE UPDATE OR DELETE ON sales_deal_stage_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- products: sales readiness (a DIFFERENT question from engineering readiness_state) ------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_readiness TEXT NOT NULL DEFAULT 'draft' CHECK (sales_readiness IN ('draft', 'internal_test', 'pilot_approved', 'available_for_sale', 'paused'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_info JSONB NOT NULL DEFAULT '{}';   -- what_it_is, who_for, includes, excludes, prerequisites, discovery_questions, objections, timeline_note
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_info_reviewed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pilot_terms TEXT;                          -- when pilot_approved: the owner-approved label/terms reps must use
CREATE TABLE IF NOT EXISTS sales_product_readiness_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id),
  from_state  TEXT, to_state TEXT NOT NULL,
  changed_by  UUID NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS sales_product_readiness_history_immutable ON sales_product_readiness_history;
CREATE TRIGGER sales_product_readiness_history_immutable BEFORE UPDATE OR DELETE ON sales_product_readiness_history FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Offerings the sales team is trained on. Every one starts as DRAFT with pricing NOT approved; nothing is claimed as available.
INSERT INTO products (slug, version, name, category, description, readiness_state) VALUES
  ('nova-wave-one',            1, 'Wave One',                         'engagement', 'Nova''s first structured engagement package. Scope, inclusions and timing are set by the owner before it is sold.', 'not started'),
  ('call-handling-ai-voice',   1, 'Call Handling / AI Voice Agent',   'communications', 'Answering and routing inbound calls, including AI voice handling where enabled.', 'not started'),
  ('missed-call-followup',     1, 'Missed-Call Follow-Up',            'communications', 'Follow-up for calls that were not answered.', 'not started'),
  ('sms-followup',             1, 'SMS Follow-Up',                    'communications', 'Text-message follow-up with recorded consent.', 'not started'),
  ('crm-pipeline-setup',       1, 'CRM & Pipeline Setup',             'operations', 'Setting up a customer database and sales pipeline for the business.', 'not started'),
  ('lead-capture',             1, 'Lead Capture',                     'operations', 'Capturing inquiries from the business''s channels into one place.', 'not started'),
  ('booking-reminders',        1, 'Booking & Reminders',              'operations', 'Appointment booking with confirmations and reminders.', 'not started')
ON CONFLICT (slug, version) DO NOTHING;

-- ---- sales toolkit (scripts, templates, checklists) — reps see ONLY approved items ------------------------------
CREATE TABLE IF NOT EXISTS sales_toolkit_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN ('script', 'email_template', 'sms_template', 'message_template', 'checklist', 'objection', 'faq', 'guide', 'link')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  program_slug  TEXT,                                    -- which Academy program it supports
  product_slug  TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  compliance_note TEXT,
  created_by    UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by   UUID, approved_at TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_toolkit_items_status_idx ON sales_toolkit_items (status, kind);

-- ---- owner-approvable configuration (nothing here is pre-approved) ------------------------------------
INSERT INTO sales_config (key, version, status, value, change_note) VALUES
  ('audit_terms', 1, 'pending_approval', '{"turnaround_min_hours": null, "turnaround_max_hours": null, "statement": null}'::jsonb, 'Owner must confirm the audit turnaround (24-72h was proposed, never approved). Until approved, reps are not shown any turnaround promise.')
ON CONFLICT (key, version) DO NOTHING;

ALTER TABLE sales_lead_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deal_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_product_readiness_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_toolkit_items ENABLE ROW LEVEL SECURITY;
