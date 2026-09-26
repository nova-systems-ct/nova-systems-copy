-- =============================================================================================
-- Nova Sales Team platform — part 1 of 5: ACCESS CONTROL, AUDIT TRAIL, REPRESENTATIVE RECORDS, HIRING.
-- Standalone and additive. Written 2026-09-26. NOT applied to any production database.
--
-- Depends on (apply first, in this order): schema-update.sql (permissions, role_permissions,
-- has_permission(), applications, contracts), academy-migration-standalone.sql,
-- hiring-workflow-migration-standalone.sql, crm-order-audit-migration-standalone.sql,
-- approval-inbox-migration-standalone.sql, durable-jobs-migration-standalone.sql.
-- Apply zz-public-schema-lockdown-standalone.sql LAST (it covers every table created here).
--
-- WHY THIS FILE FIXES THINGS RATHER THAN ONLY ADDING THEM (all verified 2026-09-26):
--  1. Production's organization_members.role CHECK rejects 'nova_sales_candidate' (probed against the live
--     database: SQLSTATE 23514). The existing invite flow ignored that failure, so an invited candidate
--     received an auth account but NO membership. The constraint is widened below.
--  2. Several existing tables have a SELECT policy of is_org_member(organization_id): ANY member of the Nova
--     organization — including a candidate whose only role grants academy.view — could read Nova's leads,
--     contracts, invoices, clients and CRM records straight from PostgREST with their own session. Those
--     policies are replaced with permission-checked ones.
--  3. nova_sales carried overview.view and growth.view, which expose organization-wide revenue and every lead.
--     Reps get their own scoped workspace instead; those two grants are removed from nova_sales.
-- The DELETE statements below are deliberate, narrow, and idempotent (role_permissions rows for one role).
-- =============================================================================================

-- ---------------------------------------------------------------- append-only guard --------
CREATE OR REPLACE FUNCTION forbid_update_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;

-- ---------------------------------------------------------------- roles ---------------------
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.organization_members'::regclass AND contype = 'c'
             AND (conname = 'organization_members_role_check' OR pg_get_constraintdef(oid) ILIKE '%role%= ANY%' OR pg_get_constraintdef(oid) ILIKE '%(role)::text%')
  LOOP
    EXECUTE format('ALTER TABLE public.organization_members DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check CHECK (role IN (
    'nova_super_admin','nova_admin','nova_auditor','nova_marketing','nova_sales','nova_developer',
    'client_owner','client_admin','client_marketing','client_employee','client_viewer',
    'nova_sales_candidate','nova_sales_manager','nova_finance'));
END $$;

-- ---------------------------------------------------------------- permissions ---------------
INSERT INTO permissions (key, description) VALUES
  ('sales.onboarding', 'Own onboarding: application status, training, documents (candidates and representatives, own records only)'),
  ('sales.rep',        'Representative workspace: assigned leads, own deals, own earnings'),
  ('sales.manage',     'Sales team management: team views scoped to assigned representatives (owner/admin: all)'),
  ('sales.hiring',     'Review applications, record assessments, request changes'),
  ('sales.owner',      'Owner-only sales actions: activation, decisions, discounts/exceptions, compensation plans, sale verification'),
  ('sales.finance',    'Commission approval and payout batches (never for one''s own commissions)')
ON CONFLICT (key) DO NOTHING;

-- Bundles. Owner (nova_super_admin) gets everything; nova_admin gets everything except owner-only and finance.
INSERT INTO role_permissions (role, permission_id)
SELECT v.role, p.id FROM permissions p JOIN (VALUES
  ('nova_super_admin','sales.onboarding'),('nova_super_admin','sales.rep'),('nova_super_admin','sales.manage'),('nova_super_admin','sales.hiring'),('nova_super_admin','sales.owner'),('nova_super_admin','sales.finance'),
  ('nova_admin','sales.onboarding'),('nova_admin','sales.manage'),('nova_admin','sales.hiring'),
  ('nova_sales_candidate','academy.view'),('nova_sales_candidate','sales.onboarding'),
  ('nova_sales','academy.view'),('nova_sales','sales.onboarding'),('nova_sales','sales.rep'),
  ('nova_sales_manager','academy.view'),('nova_sales_manager','sales.onboarding'),('nova_sales_manager','sales.manage'),('nova_sales_manager','sales.hiring'),
  ('nova_finance','sales.finance')
) AS v(role, key) ON v.key = p.key
ON CONFLICT DO NOTHING;

-- A representative must not see organization-wide revenue (overview) or every lead (growth).
DELETE FROM role_permissions
 WHERE role IN ('nova_sales', 'nova_sales_candidate')
   AND permission_id IN (SELECT id FROM permissions WHERE key IN ('overview.view', 'growth.view', 'intelligence.view', 'execution.view', 'companies.view', 'admin.view'));

