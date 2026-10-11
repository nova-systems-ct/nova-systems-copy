-- =============================================================================================
-- Nova Organizational Hierarchy — part 1 of N: REGISTRY (portfolio, organizational units, positions,
-- workers, executive assignments). Additive. NOT applied to production. Phase B of the Nova Hierarchy
-- master prompt (2026-09-27/28) — Phase A's reuse decisions are recorded in docs/NOVA_HIERARCHY_REQUIREMENTS.md.
--
-- Deliberately REUSED rather than duplicated: auth.users/organizations/organization_members/permissions/
-- role_permissions/has_permission() (identity — a worker's staff_user_id IS a real auth.users id when the
-- worker is human), sales_audit_log (append-only audit — this file adds no second audit-log table),
-- sales_config (the exact versioned-policy pattern already used for the Academy passing policy and the
-- commission plan — reused here for the CEO Twin policy, the Authority Matrix, and Model Council
-- configuration, under new sales_config keys; nothing here invents a fourth versioned-config mechanism),
-- approval_requests (Isaac's Approval Inbox — the Level 5/6 escalation destination below reuses it,
-- not a second inbox), the `jobs` durable queue (work-item execution — see part 2, not yet written).
-- =============================================================================================

CREATE OR REPLACE FUNCTION forbid_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END $$ LANGUAGE plpgsql;

-- ---- portfolio: every company/venture/internal-project Nova's platform can eventually operate ---------------
CREATE TABLE IF NOT EXISTS portfolio_entities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT NOT NULL UNIQUE,             -- stable slug, e.g. 'nova-systems', 'crystal-clear', 'aura'
  name             TEXT NOT NULL,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('owned_company', 'internal_project', 'managed_client', 'pilot_client', 'experimental_venture', 'partner', 'archived')),
  status           TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'closed')),
  industry         TEXT,
  purpose          TEXT,
  parent_entity_id UUID REFERENCES portfolio_entities(id),
  organization_id  UUID REFERENCES organizations(id),  -- set once this entity has a real tenant boundary; NULL for an idea-stage venture
  budget_status    TEXT NOT NULL DEFAULT 'not configured',
  risk_status      TEXT NOT NULL DEFAULT 'not assessed',
  data_classification TEXT NOT NULL DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
  notes            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at     TIMESTAMPTZ, paused_at TIMESTAMPTZ, closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS portfolio_entities_parent_idx ON portfolio_entities (parent_entity_id);

CREATE TABLE IF NOT EXISTS portfolio_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_entity_id UUID NOT NULL REFERENCES portfolio_entities(id),
  from_status TEXT, to_status TEXT NOT NULL, changed_by UUID NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS portfolio_status_events_immutable ON portfolio_status_events;
CREATE TRIGGER portfolio_status_events_immutable BEFORE UPDATE OR DELETE ON portfolio_status_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- organizational units: departments, committees and shared services — CONFIGURABLE, not a fixed enum ------
CREATE TABLE IF NOT EXISTS org_units (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_entity_id UUID REFERENCES portfolio_entities(id),  -- NULL = portfolio-wide (shared service or cross-company committee)
  key               TEXT NOT NULL,
  name              TEXT NOT NULL,
  unit_type         TEXT NOT NULL CHECK (unit_type IN ('department', 'committee', 'shared_service')),
  parent_unit_id    UUID REFERENCES org_units(id),
  mission           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_entity_id, key)
);

-- ---- positions: seats in the authority hierarchy. A position can exist with NO worker (vacant) or be RESERVED
-- (may never be assigned a worker through the ordinary API — Aura Control Seat and, for now, the Model Council
-- seats, since no real provider-calling integration exists yet).
CREATE TABLE IF NOT EXISTS positions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_entity_id UUID REFERENCES portfolio_entities(id),   -- NULL = portfolio-wide seat (Owner, Aura, CEO Twin, Model Council)
  org_unit_id         UUID REFERENCES org_units(id),
  key                 TEXT NOT NULL,
  title               TEXT NOT NULL,
  authority_level     INTEGER NOT NULL CHECK (authority_level BETWEEN 0 AND 6),  -- 0 Owner .. 6 escalation-only
  position_type       TEXT NOT NULL CHECK (position_type IN ('owner', 'aura_control_seat', 'ceo_twin', 'model_council_seat', 'executive', 'worker', 'shared_service')),
  is_reserved         BOOLEAN NOT NULL DEFAULT false,
  reserved_reason      TEXT,
  authority_limit_cents INTEGER,     -- NULL = no autonomous spending authority at all
  requires_owner_activation BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_entity_id, key)
);
CREATE INDEX IF NOT EXISTS positions_unit_idx ON positions (org_unit_id);

