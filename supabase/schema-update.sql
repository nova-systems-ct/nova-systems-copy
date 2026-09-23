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
  ('settings.manage',    'Change organization settings'),
  ('academy.view',       'Access the Nova Sales Academy (internal training, not organization-scoped)')
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

-- academy.view (2026-09-23, Nova Sales Academy): granted only to Nova-internal roles, never to
-- any client_* role below — the Academy is Nova's own internal training content, unrelated to
-- any client organization's data, and must not leak into a client user's dashboard.
INSERT INTO role_permissions (role, permission_id)
SELECT v.role, p.id FROM permissions p JOIN (VALUES
  ('nova_auditor',    'overview.view'), ('nova_auditor',    'intelligence.view'), ('nova_auditor', 'academy.view'),
  ('nova_marketing',  'overview.view'), ('nova_marketing',  'growth.view'), ('nova_marketing', 'academy.view'),
  ('nova_sales',      'overview.view'), ('nova_sales',      'growth.view'), ('nova_sales', 'academy.view'),
  ('nova_developer',  'overview.view'), ('nova_developer',  'execution.view'), ('nova_developer', 'academy.view'),
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

-- =============================================================================================
-- Contact page (2026-09-20): api/notify.js's `contact` action was a pure email relay with no
-- database persistence at all — correct when Resend is configured, but with it currently
-- disconnected as part of the credential reset, a submission that only sends an email loses the
-- message entirely. Per Isaac's explicit instruction, the database write is now the real,
-- required action; the email is best-effort on top of it, matching every other public form in
-- this codebase (/welcome, /waves/form).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  company         TEXT,
  category        TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'sales', 'support', 'careers', 'press', 'other')),
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
  organization_id UUID REFERENCES organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_organization_idx ON contact_submissions (organization_id);
CREATE INDEX IF NOT EXISTS contact_submissions_created_idx      ON contact_submissions (created_at DESC);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_contact_submissions ON contact_submissions;
CREATE POLICY members_read_contact_submissions ON contact_submissions FOR SELECT TO authenticated USING (is_org_member(organization_id));


-- =============================================================================================
-- Repair task (2026-09-21): Newsletter.jsx was 100% localStorage (crmStore's nova_nl_subscribers/
-- nova_nl_sent) — subscribers and send history existed only in whichever browser added them,
-- invisible cross-device/cross-staff and lost on cleared storage. Real tables below, following
-- the same organization_id-nullable-with-backfill pattern as wave_one_applications/
-- contact_submissions above (api/client.js's handleNewsletter doesn't set organization_id on
-- write yet — same known, documented gap as those two tables, not a new one).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_organization_idx ON newsletter_subscribers (organization_id);

UPDATE newsletter_subscribers SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND newsletter_subscribers.organization_id IS NULL;

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_newsletter_subscribers ON newsletter_subscribers;
CREATE POLICY members_read_newsletter_subscribers ON newsletter_subscribers FOR SELECT TO authenticated USING (is_org_member(organization_id));

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT NOT NULL,
  body             TEXT,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  organization_id  UUID REFERENCES organizations(id),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_sends_organization_idx ON newsletter_sends (organization_id);
CREATE INDEX IF NOT EXISTS newsletter_sends_sent_idx         ON newsletter_sends (sent_at DESC);

UPDATE newsletter_sends SET organization_id = o.id FROM organizations o WHERE o.kind = 'nova_internal' AND newsletter_sends.organization_id IS NULL;

ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_newsletter_sends ON newsletter_sends;
CREATE POLICY members_read_newsletter_sends ON newsletter_sends FOR SELECT TO authenticated USING (is_org_member(organization_id));

-- =============================================================================================
-- Nova Sales Academy (2026-09-23) — the ten-program training system from the master build
-- prompt's Section 6. Deliberately built against the CANONICAL identity system
-- (organization_members / auth.users), not the separate, already-flagged-insecure
-- applicant-portal localStorage scheme (ApplicantLogin.jsx/ApplicationStatus.jsx — that's a
-- distinct, pre-existing, deliberately-deferred problem since Stage 2, not touched here).
-- Enrollment ties to a real staff_user_id + organization_id, matching the candidate lifecycle's
-- "training assigned" step, which happens after a real staff invitation exists.
--
-- No RLS SELECT policy exposes academy_quiz_questions' correct_index/explanation to
-- 'authenticated' — every read/write goes through api/academy.js's service-role-backed,
-- requireStaff()-gated dispatcher (same pattern as `applications`/`intake_requests`), so a quiz
-- taker can never read the answer key directly via PostgREST. This is why these tables are NOT
-- given RLS SELECT policies for 'authenticated' the way org-scoped CRM tables are — RLS would
-- either have to expose the answer key or be bypassed by the service role anyway, so the real
-- security boundary here is the server, exactly like the applications table above.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS academy_programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  order_index         INTEGER NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  requires_practical  BOOLEAN NOT NULL DEFAULT false,
  critical_compliance BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_lessons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID NOT NULL REFERENCES academy_programs(id) ON DELETE CASCADE,
  order_index  INTEGER NOT NULL,
  title        TEXT NOT NULL,
  objectives   TEXT[] NOT NULL DEFAULT '{}',
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, order_index)
);

