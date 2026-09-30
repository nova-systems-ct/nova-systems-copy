-- =============================================================================================
-- Nova Organizational Hierarchy — part 2: GOVERNANCE (worker operating contracts, decision
-- records, escalation chain, kill switches). Additive. NOT applied to production. Phase C of the
-- Nova Hierarchy master prompt (2026-09-28). Depends on part 1
-- (hierarchy-01-registry-migration-standalone.sql) for workers/positions/portfolio_entities/org_units.
--
-- Deliberately REUSED rather than duplicated: sales_config (still the only versioned-policy
-- mechanism — the Authority Matrix and CEO Twin policy already live there from part 1; nothing
-- here adds a second one), sales_audit_log (still the only generic technical audit trail —
-- decision_records below is NOT a duplicate of it: it is a narrower, purpose-built record of
-- governance decisions specifically, for later Daily Brief/Weekly Packet reporting, the same way
-- worker_status_events is narrower than the audit log), forbid_update_delete() from part 1.
-- =============================================================================================

-- ---- worker operating contracts: a versioned, approvable statement of what a worker may do —
-- mission, responsibilities, tool/data/spending boundaries, communication permission — using the
-- exact draft/pending_approval/approved/retired pattern already established for sales_config,
-- scoped per worker instead of per global key.
CREATE TABLE IF NOT EXISTS worker_contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID NOT NULL REFERENCES workers(id),
  version       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'retired')),
  content       JSONB NOT NULL DEFAULT '{}',
  change_note   TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  UNIQUE (worker_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS worker_contracts_one_approved ON worker_contracts (worker_id) WHERE status = 'approved';

-- ---- decision records: append-only, purpose-built log of GOVERNANCE decisions (policy
-- approvals, contract approvals, escalation resolutions, kill-switch toggles) — distinct from the
-- generic sales_audit_log so the Daily Owner Brief / Weekly Executive Packet (part 3+) can query a
-- narrow, well-typed table instead of parsing free-form audit rows.
CREATE TABLE IF NOT EXISTS decision_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type   TEXT NOT NULL CHECK (decision_type IN ('policy_approval', 'contract_approval', 'escalation_resolution', 'kill_switch', 'position_assignment', 'worker_status', 'work_item_review', 'venture_override')),
  subject_type    TEXT NOT NULL,
  subject_id      UUID,
  decided_by      UUID NOT NULL,
  authority_label TEXT,
  rationale       TEXT NOT NULL,
  outcome         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decision_records_subject_idx ON decision_records (subject_type, subject_id);
DROP TRIGGER IF EXISTS decision_records_immutable ON decision_records;
CREATE TRIGGER decision_records_immutable BEFORE UPDATE OR DELETE ON decision_records FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- escalation chain: Worker -> Manager -> Executive -> CEO Twin -> Aura (reserved — routes
-- straight to Owner while inactive) -> Owner. `level` records where an escalation currently sits;
-- routing it upward is a real, tested state transition (api/_hierarchy/rules.js nextEscalationLevel),
-- never silently automatic.
CREATE TABLE IF NOT EXISTS escalations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type       TEXT NOT NULL,
  subject_id         UUID,
  raised_by_worker_id UUID REFERENCES workers(id),
  level              TEXT NOT NULL DEFAULT 'worker' CHECK (level IN ('worker', 'manager', 'executive', 'ceo_twin', 'aura', 'owner')),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'routed', 'resolved', 'cancelled')),
  reason             TEXT NOT NULL,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by        UUID,
  resolved_at        TIMESTAMPTZ,
  resolution         TEXT
);
CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), escalation_id UUID NOT NULL REFERENCES escalations(id),
  from_level TEXT, to_level TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, changed_by UUID, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS escalation_events_immutable ON escalation_events;
CREATE TRIGGER escalation_events_immutable BEFORE UPDATE OR DELETE ON escalation_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- ---- kill switches: current-state table (like workers.status) — a scope with no row here has
-- never been killed. Toggling is a real, mutable state change; every toggle also writes a
-- permanent decision_records row (decision_type='kill_switch'), so the row itself can change
-- while the historical record cannot.
CREATE TABLE IF NOT EXISTS kill_switches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type     TEXT NOT NULL CHECK (scope_type IN ('global', 'portfolio_entity', 'org_unit', 'worker', 'model_provider')),
  scope_id       TEXT,     -- a UUID (as text) for portfolio_entity/org_unit/worker, a provider key for model_provider, NULL for global
  engaged        BOOLEAN NOT NULL DEFAULT false,
  reason         TEXT,
  engaged_by     UUID, engaged_at TIMESTAMPTZ,
  disengaged_by  UUID, disengaged_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kill_switches_one_per_scope ON kill_switches (scope_type, COALESCE(scope_id, '__global__'));

-- ---- owner re-authentication confirmations: backs the sole-owner self-approval protocol (a real
-- password re-verification, not a rubber stamp) — see api/_hierarchy/governance.js confirm-reauth.
-- A single-use, auditable DB row rather than a signed token: simpler to reason about and to test.
-- The owner may approve their OWN draft only after re-proving their password AND only for the
-- EXACT content fingerprinted at confirmation time — if the draft changes in between, the
-- confirmation no longer matches and a fresh one is required.
CREATE TABLE IF NOT EXISTS owner_reauth_confirmations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id      UUID NOT NULL,
  policy_fingerprint TEXT NOT NULL,
  reason             TEXT NOT NULL,
  confirmed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL,
  used_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS owner_reauth_lookup_idx ON owner_reauth_confirmations (staff_user_id, policy_fingerprint, used_at);

ALTER TABLE worker_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_reauth_confirmations ENABLE ROW LEVEL SECURITY;

-- No new permissions: governance reads use command.view, governance writes use command.owner
-- (both already granted to nova_super_admin/nova_admin in part 1) — no new permission sprawl.