-- ---- workers: human, AI, hybrid or service-account. A human worker's identity IS a real auth.users row
-- (staff_user_id) — never a second identity system. An AI/service-account worker has no staff_user_id.
CREATE TABLE IF NOT EXISTS workers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_entity_id   UUID REFERENCES portfolio_entities(id),
  org_unit_id           UUID REFERENCES org_units(id),
  position_id           UUID REFERENCES positions(id),
  worker_type           TEXT NOT NULL CHECK (worker_type IN ('human', 'ai', 'hybrid', 'service_account')),
  staff_user_id         UUID REFERENCES auth.users(id),
  display_name          TEXT NOT NULL,
  manager_worker_id      UUID REFERENCES workers(id),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'onboarding', 'training', 'restricted', 'active', 'suspended', 'inactive')),
  model_provider         TEXT CHECK (model_provider IN ('chatgpt', 'claude', 'gemini') OR model_provider IS NULL),
  mission                TEXT,
  responsibilities        TEXT,
  skills                JSONB NOT NULL DEFAULT '[]',
  certifications          JSONB NOT NULL DEFAULT '[]',
  approved_tools          JSONB NOT NULL DEFAULT '[]',
  spending_limit_cents    INTEGER NOT NULL DEFAULT 0,
  communication_permission BOOLEAN NOT NULL DEFAULT false,
  data_classification      TEXT NOT NULL DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
  escalation_worker_id    UUID REFERENCES workers(id),
  created_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (worker_type <> 'human' OR staff_user_id IS NOT NULL),
  CHECK (model_provider IS NULL OR worker_type IN ('ai', 'hybrid'))
);
CREATE INDEX IF NOT EXISTS workers_position_idx ON workers (position_id);
CREATE INDEX IF NOT EXISTS workers_manager_idx ON workers (manager_worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS workers_one_active_staff_user ON workers (staff_user_id) WHERE staff_user_id IS NOT NULL AND status NOT IN ('inactive');

CREATE TABLE IF NOT EXISTS worker_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), worker_id UUID NOT NULL REFERENCES workers(id),
  from_status TEXT, to_status TEXT NOT NULL, changed_by UUID NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS worker_status_events_immutable ON worker_status_events;
CREATE TRIGGER worker_status_events_immutable BEFORE UPDATE OR DELETE ON worker_status_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- executive assignments: who fills which position, for which portfolio entity — a position can be
-- explicitly VACANT (fill_type='vacant', worker_id NULL) without deleting the position or inventing staffing.
CREATE TABLE IF NOT EXISTS executive_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id         UUID NOT NULL REFERENCES positions(id),
  portfolio_entity_id UUID REFERENCES portfolio_entities(id),
  worker_id           UUID REFERENCES workers(id),
  fill_type           TEXT NOT NULL CHECK (fill_type IN ('isaac', 'human', 'ai', 'hybrid', 'vacant', 'reserved')),
  assigned_by         UUID,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at       TIMESTAMPTZ,
  reason              TEXT,
  CHECK (fill_type IN ('vacant', 'reserved') OR worker_id IS NOT NULL)
);
-- At most one CURRENT (unassigned_at IS NULL) assignment per (position, portfolio_entity) pair.
CREATE UNIQUE INDEX IF NOT EXISTS executive_assignments_one_current ON executive_assignments (position_id, COALESCE(portfolio_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE unassigned_at IS NULL;

-- ---- model runs: usage ledger for the (not-yet-built) Model Council. Created now so Phase D can append to a
-- real table instead of inventing one under time pressure later. No API keys and no raw prompt/client-data text
-- are ever stored here — input_summary is a short, redacted description only.
CREATE TABLE IF NOT EXISTS model_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_entity_id UUID REFERENCES portfolio_entities(id),
  worker_id         UUID REFERENCES workers(id),
  provider          TEXT NOT NULL CHECK (provider IN ('chatgpt', 'claude', 'gemini')),
  model_version     TEXT,
  task_category     TEXT NOT NULL,
  requested_by      UUID,
  input_summary     TEXT,               -- short, redacted description — never raw prompts or client data
  cost_cents        INTEGER,
  tokens_used        INTEGER,
  latency_ms        INTEGER,
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'timeout')),
  output_ref        TEXT,               -- pointer to where the real output is stored, never the output itself
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- permissions -------------------------------------------------------------------------------------------
INSERT INTO permissions (key, description) VALUES
  ('command.view',  'View the Nova Command hierarchy, portfolio, positions and workers (read-only)'),
  ('command.owner', 'Owner-only hierarchy actions: assign/unassign executives, approve CEO Twin/authority-matrix policy, create portfolio entities, activate Aura')
ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions (role, permission_id)
SELECT v.role, p.id FROM permissions p JOIN (VALUES
  ('nova_super_admin','command.view'), ('nova_super_admin','command.owner'),
  ('nova_admin','command.view')
) AS v(role, key) ON v.key = p.key
ON CONFLICT DO NOTHING;

