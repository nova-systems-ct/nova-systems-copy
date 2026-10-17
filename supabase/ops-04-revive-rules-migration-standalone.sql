-- Nova Revive — recovery of stalled opportunities found in the business's own records (master prompt §7).
-- Extends the existing reactivation campaigns (ops_campaigns / ops_campaign_recipients) rather than adding a second
-- campaign system: a 'stalled_recovery' campaign is built from real ops_jobs / ops_bookings under explicit rules
-- (reasons, age window, attempt limit) that the owner approves together with the audience and copy.
-- Idempotent. Depends on ops-01-operational-mvp.

ALTER TABLE ops_campaigns DROP CONSTRAINT IF EXISTS ops_campaigns_purpose_check;
ALTER TABLE ops_campaigns ADD CONSTRAINT ops_campaigns_purpose_check
  CHECK (purpose IN ('past_customer_reactivation', 'dormant_quote_followup', 'stalled_recovery'));

-- {reasons: [...], min_age_days, max_age_days, attempt_limit, attempt_window_days} exactly as proposed; frozen into
-- approval_snapshot at approval.
ALTER TABLE ops_campaigns ADD COLUMN IF NOT EXISTS rules JSONB;
-- the person accountable for the campaign (defaults to its creator)
ALTER TABLE ops_campaigns ADD COLUMN IF NOT EXISTS campaign_owner UUID;

-- the stalled record that made this person eligible, why, and the record's state when it was found
ALTER TABLE ops_campaign_recipients ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES ops_jobs(id) ON DELETE SET NULL;
ALTER TABLE ops_campaign_recipients ADD COLUMN IF NOT EXISTS revive_reason TEXT
  CHECK (revive_reason IS NULL OR revive_reason IN ('incomplete_inquiry', 'abandoned_quote', 'unfinished_booking', 'missed_appointment'));
ALTER TABLE ops_campaign_recipients ADD COLUMN IF NOT EXISTS source_state TEXT;
-- when the message left Nova (provider accepted, or dry run); used for attempt limits and outcome attribution
ALTER TABLE ops_campaign_recipients ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ops_campaign_recipients_contact_sent ON ops_campaign_recipients (organization_id, contact_id, sent_at);
CREATE INDEX IF NOT EXISTS ops_campaign_recipients_source_job ON ops_campaign_recipients (source_job_id) WHERE source_job_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
