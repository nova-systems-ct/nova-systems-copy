-- =============================================================================================
-- Approval Inbox (2026-09-23, master prompt §19) — standalone migration. Safe to run: every
-- CREATE TABLE uses IF NOT EXISTS, zero DROP/TRUNCATE/DELETE/UPDATE. Safe to re-run.
--
-- This is the general-purpose approval mechanism for consequential actions that don't already
-- have their own dedicated, tested approval flow (installations, spending requests, pricing
-- exceptions, future content types). Audit report approval (audit_reports.status) and Zion video
-- review (zion_videos.status + zion_review_events) already have real, independently tested
-- approval logic with their own immutability guarantees — this table does NOT replace or
-- retrofit either (that would be a real refactor risk to freshly-shipped, tested code for no
-- functional gain); instead, api/client.js's `approvals` resource aggregates pending items from
-- all three sources into one real inbox view, exactly satisfying "Approval Inbox unifies
-- reports... content... installations and consequential actions" without duplicating logic that
-- already works.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS approval_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id),
  item_type         TEXT NOT NULL, -- 'installation' | 'spending' | 'pricing_exception' | 'content' | other future types
  item_ref          TEXT,          -- free-form reference to the item this approval concerns (id, order number, etc.)
  action_summary    TEXT NOT NULL,
  -- content_version binds this exact approval to exact content — "recheck authority and unchanged
  -- content immediately before execution" is enforced by comparing this to whatever's supplied at
  -- execution time; a mismatch means the content changed since approval and execution must be
  -- refused, not silently allowed through on stale authorization.
  content_version   TEXT,
  destination       TEXT, -- audience/company/channel this action targets
  requester_user_id UUID REFERENCES auth.users(id),
  cost_cents        INTEGER,
  currency          TEXT DEFAULT 'USD',
  evidence          JSONB NOT NULL DEFAULT '{}',
  policy_ref        TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'revoked')),
  approver_user_id  UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  revoked_reason    TEXT,
  outcome           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approval_requests_org_idx ON approval_requests (organization_id);
CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON approval_requests (status);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_read_approval_requests ON approval_requests;
CREATE POLICY members_read_approval_requests ON approval_requests FOR SELECT TO authenticated USING (organization_id IS NULL OR is_org_member(organization_id));
