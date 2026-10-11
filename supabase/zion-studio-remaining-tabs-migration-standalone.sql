-- =============================================================================================
-- Zion Studio — remaining tabs (2026-09-24, master prompt §16: Calendar, Published, Analytics,
-- Revenue, Profile Bible). Standalone migration, additive only to the existing
-- zion-studio-migration-standalone.sql tables (zion_videos/zion_character_assets already have
-- most of what these tabs need — scheduled_at/publish_id/published_at/metrics on zion_videos,
-- versioned asset_type rows on zion_character_assets — this file extends them rather than
-- duplicating). Safe to run: every statement is IF NOT EXISTS-additive.
-- =============================================================================================

-- Published must distinguish provider-confirmed publication from manually recorded publication —
-- zion_videos already has publish_id/published_at but nothing said WHICH kind of confirmation
-- produced them. NULL means neither has happened yet (not published), consistent with every other
-- nullable timestamp/status field in this codebase.
ALTER TABLE zion_videos ADD COLUMN IF NOT EXISTS publish_confirmation_source TEXT CHECK (publish_confirmation_source IN ('provider', 'manual'));

-- Profile Bible needs approval + privacy state on top of the existing version/asset_type
-- structure. "Personal Zion records are private by default" (§7) — default owner_only, never
-- defaulted to org-wide visibility.
ALTER TABLE zion_character_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved'));
ALTER TABLE zion_character_assets ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE zion_character_assets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE zion_character_assets ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'owner_only' CHECK (privacy IN ('owner_only', 'staff_visible'));

-- Revenue must distinguish estimates, verified income, expenses, and profit — profit is computed
-- (verified income minus verified expenses), never stored as its own possibly-stale number.
-- "Do not assert millionaire progress from views or pipeline value" — record_type keeps a rough
-- pipeline-value ESTIMATE structurally separate from real, VERIFIED income, so the two can never
-- be silently summed together.
CREATE TABLE IF NOT EXISTS zion_revenue_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id        UUID REFERENCES zion_videos(id),
  record_type     TEXT NOT NULL CHECK (record_type IN ('estimate', 'verified_income', 'expense')),
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  source          TEXT, -- e.g. 'sponsorship', 'affiliate', 'rendering_cost', 'editing_cost'
  notes           TEXT,
  recorded_by     UUID REFERENCES auth.users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_revenue_type_idx ON zion_revenue_records (record_type);
CREATE INDEX IF NOT EXISTS zion_revenue_video_idx ON zion_revenue_records (video_id);

ALTER TABLE zion_revenue_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read_zion_revenue ON zion_revenue_records;
-- Personal financial records — platform-owner only, same posture as zion_journal_entries, not the
-- broader "any Nova staff" visibility zion_video_ideas/zion_videos use for production
-- collaboration. Revenue is a personal-net-worth-adjacent record, not a production asset.
CREATE POLICY owner_read_zion_revenue ON zion_revenue_records FOR SELECT TO authenticated USING (is_platform_owner());
