-- =============================================================================================
-- BASE TABLES PRODUCTION HAD BEFORE THIS REPOSITORY'S MIGRATION HISTORY (security repair
-- 2026-09-30, audit F-18). First file in supabase/migration-manifest.json.
--
-- organizations, organization_members and nova_tasks were created in production outside this
-- repository. Every later migration references them, so an empty database could not be built
-- from the repository alone. These definitions are the shapes recorded in docs/data-model.md and
-- verified against production on 2026-09-26 (the same shapes the local test bootstrap uses).
--
-- On production every statement here is a no-op (IF NOT EXISTS). Read policies are defined
-- later, in schema-update.sql (own_org_read / own_membership_read).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE,
  kind text NOT NULL DEFAULT 'client' CHECK (kind IN ('nova_internal', 'client')),
  client_id uuid, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_type text NOT NULL DEFAULT 'staff',
  staff_user_id uuid,                    -- production has no foreign key to auth.users here
  client_account_id uuid,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  permissions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_member_type_check CHECK (member_type IN ('staff', 'client_account')),
  CONSTRAINT organization_members_role_check CHECK (role IN ('nova_super_admin','nova_admin','nova_auditor','nova_marketing','nova_sales','nova_developer','client_owner','client_admin','client_marketing','client_employee','client_viewer'))
);

CREATE TABLE IF NOT EXISTS nova_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text, status text DEFAULT 'open', description text, due_date date, assigned_to text,
  created_at timestamptz DEFAULT now()
);

-- Deny by default until schema-update.sql adds the per-membership read policies.
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova_tasks           ENABLE ROW LEVEL SECURITY;
