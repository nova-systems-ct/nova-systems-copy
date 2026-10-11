-- =============================================================================================
-- Nova Organizational Hierarchy — part 4: MEETING ENGINE (Committee Room, "Meet Now", persisted
-- transcript, evidence board, action items, Incident Room). Additive. NOT applied to production.
-- Depends on parts 1-3.
--
-- Table names are prefixed `committee_` because a `meetings` table already exists in this schema
-- (supabase/schema-update.sql, the client-facing "book a meeting" feature) — a different table with
-- an incompatible shape. Reusing that name would have silently skipped creation (CREATE TABLE IF
-- NOT EXISTS) and queried nonexistent columns; this was caught by the real e2e test, not by
-- inspection, and is recorded here for anyone reading this file later.
--
-- Honesty constraint carried over from parts 1-3: no live AI provider integration exists in this
-- build. A meeting's participant list is loaded from REAL position/worker/kill-switch state
-- (api/_hierarchy/rules.js meetingParticipantAvailability()) and a reserved or vacant seat is
-- marked exactly that — never silently skipped or shown as present. No transcript entry may be
-- attributed to a reserved/vacant seat's occupant, because there isn't one; see
-- api/_hierarchy/meetings.js for the enforcement. "Model disagreement" content is not fabricated
-- here — the schema supports recording it once a real Model Council integration exists.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS committee_meetings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_org_unit_id UUID REFERENCES org_units(id),
  portfolio_entity_id   UUID REFERENCES portfolio_entities(id),
  title                 TEXT NOT NULL,
  meeting_type          TEXT NOT NULL DEFAULT 'meet_now' CHECK (meeting_type IN ('scheduled', 'meet_now', 'incident')),
  status                TEXT NOT NULL DEFAULT 'in_session' CHECK (status IN ('in_session', 'closed', 'cancelled')),
  agenda                JSONB NOT NULL DEFAULT '[]',
  summary               TEXT,
  -- Incident Room fields (only meaningful when meeting_type='incident'): severity, detection,
  -- affected_systems, containment, recovery — one flexible JSONB object rather than five
  -- near-always-null columns, updated in place as an incident progresses.
  incident_details      JSONB,
  cost_cents            INTEGER NOT NULL DEFAULT 0,
  opened_by             UUID NOT NULL,
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by             UUID,
  closed_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS committee_meetings_status_idx ON committee_meetings (status);

-- Who was in the room, snapshotted honestly at open time — a historical fact, not a live query.
CREATE TABLE IF NOT EXISTS committee_meeting_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID NOT NULL REFERENCES committee_meetings(id),
  position_id  UUID REFERENCES positions(id),
  worker_id    UUID REFERENCES workers(id),
  label        TEXT NOT NULL,
  availability TEXT NOT NULL CHECK (availability IN ('available', 'unavailable', 'reserved', 'vacant', 'failed')),
  note         TEXT
);

CREATE TABLE IF NOT EXISTS committee_meeting_transcript_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL REFERENCES committee_meetings(id),
  speaker_worker_id UUID REFERENCES workers(id), speaker_label TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('question', 'statement', 'decision', 'system_note')),
  content TEXT NOT NULL, created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS committee_meeting_transcript_entries_immutable ON committee_meeting_transcript_entries;
CREATE TRIGGER committee_meeting_transcript_entries_immutable BEFORE UPDATE OR DELETE ON committee_meeting_transcript_entries FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

CREATE TABLE IF NOT EXISTS committee_meeting_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL REFERENCES committee_meetings(id),
  source TEXT NOT NULL, observation TEXT NOT NULL, added_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS committee_meeting_evidence_immutable ON committee_meeting_evidence;
CREATE TRIGGER committee_meeting_evidence_immutable BEFORE UPDATE OR DELETE ON committee_meeting_evidence FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

CREATE TABLE IF NOT EXISTS committee_meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id UUID NOT NULL REFERENCES committee_meetings(id),
  description TEXT NOT NULL, dri_worker_id UUID REFERENCES workers(id), due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS committee_meeting_action_items_status_idx ON committee_meeting_action_items (status);

ALTER TABLE committee_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meeting_transcript_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meeting_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meeting_action_items ENABLE ROW LEVEL SECURITY;

-- No new permissions: meeting reads use command.view, writes use command.owner (both already
-- granted in part 1) — consistent with parts 1-3.
