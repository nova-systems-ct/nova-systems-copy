-- Nova Audit delivery clock (master prompt §5): versioned owner-approved policy, required-input checklist with the
-- responsible party, blockers recorded WITHOUT moving the deadline, and extensions that change the due time only after
-- the client was told why and agreed. Idempotent. Depends on crm-order-audit (audit_cases).

-- Every write of a case's clock policy is a new version; approval stamps the exact version approved.
CREATE TABLE IF NOT EXISTS audit_clock_policy_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id          UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL,
  policy           JSONB NOT NULL,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  UNIQUE (case_id, version)
);

ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS clock_policy_version INTEGER;
-- [{key, label, responsible: client|nova|third_party, received_at, received_by, note}] built from the approved policy
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS input_checklist JSONB NOT NULL DEFAULT '[]';
-- hours added to the deadline by extensions the client AGREED to (never by a blocker on its own)
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS agreed_extension_hours NUMERIC NOT NULL DEFAULT 0 CHECK (agreed_extension_hours >= 0);

CREATE TABLE IF NOT EXISTS audit_case_blockers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id          UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  description      TEXT NOT NULL CHECK (length(description) >= 5),
  responsible      TEXT NOT NULL CHECK (responsible IN ('client', 'nova', 'third_party')),
  raised_by        UUID,
  raised_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID,
  resolution       TEXT
);
CREATE INDEX IF NOT EXISTS audit_case_blockers_case ON audit_case_blockers (case_id, raised_at);

CREATE TABLE IF NOT EXISTS audit_case_extensions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id                UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  due_before             TIMESTAMPTZ NOT NULL,          -- the deadline in force when this was proposed
  extra_hours            NUMERIC NOT NULL CHECK (extra_hours > 0 AND extra_hours <= 168),
  proposed_due_at        TIMESTAMPTZ NOT NULL,
  reason                 TEXT NOT NULL CHECK (length(reason) >= 10),
  blocker_id             UUID REFERENCES audit_case_blockers(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'client_notified', 'agreed', 'declined', 'withdrawn')),
  notice_text            TEXT,
  notice_channel         TEXT CHECK (notice_channel IS NULL OR notice_channel IN ('email', 'phone', 'in_person', 'message')),
  notified_at            TIMESTAMPTZ,
  notified_by            UUID,
  client_response_at     TIMESTAMPTZ,
  client_responder_name  TEXT,
  response_evidence      TEXT,
  created_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('client_notified', 'agreed', 'declined') OR notified_at IS NOT NULL),
  CHECK (status NOT IN ('agreed', 'declined') OR (client_response_at IS NOT NULL AND client_responder_name IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS audit_case_extensions_case ON audit_case_extensions (case_id, created_at);
-- at most one open (undecided) extension per case
CREATE UNIQUE INDEX IF NOT EXISTS audit_case_extensions_one_open ON audit_case_extensions (case_id) WHERE status IN ('proposed', 'client_notified');

ALTER TABLE public.audit_clock_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_case_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_case_extensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_clock_policy_versions FROM anon, authenticated;
REVOKE ALL ON public.audit_case_blockers FROM anon, authenticated;
REVOKE ALL ON public.audit_case_extensions FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