ALTER TABLE portfolio_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;

-- ---- seed: Isaac as Owner, Aura reserved, CEO Twin governed-but-unapproved, Model Council reserved,
-- Nova Systems/Crystal Clear/Aura/Nova Venture Lab as portfolio entities. No financial/legal facts invented:
-- budget_status/risk_status are left as their honest defaults, and every non-Nova-Systems entity starts 'planned'.
INSERT INTO portfolio_entities (key, name, entity_type, status, industry, purpose, organization_id)
SELECT 'nova-systems', 'Nova Systems', 'owned_company', CASE WHEN o.id IS NOT NULL THEN 'active' ELSE 'planned' END, 'Business intelligence & execution', 'Diagnose businesses with evidence and, where authorized, implement the fix.', o.id
FROM (SELECT id FROM organizations WHERE kind = 'nova_internal' LIMIT 1) o
WHERE NOT EXISTS (SELECT 1 FROM portfolio_entities WHERE key = 'nova-systems')
UNION ALL SELECT 'nova-systems', 'Nova Systems', 'owned_company', 'planned', 'Business intelligence & execution', 'Diagnose businesses with evidence and, where authorized, implement the fix.', NULL
WHERE NOT EXISTS (SELECT 1 FROM portfolio_entities WHERE key = 'nova-systems') AND NOT EXISTS (SELECT 1 FROM organizations WHERE kind = 'nova_internal')
LIMIT 1;

INSERT INTO portfolio_entities (key, name, entity_type, status, industry, purpose)
VALUES
  ('crystal-clear', 'Crystal Clear', 'owned_company', 'planned', NULL, 'Placeholder for the planned physical-services company. Name, service catalog, legal structure and market are undecided — see docs/NOVA_HIERARCHY_OWNER_ACTIONS.md.'),
  ('aura', 'Aura', 'internal_project', 'planned', NULL, 'Placeholder for the future Aura intelligence/assistant system. Not built. See the reserved Aura Control Seat position.'),
  ('nova-venture-lab', 'Nova Venture Lab', 'internal_project', 'planned', NULL, 'Zero-cost experimentation and revenue-validation unit. No experiments exist yet.')
ON CONFLICT (key) DO NOTHING;

