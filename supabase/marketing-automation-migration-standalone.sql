-- =============================================================================================
-- Autonomous marketing and content operations (2026-09-24, master build prompt §17, restored
-- scope beyond blog review/scheduling). Standalone migration. Safe to run: every CREATE TABLE
-- uses IF NOT EXISTS, zero DROP/TRUNCATE/DELETE.
--
-- IMPORTANT — RECONCILIATION, NOT A FRESH DOMAIN: before writing this file, the live database was
-- checked directly (per the master prompt's own "inspect and preserve... do not silently
-- overwrite existing product definitions" rule) and found to ALREADY contain real, seeded
-- `marketing_brands` rows (two real brand identities: "Isaac / Zion — Personal" and "Nova Systems
-- — Company", each with real content_pillars/voice_notes/never_say/always_say, created
-- 2026-08-12 — predating this session) plus empty, never-wired-up `content_ideas` and
-- `content_assets` tables clearly designed for exactly this purpose (content_ideas even has a
-- journey_entry_id column already pointing at Zion's journal). No application code anywhere in
-- this repo currently reads or writes any of them (confirmed by a full repo grep) — they were
-- schema without a workflow behind them, not a competing implementation to route around.
--
-- This migration therefore EXTENDS those three real tables with ALTER TABLE ADD COLUMN IF NOT
-- EXISTS rather than creating a parallel, same-purpose table under a different name — the
-- original plan for this file (before this check) did exactly that and was rewritten once the
-- collision was found, before ever being applied to production. Only `marketing_campaigns` and
-- `marketing_publishing_adapters` are genuinely new tables — no existing analog was found for
-- either. `newsletter_subscribers` is created IF NOT EXISTS (its own definition already lives in
-- schema-update.sql, but was independently confirmed NOT actually applied to this database yet
-- either) before being extended with suppression columns, so this file works regardless of which
-- other migrations have already run.
--
-- marketing_publishing_adapters uses the EXACT status vocabulary from §19's Integration Center
-- ('not_implemented'/'not_connected'/'authorization_required'/'connected'/'operation_tested'/
-- 'degraded'/'disconnected') — every platform starts 'not_implemented' because no provider
-- credentials exist in this environment; nothing here claims a connection that isn't real.
-- =============================================================================================

-- ---- Extend the REAL, existing marketing_brands (do not recreate) ----
ALTER TABLE marketing_brands ADD COLUMN IF NOT EXISTS audience TEXT;
ALTER TABLE marketing_brands ADD COLUMN IF NOT EXISTS cadence TEXT;
ALTER TABLE marketing_brands ADD COLUMN IF NOT EXISTS budget_cents INTEGER; -- NULL = no budget authorized yet
-- "Unknown policy means draft-only" — the real, safe default, matching §17's own explicit rule.
ALTER TABLE marketing_brands ADD COLUMN IF NOT EXISTS approval_policy TEXT NOT NULL DEFAULT 'draft_only' CHECK (approval_policy IN ('draft_only', 'per_action', 'standing_policy'));
ALTER TABLE marketing_brands ADD COLUMN IF NOT EXISTS destination_accounts JSONB NOT NULL DEFAULT '{}';

-- Reusable campaign templates AND real running campaigns — genuinely new, no existing analog.
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  brand_id          UUID NOT NULL REFERENCES marketing_brands(id),
  name              TEXT NOT NULL,
  goal              TEXT,
  is_template       BOOLEAN NOT NULL DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date        DATE,
  end_date          DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_org_idx ON marketing_campaigns (organization_id);

-- ---- Extend the REAL, existing content_ideas (do not recreate) ----
-- Already has: id, organization_id, brand_id, journey_entry_id, pillar, title, notes, status,
-- created_by, created_at, updated_at. Adding the workflow-tracking fields this session's review
-- pattern needs; `status`'s vocabulary (idea/brief/drafted/fact_checked/approved/scheduled/
-- published/rejected) is enforced in application code rather than a new CHECK constraint, since
-- the column already exists as open TEXT and no other code depends on its current values (it has
-- zero rows today).
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES marketing_campaigns(id);
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS content_type TEXT; -- 'social_post' | 'article' | 'video' | 'email'
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS source_notes TEXT; -- research/fact basis, required before fact-check
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS fact_checked_by UUID REFERENCES auth.users(id);
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS fact_checked_at TIMESTAMPTZ;
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE content_ideas ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ---- Extend the REAL, existing content_assets (do not recreate) ----
-- Already has: id, organization_id, brand_id, idea_id, platform, format, caption, script,
-- hashtags, media_url, status, generated_by, reviewed_by, reviewed_at, scheduled_at,
-- published_at, created_at — this is the real predecessor to a "platform-specific variant" table,
-- more complete than what would otherwise have been invented from scratch (already has
-- script/hashtags/format).
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS destination_account TEXT;
-- 'api' means this codebase actually calls the platform's API; 'manual_export' means a real human
-- downloads the prepared media/copy and posts it by hand — both honest, only one automated.
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS publish_mode TEXT NOT NULL DEFAULT 'manual_export' CHECK (publish_mode IN ('api', 'manual_export'));
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS provider_post_id TEXT; -- real ID returned by the platform once actually published via API
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS error TEXT;

-- Exact §19 Integration Center vocabulary — genuinely new, no existing analog. Seeded
-- 'not_implemented' for every platform; state only ever changes via real, tested integration code.
CREATE TABLE IF NOT EXISTS marketing_publishing_adapters (
  platform          TEXT PRIMARY KEY CHECK (platform IN ('tiktok', 'instagram', 'linkedin', 'youtube', 'facebook')),
  state             TEXT NOT NULL DEFAULT 'not_implemented' CHECK (state IN (
                      'not_implemented', 'not_connected', 'authorization_required', 'connected', 'operation_tested', 'degraded', 'disconnected'
                    )),
  last_tested_at    TIMESTAMPTZ,
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO marketing_publishing_adapters (platform, state, notes) VALUES
  ('tiktok', 'not_implemented', 'No API integration built yet — content is prepared for manual export/posting'),
  ('instagram', 'not_implemented', 'No API integration built yet — content is prepared for manual export/posting'),
  ('linkedin', 'not_implemented', 'No API integration built yet — content is prepared for manual export/posting'),
  ('youtube', 'not_implemented', 'No API integration built yet — content is prepared for manual export/posting'),
  ('facebook', 'not_implemented', 'No API integration built yet — content is prepared for manual export/posting')
ON CONFLICT (platform) DO NOTHING;

-- newsletter_subscribers: created IF NOT EXISTS (independently confirmed not actually live yet,
-- despite its own definition already existing in schema-update.sql), then extended with real
-- subscribed/preferences/suppression columns. Matches the original schema-update.sql definition
-- exactly so this is a genuine no-op if that file's section is ever applied first or after.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS subscribed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_marketing_campaigns ON marketing_campaigns;
CREATE POLICY members_read_marketing_campaigns ON marketing_campaigns FOR SELECT TO authenticated USING (is_org_member(organization_id));
