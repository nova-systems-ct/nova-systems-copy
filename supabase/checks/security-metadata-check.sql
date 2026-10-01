-- Read-only, metadata-only security check (security repair 2026-09-30).
-- Reads catalog information only, never customer rows. Safe to run against production in the
-- Supabase SQL editor. Every result is a name or a yes/no. Changes nothing.

-- 1. Tables that must have row level security enabled (expect rls_enabled = true on every row).
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (ARRAY[
  'organizations','organization_members','blog_posts','client_accounts','client_messages',
  'intake_requests','notifications','nova_ai_agents','nova_ai_audits','nova_ai_calls',
  'nova_ai_knowledge_bases','nova_ai_settings','nova_ai_sms_logs','nova_ai_voices','portfolio',
  'social_posts','vault_documents','jobs','clients','client_invoices','contracts','leads'])
ORDER BY 1;

-- 2. Public-schema tables with RLS off (expect zero rows).
SELECT c.relname AS rls_disabled_table
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;

-- 3. Tables the anonymous role can still read or write at the privilege level (review every row;
--    with RLS on and no anon policy, rows are still hidden, but a grant should not exist).
SELECT c.relname AS anon_privileged_table,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE')
         OR has_table_privilege('anon', c.oid, 'DELETE') AS anon_write
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
       OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE'))
ORDER BY 1;

-- 4. Over-broad policies that must be gone (expect zero rows).
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname IN ('staff_read_all_organizations', 'staff_read_all_members')
       OR (tablename = 'jobs' AND qual ILIKE '%organization_id IS NULL%'));

-- 5. Policies that match every row (qual = true), for review.
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' AND qual = 'true' ORDER BY 1, 2;

-- 6. Storage buckets and whether they are public (expect nova-intake-files, nova-vault and
--    portfolios to be false).
SELECT id, public FROM storage.buckets ORDER BY id;

-- 7. Sales reps must not hold organization-wide views (expect zero rows) — audit F-17.
SELECT rp.role, p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role = 'nova_sales' AND p.key IN ('overview.view', 'growth.view');

-- 8. Repair columns present (expect 9 rows) — prerequisite for deploying the repaired code.
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND (table_name, column_name) IN (
  ('client_invoices','payment_source'), ('client_invoices','payment_method'),
  ('client_invoices','payment_evidence'), ('client_invoices','provider_event_id'),
  ('clients','payment_source'), ('clients','provider_event_id'),
  ('contracts','content_sha256'), ('contracts','signature_hash'), ('contracts','signer_ip'))
ORDER BY 1, 2;