-- ---------------------------------------------------------------- RLS: membership → permission
-- Replaces is_org_member() read policies with has_permission() ones. Skips tables that do not exist yet.
DO $$
DECLARE t record; p record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('leads','growth.view'), ('referral_tracking','growth.view'), ('wave_one_applications','growth.view'),
    ('contact_submissions','growth.view'), ('newsletter_subscribers','growth.view'), ('newsletter_sends','growth.view'),
    ('intake_submissions','intelligence.view'), ('clients','intelligence.view'),
    ('contracts','admin.view'), ('client_invoices','admin.view'),
    ('meetings','execution.view'), ('nova_tasks','execution.view'),
    ('businesses','growth.view'), ('crm_contacts','growth.view'), ('crm_deals','growth.view'), ('orders','growth.view'),
    ('audit_cases','intelligence.view'),
    ('wave1_org_settings','growth.view'), ('wave1_conversations','growth.view'), ('wave1_messages','growth.view'), ('wave1_appointments','growth.view'), ('pilots','growth.view'),
    ('approval_requests','admin.view')
  ) AS x(tbl, perm)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = 'organization_id') THEN
      RAISE NOTICE 'skipping % : no organization_id column (apply the migration that scopes it first)', t.tbl; CONTINUE;
    END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tbl AND policyname LIKE 'members_read_%' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'perm_read_' || t.tbl, t.tbl);
    IF t.tbl = 'approval_requests' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (organization_id IS NOT NULL AND has_permission(organization_id, %L))', 'perm_read_' || t.tbl, t.tbl, t.perm);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (has_permission(organization_id, %L))', 'perm_read_' || t.tbl, t.tbl, t.perm);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- audit trail (append-only) --
CREATE TABLE IF NOT EXISTS sales_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  actor_role    TEXT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  action        TEXT NOT NULL,
  detail        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS sales_audit_entity_idx ON sales_audit_log (entity_type, entity_id, at);
CREATE INDEX IF NOT EXISTS sales_audit_actor_idx ON sales_audit_log (actor_user_id, at);
DROP TRIGGER IF EXISTS sales_audit_log_immutable ON sales_audit_log;
CREATE TRIGGER sales_audit_log_immutable BEFORE UPDATE OR DELETE ON sales_audit_log FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
DROP TRIGGER IF EXISTS sales_audit_log_no_truncate ON sales_audit_log;
CREATE TRIGGER sales_audit_log_no_truncate BEFORE TRUNCATE ON sales_audit_log FOR EACH STATEMENT EXECUTE FUNCTION forbid_update_delete();

-- ---------------------------------------------------------------- versioned owner configuration
-- One row per (key, version). Only one APPROVED version per key is current. Anything not yet approved is
-- 'draft' or 'pending_approval' and is shown as such — never silently treated as approved.
CREATE TABLE IF NOT EXISTS sales_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL,
  version       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'retired')),
  value         JSONB NOT NULL DEFAULT '{}',
  change_note   TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  UNIQUE (key, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_config_one_approved ON sales_config (key) WHERE status = 'approved';

-- ---------------------------------------------------------------- representative record -----
CREATE TABLE IF NOT EXISTS sales_reps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  application_id     UUID REFERENCES applications(id),
  display_name       TEXT,
  status             TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'suspended', 'inactive')),
  manager_user_id    UUID,
  operational_setup  JSONB NOT NULL DEFAULT '{}',    -- owner-defined setup items, each {done, evidence, by, at}
  manager_notes      TEXT,                            -- restricted: managers/owner only, never returned to the rep
  activated_at       TIMESTAMPTZ, activated_by UUID,
  suspended_at       TIMESTAMPTZ, suspended_by UUID, suspension_reason TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_reps_status_idx ON sales_reps (status);
CREATE INDEX IF NOT EXISTS sales_reps_manager_idx ON sales_reps (manager_user_id);

-- Explicit owner approval of activation. Append-only; captures what the checklist looked like at that moment.
CREATE TABLE IF NOT EXISTS sales_activation_approvals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id             UUID NOT NULL REFERENCES sales_reps(id),
  approved_by        UUID NOT NULL,
  approved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  checklist_snapshot JSONB NOT NULL,
  notes              TEXT
);
DROP TRIGGER IF EXISTS sales_activation_approvals_immutable ON sales_activation_approvals;
CREATE TRIGGER sales_activation_approvals_immutable BEFORE UPDATE OR DELETE ON sales_activation_approvals FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---------------------------------------------------------------- applications: extend in place
-- (the same table the existing Careers flow writes; no second applicant store)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();  -- the legacy table only had submitted_at (which defaulted to row creation)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS reference_code TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS email_normalized TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sales_profile JSONB NOT NULL DEFAULT '{}';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS privacy_notice_version TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS privacy_ack_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decided_by UUID;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_reason TEXT;            -- internal
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_message TEXT;          -- the only decision text the applicant sees
ALTER TABLE applications ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_date TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_time TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_messages JSONB NOT NULL DEFAULT '[]';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portfolio_file_path TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS applications_reference_code_uniq ON applications (reference_code) WHERE reference_code IS NOT NULL;
-- One ACTIVE application per person per position. Rejected/withdrawn/legacy-closed ones do not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_active_per_email ON applications (email_normalized, position)
  WHERE email_normalized IS NOT NULL AND status NOT IN ('rejected', 'withdrawn', 'declined', 'hired');
