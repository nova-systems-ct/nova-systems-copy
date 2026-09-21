-- Nova Systems — schema update
-- Run in Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS guards).

-- ── APPLICATIONS (careers) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,
  status TEXT DEFAULT 'new',
  password_hash TEXT,
  city TEXT,
  bio TEXT,
  equipment_owned TEXT,
  has_transportation TEXT,
  instagram_tiktok TEXT,
  camera_equipment TEXT,
  drone_equipment TEXT,
  faa_part_107 TEXT,
  has_transportation_license TEXT,
  speaks_spanish TEXT,
  sales_experience TEXT,
  sales_experience_desc TEXT,
  why_position TEXT,
  start_timing TEXT,
  linkedin_url TEXT,
  ai_tools_experience TEXT,
  ai_system_description TEXT,
  portfolio_links TEXT,
  portfolio_file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS equipment_owned TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_transportation TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS instagram_tiktok TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS camera_equipment TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS drone_equipment TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS faa_part_107 TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_transportation_license TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS speaks_spanish TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sales_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sales_experience_desc TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS why_position TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS start_timing TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_tools_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_system_description TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portfolio_links TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portfolio_file_url TEXT;
-- Added for the 7-position careers page (CTO/COO/CPO/CFO/Sales/Content Creator/Lead Gen)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS years_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tech_stack TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS management_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS operations_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS organization_tools TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS planning_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS project_example TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS financial_background TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS invoicing_tax_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS invoicing_tax_explain TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS platforms TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS editing_software TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS reliable_internet TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS outreach_experience TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS hours_per_week TEXT;

-- Storage bucket for job-application portfolio uploads (private): "portfolios"
-- Create manually in Supabase Studio → Storage, or via API. Folder convention:
-- portfolios/[applicant_email]/[timestamp].[ext]

-- ── PORTFOLIO (public work showcase) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT DEFAULT 'Other',
  client_name TEXT,
  featured BOOLEAN DEFAULT FALSE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ── BLOG ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  slug TEXT UNIQUE,
  category TEXT,
  excerpt TEXT,
  content TEXT,
  thumbnail_color TEXT DEFAULT '#C49A3C',
  seo_title TEXT,
  seo_description TEXT,
  published BOOLEAN DEFAULT FALSE,
  author TEXT DEFAULT 'Isaac Nova',
  site TEXT DEFAULT 'nova',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Backfill columns for a blog_posts table that already existed before this file did.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS thumbnail_color TEXT DEFAULT '#C49A3C';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Isaac Nova';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS site TEXT DEFAULT 'nova';

-- ── CLIENTS (intake / CRM) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  business_address TEXT,
  business_type TEXT,
  current_website TEXT,
  referral_source TEXT,
  tier_name TEXT,
  tier_price NUMERIC,
  intake_data JSONB,
  signature_data_url TEXT,
  status TEXT DEFAULT 'Pending Payment',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_payment_date TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier_price NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS intake_data JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_data_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- ── CLIENT ACCOUNTS (portal login) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  email TEXT UNIQUE,
  password_hash TEXT,
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENT MESSAGES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  sender TEXT,
  message TEXT,
  translated_message TEXT,
  attachment_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SOCIAL POSTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  platform TEXT,
  caption TEXT,
  media_url TEXT,
  scheduled_date DATE,
  status TEXT DEFAULT 'Pending Approval',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEETINGS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  meeting_type TEXT,
  date DATE,
  time TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Requested',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS (dashboard activity feed) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  type TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENT INVOICES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  invoice_number TEXT,
  line_items JSONB,
  subtotal NUMERIC,
  tax NUMERIC DEFAULT 0,
  total NUMERIC,
  deposit_amount NUMERIC,
  due_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'Unpaid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- ── REFERRAL / COMMISSION TRACKING (sales reps) ──────────────────────────────
CREATE TABLE IF NOT EXISTS referral_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_name TEXT,
  rep_email TEXT,
  client_id UUID,
  client_name TEXT,
  deal_value NUMERIC,
  commission_rate NUMERIC,
  commission_amount NUMERIC,
  status TEXT DEFAULT 'Pending',
  retention_bonus_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── VAULT DOCUMENTS (Nova Vault metadata index) ──────────────────────────────
CREATE TABLE IF NOT EXISTS vault_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT,
  client_id UUID,
  client_name TEXT,
  type TEXT,            -- Contract | Invoice | Client File
  storage_path TEXT,
  file_url TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'Pending',  -- Signed | Paid | Pending | Active
  source TEXT DEFAULT 'system',  -- system (auto-generated) | manual (uploaded via Nova Vault)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system';

