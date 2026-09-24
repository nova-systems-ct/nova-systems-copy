-- =============================================================================================
-- Public-schema lockdown for every table created by the standalone migrations. RUN LAST.
--
-- WHY: Supabase grants new public-schema tables to the anon and authenticated roles by default,
-- and the anon key is embedded in the browser bundle. A table without row-level security is
-- therefore readable AND writable by anyone with devtools. 47 of the tables below enable RLS
-- nowhere in their own migration file (they are meant to be reached only through the
-- service-role API, which enforces organization scope in code).
--
-- WHAT: for each listed table that exists — enable RLS (no policy = deny for anon/authenticated;
-- the service role bypasses RLS), revoke everything from anon, and revoke every write privilege
-- from authenticated. Existing org-scoped SELECT policies for authenticated members (crm/audit/
-- wave1 tables) are untouched, so direct member reads keep working.
--
-- SAFE TO RERUN. Skips tables that do not exist yet (migration not applied). Touches ONLY the
-- tables listed here; it does not alter any pre-existing production table.
--
-- Verified by: scripts/check_migration_lockdown.mjs (static coverage check). NOT yet run against a
-- live database — after running, confirm with the anon key that a SELECT on e.g. audit_evidence
-- returns 401/permission denied (see docs/NOVA_PILOT_INSTALLATION.md).
-- =============================================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academy_certificates',
    'academy_enrollments',
    'academy_lessons',
    'academy_programs',
    'academy_quiz_attempts',
    'academy_quiz_questions',
    'approval_requests',
    'audit_case_pause_events',
    'audit_cases',
    'audit_deliveries',
    'audit_evidence',
    'audit_finding_evidence',
    'audit_findings',
    'audit_outcomes',
    'audit_recommendations',
    'audit_reports',
    'business_locations',
    'businesses',
    'crm_activities',
    'crm_contacts',
    'crm_deals',
    'crm_proposals',
    'crystal_completion_reviews',
    'crystal_customers',
    'crystal_equipment',
    'crystal_estimates',
    'crystal_feedback',
    'crystal_invoices',
    'crystal_job_assignments',
    'crystal_job_checklist_items',
    'crystal_job_media',
    'crystal_jobs',
    'crystal_properties',
    'crystal_quote_requests',
    'crystal_recurring_schedules',
    'crystal_service_catalog',
    'installation_events',
    'installation_tests',
    'installations',
    'jobs',
    'marketing_campaigns',
    'marketing_publishing_adapters',
    'marketing_sequence_enrollments',
    'marketing_sequences',
    'marketing_social_accounts',
    'newsletter_subscribers',
    'order_events',
    'orders',
    'pilot_checklist_items',
    'pilot_permissions',
    'pilots',
    'products',
    'voice_calendar_slots',
    'voice_call_sessions',
    'voice_call_tool_events',
    'voice_configurations',
    'voice_knowledge_base',
    'wave1_appointments',
    'wave1_conversations',
    'wave1_messages',
    'wave1_org_settings',
    'wave1_source_events',
    'zion_character_assets',
    'zion_facts',
    'zion_journal_entries',
    'zion_revenue_records',
    'zion_review_events',
    'zion_scripts',
    'zion_storyboards',
    'zion_video_ideas',
    'zion_videos'
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
