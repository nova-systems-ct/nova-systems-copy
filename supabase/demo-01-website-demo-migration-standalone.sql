-- =============================================================================================
-- Nova website demo (five-minute demo): one row per visitor session.
-- Depends on: 00-base-identity, crm-order-audit (businesses, crm_contacts, crm_deals), ops-01 (ops_jobs).
-- Additive and re-runnable. The browser never reads this table: the public API reads it with the service role,
-- by the hash of the visitor's random session token, and returns only that session.
-- =============================================================================================
CREATE TABLE IF NOT EXISTS demo_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash          TEXT NOT NULL UNIQUE,              -- sha256 of the visitor's session token (token itself never stored)
  submission_id       TEXT NOT NULL UNIQUE,              -- client-generated per form load: a double submit cannot create two sessions
  ip_hash             TEXT NOT NULL,                     -- sha256(ip + salt) for abuse limits; raw IP is not stored
  name                TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  website             TEXT,
  email               TEXT NOT NULL,
  concern             TEXT NOT NULL,
  marketing_consent   BOOLEAN NOT NULL DEFAULT false,   -- separate from access to the demo
  consent_text        TEXT,
  status              TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'scanning', 'scanned', 'workers_running', 'completed', 'failed')),
  scan                JSONB,                             -- {result, checks[], finding, limitation, started_at, finished_at}
  worker_steps        JSONB NOT NULL DEFAULT '[]',       -- [{key, label, status, started_at, finished_at, detail, record_id}]
  demo_org_id         UUID REFERENCES organizations(id),
  demo_job_id         UUID REFERENCES ops_jobs(id) ON DELETE SET NULL,
  nova_business_id    UUID REFERENCES businesses(id) ON DELETE SET NULL,
  nova_contact_id     UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  nova_deal_id        UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  summary             JSONB,
  staff_alert_status  TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  scan_finished_at    TIMESTAMPTZ,
  workers_finished_at TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS demo_sessions_ip_day ON demo_sessions (ip_hash, submitted_at);
CREATE INDEX IF NOT EXISTS demo_sessions_submitted ON demo_sessions (submitted_at);
CREATE INDEX IF NOT EXISTS demo_sessions_email ON demo_sessions (lower(email), submitted_at);

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_sessions FROM anon;
REVOKE ALL ON public.demo_sessions FROM authenticated;
