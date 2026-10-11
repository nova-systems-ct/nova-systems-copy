// Dependency-ordered migration list used by the local integration tests (and mirrored in docs/SALES_TEAM_INSTALLATION.md).
export const BASE = [
  'supabase/00-base-identity-tables-standalone.sql',            // tables production had before this repo's history
  { file: 'supabase/schema-update.sql', mode: 'statements' },
  'supabase/security-repair-2026-09-30-columns-standalone.sql',   // legacy cumulative file: run per statement
  'supabase/academy-migration-standalone.sql',
  'supabase/hiring-workflow-migration-standalone.sql',
  'supabase/crm-order-audit-migration-standalone.sql',
  'supabase/approval-inbox-migration-standalone.sql',
  'supabase/durable-jobs-migration-standalone.sql',
];
export const HIERARCHY_PARTS = [
  'supabase/hierarchy-01-registry-migration-standalone.sql',
  'supabase/hierarchy-02-governance-migration-standalone.sql',
  'supabase/hierarchy-03-work-and-reporting-migration-standalone.sql',
  'supabase/hierarchy-04-meetings-migration-standalone.sql',
];
export const SALES_PARTS = [
  'supabase/sales-team-01-access-and-hiring-migration-standalone.sql',
  'supabase/sales-team-02-academy-v2-migration-standalone.sql',
  'supabase/sales-team-03-documents-and-activation-migration-standalone.sql',
  'supabase/sales-team-04-pipeline-catalog-toolkit-migration-standalone.sql',
  'supabase/sales-team-05-proposals-closing-migration-standalone.sql',
  'supabase/sales-team-06-commissions-payouts-migration-standalone.sql',
  'supabase/sales-team-07-academy-content-migration-standalone.sql',
];
export const LOCKDOWN = 'supabase/zz-public-schema-lockdown-standalone.sql';
export const allMigrations = (parts = [...SALES_PARTS, ...HIERARCHY_PARTS], { lockdown = true } = {}) => [...BASE, ...parts, ...(lockdown ? [LOCKDOWN] : [])];
