-- =============================================================================================
-- Install Systems (master execution prompt 2026-10-17, section 11): a versioned installation manifest derived from a
-- business's audit findings and current configuration, installed in explicit, idempotent, resumable stages.
-- Complements the order-based Installation Center (installations/installation_tests/installation_events); a client
-- installation created from an order can reference its manifest via installation_id.
-- Depends on: 00-base-identity, crm-order-audit (audit_cases), installation-center, ops-01. Additive, re-runnable.
-- =============================================================================================
CREATE TABLE IF NOT EXISTS ops_install_manifests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  manifest          JSONB NOT NULL,                 -- {components:[{key,label,required,action,prerequisite}], audit:{case_id,findings[]}}
  manifest_sha256   TEXT NOT NULL,
  source_audit_case_id UUID REFERENCES audit_cases(id) ON DELETE SET NULL,
  installation_id   UUID REFERENCES installations(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'installing', 'installed', 'partial', 'failed', 'activated', 'superseded')),
  lock_token        TEXT,                           -- set while a run is in progress; a second concurrent run is refused
  lock_expires_at   TIMESTAMPTZ,
  created_by        UUID,
  activated_by      UUID,
  activated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, version)
);
CREATE INDEX IF NOT EXISTS ops_install_manifests_org ON ops_install_manifests (organization_id, version DESC);

CREATE TABLE IF NOT EXISTS ops_install_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id       UUID NOT NULL REFERENCES ops_install_manifests(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage             INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 9),
  step_key          TEXT NOT NULL,
  label             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'skipped', 'blocked', 'failed')),
  detail            TEXT,
  evidence          JSONB NOT NULL DEFAULT '{}',
  owner_action      TEXT,                           -- exact next action when blocked
  attempts          INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  UNIQUE (manifest_id, step_key)
);
CREATE INDEX IF NOT EXISTS ops_install_steps_manifest ON ops_install_steps (manifest_id, stage);

ALTER TABLE public.ops_install_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_install_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_install_manifests FROM anon, authenticated;
REVOKE ALL ON public.ops_install_steps FROM anon, authenticated;