-- ── INTAKE REQUESTS (public /welcome strategy-meeting bookings) ──────────────
CREATE TABLE IF NOT EXISTS intake_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  business_type TEXT,
  needs TEXT[],
  notes TEXT,
  referral_source TEXT,
  meeting_date TEXT NOT NULL,
  meeting_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending | confirmed | completed | no_show | rescheduled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOVA AI (voice + SMS agent platform, /ai) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS nova_ai_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  agent_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone_number TEXT,
  twilio_number_sid TEXT,
  voice_id TEXT,
  voice_name TEXT,
  knowledge_base_id UUID,
  status TEXT DEFAULT 'testing',  -- testing | active | inactive
  calls_total INTEGER DEFAULT 0,
  bookings_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_knowledge_bases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID,
  client_id UUID,
  business_name TEXT,
  business_description TEXT,
  services TEXT,
  hours TEXT,
  address TEXT,
  booking_process TEXT,
  faqs JSONB,
  never_say TEXT,
  always_say TEXT,
  escalation TEXT,
  personality TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES nova_ai_agents(id),
  caller_phone TEXT,
  duration INTEGER,
  transcript TEXT,
  recording_url TEXT,
  outcome TEXT DEFAULT 'unknown',  -- booked | callback | transferred | hangup | unknown
  booked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES nova_ai_agents(id),
  contact_phone TEXT,
  direction TEXT,  -- inbound | outbound
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_name TEXT NOT NULL UNIQUE,
  elevenlabs_voice_id TEXT NOT NULL,
  industry TEXT,
  language TEXT DEFAULT 'en-es',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default voices — swap elevenlabs_voice_id for real IDs in the Nova AI Voices tab.
INSERT INTO nova_ai_voices (voice_name, elevenlabs_voice_id, industry, language, description) VALUES
  ('Sofia',  'REPLACE_WITH_ELEVENLABS_VOICE_ID_1', 'Restaurant',  'en-es', 'Warm bilingual female voice, friendly and inviting.'),
  ('Marcus', 'REPLACE_WITH_ELEVENLABS_VOICE_ID_2', 'Barbershop',  'en-es', 'Cool, confident male voice with an easygoing energy.'),
  ('Elena',  'REPLACE_WITH_ELEVENLABS_VOICE_ID_3', 'Medical',     'en-es', 'Calm, professional female voice, reassuring bedside manner.'),
  ('Victor', 'REPLACE_WITH_ELEVENLABS_VOICE_ID_4', 'Contractor',  'en-es', 'Direct, practical male voice — no-nonsense and trustworthy.'),
  ('Aria',   'REPLACE_WITH_ELEVENLABS_VOICE_ID_5', 'General',     'en-es', 'Friendly, professional female voice suited to any business.')
ON CONFLICT (voice_name) DO NOTHING;

-- ── WAVE ONE (limited-enrollment landing page + intake, /waves) ─────────────
CREATE TABLE IF NOT EXISTS wave_one_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  website TEXT,
  city TEXT,
  industry TEXT,
  biggest_problem TEXT,
  revenue_range TEXT,
  priority_engines JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT DEFAULT 'new',  -- new | reviewing | approved | rejected | waitlisted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the Wave One spots counter shown live on /waves (read/written via nova_ai_settings).
INSERT INTO nova_ai_settings (key, value) VALUES ('wave_one_spots_remaining', '7')
ON CONFLICT (key) DO NOTHING;

-- ── LEADS (public /welcome quick-contact form) ───────────────────────────────
-- Column names below match the current /welcome form + api/notify.js (?action=welcome-lead).
-- Legacy columns full_name / company_name / service_interest are kept (not dropped) in case
-- older rows or code still reference them, but new writes go to name / company / industry etc.
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_name TEXT,
  service_interest TEXT,
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS challenge TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intake_submission_id UUID;

