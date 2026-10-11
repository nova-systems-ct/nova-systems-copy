-- =============================================================================================
-- NOVA PRODUCTION SECURITY PATCH — 2026-09-30 (audit F-01 = MVP gaps A-2/A-3, F-34, F-16)
--
-- NOT APPLIED. Applying this to any real database needs Isaac's explicit approval of this exact
-- file. Take a Supabase backup immediately before. Staging first when a staging project exists.
--
-- Narrow and additive: it enables RLS, replaces two over-broad read policies with per-membership
-- ones, revokes anonymous access on 15 tables, narrows one jobs policy, and makes one storage
-- bucket private. It deletes no rows and drops no tables or columns. Safe to run more than once.
-- Every table-specific statement is guarded, so a table missing in the target is skipped.
--
-- It contains the whole of mvp-security-fix-2026-09-29-standalone.sql (A-2, A-3) plus:
--   * F-34: platform jobs (organization_id IS NULL) stop being readable by every signed-in user.
--   * F-16: the intake uploads bucket becomes private. The repaired code reads those files only
--     through 5-minute signed links for Nova staff; no dashboard screen shows them today.
--
-- Legitimate access that is preserved (proven by scripts/e2e_production_patch_test.mjs):
--   * every API handler uses the service role and is unaffected;
--   * a signed-in member still reads their own organization, their own membership rows and
--     their own organization's jobs.
--
-- Rollback must not reopen the exposure: add a narrower policy for the specific legitimate case
-- that broke. Do not restore staff_read_all_* and do not disable RLS.
--
-- Verify afterwards with supabase/checks/security-metadata-check.sql (catalog metadata only; it
-- reads no customer rows).
-- =============================================================================================

-- ---- Preconditions: fail loudly instead of half-applying -------------------------------------
DO $$ BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.organization_members') IS NULL THEN
    RAISE EXCEPTION 'organizations / organization_members missing: this is not the Nova database';
  END IF;
  IF to_regprocedure('public.is_org_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_org_member(uuid) missing: apply the Stage 4 section of schema-update.sql first';
  END IF;
END $$;

-- ---- A-2: organizations / organization_members ----------------------------------------------
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read_all_organizations ON organizations;
DROP POLICY IF EXISTS staff_read_all_members ON organization_members;

DROP POLICY IF EXISTS own_org_read ON organizations;
CREATE POLICY own_org_read ON organizations FOR SELECT TO authenticated USING (is_org_member(id));

DROP POLICY IF EXISTS own_membership_read ON organization_members;
CREATE POLICY own_membership_read ON organization_members FOR SELECT TO authenticated USING (staff_user_id = auth.uid());

-- ---- A-3: 15 tables with no RLS --------------------------------------------------------------
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

-- ---- F-34: jobs without an organization are service-role only --------------------------------
DO $$ BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS members_read_jobs ON public.jobs';
    EXECUTE 'CREATE POLICY members_read_jobs ON public.jobs FOR SELECT TO authenticated USING (organization_id IS NOT NULL AND is_org_member(organization_id))';
  END IF;
END $$;

-- ---- F-16: intake uploads bucket private ----------------------------------------------------
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets SET public = false WHERE id = 'nova-intake-files' AND public IS DISTINCT FROM false;
  END IF;
END $$;
