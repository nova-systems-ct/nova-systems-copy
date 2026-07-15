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
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_name TEXT,
  service_interest TEXT,  -- Website | Social Media | AI Automation | Full Wave One | Not Sure
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INTAKE SUBMISSIONS (public /intake full business intake form) ───────────
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

-- ── STORAGE BUCKETS (create manually in Supabase Studio → Storage) ──────────
-- portfolio   (public)  — homepage/portfolio images
-- portfolios  (private) — job-applicant portfolio uploads, path: [applicant_email]/[file]
-- nova-vault  (private) — contracts, invoices, client files
--   nova-vault/contracts/[client_id]/
--   nova-vault/invoices/[client_id]/
--   nova-vault/files/[client_id]/