-- ── INTAKE SUBMISSIONS (public /intake — 20-step Business Intelligence Assessment) ──
CREATE TABLE IF NOT EXISTS intake_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  preferred_contact TEXT,
  best_time TEXT,
  businesses JSONB,
  social_media JSONB,
  goals JSONB,
  budget_range TEXT,
  timeline TEXT,
  referral_source TEXT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  agreement_date TIMESTAMPTZ,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Links back to the originating /welcome lead, when the client arrived via that funnel.
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);
-- One JSONB column per assessment section (sections 3-17 of the 20-step form).
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS story JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS customers JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS services JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS sales_process JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS marketing JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS technology JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS communication JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS team JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS reputation JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS financials JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS competitors JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS ai_knowledge JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS final_questions JSONB;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS document_urls JSONB;
-- Section 19 (Reserve Your Spot) — set when the client skips adding a card.
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS no_card_on_file BOOLEAN DEFAULT FALSE;
-- Section 20 (Agreements & Signature).
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS ai_authorization BOOLEAN DEFAULT FALSE;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS digital_signature TEXT;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS signature_date DATE;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS call_consent BOOLEAN DEFAULT FALSE;

-- ── NOVA AI AUDITS (contact/business record used by Nova AI for follow-up) ──
CREATE TABLE IF NOT EXISTS nova_ai_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  business_name TEXT,
  industry TEXT,
  source TEXT DEFAULT 'intake_form',
  intake_submission_id UUID REFERENCES intake_submissions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTRACTS (digital document signing, /sign/:contract_id) ────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT,
  client_email TEXT,
  contract_type TEXT,   -- Digital Foundation | Growth Package | Custom
  custom_notes TEXT,
  status TEXT DEFAULT 'pending',  -- pending | signed
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  signed_name TEXT,
  signature_data TEXT,  -- base64 PNG data URL of the drawn signature
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STORAGE BUCKETS (create manually in Supabase Studio → Storage) ──────────
-- portfolio         (public)  — homepage/portfolio images
-- portfolios        (private) — job-applicant portfolio uploads, path: [applicant_email]/[file]
-- nova-vault        (private) — contracts, invoices, client files
--   nova-vault/contracts/[client_id]/
--   nova-vault/invoices/[client_id]/
--   nova-vault/files/[client_id]/
-- nova-intake-files (public)  — /intake section 16 document uploads (logos, price lists,
--                                photos, brand guides, etc.), path: [email]/[category]/[timestamp]-[filename]
--                                Public read so confirmation emails/dashboard can link directly;
--                                writes go through the service-role key only (api/business-intake.js).

-- ============================================================================================
-- STAGE 4 — MULTI-COMPANY ARCHITECTURE + RBAC (2026-09-12/13, NOVA-STAGE-4-MULTI-COMPANY-RBAC)
-- Additive only. Safe to re-run. Does not alter or drop any existing table's data.
--
-- IDENTITY MODEL (corrected 2026-09-13 per Isaac's explicit direction — do not revisit without
-- his authorization): there is NO third member_type. Every real authenticated user, Nova staff
-- and client-side people alike, is member_type='staff', staff_user_id = auth.users.id. The
-- actual business relationship (Nova admin vs. client owner vs. client employee, and which
-- organization(s) they belong to) is determined entirely by ROLE plus which organization(s)
-- they have an active organization_members ROW for, never by member_type, which stays a legacy
-- label. organization_members_identity_check and organization_members_member_type_check are
-- deliberately NOT modified by this section.
--
-- SCHEMA-SHAPE NOTE: the live permissions/role_permissions tables (already applied to
-- production before this note was written) use surrogate UUID id primary keys with
-- role_permissions.permission_id as a foreign key to permissions.id, not a direct
-- permission_key TEXT reference, confirmed via PostgREST OpenAPI introspection. The CREATE
-- TABLE statements below match that live shape. src/lib/OrgContext.jsx queries this shape via a
-- PostgREST embed (role_permissions -> permissions(key)), already verified against production.
--
-- KNOWN PRE-EXISTING RISK, inherited, not introduced here, flagged for the tenant-isolation
-- test rather than assumed either way: organizations/organization_members already carry a
-- blanket policy from nova-wave-one's 2026-08-12 migration, staff_read_all_organizations and
-- staff_read_all_members, granting ANY row with member_type='staff' (regardless of role or
-- which org it is on) read access to EVERY organization. Under Isaac's corrected model a
-- client-side person is ALSO member_type='staff' (distinguished only by role), so this
-- pre-existing blanket policy may mean a client_owner row can read organizations it has no real
-- relationship with. scripts/e2e_org_isolation_test.mjs checks this empirically.
-- ============================================================================================

-- LOCATIONS
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS locations_organization_idx ON locations (organization_id);

-- PERMISSIONS + ROLE_PERMISSIONS
-- Keyed to organization_members.role's EXISTING CHECK-constrained values (nova_super_admin,
-- nova_admin, nova_auditor, nova_marketing, nova_sales, nova_developer, client_owner,
-- client_admin, client_marketing, client_employee, client_viewer). No parallel role vocabulary,
-- no ALTER of a constraint another already-deployed app relies on.
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (role, permission_id)
);

