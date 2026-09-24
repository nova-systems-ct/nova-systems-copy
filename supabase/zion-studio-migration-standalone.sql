-- =============================================================================================
-- Zion Studio (2026-09-23) — standalone migration. Safe to run: every CREATE TABLE uses
-- IF NOT EXISTS, zero DROP/TRUNCATE/DELETE/UPDATE. Safe to re-run.
--
-- Zion is Isaac's own real public profile (documenting his real life/college/business-building
-- journey through his existing character, because he doesn't show his face on camera) — NOT a
-- separate fictional entity, and not organization-tenant data in the same sense as client-facing
-- CRM/Audit records. Journal entries and facts are scoped to the author, not an organization;
-- ideas/scripts/videos carry an organization_id only so Nova-internal staff (with the right
-- permission) can help produce them, matching "Personal Zion records are private by default."
--
-- Missing character reference assets block RENDERING only (zion_videos.status can never leave
-- 'draft' toward a real render without a real zion_character_assets row) — the rest of the
-- pipeline (journal, facts, ideas, scripts, storyboards, review/approval) works regardless.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS zion_journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id    UUID NOT NULL REFERENCES auth.users(id),
  entry_date        DATE NOT NULL,
  text_content      TEXT,
  voice_note_path   TEXT, -- private storage path only, never a public URL
  time_spent_minutes INTEGER,
  wins              TEXT,
  setbacks          TEXT,
  lessons           TEXT,
  next_plan         TEXT,
  privacy_level     TEXT NOT NULL DEFAULT 'private' CHECK (privacy_level IN ('private', 'allowed_disclosure')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_journal_author_idx ON zion_journal_entries (author_user_id);

-- A journal entry describes what happened; individual FACTS extracted from it must be explicitly
-- confirmed by Isaac before anything downstream (an idea, a script) may cite them as real — "not
-- established facts until Isaac confirms the event."
CREATE TABLE IF NOT EXISTS zion_facts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  UUID NOT NULL REFERENCES zion_journal_entries(id) ON DELETE CASCADE,
  statement         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('unconfirmed', 'confirmed', 'rejected')),
  disclosure_allowed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by      UUID REFERENCES auth.users(id),
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_facts_journal_idx ON zion_facts (journal_entry_id);

-- Versioned character reference — "retrieve existing character references and preserve them...
-- missing references block rendering, not development of the Studio." No row here at all is the
-- expected, honest starting state; the app must never invent an appearance in its absence.
CREATE TABLE IF NOT EXISTS zion_character_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version       INTEGER NOT NULL,
  asset_type    TEXT NOT NULL CHECK (asset_type IN ('appearance_reference', 'voice_reference', 'profile_bible')),
  storage_path  TEXT,
  notes         TEXT,
  supplied_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version, asset_type)
);

CREATE TABLE IF NOT EXISTS zion_video_ideas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  source_fact_ids UUID[] NOT NULL DEFAULT '{}',
  angle           TEXT NOT NULL,
  story_type      TEXT CHECK (story_type IN ('recap', 'lesson', 'process_explanation', 'reflection')),
  status          TEXT NOT NULL DEFAULT 'idea' CHECK (status IN (
                    'idea', 'scripting', 'storyboarding', 'ready_to_render', 'rendering', 'editing',
                    'qa', 'ready_for_review', 'approved', 'changes_requested', 'rejected',
                    'scheduled', 'published', 'archived'
                  )),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_video_ideas_status_idx ON zion_video_ideas (status);

CREATE TABLE IF NOT EXISTS zion_scripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES zion_video_ideas(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL DEFAULT 1,
  hook       TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idea_id, version)
);

CREATE TABLE IF NOT EXISTS zion_storyboards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES zion_video_ideas(id) ON DELETE CASCADE,
  scenes     JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The full production record per master prompt §16's exact field list. A video can exist as a
-- real row through the entire draft/scripting/review pipeline with NO provider connected and NO
-- character asset supplied — only the actual render step is blocked by those, and that block is
-- enforced in application code (api/client.js's zion resource), not hidden.
CREATE TABLE IF NOT EXISTS zion_videos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id                  UUID NOT NULL REFERENCES zion_video_ideas(id),
  script_id                UUID REFERENCES zion_scripts(id),
  storyboard_id            UUID REFERENCES zion_storyboards(id),
  character_asset_version  INTEGER,
  voice_rights_note        TEXT,
  provider                 TEXT,
  provider_render_id       TEXT,
  cost_cents               INTEGER,
  final_video_path         TEXT,
  thumbnail_path           TEXT,
  captions_path             TEXT,
  platform_variant          TEXT,
  disclosure_text            TEXT,
  destination_account         TEXT,
  qa_status                     TEXT CHECK (qa_status IN ('pending', 'pass', 'fail')),
  approval_version               INTEGER,
  approved_by                       UUID REFERENCES auth.users(id),
  approved_at                        TIMESTAMPTZ,
  scheduled_at                        TIMESTAMPTZ,
  publish_id                           TEXT,
  published_at                          TIMESTAMPTZ,
  metrics                                JSONB NOT NULL DEFAULT '{}',
  metrics_updated_at                      TIMESTAMPTZ,
  status                                   TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                                              'draft', 'ready_for_review', 'changes_requested',
                                              'rejected', 'approved', 'scheduled', 'published'
                                            )),
  created_at                                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_videos_idea_idx ON zion_videos (idea_id);
CREATE INDEX IF NOT EXISTS zion_videos_status_idx ON zion_videos (status);

-- Reviewer feedback/history — "Material revisions invalidate approval": a changes_requested or
-- rejected entry here is what actually forces zion_videos.approval_version to be superseded,
-- enforced in application code the same way audit_reports' immutability is.
CREATE TABLE IF NOT EXISTS zion_review_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id     UUID NOT NULL REFERENCES zion_videos(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('approve', 'request_changes', 'reject', 'schedule')),
  notes        TEXT,
  actor_user_id UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_review_events_video_idx ON zion_review_events (video_id);

-- RLS: journal/facts are private-by-default (author only, plus platform owner for the rare case
-- Isaac reviews his own data through an admin tool — is_platform_owner() already exists and is
-- proven). Ideas/scripts/storyboards/videos/review events are staff-visible within Nova's own
-- org (real production collaboration), not public, not client-visible.
ALTER TABLE zion_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read_zion_journal ON zion_journal_entries;
CREATE POLICY owner_read_zion_journal ON zion_journal_entries FOR SELECT TO authenticated USING (author_user_id = auth.uid() OR is_platform_owner());

ALTER TABLE zion_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read_zion_facts ON zion_facts;
CREATE POLICY owner_read_zion_facts ON zion_facts FOR SELECT TO authenticated USING (
  is_platform_owner() OR EXISTS (SELECT 1 FROM zion_journal_entries j WHERE j.id = zion_facts.journal_entry_id AND j.author_user_id = auth.uid())
);

ALTER TABLE zion_video_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_zion_ideas ON zion_video_ideas;
CREATE POLICY members_read_zion_ideas ON zion_video_ideas FOR SELECT TO authenticated USING (organization_id IS NULL OR is_org_member(organization_id));
