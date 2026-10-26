-- Nova application AI spending guard (repair brief 2026-10-25 §3, "Nova application usage").
-- Every optional paid model call made by the Nova API/worker reserves a conservative cost estimate here BEFORE it is
-- dispatched, and settles the provider-reported usage afterwards. Reservation is atomic per purpose (advisory lock), so
-- concurrent calls cannot overrun a limit. No limit row = blocked: a missing budget never means "free".
-- Application estimates can differ from the provider invoice; use the provider's own spend limits as well.
-- Content is never stored here (no prompts, no customer text). Idempotent. Server (service role) only.

CREATE TABLE IF NOT EXISTS ai_spend_limits (
  purpose         TEXT PRIMARY KEY,                                   -- e.g. 'document_draft', 'ops_extract'
  period          TEXT NOT NULL DEFAULT 'day' CHECK (period IN ('day', 'month')),
  limit_usd       NUMERIC(12, 4) NOT NULL CHECK (limit_usd >= 0),
  max_concurrent  INTEGER NOT NULL DEFAULT 2 CHECK (max_concurrent >= 1),
  approved_by     TEXT NOT NULL,                                      -- who approved this budget (owner)
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT
);

CREATE TABLE IF NOT EXISTS ai_spend_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       TEXT NOT NULL UNIQUE,                              -- caller's idempotency key
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  purpose          TEXT NOT NULL,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  pricing_version  TEXT,
  reserved_usd     NUMERIC(12, 6) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL CHECK (status IN ('blocked', 'reserved', 'settled', 'failed')),
  block_reason     TEXT,
  input_tokens     INTEGER,
  output_tokens    INTEGER,
  actual_usd       NUMERIC(12, 6),
  usage_basis      TEXT CHECK (usage_basis IN ('reported', 'estimated', 'unknown')),
  latency_ms       INTEGER,
  outcome          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_spend_events_purpose_created ON ai_spend_events (purpose, created_at);

ALTER TABLE ai_spend_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_spend_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_spend_limits, ai_spend_events FROM anon, authenticated;

-- Spend counted against a limit: settled calls at their actual cost when known (never below the reservation when the
-- usage is unknown), open reservations and failed calls at their full reservation (a failed call may still be billed).
CREATE OR REPLACE FUNCTION ai_spend_committed(p_purpose TEXT, p_since TIMESTAMPTZ) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(CASE
           WHEN status = 'settled' AND usage_basis = 'reported' THEN COALESCE(actual_usd, reserved_usd)
           WHEN status = 'settled' THEN GREATEST(COALESCE(actual_usd, 0), reserved_usd)
           WHEN status IN ('reserved', 'failed') THEN reserved_usd
           ELSE 0 END), 0)
  FROM ai_spend_events WHERE purpose = p_purpose AND created_at >= p_since
$$;

CREATE OR REPLACE FUNCTION ai_spend_reserve(
  p_request_id TEXT, p_organization_id UUID, p_purpose TEXT, p_provider TEXT, p_model TEXT,
  p_pricing_version TEXT, p_reserve_usd NUMERIC
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  lim ai_spend_limits%ROWTYPE; since TIMESTAMPTZ; used NUMERIC; open_count INTEGER; existing ai_spend_events%ROWTYPE;
  reason TEXT := NULL; new_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ai_spend:' || p_purpose));
  SELECT * INTO existing FROM ai_spend_events WHERE request_id = p_request_id;
  IF FOUND THEN  -- idempotent: a retried request never reserves twice
    RETURN jsonb_build_object('ok', existing.status = 'reserved', 'id', existing.id, 'status', existing.status,
                              'reason', COALESCE(existing.block_reason, 'duplicate_request'));
  END IF;
  SELECT * INTO lim FROM ai_spend_limits WHERE purpose = p_purpose;
  IF NOT FOUND THEN
    reason := 'no_approved_budget';
  ELSIF p_reserve_usd IS NULL OR p_reserve_usd <= 0 THEN
    reason := 'price_unknown';
  ELSE
    since := CASE lim.period WHEN 'month' THEN date_trunc('month', now()) ELSE date_trunc('day', now()) END;
    used := ai_spend_committed(p_purpose, since);
    SELECT count(*) INTO open_count FROM ai_spend_events
      WHERE purpose = p_purpose AND status = 'reserved' AND created_at > now() - interval '15 minutes';
    IF used + p_reserve_usd > lim.limit_usd THEN reason := 'budget_exhausted';
    ELSIF open_count >= lim.max_concurrent THEN reason := 'too_many_concurrent';
    END IF;
  END IF;
  INSERT INTO ai_spend_events (request_id, organization_id, purpose, provider, model, pricing_version, reserved_usd, status, block_reason)
  VALUES (p_request_id, p_organization_id, p_purpose, p_provider, p_model, p_pricing_version,
          CASE WHEN reason IS NULL THEN p_reserve_usd ELSE 0 END,
          CASE WHEN reason IS NULL THEN 'reserved' ELSE 'blocked' END, reason)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', reason IS NULL, 'id', new_id, 'status', CASE WHEN reason IS NULL THEN 'reserved' ELSE 'blocked' END,
                            'reason', reason, 'limit_usd', lim.limit_usd, 'used_usd', used);
END $$;

CREATE OR REPLACE FUNCTION ai_spend_settle(
  p_id UUID, p_status TEXT, p_input_tokens INTEGER, p_output_tokens INTEGER, p_actual_usd NUMERIC,
  p_usage_basis TEXT, p_latency_ms INTEGER, p_outcome TEXT
) RETURNS VOID LANGUAGE sql AS $$
  UPDATE ai_spend_events SET status = p_status, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
         actual_usd = p_actual_usd, usage_basis = p_usage_basis, latency_ms = p_latency_ms,
         outcome = left(p_outcome, 200), settled_at = now()
  WHERE id = p_id AND status = 'reserved' AND p_status IN ('settled', 'failed')
$$;

REVOKE ALL ON FUNCTION ai_spend_committed(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ai_spend_reserve(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ai_spend_settle(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ai_spend_committed(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION ai_spend_reserve(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION ai_spend_settle(UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, INTEGER, TEXT) TO service_role;
GRANT ALL ON ai_spend_limits, ai_spend_events TO service_role;
