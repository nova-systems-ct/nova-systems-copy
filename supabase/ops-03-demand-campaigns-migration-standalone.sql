-- =============================================================================================
-- Nova Demand (master execution prompt 2026-10-17, section 8): an attributable acquisition campaign. A campaign names
-- the service it sells (an APPROVED ops price rule), the offer, the audience, the sourced prospects with fit evidence,
-- the permitted channels and limits, and the attribution rule. Outreach is not sent by this layer: prospects move to
-- 'approved_for_contact' only after the owner approves the campaign; contacts are recorded by the person or channel
-- that made them; replies and bookings arrive through the normal intake path carrying the campaign code.
-- Depends on: crm-order-audit (businesses, crm_contacts), ops-01 (ops_jobs, ops_price_rules). Additive, re-runnable.
-- =============================================================================================
CREATE TABLE IF NOT EXISTS demand_campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code               TEXT NOT NULL,                      -- short public attribution code used in links (?c=CODE)
  name               TEXT NOT NULL,
  objective          TEXT NOT NULL,                      -- e.g. "two new paying catering customers in 30 days"
  service_key        TEXT NOT NULL,                      -- must match an approved ops_price_rules.service_key
  offer_text         TEXT NOT NULL,
  capacity_note      TEXT,                               -- what the business can actually take on
  audience           JSONB NOT NULL DEFAULT '{}',        -- criteria, area, exclusions
  channels           TEXT[] NOT NULL DEFAULT '{}',       -- e.g. {email, phone, in_person, referral}
  volume_limit       INTEGER CHECK (volume_limit IS NULL OR volume_limit BETWEEN 1 AND 5000),
  cost_limit_cents   INTEGER CHECK (cost_limit_cents IS NULL OR cost_limit_cents >= 0),
  starts_on          DATE,
  ends_on            DATE,
  attribution_rule   TEXT NOT NULL DEFAULT 'A new customer counts when an inquiry carrying this campaign code, from a prospect in this campaign, becomes a completed paid job within the campaign period; cancellations and refunds are subtracted.',
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'paused', 'completed', 'cancelled')),
  approval_snapshot  JSONB,
  approved_by        UUID,
  approved_at        TIMESTAMPTZ,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  CHECK (status NOT IN ('approved', 'completed') OR (approved_by IS NOT NULL AND approval_snapshot IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS demand_prospects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id        UUID NOT NULL REFERENCES demand_campaigns(id) ON DELETE CASCADE,
  business_name      TEXT NOT NULL,
  website            TEXT,
  contact_name       TEXT,
  contact_route      TEXT,                               -- the published route to reach them (e.g. public business phone)
  source             TEXT NOT NULL,                      -- where the prospect was found (URL or list), never invented
  fit_evidence       TEXT NOT NULL,                      -- why they plausibly need the service
  verified_at        TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'researched' CHECK (status IN ('researched', 'approved_for_contact', 'contacted', 'replied', 'qualified', 'booked', 'won', 'lost', 'do_not_contact')),
  dedupe_key         TEXT NOT NULL,                      -- normalized name/website: the same business is not added twice
  assigned_user_id   UUID,
  last_event_at      TIMESTAMPTZ,
  job_id             UUID REFERENCES ops_jobs(id) ON DELETE SET NULL,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS demand_prospects_campaign ON demand_prospects (campaign_id, status);

CREATE TABLE IF NOT EXISTS demand_events (
  id                 BIGSERIAL PRIMARY KEY,
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id        UUID NOT NULL REFERENCES demand_campaigns(id) ON DELETE CASCADE,
  prospect_id        UUID REFERENCES demand_prospects(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,                      -- researched | approved | contacted | replied | inquiry | qualified | booked | won | lost | do_not_contact | note
  detail             JSONB NOT NULL DEFAULT '{}',
  actor_id           TEXT,
  at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demand_events_campaign ON demand_events (campaign_id, at);

-- Attribution: an inquiry that arrived with a campaign code is linked to the campaign.
ALTER TABLE ops_jobs ADD COLUMN IF NOT EXISTS demand_campaign_id UUID REFERENCES demand_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.demand_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demand_campaigns FROM anon, authenticated;
REVOKE ALL ON public.demand_prospects FROM anon, authenticated;
REVOKE ALL ON public.demand_events FROM anon, authenticated;