CREATE TABLE IF NOT EXISTS academy_quiz_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     UUID NOT NULL REFERENCES academy_programs(id) ON DELETE CASCADE,
  order_index    INTEGER NOT NULL,
  question       TEXT NOT NULL,
  choices        JSONB NOT NULL,
  correct_index  INTEGER NOT NULL,
  explanation    TEXT,
  critical       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, order_index)
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id         UUID NOT NULL REFERENCES auth.users(id),
  organization_id       UUID REFERENCES organizations(id),
  program_id            UUID NOT NULL REFERENCES academy_programs(id),
  status                TEXT NOT NULL DEFAULT 'not_started'
                          CHECK (status IN ('not_started','in_progress','quiz_passed','awaiting_practical_review','completed','failed')),
  lessons_completed     INTEGER NOT NULL DEFAULT 0,
  best_score            NUMERIC,
  practical_approved_by UUID REFERENCES auth.users(id),
  practical_approved_at TIMESTAMPTZ,
  practical_notes       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, program_id)
);

CREATE TABLE IF NOT EXISTS academy_quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  staff_user_id   UUID NOT NULL REFERENCES auth.users(id),
  answers         JSONB NOT NULL,
  score           NUMERIC NOT NULL,
  passed          BOOLEAN NOT NULL,
  critical_failed BOOLEAN NOT NULL DEFAULT false,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES academy_enrollments(id),
  staff_user_id     UUID NOT NULL REFERENCES auth.users(id),
  program_id        UUID NOT NULL REFERENCES academy_programs(id),
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academy_lessons_program_idx        ON academy_lessons (program_id);
CREATE INDEX IF NOT EXISTS academy_quiz_questions_program_idx ON academy_quiz_questions (program_id);
CREATE INDEX IF NOT EXISTS academy_enrollments_staff_idx      ON academy_enrollments (staff_user_id);
CREATE INDEX IF NOT EXISTS academy_enrollments_program_idx    ON academy_enrollments (program_id);
CREATE INDEX IF NOT EXISTS academy_quiz_attempts_enrollment_idx ON academy_quiz_attempts (enrollment_id);
CREATE INDEX IF NOT EXISTS academy_certificates_staff_idx     ON academy_certificates (staff_user_id);


-- Nova Sales Academy content seed (10 programs, 20 lessons, 50 quiz questions)
-- Seed data generated from a content script — DO NOT hand-edit the text below; edit
-- the source content and regenerate if changes are needed.

