-- Audit workspace repair (2026-10-26, repair brief §5 items 3–6, §6).
--  * Reversible archive for audit cases (hidden by default, restorable; nothing is deleted).
--  * Proposed findings from the automated evidence review carry their origin and check key, so a re-run never
--    duplicates them and a reviewer can tell machine-proposed from human-written findings.
--  * Vault rows link to the exact audit report version and content hash they were rendered from, scoped to the
--    organization, so a PDF can never be mistaken for another version or opened across clients.
-- Additive and idempotent. Depends on the audit tables and vault_documents.

ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS archived_by UUID;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS archive_reason TEXT;
ALTER TABLE audit_cases ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;

ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS check_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS audit_findings_one_proposal_per_check
  ON audit_findings (case_id, check_key) WHERE check_key IS NOT NULL;

ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS audit_case_id UUID REFERENCES audit_cases(id) ON DELETE SET NULL;
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS audit_report_id UUID REFERENCES audit_reports(id) ON DELETE SET NULL;
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS report_version INTEGER;
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS content_sha256 TEXT;
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS report_status TEXT;      -- 'draft' or 'approved' at render time
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS vault_documents_one_render_per_report_content
  ON vault_documents (audit_report_id, content_sha256) WHERE audit_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_documents_case ON vault_documents (audit_case_id) WHERE audit_case_id IS NOT NULL;
