-- Contract composer repair (2026-10-26): drafts (status 'draft', never shown on /sign) and an honest record of what
-- happened to the signing-link email (sent = provider accepted / dry_run / blocked / failed). Idempotent; additive.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE contracts ALTER COLUMN sent_at DROP NOT NULL;