INSERT INTO permissions (key, description) VALUES
  ('overview.view',      'View the HQ Overview page'),
  ('intelligence.view',  'View the Intelligence area (diagnostics, intake)'),
  ('growth.view',        'View the Growth area (leads, content, referrals)'),
  ('execution.view',     'View the Execution area'),
  ('companies.view',     'View the Companies (organizations) area'),
  ('admin.view',         'View the Admin area'),
  ('members.view',       'View organization membership lists'),
  ('members.manage',     'Invite/remove/change organization members'),
  ('locations.view',     'View organization locations'),
  ('locations.manage',   'Create/edit organization locations'),
  ('documents.view',     'View documents/Nova Vault'),
  ('documents.manage',   'Upload/delete documents'),
  ('billing.view',       'View invoices/billing'),
  ('billing.manage',     'Create/edit invoices'),
  ('settings.view',      'View organization settings'),
  ('settings.manage',    'Change organization settings')
ON CONFLICT (key) DO NOTHING;

-- Role -> permission bundles. nova_super_admin/nova_admin get everything (platform/Nova-wide
-- operational roles). Every other role — Nova staff and client roles alike — gets ONLY the
-- permission keys actually wired to a route today (overview/intelligence/growth/execution/
-- companies/admin.view — confirmed via grep of src/App.jsx, the only 6 permission strings any
-- frontend code checks). The finer-grained keys (members.*, locations.*, documents.*,
-- billing.*, settings.*) are reference data only — nothing reads them yet — and are
-- DELIBERATELY NOT granted to any client-facing role below (Stage 4.1, 2026-09-13/14):
-- "documents.view"/"billing.view" etc. all point at Nova-global, non-organization-scoped data
-- sources (api/client?resource=invoices etc. return ALL of Nova's records regardless of caller)
-- with no tenant-scoped implementation behind them yet. Do not grant any of them to a
-- client_* role until a real per-organization-scoped implementation exists to back them —
-- granting the permission key first and scoping the data later is exactly the trap this
-- comment exists to prevent.
--
-- STAGE 4.1 FIX (2026-09-13/14, NOVA-STAGE-4.1-CLIENT-ADMIN-SAFETY): client_owner/client_admin
-- previously had admin.view (whatever applied this migration originally granted it) — admin.view
-- gates Nova's own Invoices/Contracts/Nova Vault/Documents/Candidates pages, all Nova-global and
-- not organization-scoped. Removed live via direct DELETE against role_permissions (13 rows:
-- admin.view from client_owner/client_admin, plus the unwired members/locations/documents/
-- billing/settings.view grants from client_owner/client_admin/client_marketing/client_employee)
-- and corrected here so a fresh migration run reproduces the same safe baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id FROM permissions p, (VALUES ('nova_super_admin'), ('nova_admin')) AS r(role)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT v.role, p.id FROM permissions p JOIN (VALUES
  ('nova_auditor',    'overview.view'), ('nova_auditor',    'intelligence.view'),
  ('nova_marketing',  'overview.view'), ('nova_marketing',  'growth.view'),
  ('nova_sales',      'overview.view'), ('nova_sales',      'growth.view'),
  ('nova_developer',  'overview.view'), ('nova_developer',  'execution.view'),
  ('client_owner',    'overview.view'), ('client_owner',    'growth.view'),
  ('client_owner',    'intelligence.view'), ('client_owner', 'companies.view'),
  ('client_owner',    'execution.view'),
  ('client_admin',    'overview.view'), ('client_admin',    'growth.view'),
  ('client_admin',    'intelligence.view'), ('client_admin', 'companies.view'),
  ('client_admin',    'execution.view'),
  ('client_marketing','overview.view'), ('client_marketing','growth.view'),
  ('client_employee', 'overview.view'), ('client_employee', 'execution.view'),
  ('client_viewer',   'overview.view')
) AS v(role, key) ON v.key = p.key
ON CONFLICT DO NOTHING;

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- permissions/role_permissions are a non-sensitive reference table, no tenant data, any
-- authenticated user may read them.
DROP POLICY IF EXISTS authenticated_read_permissions ON permissions;
CREATE POLICY authenticated_read_permissions ON permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS authenticated_read_role_permissions ON role_permissions;
CREATE POLICY authenticated_read_role_permissions ON role_permissions FOR SELECT TO authenticated USING (true);

-- LOCATIONS RLS: real per-organization membership, no blanket clause. Deliberately does NOT
-- grant blanket access to every staff row, scoped to whether the caller has an active
-- organization_members row for THIS specific organization, matching Isaac's corrected identity
-- model (role + membership determine access, not member_type).
DROP POLICY IF EXISTS members_read_locations ON locations;
CREATE POLICY members_read_locations ON locations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.staff_user_id = auth.uid() AND m.status = 'active'
      AND m.organization_id = locations.organization_id
  ));