-- Program 1: Nova Fundamentals
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('nova-fundamentals', 1, 'Nova Fundamentals', 'What Nova actually sells, how the diagnostic process works, and where a sales representative fits into it.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'What Nova Sells (and Why It''s Different)', ARRAY['Explain Nova''s core loop: Observe, Diagnose, Prioritize, Act, Measure, Learn.', 'Distinguish Nova from a generic web agency, chatbot vendor, or AI-phone company.', 'State the primary product a rep is actually selling: a Business Diagnostic, not a finished solution.']::text[], 'Nova Systems is a business-intelligence and authorized-execution platform, not a website agency and not a chatbot vendor. Those may be things Nova eventually builds for a client, but they are never the pitch. The pitch is the diagnostic itself: Nova investigates a business''s real customer journey — website, phone response, listings, reviews, lead handling, follow-up — and documents what it finds before recommending anything.

That order matters. Nova''s operating loop is Observe -> Diagnose -> Prioritize -> Act -> Measure -> Learn. A rep''s job lives almost entirely in the first step: getting a business owner to agree to be observed. Everything after that — the findings, the recommendations, the optional implementation work — belongs to the diagnostic and delivery teams, not to the rep''s pitch.

EXAMPLE: A weak pitch sounds like "We build websites and social media for small businesses." A correct pitch sounds like "We look at how your business actually handles a new customer today — your site, your phone, your follow-up — and show you exactly where you''re losing them, with evidence, before anyone recommends spending a dollar."

EXERCISE: Write a two-sentence answer to "What does Nova do?" that does NOT mention websites, ads, or social media as the first thing Nova does. Read it back — does it lead with investigation and evidence, or with a deliverable?'
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'The Rep''s Role in the Nova Process', ARRAY['Map the customer journey from first contact through diagnostic delivery.', 'List what a rep may promise and what a rep must never promise.', 'Identify the exact handoff point from rep to diagnostic team.']::text[], 'The real customer journey is: inquiry -> intake -> scope confirmation -> access/consent -> evidence collection -> investigation -> findings -> recommendations -> human review -> delivered report -> customer decision -> optional implementation -> measurement. A rep owns the first two steps — getting the inquiry and helping the prospect complete intake — and nothing past scope confirmation.

What a rep may say: what Nova investigates (website, mobile experience, search visibility, listings, reviews, contact paths, phone response, lead handling, follow-up), that the process is evidence-based, and the honest, scope-dependent timing Nova has approved (a scoped remote diagnostic vs. a broader 360 review are different timelines — never promise one universal number).

What a rep may never say: a specific price not in Nova''s approved pricing, a guaranteed outcome or dollar figure ("we''ll get you $10k more a month"), a turnaround time Nova hasn''t approved for that scope, or anything about a client''s internal financials, commission structure, or unreleased case study. If you don''t know, say "I''ll confirm that and follow up" — never guess out loud to a prospect.

EXERCISE: A prospect asks, "How much will this cost me and how fast will I see results?" Write the honest, non-inventive answer a rep should give.'
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What is the primary thing a Nova sales representative is selling?', '["A finished website","A Business Diagnostic (evidence-based investigation)","A monthly ad-spend package","A chatbot subscription"]'::jsonb, 1, 'The diagnostic is the front door. Implementation only follows if findings support it and the client agrees.', false
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'What is Nova''s operating loop, in order?', '["Sell, Build, Bill, Repeat","Observe, Diagnose, Prioritize, Act, Measure, Learn","Pitch, Close, Deliver, Upsell","Cold Call, Demo, Contract, Onboard"]'::jsonb, 1, 'This loop is the backbone of how Nova frames every conversation, not just internal process language.', false
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'A prospect asks for an exact turnaround time before intake and access have been confirmed. What should a rep do?', '["Promise 24-72 hours to close the deal","Give the honest, scope-dependent framing Nova has approved and explain the clock starts after intake/access","Say it depends on the sales manager''s mood","Refuse to discuss timing at all"]'::jsonb, 1, 'The 24-72hr figure only applies to an appropriately scoped remote diagnostic after intake and access — never a blanket promise.', false
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'Which of these may a rep say to a prospect?', '["\"We guarantee you''ll make $10,000 more per month.\"","\"Nova investigates your website, phone response, listings, reviews, and lead handling.\"","\"I can quote you a custom discount right now off the top of my head.\"","\"Our other client in your industry made a fortune with us\" (no such approved case study exists)"]'::jsonb, 1, 'Only Nova-approved, factual descriptions of what''s investigated are safe to state without further authorization.', false
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'Where does a rep''s ownership of the customer journey end?', '["After the contract is fully paid off","At scope confirmation, when the diagnostic team takes over","Never — reps own the client relationship forever","At the first cold call"]'::jsonb, 1, 'Findings, recommendations, and delivery belong to the diagnostic team, not the rep.', false
FROM academy_programs WHERE slug = 'nova-fundamentals'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 2: Prospecting and Qualification
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('prospecting-and-qualification', 2, 'Prospecting and Qualification', 'Finding businesses with a real, evidence-worthy visibility problem, and qualifying them before you pitch.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Finding Businesses With a Real Visibility Problem', ARRAY['Recognize real signals of a weak customer journey without making accusatory claims.', 'Source prospects respectfully and in line with consent/suppression rules.']::text[], 'Good prospecting starts with real, observable signals — not guesses. Signs worth noting: a business listing with inconsistent hours or address across platforms, a website with no working contact form or booking path, reviews mentioning slow response or missed calls, a phone number that rings out or has no callback. Note what you actually observed, not what you assume is happening internally — "your Google listing shows two different phone numbers" is a fact; "you''re losing half your leads" is a claim only the diagnostic can support.

Always phrase these as possible conditions in conversation ("I noticed X — is that something you''re aware of?"), never as an accusation or a certainty. Source contacts through legitimate channels only, respect any do-not-contact or suppression status, and never scrape or use data you don''t have a legitimate right to use.

EXERCISE: Pick a real, public business listing. Write down two neutral, fact-based observations you could open a conversation with — not judgments.'
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Qualifying Before You Pitch', ARRAY['Apply a short qualification checklist before investing outreach time.', 'Identify who has authority to grant diagnostic access.']::text[], 'Before pitching, confirm four things, even loosely: (1) Problem — is there a real, visible sign of a customer-journey gap? (2) Authority — are you talking to someone who can actually authorize a diagnostic (owner, manager, marketing lead)? (3) Timing — is there any near-term reason they''d act now (new location, slow season, a bad review streak)? (4) Reachability — do they respond at all through any channel?

You don''t need a perfect score on all four to start a conversation — but if none of them are true, that''s a low-value prospect and your time is better spent elsewhere. Qualification isn''t about disqualifying people rudely; it''s about being honest with yourself about where your effort will land.

EXERCISE: Take three prospects from your list and score each 0-4 on the checklist above. Which one do you contact first, and why?'
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'Which of these is a safe, fact-based prospecting observation?', '["\"You''re definitely losing 30% of your calls.\"","\"Your Google Business listing shows different hours than your website.\"","\"Your business is failing.\"","\"Everyone in your industry is switching to Nova.\""]'::jsonb, 1, 'Only state what you actually observed. Impact claims belong to the diagnostic, not the pitch.', false
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'What should a rep do with a contact on a suppression or do-not-contact list?', '["Contact them anyway if the lead looks valuable","Never contact them through any channel","Only call, never email","Ask a colleague to contact them instead"]'::jsonb, 1, 'Suppression status must be honored across every channel, no exceptions.', false
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'What does the "Authority" qualification check for?', '["Whether the prospect has good credit","Whether you''re speaking with someone who can actually authorize a diagnostic","Whether the business is famous","Whether the business has a large ad budget"]'::jsonb, 1, 'Talking to someone without authority to grant access wastes everyone''s time.', false
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'A prospect shows zero signals and hasn''t responded to three attempts. What''s the right move?', '["Escalate contact frequency to daily","Deprioritize and move effort to a better-qualified prospect","Assume they''re just busy and keep pitching the same message forever","Report them as a lost cause and never reconsider"]'::jsonb, 1, 'Qualification means redirecting effort honestly, not giving up on the relationship forever.', false
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'Where should prospecting data ultimately be recorded?', '["A personal spreadsheet only you can see","Nova''s real CRM, so the whole team has accurate, current information","Nowhere until the deal closes","A shared public document"]'::jsonb, 1, 'Accurate, timely CRM logging is covered in full in Program 9, but it starts at prospecting.', false
FROM academy_programs WHERE slug = 'prospecting-and-qualification'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 3: Cold Emailing
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('cold-emailing', 3, 'Cold Emailing', 'Writing cold emails people actually read, and following up without being pushy.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Writing a Cold Email People Actually Read', ARRAY['Write a subject line and opening line that earns a read past the first sentence.', 'Keep a cold email to one clear ask.']::text[], 'A cold email has about two seconds to earn a second look. Skip the generic "Hope you''re doing well" — open with the one specific, real observation you made during prospecting. Keep the whole email under 120 words. State one clear ask: start a conversation about a Business Diagnostic — not five asks buried in one message.

Personalization means referencing something real and specific about their business — never fabricate a detail you haven''t actually verified. If you don''t have a real specific to reference, your email isn''t ready to send yet; go back and look again.

EXAMPLE structure: (1) One-line specific observation. (2) One line connecting it to a possible cost (a missed call, a confusing booking path). (3) One clear ask — a short call, or a link to start a diagnostic. (4) A simple, no-pressure sign-off.

EXERCISE: Draft a 4-line cold email for a real, public local business using this structure. Read it aloud — does it sound like a form letter or like a real person who looked at their business?'
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Sequences and Follow-Up Without Being Pushy', ARRAY['Run a realistic, respectful follow-up sequence.', 'Recognize when to stop and honor unsubscribe/do-not-contact requests immediately.']::text[], 'A realistic sequence is three touches over roughly two weeks: the initial email, a short follow-up a few days later that adds one new piece of value (not just "just checking in"), and a final, low-pressure close-the-loop message that makes it easy to say "not right now" without guilt.

Every email must make opting out effortless, and any unsubscribe or "stop contacting me" request must be honored immediately, across every channel — not just email. This isn''t optional or a suggestion; it''s how consent and suppression actually work at Nova.

EXERCISE: Write the second-touch follow-up to the cold email you drafted in the previous lesson. What new, real value does it add instead of just repeating the ask?'
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What should the opening line of a cold email contain?', '["A generic greeting like \"Hope you''re well\"","A specific, real observation about the prospect''s business","A list of Nova''s five service lines","An unverified claim about their competitors"]'::jsonb, 1, 'Specificity earns the read. Generic openers get deleted.', false
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'How many clear asks should a single cold email contain?', '["As many as fit","One","Three, to increase the odds one lands","None — just introduce Nova"]'::jsonb, 1, 'One clear ask keeps the email easy to act on.', false
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'What must happen immediately if a prospect asks to stop being contacted?', '["Wait until the sequence naturally ends","Honor it immediately, across every channel","Only stop emailing but continue calling","Ask them to confirm twice"]'::jsonb, 1, 'Suppression requests are honored immediately and completely, not partially.', false
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'What''s wrong with personalizing an email using a detail you haven''t verified?', '["Nothing, as long as it sounds plausible","It risks stating something false to a prospect, which damages trust and violates Nova''s honesty standard","It takes too long","It''s fine for cold email but not cold calling"]'::jsonb, 1, 'Fabricated personalization is a trust and ethics problem, not just a style issue.', false
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'What should a second-touch follow-up add that the first email didn''t?', '["Nothing — just repeat the same ask","One new piece of real value or information","A discount that hasn''t been approved","A guilt-trip about not responding"]'::jsonb, 1, 'Adding real value keeps follow-up from feeling like nagging.', false
FROM academy_programs WHERE slug = 'cold-emailing'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 4: Cold Calling
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('cold-calling', 4, 'Cold Calling', 'Earning the first ten seconds of a cold call, and handling objections honestly.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'The First 10 Seconds', ARRAY['Open a cold call with a permission-based, purpose-first structure.', 'Avoid scripts that sound like a scripted sales call.']::text[], 'The first ten seconds decide whether the call continues. State who you are and why you''re calling fast, then ask permission to continue: "Hi, this is [name] with Nova Systems — I looked at [specific real thing] about your business and wanted to flag it. Got two minutes?" That''s it. No long preamble, no fake familiarity.

Permission-based framing respects the other person''s time and dramatically lowers the instinct to hang up, because you''ve given them control. If they say no or "not now," respect it immediately and ask for a better time rather than pushing through.

EXERCISE: Say your opening line out loud, timed. If it takes longer than 12 seconds to get to "got two minutes," cut it down.'
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Handling Objections Honestly', ARRAY['Respond to the three most common objections without pressure tactics.', 'Know when to end a call gracefully instead of pushing.']::text[], '"We already have a website" — acknowledge it, then clarify the diagnostic looks at the whole customer journey, not just whether a site exists. "We''re not interested" — respect it once, offer to send a short written note instead, and end the call if they decline that too. "Send me something in writing" — treat this as a real request, not a brush-off; follow up promptly with exactly what you said you''d send.

Never use false urgency ("this offer expires today") or manufactured scarcity that Nova hasn''t approved. If a prospect is genuinely not interested after a respectful attempt, end the call politely — a bad call handled well protects the relationship for a future attempt; a pushy call closes the door permanently.

EXERCISE: Write your honest, non-pushy response to "we''re not interested" that still leaves the door open.'
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What should the first line of a cold call establish?', '["A long personal story to build rapport","Who you are, why you''re calling, and permission to continue","A hard pitch for the full service list","Nothing — let them guess"]'::jsonb, 1, 'Fast, permission-based openers respect the prospect''s time and reduce hang-ups.', false
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'A prospect says "we already have a website." What''s the correct response?', '["Argue that their website is bad","Acknowledge it and clarify the diagnostic covers the full customer journey, not just site existence","Hang up, since they''re not qualified","Offer an unapproved discount to change their mind"]'::jsonb, 1, 'Reframe honestly instead of arguing or pressuring.', false
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'What is false urgency, and is it allowed?', '["A real, Nova-approved deadline — always allowed","A manufactured deadline to pressure a decision — never allowed","A scheduling conflict — sometimes allowed","A weather delay — allowed on Fridays"]'::jsonb, 1, 'Manufactured urgency Nova hasn''t approved is a trust violation, not a sales technique.', false
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'A prospect asks to "send something in writing." What should a rep do?', '["Treat it as a polite brush-off and move on","Treat it as a real request and follow up promptly with exactly what was promised","Call back immediately and re-pitch verbally instead","Ignore it since verbal commitment is what matters"]'::jsonb, 1, 'Following through builds trust even if the deal doesn''t close immediately.', false
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'When should a rep end a cold call?', '["Never — always keep pushing until they hang up","After a respectful attempt, if the prospect is genuinely not interested","Only if a manager tells them to","As soon as any objection is raised"]'::jsonb, 1, 'Ending gracefully after a real attempt protects the relationship for the future.', false
FROM academy_programs WHERE slug = 'cold-calling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 5: Cold Messaging
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('cold-messaging', 5, 'Cold Messaging', 'Outreach etiquette for social, DM, and SMS channels, and moving a reply toward a diagnostic.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Social/SMS/DM Outreach Etiquette', ARRAY['Respect platform norms for social and messaging outreach.', 'Never send SMS without prior consent.']::text[], 'Direct messages and social outreach are read the same way a stranger walking up to you in person would be — brief, respectful, and clearly stating who you are matters even more than in email, because the format feels personal. Keep the opener short, real, and specific, same as cold email, but even shorter — one or two sentences.

SMS is different from social DMs and email: it requires prior consent before Nova sends anything, and only approved, provisioned numbers may be used. Never text a prospect who hasn''t opted in, and never use a personal phone number for Nova outreach. If you''re unsure whether SMS is authorized for a given contact, don''t send it — ask first.

EXERCISE: Write a two-sentence DM opener for a real, public business''s social account. Would you be comfortable if the business owner read it out loud to their team?'
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'From DM to Diagnostic', ARRAY['Move a casual reply toward booking a diagnostic without pressuring.', 'Recognize when a channel switch (to email or call) will actually help, not hurt.']::text[], 'A DM reply is a warm signal, not a closed deal. When someone responds, the next move is a simple, low-friction ask: "Want me to send a quick link to see what a diagnostic would look at for your business?" That''s easier to say yes to than "let''s hop on a call."

If the conversation gets detailed, offer to move to email so there''s a clear written record both sides can refer back to — this isn''t pushing them away, it''s making the next step easier to act on. Always match their pace; don''t turn a friendly reply into a rapid-fire pitch.

EXERCISE: Write the exact next message you''d send after a prospect replies "oh interesting, tell me more" to your DM.'
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What must happen before Nova sends any SMS to a contact?', '["Nothing — SMS is always fine for business outreach","Prior consent, and only through an approved, provisioned number","Just a good guess that they''d want it","Approval from the prospect''s competitor"]'::jsonb, 1, 'SMS consent is a hard requirement, not a best practice — never text without it.', false
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'How should a cold DM opener compare in length to a cold email?', '["Much longer, since DMs feel more casual","Similar or shorter — one or two sentences","It doesn''t matter, length is irrelevant on social","Always exactly five sentences"]'::jsonb, 1, 'DMs are read as personal messages, so brevity and specificity matter even more.', false
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'A prospect replies "tell me more" to a DM. What''s the best next move?', '["Immediately pitch the full service list in one long message","Offer one simple, low-friction next step, like a link to learn about the diagnostic","Ask for their phone number to call right away","Wait several days before replying"]'::jsonb, 1, 'Match their pace with an easy next step, not a rapid pitch.', false
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'Why offer to move a detailed conversation to email?', '["To avoid the prospect entirely","To create a clear written record both sides can refer back to","Because DMs are against platform rules","It''s never appropriate to switch channels"]'::jsonb, 1, 'Channel switches should make the next step easier, not distance the prospect.', false
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'Can a rep use a personal phone number for SMS outreach to prospects?', '["Yes, if it gets better response rates","No — only approved, provisioned Nova numbers may be used","Yes, but only for existing clients","Only with a manager''s verbal okay"]'::jsonb, 1, 'Personal numbers are never an approved channel for Nova SMS outreach.', false
FROM academy_programs WHERE slug = 'cold-messaging'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 6: In-Person Sales
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('in-person-sales', 6, 'In-Person Sales', 'Reading a room, building rapport quickly, and pitching a diagnostic face-to-face.', true, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Reading a Room and a Business', ARRAY['Observe a physical business respectfully within the first minute.', 'Build rapport quickly without being intrusive.']::text[], 'Walking into a business in person gives you information a cold email never could — how busy it is, how staff handle a walk-in, what the space communicates about the brand. Notice these things, but don''t announce them as criticism; they''re context for the conversation, not ammunition.

Rapport in person happens fast or not at all. Introduce yourself clearly, respect that you''re interrupting their workday, and get to the point quickly — the same permission-based instinct from cold calling applies here too: "I know you''re busy — got two minutes?"

EXERCISE: Next time you''re in any local business as a customer, practice noticing three neutral, factual details about how they handle customers — without saying anything, just as observation practice.'
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'The In-Person Pitch and Close', ARRAY['Structure a short in-person conversation toward booking a diagnostic.', 'Avoid closing a full contract on the spot without proper intake.']::text[], 'An in-person conversation should run 5-10 minutes: introduce yourself and Nova, share one specific, real observation, explain the diagnostic briefly, and ask for the next step — usually a short intake form or a scheduled follow-up, not a signed contract on the spot. Nova''s process requires proper intake and scope confirmation before any real engagement begins; skipping that to force a fast close undermines the whole evidence-based model.

Leave something tangible — a card, a link, a one-pager — so the conversation isn''t lost the moment you walk out. Follow up within a day while the conversation is still fresh for them.

This program includes a practical assessment: a manager or sales lead will observe or review a role-played in-person pitch before this program can be marked complete.'
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What''s the right first move when observing a business''s storefront or operations?', '["Point out flaws immediately to create urgency","Note context privately and use it respectfully in conversation, not as criticism","Ignore everything and just recite the pitch","Take photos without asking"]'::jsonb, 1, 'Observation informs the conversation; it isn''t used to criticize the business to their face.', false
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'How long should a typical in-person pitch conversation run?', '["30-45 minutes minimum","5-10 minutes","As long as it takes to get a signature","Under 30 seconds"]'::jsonb, 1, 'Short, respectful, and focused on the next step — not a full sales presentation.', false
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'Should a rep close a full signed contract on the spot during a first in-person visit?', '["Yes, always push for it","No — proper intake and scope confirmation come first","Only if the prospect insists","Only for businesses with a nice storefront"]'::jsonb, 1, 'Nova''s process requires intake and scope confirmation before real engagement — skipping it undermines the evidence-based model.', false
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'What should a rep leave behind after an in-person conversation?', '["Nothing — memory is enough","Something tangible, like a card or link, so the conversation isn''t lost","A pre-signed contract","An invoice"]'::jsonb, 1, 'A tangible follow-up item makes it easier to continue the conversation later.', false
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'How is this program formally completed?', '["Passing the quiz alone","Passing the quiz AND a practical review (role-play or observed pitch) by a manager/sales lead","Watching a video once","It cannot be completed"]'::jsonb, 1, 'In-Person Sales requires a practical assessment in addition to the quiz.', false
FROM academy_programs WHERE slug = 'in-person-sales'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 7: Discovery and Diagnostic Selling
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('discovery-and-diagnostic-selling', 7, 'Discovery and Diagnostic Selling', 'Diagnosing before prescribing, and running a real discovery conversation.', true, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Diagnosis Before Prescription', ARRAY['Explain to a skeptical prospect why Nova investigates before recommending anything.', 'Distinguish this approach from a typical vendor pitch.']::text[], 'Most vendors pitch a solution before they understand the problem. Nova''s entire model is built on the opposite order: investigate first, document real evidence, then recommend only what the evidence supports. This is worth explaining directly to skeptical prospects, because it''s genuinely different from what they''re used to hearing.

A simple way to say it: "I''m not here to sell you a website today. I''m here to find out, with evidence, where your business might be losing customers — and only after that do we talk about what, if anything, makes sense to fix." This framing builds trust precisely because it asks for less up front, not more.

EXERCISE: Practice explaining "diagnosis before prescription" in one sentence you could say to a prospect who assumes you''re just there to sell them a website.'
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Running a Discovery Conversation', ARRAY['Ask open-ended questions about a prospect''s real customer journey.', 'Separate what was observed, what was stated by the prospect, and what is an assumption.']::text[], 'Good discovery questions are open-ended and about the prospect''s real experience: "Walk me through what happens when a new customer tries to reach you." "What happens to a missed call?" "How do you follow up with someone who inquired but didn''t book?" Let them talk — discovery is mostly listening.

While listening, mentally (or literally) separate three things: what you can directly observe (a listing shows conflicting hours), what the prospect tells you (they said calls sometimes go unanswered), and what you''re inferring (that this is costing them bookings) — that last one is a hypothesis for the diagnostic to test, not a fact you should state as certain. This same discipline — observed fact vs. stated claim vs. inference — is exactly how the diagnostic team documents findings later, so building the habit here matters.

This program includes a practical assessment: a mock discovery conversation will be reviewed before this program can be marked complete.'
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What is Nova''s core sales philosophy in discovery selling?', '["Pitch the solution first, then justify it","Diagnose before prescribing — investigate and gather evidence before recommending anything","Always lead with price","Sell whatever the prospect asks for without question"]'::jsonb, 1, 'This ordering is the foundation of Nova''s credibility with skeptical prospects.', false
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'What kind of questions should dominate a discovery conversation?', '["Yes/no questions about budget only","Open-ended questions about the prospect''s real customer journey","Questions designed to trap the prospect into objections","No questions — just present the pitch"]'::jsonb, 1, 'Discovery is mostly listening, driven by open-ended questions.', false
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'A prospect says calls "sometimes" go unanswered. Is this an observed fact, a stated claim, or an inference?', '["An observed fact","A stated claim (from the prospect) — not yet verified as a documented fact","An inference the rep is making","None of these categories apply"]'::jsonb, 1, 'What a prospect tells you is a claim to note, not something you personally observed or verified.', false
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'Why does separating observed fact / stated claim / inference matter during discovery?', '["It doesn''t — all information is equally certain","It mirrors how the diagnostic team documents findings, and prevents overstating certainty to the prospect","It''s only relevant to the diagnostic team, never to reps","It slows down the pitch unnecessarily"]'::jsonb, 1, 'Building this discipline early keeps reps honest about what''s actually known.', false
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'How is this program formally completed?', '["Quiz only","Quiz AND a reviewed mock discovery conversation","Attendance at a single training session","It auto-completes after 30 days"]'::jsonb, 1, 'Discovery and Diagnostic Selling requires a practical assessment in addition to the quiz.', false
FROM academy_programs WHERE slug = 'discovery-and-diagnostic-selling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 8: Follow-Up and Scheduling
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('follow-up-and-scheduling', 8, 'Follow-Up and Scheduling', 'A follow-up cadence that doesn''t annoy, and scheduling without friction.', false, false)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'The Follow-Up Cadence That Doesn''t Annoy', ARRAY['Design a realistic, multi-channel follow-up cadence.', 'Respect a prospect''s stated contact preferences.']::text[], 'A good cadence spaces touches out realistically — not daily, not silent for a month. A workable default: touch 1 at initial contact, touch 2 three to four days later, touch 3 about a week after that, then a longer pause before a final check-in. Mix channels (email, then a call, then a short message) rather than hammering the same channel repeatedly.

If a prospect states a preference — "email only," "don''t call me," "check back next quarter" — that preference overrides the default cadence immediately and permanently until they say otherwise. Ignoring a stated preference is one of the fastest ways to lose a prospect for good.

EXERCISE: Sketch a four-touch cadence over three weeks for a prospect who responded once but went quiet.'
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Scheduling Without Friction', ARRAY['Confirm every detail needed to avoid a no-show.', 'Handle rescheduling gracefully.']::text[], 'When booking any call or meeting, confirm the date, time, timezone, and contact method out loud or in writing — ambiguity here is the number one cause of no-shows. Send a confirmation immediately after booking, and a short reminder shortly before the meeting.

Reschedules happen constantly and are not a sign of a dying deal — handle them the same respectful, low-friction way every time: "No problem, what works better for you?" Never guilt a prospect for rescheduling; it damages trust for no benefit.

EXERCISE: Write the exact confirmation message you''d send immediately after booking a call for "next Tuesday afternoon" with a prospect — resolve the ambiguity in "next Tuesday afternoon" yourself before sending it.'
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'What should override a rep''s default follow-up cadence?', '["Nothing — always follow the default cadence exactly","A prospect''s stated contact preference","The rep''s personal schedule","The size of the potential deal"]'::jsonb, 1, 'A stated preference takes priority immediately and permanently until changed.', false
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'What is the leading cause of scheduling no-shows?', '["Prospects being generally unreliable","Ambiguity in the confirmed date, time, timezone, or contact method","Sending too many reminders","Booking too far in advance"]'::jsonb, 1, 'Resolving ambiguity up front prevents most no-shows.', false
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'How should a rep respond when a prospect asks to reschedule?', '["Express frustration to discourage further changes","Respond the same respectful, low-friction way every time","Cancel the relationship after one reschedule","Require a reason before agreeing"]'::jsonb, 1, 'Guilting a prospect over a reschedule damages trust for no benefit.', false
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'Should follow-up touches use the same channel every time?', '["Yes, always email","No — mixing channels (email, call, message) is more effective than repeating one channel","Yes, always phone","It doesn''t matter at all"]'::jsonb, 1, 'Channel variety avoids fatigue on any single channel.', false
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'When should a confirmation message be sent after booking a meeting?', '["A week later","Immediately after booking, plus a short reminder before the meeting","Never — the prospect should remember","Only if the prospect asks for one"]'::jsonb, 1, 'Immediate confirmation plus a reminder is the standard that reduces no-shows.', false
FROM academy_programs WHERE slug = 'follow-up-and-scheduling'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 9: CRM and Data Protection
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('crm-and-data-protection', 9, 'CRM and Data Protection', 'Logging activity correctly and handling prospect and client data responsibly.', false, true)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Logging Activity Correctly', ARRAY['Log every real interaction in Nova''s actual CRM, not a personal notebook or spreadsheet.', 'Understand why accurate logging matters to the whole team, not just the rep.']::text[], 'Every real interaction — a call, an email sent, a meeting booked, a status change — belongs in Nova''s real CRM system, scoped to the correct organization. A personal spreadsheet or notes app might feel faster in the moment, but it creates a second, invisible source of truth that nobody else on the team can see, and that directly contradicts Nova''s rule against fake or hidden data.

Accurate logging isn''t busywork — it''s what lets a manager see real pipeline health, lets another rep pick up a relationship if you''re out, and lets Nova''s own reporting be honest instead of guessed. If it didn''t happen in the CRM, as far as the rest of the team is concerned, it didn''t happen.

EXERCISE: List the last three real prospect interactions you had. Are all three logged in the real CRM right now? If not, log them before moving on.'
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'Handling Prospect and Client Data Responsibly', ARRAY['Handle PII according to Nova''s data-protection standards.', 'Know exactly what to do — and never do — with sensitive information a prospect shares.']::text[], 'Prospect and client data — names, phone numbers, emails, anything they tell you about their business — stays inside Nova''s systems. Never export it to a personal device, a personal email account, or a personal spreadsheet, and never share it with anyone outside Nova without authorization. This applies even to data that feels harmless, like a business''s public phone number, once it''s tied to a prospect record.

If a prospect shares something sensitive — financial details, a personal problem, confidential business information — treat it with the same care you''d want for your own information: log what''s relevant to the deal, and never repeat it outside a legitimate business need.

CRITICAL COMPLIANCE NOTE: exporting or sharing prospect/client data outside Nova''s systems, for any reason, is a serious violation — not a judgment call to make on your own.

EXERCISE: A prospect emails you a sensitive detail about a legal issue their business is facing. What do you do with that information, and what do you not do with it?'
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'Where must every real prospect interaction be logged?', '["A personal notebook or spreadsheet","Nova''s real CRM, scoped to the correct organization","Nowhere, unless the deal closes","A shared public document"]'::jsonb, 1, 'A hidden personal log defeats the purpose of a shared, honest CRM.', false
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'Why does accurate CRM logging matter beyond the individual rep?', '["It doesn''t — it''s just personal record-keeping","It lets managers see real pipeline health and lets teammates cover for each other honestly","It''s only used for commission calculations","It''s optional busywork"]'::jsonb, 1, 'CRM accuracy is a team-wide honesty requirement, not personal preference.', false
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'May prospect or client data ever be exported to a personal device or personal email account?', '["Yes, if it''s more convenient","No — never, for any reason, without authorization","Yes, but only for closed deals","Yes, if the prospect gives verbal permission to the rep directly"]'::jsonb, 1, 'This is a hard compliance rule, not a judgment call — data never leaves Nova''s systems without proper authorization.', true
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'A prospect shares a sensitive personal or legal detail unrelated to the deal. What should a rep do?', '["Log it in full detail and share it with the team for entertainment","Log only what''s relevant to the deal and never repeat it outside a legitimate business need","Post about it on social media","Ignore it entirely and delete the message"]'::jsonb, 1, 'Sensitive information deserves the same discretion you''d want for your own information.', true
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'What happens to interactions that are never logged in the CRM?', '["They''re automatically added later by the system","As far as the rest of the team is concerned, they didn''t happen","They still count toward commission automatically","Nothing — logging is purely optional"]'::jsonb, 1, 'Unlogged work is invisible to the rest of Nova, no matter how real it was.', false
FROM academy_programs WHERE slug = 'crm-and-data-protection'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

-- Program 10: Ethics, Commission Rules, and Final Assessment
INSERT INTO academy_programs (slug, order_index, title, description, requires_practical, critical_compliance)
VALUES ('ethics-commission-final-assessment', 10, 'Ethics, Commission Rules, and Final Assessment', 'Nova''s sales ethics, how commission actually works, and a comprehensive final review.', false, true)
ON CONFLICT (slug) DO UPDATE SET order_index = EXCLUDED.order_index, title = EXCLUDED.title, description = EXCLUDED.description, requires_practical = EXCLUDED.requires_practical, critical_compliance = EXCLUDED.critical_compliance;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 1, 'Nova''s Sales Ethics', ARRAY['State Nova''s non-negotiable ethical standards for sales conversations.', 'Recognize the difference between confident selling and dishonest selling.']::text[], 'Every previous program has touched on this, but it''s worth stating plainly and completely here: no false claims, no invented case studies or results, no fabricated urgency or scarcity, no guarantees Nova hasn''t formally approved, and no promises about pricing, timelines, or outcomes that go beyond what''s actually been approved for that scope. Confidence in the pitch is good; certainty about things you don''t actually know is not.

Honesty extends to how you describe the diagnostic process itself — never imply it''s faster, cheaper, or more certain than what''s actually been approved just to close a conversation. A prospect who signs up based on an inflated promise becomes a client who was set up to be disappointed, and that costs Nova far more than a slower, honest close ever would.

EXERCISE: Recall a moment from any previous program''s exercises where you were tempted to round a claim up to sound more impressive. What was the honest version instead?'
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_lessons (program_id, order_index, title, objectives, body)
SELECT id, 2, 'How Commission Works (and What You Cannot Promise)', ARRAY['Explain, accurately and without inventing numbers, how commission is determined.', 'State clearly what a rep can never do regarding their own or another rep''s commission.']::text[], 'Commission is governed entirely by each rep''s own signed compensation agreement with Nova — not by anything stated informally, not by what a rep assumes is standard, and never by a number invented on the spot to close a deal internally or externally. A deal must be verified and, where applicable, actually paid before any commission is owed on it.

A rep can never self-approve their own commission, alter their own commission record, or approve a commission adjustment for themselves or another rep — that approval always sits with the appropriate manager or finance role, following Nova''s real process, not the rep''s own judgment. If a prospect ever asks a rep directly what commission they earn or what percentage Nova pays, the honest answer is that it''s part of Nova''s internal compensation structure and isn''t something to discuss with a prospect — not an invented number.

CRITICAL COMPLIANCE NOTE: attempting to self-approve, alter, or influence your own commission record outside the proper process is a serious violation, regardless of intent.'
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET title = EXCLUDED.title, objectives = EXCLUDED.objectives, body = EXCLUDED.body;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 1, 'May a rep invent or exaggerate a result, case study, or guarantee to help close a deal?', '["Yes, if it''s likely close to true","No — never, under any circumstance","Yes, but only for large deals","Yes, if a manager isn''t listening"]'::jsonb, 1, 'Invented claims are a hard ethical line, not a judgment call based on deal size.', true
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 2, 'Who determines a rep''s exact commission structure?', '["The rep, based on what feels fair","Each rep''s own signed compensation agreement with Nova, applied through Nova''s real approval process","Whatever the prospect is told during the pitch","Common industry standard, regardless of the actual agreement"]'::jsonb, 1, 'Commission is never invented or self-determined — it follows the signed agreement and Nova''s real process.', true
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 3, 'Can a rep self-approve or alter their own commission record?', '["Yes, if the deal clearly qualifies","No — this always requires the appropriate manager or finance approval, never the rep''s own judgment","Yes, for deals under a certain size","Only with a verbal okay from another rep"]'::jsonb, 1, 'Self-approval of commission is a critical compliance violation regardless of how justified it seems.', true
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 4, 'Before commission is owed on a deal, what must happen?', '["Nothing — commission is owed the moment a prospect verbally agrees","The deal must be verified and, where applicable, actually paid","The rep just needs to log it as closed","Commission is always paid in advance"]'::jsonb, 1, 'Verified, and where applicable paid, deals are the basis for commission — not verbal agreement alone.', false
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;

INSERT INTO academy_quiz_questions (program_id, order_index, question, choices, correct_index, explanation, critical)
SELECT id, 5, 'A prospect asks a rep directly what percentage commission they personally earn. What''s the correct response?', '["State an exact percentage to build trust","Explain it''s part of Nova''s internal compensation structure and isn''t discussed with prospects","Make up a plausible-sounding number","Refuse to respond at all and end the call"]'::jsonb, 1, 'Internal compensation details are never shared with prospects, and never invented on the spot.', true
FROM academy_programs WHERE slug = 'ethics-commission-final-assessment'
ON CONFLICT (program_id, order_index) DO UPDATE SET question = EXCLUDED.question, choices = EXCLUDED.choices, correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation, critical = EXCLUDED.critical;