CREATE INDEX IF NOT EXISTS applications_auth_user_idx ON applications (auth_user_id);
-- New sales-hiring vocabulary alongside the legacy one. NOT VALID: existing rows are not re-checked.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_vocab;
ALTER TABLE applications ADD CONSTRAINT applications_status_vocab CHECK (status IN (
  'new', 'reviewing', 'interview_scheduled', 'hired', 'declined',
  'draft', 'submitted', 'under_review', 'interview_requested', 'changes_requested', 'accepted', 'rejected', 'withdrawn')) NOT VALID;

-- History of every stage change and decision (visible to reviewers; the applicant sees only 'applicant_visible' rows).
CREATE TABLE IF NOT EXISTS application_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID NOT NULL REFERENCES applications(id),
  at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id      UUID,
  actor_kind         TEXT NOT NULL CHECK (actor_kind IN ('applicant', 'reviewer', 'owner', 'system')),
  event_type         TEXT NOT NULL,
  from_status        TEXT,
  to_status          TEXT,
  applicant_visible  BOOLEAN NOT NULL DEFAULT false,
  detail             JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS application_events_app_idx ON application_events (application_id, at);
DROP TRIGGER IF EXISTS application_events_immutable ON application_events;
CREATE TRIGGER application_events_immutable BEFORE UPDATE OR DELETE ON application_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Every submitted version is kept, so a resubmission never overwrites what was originally submitted.
CREATE TABLE IF NOT EXISTS application_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  version         INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, version)
);
DROP TRIGGER IF EXISTS application_versions_immutable ON application_versions;
CREATE TRIGGER application_versions_immutable BEFORE UPDATE OR DELETE ON application_versions FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Structured reviewer assessments. PRIVATE: never returned to the applicant.
CREATE TABLE IF NOT EXISTS application_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  reviewer_id     UUID NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'review' CHECK (kind IN ('review', 'interview', 'practical')),
  scores          JSONB NOT NULL DEFAULT '{}',          -- {criterion: 1..5}
  recommendation  TEXT CHECK (recommendation IN ('advance', 'hold', 'reject')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_evaluations_app_idx ON application_evaluations (application_id);

-- Reviewer asks the applicant for more information. The message is what the applicant sees.
CREATE TABLE IF NOT EXISTS application_change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  requested_by    UUID NOT NULL,
  message         TEXT NOT NULL,
  fields          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- Secure invitations. Only a HASH of the token is stored; the token itself exists only in the emailed link.
CREATE TABLE IF NOT EXISTS application_invitations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       UUID NOT NULL REFERENCES applications(id),
  email                TEXT NOT NULL,
  token_hash           TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'accepted', 'expired', 'revoked')),
  created_by           UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,
  sent_at              TIMESTAMPTZ,
  provider_message_id  TEXT,
  delivery_error       TEXT,
  accepted_at          TIMESTAMPTZ,
  accepted_user_id     UUID,
  last_event_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS application_invitations_app_idx ON application_invitations (application_id);
-- At most one invitation may be live per application.
CREATE UNIQUE INDEX IF NOT EXISTS application_invitations_one_live ON application_invitations (application_id) WHERE status IN ('queued', 'sent', 'delivered');

-- ---------------------------------------------------------------- notifications (outbox) -----
-- In-app rows are always delivered. Email rows carry an honest delivery state; 'dry_run' means it was
-- deliberately NOT sent (development/test mode), never "sent".
CREATE TABLE IF NOT EXISTS sales_notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID,
  email                TEXT,
  channel              TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  kind                 TEXT NOT NULL,
  subject              TEXT NOT NULL,
  body                 TEXT NOT NULL,
  link                 TEXT,
  status               TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'dry_run', 'blocked', 'read')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  provider_message_id  TEXT,
  idempotency_key      TEXT UNIQUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at              TIMESTAMPTZ,
  read_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sales_notifications_user_idx ON sales_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_notifications_status_idx ON sales_notifications (status);

-- ---------------------------------------------------------------- row level security ---------
-- Every table here is reached only through the service-role API, which enforces who may see what.
-- RLS is enabled with NO policy (deny-by-default), so a direct PostgREST call with a user's own session gets nothing.
-- Deliberate: applications carries reviewer notes; evaluations and manager notes must never reach the applicant.
ALTER TABLE sales_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_activation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY;