-- HELPER FUNCTIONS (SECURITY DEFINER, minimal, explicit search_path). is_org_member and
-- has_permission check real per-organization membership only, no member_type shortcut.
-- is_platform_owner is the one deliberately org-agnostic check (a platform-wide role flag, not
-- a data-access bypass).
CREATE OR REPLACE FUNCTION is_platform_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.staff_user_id = auth.uid() AND m.role = 'nova_super_admin' AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.staff_user_id = auth.uid() AND m.status = 'active' AND m.organization_id = target_org_id
  );
$$;

CREATE OR REPLACE FUNCTION has_permission(target_org_id UUID, permission_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    JOIN role_permissions rp ON rp.role = m.role
    JOIN permissions p ON p.id = rp.permission_id AND p.key = permission_key
    WHERE m.staff_user_id = auth.uid() AND m.status = 'active' AND m.organization_id = target_org_id
  );
$$;

-- BOOTSTRAP: Isaac's real staff membership on Nova Systems. Looked up by email against the
-- REAL auth.users table at migration-run time, never a guessed or hardcoded UUID. Covers both
-- real accounts on file for Isaac. Idempotent: NOT EXISTS guard means running this twice
-- creates nothing extra.
INSERT INTO organization_members (organization_id, member_type, staff_user_id, role, status)
SELECT o.id, 'staff', u.id, 'nova_super_admin', 'active'
FROM organizations o
JOIN auth.users u ON u.email IN ('isaac@nova-systems.app', 'isaac_0427@icloud.com')
WHERE o.kind = 'nova_internal'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members m WHERE m.staff_user_id = u.id AND m.organization_id = o.id
  );

-- ============================================================================================
-- STAGE 5 — NOVA RUNS NOVA (2026-09-14, NOVA-STAGE-5-RUNS-NOVA)
-- Additive only. Safe to re-run. Does not alter or drop any existing table's data.
--
-- Organization-scopes the real (not crmStore/localStorage) tables Nova's own operating data
-- already lives in: leads, intake_submissions, contracts, client_invoices, clients, meetings,
-- nova_tasks, referral_tracking. All confirmed live via direct PostgREST introspection before
-- writing this, with actual row content inspected, not assumed:
--   leads (1 row — Isaac's own test submission), intake_submissions (0), contracts (1 row,
--   literally named "QA Test Client — DELETE ME"), client_invoices (0), clients (0), meetings
--   (0), nova_tasks (0), referral_tracking (0). Every existing row in every one of these tables
--   is unambiguously Nova's own data (there is no other real organization yet) — backfilled to
--   the Nova Systems org below, not guessed.
--
-- blog_posts/portfolio are deliberately NOT organization-scoped here — they are the PUBLIC
-- website's marketing content (blog_posts already has a `site` column defaulting to 'nova',
-- confirming platform-global intent), not per-tenant business data (master prompt Section 71:
-- "Some data may be platform-global... Some data is organization-specific" — these are the
-- former).
--
-- No new permission keys were added (leads.view, pipeline.view, tasks.view, revenue.view etc.
-- were considered per Section 43 but rejected as unnecessary proliferation) — the new Leads/
-- Tasks/Revenue surfaces reuse the SAME permission that already gates their parent HQ area
-- (growth.view for Leads/pipeline under Growth, execution.view for Tasks under Execution,
-- overview.view for the Revenue summary on Overview), consistent with how every other child
-- page under an area already works (e.g. Referrals/Blog/Portfolio all just check growth.view).
-- ============================================================================================

ALTER TABLE leads             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE intake_submissions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE contracts         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE client_invoices   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE clients           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE meetings          ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE nova_tasks        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE referral_tracking ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS leads_organization_idx             ON leads (organization_id);
CREATE INDEX IF NOT EXISTS intake_submissions_organization_idx ON intake_submissions (organization_id);
CREATE INDEX IF NOT EXISTS contracts_organization_idx          ON contracts (organization_id);
CREATE INDEX IF NOT EXISTS client_invoices_organization_idx    ON client_invoices (organization_id);
CREATE INDEX IF NOT EXISTS clients_organization_idx            ON clients (organization_id);
CREATE INDEX IF NOT EXISTS meetings_organization_idx           ON meetings (organization_id);
CREATE INDEX IF NOT EXISTS nova_tasks_organization_idx         ON nova_tasks (organization_id);
CREATE INDEX IF NOT EXISTS referral_tracking_organization_idx  ON referral_tracking (organization_id);

