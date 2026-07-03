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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STORAGE BUCKETS (create manually in Supabase Studio → Storage) ──────────
-- portfolio   (public)  — homepage/portfolio images
-- portfolios  (private) — job-applicant portfolio uploads, path: [applicant_email]/[file]
-- nova-vault  (private) — contracts, invoices, client files
--   nova-vault/contracts/[client_id]/
--   nova-vault/invoices/[client_id]/
--   nova-vault/files/[client_id]/
