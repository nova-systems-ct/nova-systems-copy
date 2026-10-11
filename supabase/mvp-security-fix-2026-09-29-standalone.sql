-- =============================================================================================
-- NARROWLY SCOPED SECURITY FIX — Gaps A-2 and A-3 (docs/NOVA_MVP_ACCEPTANCE.md)
--
-- Run this file alone against the target database. Do NOT run the full, cumulative
-- supabase/schema-update.sql against an already-provisioned deployment — most of that file has
-- almost certainly already been applied there, and re-running it blindly touches far more than
-- this fix needs. This file contains only the statements that address A-2 and A-3, extracted
-- verbatim from schema-update.sql (where they also live, for a from-scratch install) and
-- zz-public-schema-lockdown-standalone.sql.
--
-- STATUS: prepared and proven against a real local disposable PostgreSQL + PostgREST
-- (scripts/e2e_org_membership_read_test.mjs 10/10, scripts/e2e_schema_lockdown_test.mjs 48/48).
-- NOT YET APPLIED to any staging or production database. This file does not authorize applying
-- itself — Isaac's explicit approval is still required before it touches the real deployment, and
-- staging comes first, every time (see "Staging target" below).
--
-- WHAT THIS FIXES
--
-- A-2: the real deployment carries a policy named staff_read_all_organizations /
-- staff_read_all_members (added directly to production by an external nova-wave-one 2026-08-12
-- migration — not present in this repo's own migration history) that grants ANY row with
-- member_type='staff' read access to EVERY organization and EVERY membership row, regardless of
-- which org it's actually on. Since a client-side person is also member_type='staff' in this
-- schema (distinguished only by role), a client_owner at Org B can read Org A's
-- organizations/organization_members rows directly via PostgREST today. This section replaces
-- that policy with a real per-membership check.
--
-- A-3: 15 tables exist in the public schema with RLS never enabled and no REVOKE ever applied to
-- them, meaning the public anon key (already shipped in the browser bundle) can read AND write
-- them via PostgREST today: blog_posts, client_accounts (contains a password_hash column — the
-- one code path that ever read it, the "Nova Connect" client login, was already removed
-- 2026-09-20, so this is dead data exposure, not a live login bypass, but still real PII/hash
-- exposure), client_messages, intake_requests, notifications, nova_ai_agents, nova_ai_audits,
-- nova_ai_calls (call transcripts/recording URLs), nova_ai_knowledge_bases, nova_ai_settings,
-- nova_ai_sms_logs (SMS content), nova_ai_voices, portfolio, social_posts, vault_documents
-- (contract/invoice document links). This section enables RLS (deny-by-default — the same,
-- already-proven pattern used for 148 other tables in zz-public-schema-lockdown-standalone.sql)
-- and revokes anon/authenticated-write privileges on exactly these 15 tables.
--
-- DEPENDENCIES
-- - `organizations`, `organization_members` must already exist (they do in production — this is
--   base schema, not a new feature).
-- - The `is_org_member(uuid)` function must already exist (defined in schema-update.sql's Stage 4
--   section, already live in production per docs/requirement-matrix.md's R03 "live verified").
-- - Every one of the 15 A-3 tables must already exist for its ALTER/REVOKE to apply; this file
--   uses the same `to_regclass` existence guard as the full lockdown script, so it is a safe no-op
--   for any table not present.
--
-- PRESERVATION OF LEGITIMATE ACCESS
-- - A-2: every real handler in this codebase uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS
--   entirely) for organizations/organization_members reads — confirmed by direct code grep before
--   writing this file. The only access this changes is direct PostgREST access using a caller's
--   own token, which after this fix returns exactly the org(s) and membership row(s) that caller
--   is really an active member of — the same set the old, broken policy was supposed to already
--   restrict them to.
-- - A-3: every one of the 15 tables is confirmed (by direct code grep) to be read/written
--   server-side only via the service role key — no frontend code calls the Supabase client
--   directly against any of them. This fix closes a code path nothing legitimate ever used.
--
-- BACKUP FIRST
-- Take a Supabase Dashboard → Database → Backups snapshot (or `pg_dump` if you have direct
-- connection access) immediately before applying this file to any real database, staging or
-- production. This file only ADDs policies/RLS/revokes — it drops no data and alters no rows —
-- but a snapshot costs nothing and is the standing rule for every real-database change here.
--
-- STAGING TARGET
-- As of this writing, no separate Supabase staging project exists — nova-systems-copy and
-- nova-wave-one share one Supabase project (docs/NOVA_HIERARCHY_STAGING_PLAN.md's own staging
-- plan lists "create an isolated Supabase staging project" as an unstarted step). Concretely, this
-- means: either (a) Isaac creates a new, separate Supabase project (the free tier supports
-- multiple projects, so this does not require new spend) and this file is applied there first, or
-- (b) if Isaac judges the exposure severe enough and a staging project impractical to stand up
-- quickly, apply directly to production with a fresh backup immediately beforehand and the
-- verification queries below run immediately after. Recommendation: (a), because every ALTER TABLE
-- ENABLE ROW LEVEL SECURITY statement is a real behavior change worth proving against a
-- non-production copy first, even for an additive, backward-compatible fix. This file does not
-- pick (a) or (b) for you — that is the one open decision left in this package.
--
-- VERIFICATION QUERIES (run after applying, from a terminal — never paste the anon/service key
-- anywhere logged or shared; substitute your own env var names)
--   A-2: curl -s "$SUPABASE_URL/rest/v1/organizations?select=id" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--        -> expect [] (empty array), not a list of every organization.
--   A-3: curl -s "$SUPABASE_URL/rest/v1/client_accounts?select=id" -H "apikey: $ANON_KEY"
--        -> expect a permission-denied error (42501), not rows.
--   Then, as a real signed-in staff member (not the anon key), confirm the dashboard still loads
--   your own organization list and Audit/CRM/Vault screens exactly as before — this file changes
--   authorization at the database layer, and while every real handler already uses the service
--   role (unaffected), this step is a real end-to-end sanity check, not a formality.
--
-- RECOVERY / ROLLBACK — must not reopen the exposure
-- Because this file only adds policies and enables RLS (never drops anything), the honest rollback
-- for "something legitimate broke" is to ADD a narrower additional policy for the specific
-- legitimate case that broke, not to re-widen access back to the old blanket policy or disable RLS
-- entirely. If something is broken after applying this file, the two likely causes are: (1) a
-- direct-PostgREST caller (not going through a service-role API handler) that legitimately needs
-- to read a row it doesn't have an `organization_members` row for yet — fix by adding that
-- membership row, not by loosening the policy; (2) a legitimate cross-org read that was never
-- actually supposed to work this broadly — surface it to Isaac as a real product requirement
-- before writing a new policy for it, rather than assuming the old blanket policy was correct.
-- =============================================================================================

-- ---- A-2: organizations / organization_members ----------------------------------------------
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read_all_organizations ON organizations;
DROP POLICY IF EXISTS staff_read_all_members ON organization_members;

DROP POLICY IF EXISTS own_org_read ON organizations;
CREATE POLICY own_org_read ON organizations FOR SELECT TO authenticated USING (is_org_member(id));

DROP POLICY IF EXISTS own_membership_read ON organization_members;
CREATE POLICY own_membership_read ON organization_members FOR SELECT TO authenticated USING (staff_user_id = auth.uid());

-- ---- A-3: 15 tables with no RLS anywhere -----------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'blog_posts', 'client_accounts', 'client_messages', 'intake_requests', 'notifications',
    'nova_ai_agents', 'nova_ai_audits', 'nova_ai_calls', 'nova_ai_knowledge_bases',
    'nova_ai_settings', 'nova_ai_sms_logs', 'nova_ai_voices', 'portfolio', 'social_posts',
    'vault_documents'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END
$$;
