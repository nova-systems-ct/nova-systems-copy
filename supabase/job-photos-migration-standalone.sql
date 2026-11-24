-- Job photos (Nova system 24): before and after photos from the worker's phone page.
-- Run after team-dispatch-migration-standalone.sql and before zz-public-schema-lockdown-standalone.sql.
-- Safe to run twice. The photos themselves live in the PRIVATE storage bucket 'job-photos' (no public
-- address); the server reads them with the service role and gives the owner one-hour links. Also makes
-- the PRIVATE 'nova-intake-files' bucket for the intake form's uploads.
-- Depends on: team-dispatch-migration-standalone.sql (business_workers, job_assignments).

CREATE TABLE IF NOT EXISTS job_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  journey_id       UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  assignment_id    UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES business_workers(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('before', 'after')),
  storage_path     TEXT NOT NULL UNIQUE,
  content_type     TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes            INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 2500000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_photos_journey_idx ON job_photos (organization_id, journey_id, created_at);
CREATE INDEX IF NOT EXISTS job_photos_assignment_idx ON job_photos (assignment_id);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_photos_member_read ON job_photos;
CREATE POLICY job_photos_member_read ON job_photos FOR SELECT USING (is_org_member(organization_id));

-- The private bucket (Supabase only; skipped on a plain PostgreSQL test database).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('job-photos', 'job-photos', false, 2500000, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
    -- The intake form's document uploads (api/business-intake.js): PRIVATE, 4 MB, the same file
    -- types the server accepts; staff open them through a five-minute link. Intake uploads fail
    -- until this bucket exists (it existed in neither staging nor production on 2026-11-14).
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('nova-intake-files', 'nova-intake-files', false, 4194304, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/plain'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;
