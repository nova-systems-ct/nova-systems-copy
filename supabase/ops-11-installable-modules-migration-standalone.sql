-- Installable modules (owner brief 2026-10-30 §6): per-business state of each catalog module (selected by the owner,
-- installed, blocked, disabled), so installation is a recipe with recorded results and a module can be disabled without
-- erasing the business's records. Fix tasks created from audit findings carry a source reference so a re-run never
-- duplicates them. Additive and idempotent.
CREATE TABLE IF NOT EXISTS ops_installed_modules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'installing', 'installed', 'blocked', 'failed', 'disabled')),
  catalog_version  INTEGER NOT NULL DEFAULT 1,
  manifest_id      UUID REFERENCES ops_install_manifests(id) ON DELETE SET NULL,
  config           JSONB NOT NULL DEFAULT '{}',
  selected_by      UUID,
  selected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_at     TIMESTAMPTZ,
  disabled_at      TIMESTAMPTZ,
  disabled_by      UUID,
  disabled_reason  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_key)
);
ALTER TABLE ops_installed_modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_installed_modules FROM anon, authenticated;
GRANT ALL ON ops_installed_modules TO service_role;

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS work_items_one_per_source_ref ON work_items (source_ref) WHERE source_ref IS NOT NULL;

-- Which business this workspace's installation is for (its own business). Nova's own workspace also holds audits of
-- prospects; the installer must use the audit of the business being installed, never another business's audit.
ALTER TABLE ops_business_settings ADD COLUMN IF NOT EXISTS self_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;
