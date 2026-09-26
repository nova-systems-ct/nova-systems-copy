-- =============================================================================================
-- Nova Sales Team platform — part 3 of 5: AGREEMENTS + E-SIGNATURE + ACTIVATION support. Additive. NOT applied to production.
-- Depends on: part 1 (forbid_update_delete, sales_reps, sales_config). Independent of part 2.
-- Nothing here invents legal text: seeded templates are empty shells marked 'unreviewed' and cannot be sent until the
-- OWNER approves a version (and confirms review).
-- =============================================================================================

CREATE TABLE IF NOT EXISTS sales_document_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT NOT NULL UNIQUE,                 -- working_agreement, compensation_schedule, confidentiality, acceptable_use, ...
  title            TEXT NOT NULL,
  description      TEXT,
  requires_countersign BOOLEAN NOT NULL DEFAULT false,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A version is immutable once approved (enforced by trigger below). Changing text = a new version.
CREATE TABLE IF NOT EXISTS sales_document_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES sales_document_templates(id),
  version          INTEGER NOT NULL,
  body             TEXT NOT NULL DEFAULT '',             -- plain text / light markdown; rendered identically for signer, PDF and hash
  content_hash     TEXT,                                 -- sha256 of title + body, set at approval
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  review_status    TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'owner_confirmed_reviewed')),
  material_change  BOOLEAN NOT NULL DEFAULT true,        -- true → everyone must re-sign this version
  change_note      TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  UNIQUE (template_id, version)
);

CREATE OR REPLACE FUNCTION sales_document_version_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'approved or retired document versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' THEN
    -- only the lifecycle marker may move (approved → retired); text/hash/flags are frozen
    IF NEW.body IS DISTINCT FROM OLD.body OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.template_id <> OLD.template_id
       OR NEW.version <> OLD.version OR NEW.material_change <> OLD.material_change OR NEW.review_status <> OLD.review_status THEN
      RAISE EXCEPTION 'an approved document version is immutable; create a new version instead';
    END IF;
    IF NEW.status = 'draft' THEN RAISE EXCEPTION 'an approved document version cannot return to draft'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_document_versions_guard ON sales_document_versions;
CREATE TRIGGER sales_document_versions_guard BEFORE UPDATE OR DELETE ON sales_document_versions FOR EACH ROW EXECUTE FUNCTION sales_document_version_guard();

CREATE TABLE IF NOT EXISTS sales_document_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id       UUID NOT NULL REFERENCES sales_document_versions(id),
  template_id      UUID NOT NULL REFERENCES sales_document_templates(id),
  signer_user_id   UUID NOT NULL REFERENCES auth.users(id),
  signer_email     TEXT,
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'signed', 'declined', 'expired', 'void', 'superseded')),
  content_hash     TEXT NOT NULL,                        -- hash of the exact text this request was issued for
  sent_by          UUID NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  viewed_at        TIMESTAMPTZ,
  -- signature record (server-stamped)
  signed_at        TIMESTAMPTZ,
  signer_typed_name TEXT,
  signature_image  TEXT,                                 -- small PNG data URI (optional drawn signature)
  esign_consent    BOOLEAN,
  esign_consent_text_version TEXT,
  signer_ip        TEXT,
  signer_user_agent TEXT,
  signature_hash   TEXT,                                 -- sha256 over the canonical signature record
  declined_at      TIMESTAMPTZ, decline_reason TEXT,
  countersigned_by UUID, countersigned_at TIMESTAMPTZ, countersign_name TEXT,
  voided_by        UUID, voided_at TIMESTAMPTZ, void_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_document_requests_signer_idx ON sales_document_requests (signer_user_id, status);
-- At most one OPEN request per signer + template (re-sends replace, never stack)
CREATE UNIQUE INDEX IF NOT EXISTS sales_document_requests_one_open ON sales_document_requests (signer_user_id, template_id) WHERE status IN ('sent', 'viewed');

-- A signed record cannot be edited after the fact except to add the owner countersignature or mark superseded/void.
CREATE OR REPLACE FUNCTION sales_document_request_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'document requests are never deleted'; END IF;
  IF OLD.status = 'signed' THEN
    IF NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.signer_typed_name IS DISTINCT FROM OLD.signer_typed_name
       OR NEW.signature_image IS DISTINCT FROM OLD.signature_image OR NEW.signature_hash IS DISTINCT FROM OLD.signature_hash
       OR NEW.content_hash <> OLD.content_hash OR NEW.version_id <> OLD.version_id OR NEW.signer_user_id <> OLD.signer_user_id
       OR NEW.signer_ip IS DISTINCT FROM OLD.signer_ip OR NEW.esign_consent IS DISTINCT FROM OLD.esign_consent THEN
      RAISE EXCEPTION 'a signed document record is immutable';
    END IF;
    IF NEW.status NOT IN ('signed', 'superseded', 'void') THEN RAISE EXCEPTION 'a signed document can only become superseded or void'; END IF;
  END IF;
  IF OLD.status IN ('declined', 'expired', 'void', 'superseded') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'this document request is closed'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_document_requests_guard ON sales_document_requests;
CREATE TRIGGER sales_document_requests_guard BEFORE UPDATE OR DELETE ON sales_document_requests FOR EACH ROW EXECUTE FUNCTION sales_document_request_guard();

-- Hash-chained event log: each row commits to the previous row of the same request → edits/deletions are detectable.
CREATE TABLE IF NOT EXISTS sales_document_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES sales_document_requests(id),
  seq              INTEGER NOT NULL,
  event            TEXT NOT NULL,                        -- sent, viewed, signed, declined, expired, countersigned, void, superseded, resend
  actor_user_id    UUID,
  detail           JSONB NOT NULL DEFAULT '{}',
  prev_hash        TEXT,
  hash             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq)
);
DROP TRIGGER IF EXISTS sales_document_events_immutable ON sales_document_events;
CREATE TRIGGER sales_document_events_immutable BEFORE UPDATE OR DELETE ON sales_document_events FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Manager/owner notes about a representative: append-only history, never shown to the rep.
CREATE TABLE IF NOT EXISTS sales_rep_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id           UUID NOT NULL REFERENCES sales_reps(id),
  author_id        UUID NOT NULL,
  note             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS sales_rep_notes_immutable ON sales_rep_notes;
CREATE TRIGGER sales_rep_notes_immutable BEFORE UPDATE OR DELETE ON sales_rep_notes FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Suspension / reactivation history (sales_reps holds only the current state)
CREATE TABLE IF NOT EXISTS sales_rep_status_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id           UUID NOT NULL REFERENCES sales_reps(id),
  from_status      TEXT, to_status TEXT NOT NULL,
  changed_by       UUID NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS sales_rep_status_history_immutable ON sales_rep_status_history;
CREATE TRIGGER sales_rep_status_history_immutable BEFORE UPDATE OR DELETE ON sales_rep_status_history FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- Seed EMPTY templates. No agreement text is invented: bodies are blank drafts the owner must write/paste, review, and approve.
INSERT INTO sales_document_templates (key, title, description, requires_countersign) VALUES
  ('working_agreement',     'Sales Representative Working Agreement', 'The relationship, duties and term. Text supplied and reviewed by the owner.', true),
  ('compensation_schedule', 'Compensation Schedule',                  'How commission is calculated and paid. Must match the approved commission plan.', true),
  ('confidentiality',       'Confidentiality Agreement',              'Protection of client and Nova information.', false),
  ('acceptable_use',        'Acceptable Use & Conduct Policy',        'Ethical selling, data handling and conduct rules.', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sales_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rep_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rep_status_history ENABLE ROW LEVEL SECURITY;
