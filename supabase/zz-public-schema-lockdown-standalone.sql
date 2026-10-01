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
-- 2026-09-29: added 15 tables from supabase/schema-update.sql (the older, pre-standalone-migration
-- schema file) that check_migration_lockdown.mjs never scanned, because it only reads files
-- matching *-standalone.sql — schema-update.sql doesn't match that glob, so these tables silently
-- had zero RLS and zero lockdown coverage despite holding real client/PII data (client_accounts
-- has a password_hash column, though the one code path that ever read it — the "Nova Connect"
-- client login — was already removed 2026-09-20; nova_ai_calls/sms_logs hold call/SMS content;
-- vault_documents/intake_requests/client_messages hold client PII). Confirmed by direct grep that
-- every one of these 15 is read/written server-side only via SUPABASE_SERVICE_ROLE_KEY (which
-- bypasses RLS) — no frontend code calls the Supabase client directly against any of them — so
-- this closes the anon/authenticated direct-REST attack surface without touching any legitimate
-- code path: blog_posts, client_accounts, client_messages, intake_requests, notifications,
-- nova_ai_agents, nova_ai_audits, nova_ai_calls, nova_ai_knowledge_bases, nova_ai_settings,
-- nova_ai_sms_logs, nova_ai_voices, portfolio, social_posts, vault_documents.
-- check_migration_lockdown.mjs was also fixed the same day to scan schema-update.sql too, so this
-- blind spot cannot silently reopen the next time a table is added there.
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
    'academy_exercise_responses',
    'academy_exercises',
    'academy_lesson_progress',
    'academy_lessons',
    'academy_practical_submissions',
    'academy_programs',
    'academy_quiz_attempts',
    'academy_quiz_questions',
    'application_change_requests',
    'application_evaluations',
    'application_events',
    'application_invitations',
    'application_versions',
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
    'blog_posts',
    'business_locations',
    'businesses',
    'client_accounts',
    'client_messages',
    'committee_meeting_action_items',
    'committee_meeting_evidence',
    'committee_meeting_participants',
    'committee_meeting_transcript_entries',
    'committee_meetings',
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
    'decision_records',
    'escalation_events',
    'escalations',
    'executive_assignments',
    'installation_events',
    'installation_tests',
    'installations',
    'intake_requests',
    'jobs',
    'kill_switches',
    -- 2026-09-30: the three tables below pre-date this repo in production (created 2026-08-12) and are
    -- read only by service-role handlers in both apps; a fresh install now creates them (F-18).
    'content_assets',
    'content_ideas',
    'marketing_brands',
    'marketing_campaigns',
    'marketing_publishing_adapters',
    'marketing_sequence_enrollments',
    'marketing_sequences',
    'marketing_social_accounts',
    'model_runs',
    'newsletter_subscribers',
    'notifications',
    'nova_ai_agents',
    'nova_ai_audits',
    'nova_ai_calls',
    'nova_ai_knowledge_bases',
    'nova_ai_settings',
    'nova_ai_sms_logs',
    'nova_ai_voices',
    'operational_memory',
    'order_events',
    'orders',
    'org_units',
    'owner_briefs',
    'owner_reauth_confirmations',
    'pilot_checklist_items',
    'pilot_permissions',
    'pilots',
    'portfolio',
    'portfolio_entities',
    'portfolio_status_events',
    'positions',
    'products',
    'sales_activation_approvals',
    'sales_audit_log',
    'sales_commission_entries',
    'sales_commission_events',
    'sales_config',
    'sales_deal_stage_events',
    'sales_deal_verifications',
    'sales_document_events',
    'sales_document_requests',
    'sales_document_templates',
    'sales_document_versions',
    'sales_lead_assignments',
    'sales_lead_keys',
    'sales_notifications',
    'sales_payments',
    'sales_payout_accounts',
    'sales_payout_batches',
    'sales_payouts',
    'sales_product_readiness_history',
    'sales_provider_events',
    'sales_rep_notes',
    'sales_rep_status_history',
    'sales_reps',
    'sales_scope_exceptions',
    'sales_toolkit_items',
    'social_posts',
    'vault_documents',
    'venture_stage_events',
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
    'work_item_events',
    'work_item_evidence',
    'work_item_outputs',
    'work_item_reviews',
    'work_items',
    'worker_contracts',
    'worker_heartbeats',
    'worker_status_events',
    'workers',
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

-- ---- Legacy tables (security repair 2026-09-30, audit F-01/F-18) ----------------------------------------
-- These already have RLS with per-organization policies for signed-in users, but still carried Supabase's
-- default grants to the anonymous role. No browser code (nova-systems-copy or nova-wave-one) uses the anonymous
-- key on them; every public form goes through a service-role API handler. Only the anon grant is removed here:
-- signed-in access stays governed by the existing RLS policies.
DO $$
DECLARE
  t text;
  legacy text[] := ARRAY[
    'applications', 'client_invoices', 'clients', 'contact_submissions', 'contracts', 'intake_submissions',
    'leads', 'locations', 'meetings', 'newsletter_sends', 'newsletter_subscribers', 'nova_tasks',
    'organization_members', 'organizations', 'permissions', 'referral_tracking', 'role_permissions',
    'wave_one_applications'
  ];
BEGIN
  FOREACH t IN ARRAY legacy LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END
$$;
