-- Executable worker registration (repair 2026-10-26, brief §7). A worker row may name the tested capability it runs
-- (api/_workerCapabilities.js). One live worker per capability; pausing it (status suspended) holds that capability's
-- queued jobs. Additive and idempotent.
ALTER TABLE workers ADD COLUMN IF NOT EXISTS capability_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS workers_one_live_per_capability ON workers (capability_key) WHERE capability_key IS NOT NULL AND status <> 'inactive';
