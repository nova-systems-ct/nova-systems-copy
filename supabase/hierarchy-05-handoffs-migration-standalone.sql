-- Nova hierarchy handoffs (master prompt §4): acknowledgment with a deadline, a named recipient for every result,
-- and escalation of unacknowledged or overdue work to the worker's escalation contact / manager / owner.
-- Idempotent. Depends on hierarchy-01 (workers), hierarchy-02 (escalations), hierarchy-03 (work_items).

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS ack_within_hours INTEGER NOT NULL DEFAULT 4 CHECK (ack_within_hours BETWEEN 1 AND 168);
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS ack_due_at TIMESTAMPTZ;           -- set at assignment
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS acknowledged_by UUID;
-- who receives the result (defaults to the creator); the handoff is complete only when they confirm receipt
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS result_to_user_id UUID;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS result_handed_at TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS result_received_at TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS result_action TEXT;               -- what the recipient will do with it

-- escalations are routed to a specific worker or person and deduplicated per cause
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS routed_to_worker_id UUID REFERENCES workers(id);
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS routed_to_user_id UUID;
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
-- a full (non-partial) unique index so ON CONFLICT (dedupe_key) can use it; NULL keys never collide
CREATE UNIQUE INDEX IF NOT EXISTS escalations_dedupe_key ON escalations (dedupe_key);
CREATE INDEX IF NOT EXISTS escalations_routed_user ON escalations (routed_to_user_id, status);
CREATE INDEX IF NOT EXISTS work_items_ack_due ON work_items (ack_due_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS work_items_result_to ON work_items (result_to_user_id) WHERE result_received_at IS NULL;

NOTIFY pgrst, 'reload schema';