-- Portfolio-wide organizational units (department/committee list is illustrative and fully editable — nothing
-- in the API hard-codes this list; it exists only as a starting point an owner can rename, add to, or remove).
INSERT INTO org_units (portfolio_entity_id, key, name, unit_type, mission)
SELECT NULL, u.key, u.name, u.unit_type, u.mission FROM (VALUES
  ('executive-operations', 'Executive Operations', 'department', 'Owner and executive support'),
  ('finance', 'Finance & Accounting', 'shared_service', 'Budgets, cash, payouts, profitability'),
  ('people-operations', 'People Operations / HR', 'shared_service', 'Recruiting, onboarding, training, conduct'),
  ('sales', 'Sales', 'department', 'Pipeline, proposals, closing'),
  ('marketing', 'Marketing', 'department', 'Brand, content, campaigns'),
  ('audit-research', 'Nova Audit Research', 'department', 'Evidence collection and findings'),
  ('technology', 'Technology & Development', 'shared_service', 'Engineering, infrastructure, automation'),
  ('cybersecurity', 'Cybersecurity', 'shared_service', 'Access, incidents, risk'),
  ('customer-experience', 'Customer Experience', 'department', 'Support, retention, complaints'),
  ('legal-compliance', 'Legal & Compliance Administration', 'shared_service', 'Policy and regulated-risk review'),
  ('executive-committee', 'Executive Committee', 'committee', 'Portfolio priorities and cross-company conflicts'),
  ('revenue-council', 'Revenue Council', 'committee', 'Lead-to-cash pipeline health'),
  ('finance-investment-committee', 'Finance & Investment Committee', 'committee', 'Cash, cost and investment decisions'),
  ('audit-quality-committee', 'Audit & Quality Committee', 'committee', 'Evidence and claim quality review'),
  ('technology-security-council', 'Technology & Security Council', 'committee', 'Reliability, security, deployment'),
  ('marketing-growth-council', 'Marketing & Growth Council', 'committee', 'Demand-generation review'),
  ('people-ethics-committee', 'People, Ethics & Workforce Committee', 'committee', 'Workforce and conduct decisions'),
  ('customer-council', 'Customer Council', 'committee', 'Client experience end to end'),
  ('data-intelligence-committee', 'Data Intelligence Committee', 'committee', 'Verified market/competitor understanding'),
  ('venture-council', 'Venture Council', 'committee', 'Venture Lab go/pause/kill decisions'),
  ('model-council', 'Model Council', 'committee', 'ChatGPT / Claude / Gemini reasoning providers')
) AS u(key, name, unit_type, mission)
WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE portfolio_entity_id IS NULL AND key = u.key);

-- Positions: Owner, Aura Control Seat (reserved), CEO Twin (governed, unapproved policy), Model Council seats
-- (reserved — no provider integration exists yet).
INSERT INTO positions (portfolio_entity_id, org_unit_id, key, title, authority_level, position_type, is_reserved, reserved_reason, requires_owner_activation)
SELECT NULL, (SELECT id FROM org_units WHERE portfolio_entity_id IS NULL AND key = 'executive-operations'), 'owner', 'Owner', 0, 'owner', false, NULL, false
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE portfolio_entity_id IS NULL AND key = 'owner');

INSERT INTO positions (portfolio_entity_id, org_unit_id, key, title, authority_level, position_type, is_reserved, reserved_reason, requires_owner_activation)
SELECT NULL, (SELECT id FROM org_units WHERE portfolio_entity_id IS NULL AND key = 'executive-operations'), 'aura-control-seat', 'Aura Control Seat', 1, 'aura_control_seat', true, 'Reserved — Aura is not active yet. No task may be assigned to this seat and no decisions may be simulated on its behalf.', true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE portfolio_entity_id IS NULL AND key = 'aura-control-seat');

INSERT INTO positions (portfolio_entity_id, org_unit_id, key, title, authority_level, position_type, is_reserved, reserved_reason, requires_owner_activation)
SELECT NULL, (SELECT id FROM org_units WHERE portfolio_entity_id IS NULL AND key = 'executive-operations'), 'ceo-twin', 'CEO Twin', 2, 'ceo_twin', false, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE portfolio_entity_id IS NULL AND key = 'ceo-twin');

INSERT INTO positions (portfolio_entity_id, org_unit_id, key, title, authority_level, position_type, is_reserved, reserved_reason, requires_owner_activation)
SELECT NULL, (SELECT id FROM org_units WHERE portfolio_entity_id IS NULL AND key = 'model-council'), u.key, u.title, 3, 'model_council_seat', true, 'Reserved — no live model-provider integration exists yet in this build.', true
FROM (VALUES ('model-council-chatgpt', 'Model Council — ChatGPT'), ('model-council-claude', 'Model Council — Claude'), ('model-council-gemini', 'Model Council — Gemini')) AS u(key, title)
WHERE NOT EXISTS (SELECT 1 FROM positions WHERE portfolio_entity_id IS NULL AND key = u.key);

