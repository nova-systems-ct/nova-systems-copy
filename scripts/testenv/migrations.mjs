// Dependency-ordered migration list used by the local integration tests (and mirrored in docs/SALES_TEAM_INSTALLATION.md).
export const BASE = [
  { file: 'supabase/schema-update.sql', mode: 'statements' },   // legacy cumulative file: run per statement
  'supabase/academy-migration-standalone.sql',
  'supabase/hiring-workflow-migration-standalone.sql',
  'supabase/crm-order-audit-migration-standalone.sql',
  'supabase/approval-inbox-migration-standalone.sql',
  'supabase/durable-jobs-migration-standalone.sql',
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
export const allMigrations = (parts = SALES_PARTS, { lockdown = true } = {}) => [...BASE, ...parts, ...(lockdown ? [LOCKDOWN] : [])];
