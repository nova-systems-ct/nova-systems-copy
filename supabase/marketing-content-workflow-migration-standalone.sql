-- =============================================================================================
-- Marketing/content workflow (2026-09-24, master build prompt §17) — standalone migration.
--
-- UNLIKE every other standalone migration this session, blog_posts is a LIVE table with real
-- production rows already in it (public Insights blog) — this is not a brand-new domain. Every
-- statement below is still additive (IF NOT EXISTS) EXCEPT one narrow, intentional exception:
-- a single UPDATE that backfills the brand-new `status` column from the EXISTING `published`
-- boolean on EXISTING rows, so a post that was already live doesn't suddenly read as an
-- unreviewed draft the moment this migration runs. It touches no other column, deletes nothing,
-- and is idempotent (safe to re-run — the WHERE clause only ever matches rows still at the
-- default). This is the one place this session's "zero UPDATE/DELETE" convention is knowingly
-- relaxed, and only because every prior migration created a brand-new table with no rows yet.
--
-- Closes the real gap identified in the requirement matrix: blog_posts already has real content
-- fields and SEO metadata, but zero review workflow — any grower.view staff member could flip
-- `published` straight to true with no second set of eyes on public-facing content. Submitting
-- for review creates a real row in the Approval Inbox's own `content` item_type via api/client.js
-- (aggregated the same way Audit reports/Zion videos already are), not a separate, disconnected
-- mechanism.
-- =============================================================================================

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'scheduled', 'published'));
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- The one intentional backfill UPDATE described above — see the block comment.
UPDATE blog_posts SET status = 'published' WHERE published = TRUE AND status = 'draft';

-- Scheduling records intent (`scheduled_at`) but nothing in this codebase can act on it
-- automatically yet — there is no durable worker/cron infrastructure (see requirement matrix R19,
-- still not started, blocked on a hosting decision). "Scheduled" content still requires a real
-- staff member to click "Publish Now" once the time arrives; the field is honest about intent, not
-- a promise of automatic publication it can't keep.
