-- =============================================================================================
-- Nova hiring workflow — standalone migration (2026-09-23). Safe to run on the live database:
-- every statement is additive (ALTER TABLE ... ADD COLUMN IF NOT EXISTS, or an idempotent
-- INSERT ... ON CONFLICT). Zero DROP/TRUNCATE/DELETE/UPDATE statements. Safe to re-run.
--
-- Verified before writing this: `applications` currently has 0 rows in production, so there is
-- no real existing data at risk from these additive changes — but every statement is still
-- written to be safe even if that weren't true.
--
-- Prerequisites (already live, confirmed): `applications`, `contracts`, `organizations`,
-- `permissions`, `role_permissions` tables; the "Nova Sales Academy" migration section
-- (supabase/academy-migration-standalone.sql) should be run first, or at the same time — this
-- file does not strictly require it, but the workflow it supports does.
-- =============================================================================================

-- Links an application to a real Supabase Auth account once an administrator invites the
-- candidate. Nullable — an application with no auth_user_id simply hasn't been invited yet.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

-- Real, private storage path for a resume/portfolio upload (see api/intake.js's
-- uploadPortfolioFile) — replaces reliance on the old portfolio_file_url column, which always
-- silently stored NULL in production because the storage bucket it pointed at never actually
-- existed (confirmed live: 0 of 0 real applications have a non-null portfolio_file_url). The old
-- column is left in place, unused for new rows, rather than dropped.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS portfolio_file_path TEXT;

-- Links a contract/working-agreement to the application it belongs to, alongside the existing
-- client_name/client_email fields the sign flow already uses directly (no FK to `clients` was
-- ever required for contracts — this column is purely for admin-UI traceability).
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id);

-- nova_sales_candidate: the pre-activation role a hired-but-not-yet-activated candidate holds.
-- Deliberately granted ONLY academy.view — no overview.view, no growth.view, nothing else. This
-- reuses the exact same canonical RBAC machinery (organization_members / role_permissions /
-- has_permission()) that already gates every other page in this app, rather than inventing a
-- parallel "candidate" identity system. A candidate with this role can reach /dashboard/academy
-- and nothing else in the HQ shell. "Administrator-controlled representative activation" is then
-- just an UPDATE of organization_members.role from 'nova_sales_candidate' to 'nova_sales' —
-- see api/intake.js's activate-representative action.
INSERT INTO role_permissions (role, permission_id)
SELECT 'nova_sales_candidate', p.id FROM permissions p WHERE p.key = 'academy.view'
ON CONFLICT DO NOTHING;