-- Backfill: every EXISTING row in these tables is Nova's own real data (verified by content
-- above, not assumed) -> Nova Systems org. Future rows from a real second organization would
-- need their own organization_id set at write time; nothing here retroactively reassigns
-- anything once organization_id is non-null, so this is a one-time, idempotent backfill.
UPDATE leads             SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND leads.organization_id IS NULL;
UPDATE intake_submissions SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND intake_submissions.organization_id IS NULL;
UPDATE contracts         SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND contracts.organization_id IS NULL;
UPDATE client_invoices   SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND client_invoices.organization_id IS NULL;
UPDATE clients           SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND clients.organization_id IS NULL;
UPDATE meetings          SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND meetings.organization_id IS NULL;
UPDATE nova_tasks        SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND nova_tasks.organization_id IS NULL;
UPDATE referral_tracking SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND referral_tracking.organization_id IS NULL;

ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;

-- Real per-organization membership check (is_org_member, built in Stage 4) — no blanket
-- member_type shortcut. All existing api/*.js handlers use the service-role key (bypasses RLS
-- entirely), so enabling RLS here does not change any current server-side behavior — it only
-- closes off direct browser/anon-key access to another organization's rows, matching the same
-- pattern already applied to organizations/organization_members/locations.
DROP POLICY IF EXISTS members_read_leads ON leads;
CREATE POLICY members_read_leads ON leads FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_intake_submissions ON intake_submissions;
CREATE POLICY members_read_intake_submissions ON intake_submissions FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_contracts ON contracts;
CREATE POLICY members_read_contracts ON contracts FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_client_invoices ON client_invoices;
CREATE POLICY members_read_client_invoices ON client_invoices FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_clients ON clients;
CREATE POLICY members_read_clients ON clients FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_meetings ON meetings;
CREATE POLICY members_read_meetings ON meetings FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_nova_tasks ON nova_tasks;
CREATE POLICY members_read_nova_tasks ON nova_tasks FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS members_read_referral_tracking ON referral_tracking;
CREATE POLICY members_read_referral_tracking ON referral_tracking FOR SELECT TO authenticated USING (is_org_member(organization_id));

-- =============================================================================================
-- BUG FIX (2026-09-20, found during the security audit): wave_one_applications was never
-- created. api/waves-intake.js has referenced this exact table name since it was written — every
-- real /waves/form submission has silently failed to save (Supabase 404, caught, logged,
-- swallowed) while the API still returned 200 {ok:true} to the visitor. Confirmed via the live
-- PostgREST schema: no wave_one_applications table exists, and the applications/clients tables
-- (the ones exposed by the separate unauthenticated-endpoint findings from this same audit) are
-- both empty — nothing real was lost from THAT exposure, but this is a distinct, ongoing
-- data-loss bug: real applicants who filled out the Wave One form believed they'd applied, and
-- nothing was ever recorded. Run this once, then every future submission actually persists.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS wave_one_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  company_name     TEXT NOT NULL,
  website          TEXT,
  city             TEXT,
  industry         TEXT,
  biggest_problem  TEXT,
  revenue_range    TEXT,
  priority_engines TEXT[] DEFAULT '{}',
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'rejected', 'waitlisted')),
  organization_id  UUID REFERENCES organizations(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wave_one_applications_organization_idx ON wave_one_applications (organization_id);
CREATE INDEX IF NOT EXISTS wave_one_applications_created_idx      ON wave_one_applications (created_at DESC);

-- Backfilled to Nova's own org for consistency with every other table above — api/waves-intake.js
-- doesn't currently set organization_id on insert (matches its pre-Stage-4 origin), so every row
-- starts NULL and would need the same backfill pattern repeated after a real second organization
-- exists and that handler is updated to set it at write time.
UPDATE wave_one_applications SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND wave_one_applications.organization_id IS NULL;

ALTER TABLE wave_one_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_wave_one_applications ON wave_one_applications;
CREATE POLICY members_read_wave_one_applications ON wave_one_applications FOR SELECT TO authenticated USING (is_org_member(organization_id));