-- Isaac is seeded as Owner IF a real nova_super_admin already exists (never invents an account).
INSERT INTO workers (portfolio_entity_id, org_unit_id, position_id, worker_type, staff_user_id, display_name, status, communication_permission, data_classification)
SELECT NULL, (SELECT id FROM org_units WHERE portfolio_entity_id IS NULL AND key = 'executive-operations'), (SELECT id FROM positions WHERE portfolio_entity_id IS NULL AND key = 'owner'), 'human', m.staff_user_id, 'Isaac Nova', 'active', true, 'restricted'
FROM organization_members m WHERE m.role = 'nova_super_admin' AND m.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM workers WHERE staff_user_id = m.staff_user_id)
LIMIT 1;

INSERT INTO executive_assignments (position_id, portfolio_entity_id, worker_id, fill_type, assigned_by, reason)
SELECT (SELECT id FROM positions WHERE portfolio_entity_id IS NULL AND key = 'owner'), NULL, w.id, 'isaac', w.staff_user_id, 'Seeded from the existing nova_super_admin membership.'
FROM workers w WHERE w.position_id = (SELECT id FROM positions WHERE portfolio_entity_id IS NULL AND key = 'owner')
  AND NOT EXISTS (SELECT 1 FROM executive_assignments WHERE position_id = w.position_id AND unassigned_at IS NULL);

INSERT INTO executive_assignments (position_id, portfolio_entity_id, worker_id, fill_type, reason)
SELECT id, NULL, NULL, 'reserved', reserved_reason FROM positions WHERE portfolio_entity_id IS NULL AND is_reserved = true
  AND NOT EXISTS (SELECT 1 FROM executive_assignments ea WHERE ea.position_id = positions.id AND ea.unassigned_at IS NULL);

INSERT INTO executive_assignments (position_id, portfolio_entity_id, worker_id, fill_type, reason)
SELECT id, NULL, NULL, 'vacant', 'Not yet filled.' FROM positions WHERE portfolio_entity_id IS NULL AND is_reserved = false AND key = 'ceo-twin'
  AND NOT EXISTS (SELECT 1 FROM executive_assignments ea WHERE ea.position_id = positions.id AND ea.unassigned_at IS NULL);

-- CEO Twin governed policy: seeded as a DRAFT (pending), matching the same "proposed, not approved" pattern
-- already used for the Academy passing policy — nothing about Isaac's actual principles/risk tolerance/pricing
-- rules is invented; every field starts empty for the owner to fill in.
INSERT INTO sales_config (key, version, status, value, change_note)
VALUES ('ceo_twin_policy', 1, 'draft',
  '{"principles": [], "decision_preferences": [], "risk_tolerance": null, "brand_rules": [], "pricing_restrictions": [], "communication_standards": [], "escalation_preferences": [], "company_priorities": [], "prohibited_actions": [], "approval_thresholds": {}}'::jsonb,
  'Empty shell seeded by the hierarchy registry migration. Isaac must write and approve the real content before the CEO Twin represents anything.')
ON CONFLICT (key, version) DO NOTHING;

INSERT INTO sales_config (key, version, status, value, change_note)
VALUES ('authority_matrix', 1, 'pending_approval',
  '{"draft_internal_analysis":"worker","create_internal_task":"worker_or_manager","reassign_routine_task":"manager","change_company_strategy":"owner","publish_public_content":"approval_policy","contact_real_prospect":"approved_outreach_policy","send_bulk_communications":"explicit_campaign_approval","sign_contract":"owner_or_authorized_signer","change_pricing":"owner","approve_compensation":"owner","transfer_money":"owner_approved_payout_process","change_production_security":"owner_or_ciso_process","delete_financial_audit_history":"prohibited","create_new_legal_company":"owner","activate_aura":"owner","increase_agent_permissions":"authorized_human_approval","close_venture_experiment":"experiment_owner_within_policy_or_owner"}'::jsonb,
  'Default authority matrix proposed by the master prompt. Marked pending — the owner must approve it, same as any other sales_config policy, before it is treated as governing.')
ON CONFLICT (key, version) DO NOTHING;

INSERT INTO sales_config (key, version, status, value, change_note)
VALUES ('model_council', 1, 'draft',
  '{"providers": {"chatgpt": {"enabled": false}, "claude": {"enabled": false}, "gemini": {"enabled": false}}, "fallback_order": []}'::jsonb,
  'No provider is enabled. API keys are never stored in this record — only non-secret operating configuration (limits, fallback order) once the owner defines them.')
ON CONFLICT (key, version) DO NOTHING;
