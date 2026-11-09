-- Free-first safety repairs. Additive replacement of the dispatch reservation, plus atomic CFO approvals.
-- Server-only functions: browser clients cannot reserve provider calls or approve expenses directly.
CREATE OR REPLACE FUNCTION public.ai_spend_reserve(
  p_request_id TEXT, p_organization_id UUID, p_purpose TEXT, p_provider TEXT, p_model TEXT,
  p_pricing_version TEXT, p_reserve_usd NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  lim ai_spend_limits%ROWTYPE; since TIMESTAMPTZ; used NUMERIC; open_count INTEGER; existing ai_spend_events%ROWTYPE;
  reason TEXT; new_id UUID;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) = 0 OR p_purpose IS NULL OR length(p_purpose) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;
  -- Same request with different purposes still has one owner. The second call must never dispatch.
  PERFORM pg_advisory_xact_lock(hashtext('ai_request:' || p_request_id));
  SELECT * INTO existing FROM ai_spend_events WHERE request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'id', existing.id, 'status', existing.status, 'reason', 'duplicate_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_spend:' || p_purpose));
  SELECT * INTO lim FROM ai_spend_limits WHERE purpose = p_purpose;
  IF NOT FOUND THEN reason := 'no_approved_budget';
  ELSIF p_reserve_usd IS NULL OR p_reserve_usd::text IN ('NaN', 'Infinity', '-Infinity') OR p_reserve_usd <= 0 THEN reason := 'price_unknown';
  ELSE
    since := CASE lim.period WHEN 'month' THEN date_trunc('month', now()) ELSE date_trunc('day', now()) END;
    used := ai_spend_committed(p_purpose, since);
    SELECT count(*) INTO open_count FROM ai_spend_events
      WHERE purpose = p_purpose AND status = 'reserved' AND created_at > now() - interval '15 minutes';
    IF used + p_reserve_usd > lim.limit_usd THEN reason := 'budget_exhausted';
    ELSIF open_count >= lim.max_concurrent THEN reason := 'too_many_concurrent'; END IF;
  END IF;
  INSERT INTO ai_spend_events(request_id, organization_id, purpose, provider, model, pricing_version, reserved_usd, status, block_reason)
  VALUES(p_request_id, p_organization_id, p_purpose, p_provider, p_model, p_pricing_version,
    CASE WHEN reason IS NULL THEN p_reserve_usd ELSE 0 END,
    CASE WHEN reason IS NULL THEN 'reserved' ELSE 'blocked' END, reason) RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', reason IS NULL, 'id', new_id, 'reason', reason);
END $$;
REVOKE ALL ON FUNCTION public.ai_spend_reserve(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_spend_reserve(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.nova_approve_expense(
  p_organization_id UUID, p_expense_id UUID, p_actor UUID, p_mode TEXT, p_spending_unlocked BOOLEAN DEFAULT false
) RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  exp expense_requests%ROWTYPE; bal finance_balance_snapshots%ROWTYPE;
  prefs JSONB; committed NUMERIC; spent NUMERIC; debits NUMERIC; available NUMERIC;
  fresh_days NUMERIC; auto_limit NUMERIC; monthly_limit NUMERIC; reason TEXT;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('policy', 'owner') OR p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'A valid approval mode and actor are required.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nova_finance:' || p_organization_id::text));
  SELECT * INTO exp FROM expense_requests WHERE id = p_expense_id AND organization_id = p_organization_id FOR UPDATE;
  IF NOT FOUND OR exp.status NOT IN ('proposed', 'needs_owner') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'This expense is not waiting for approval in this business.');
  END IF;
  IF exp.amount_cents > 0 AND p_spending_unlocked IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Spending is locked by the owner. No positive expense was approved.');
  END IF;
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO prefs FROM owner_preferences WHERE organization_id = p_organization_id;
  -- Zero-cost work needs no invented bank balance. It grants no right to incur a later provider charge.
  IF exp.amount_cents > 0 THEN
    SELECT * INTO bal FROM finance_balance_snapshots WHERE organization_id = p_organization_id ORDER BY as_of DESC LIMIT 1;
    fresh_days := COALESCE((prefs->>'balance_freshness_days')::numeric, 7);
    auto_limit := COALESCE((prefs->>'auto_approve_cents')::numeric, 0);
    monthly_limit := (prefs->>'monthly_budget_cents')::numeric;
    IF bal.id IS NULL OR bal.currency <> 'USD' OR exp.currency <> 'USD' OR NOT isfinite(bal.as_of)
       OR bal.as_of > now() OR fresh_days < 0 OR fresh_days::text IN ('NaN', 'Infinity', '-Infinity')
       OR now() - bal.as_of > fresh_days * interval '1 day' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'A valid current USD balance and freshness policy are required.');
    END IF;
    SELECT COALESCE(sum(amount_cents), 0) INTO committed FROM expense_requests WHERE organization_id = p_organization_id AND status = 'approved';
    SELECT COALESCE(sum(amount_cents) FILTER (WHERE recorded_at >= date_trunc('month', now())), 0),
           COALESCE(sum(amount_cents) FILTER (WHERE recorded_at > bal.as_of), 0) INTO spent, debits
      FROM expense_requests WHERE organization_id = p_organization_id AND status = 'recorded';
    available := bal.balance_cents - committed - debits;
    IF exp.amount_cents > available THEN reason := 'Available funds are insufficient after commitments and recorded debits.';
    ELSIF monthly_limit IS NULL OR monthly_limit < 0 OR monthly_limit <> trunc(monthly_limit) OR monthly_limit::text IN ('NaN', 'Infinity', '-Infinity') THEN reason := 'Set a valid monthly budget before approval.';
    ELSIF spent + committed + exp.amount_cents > monthly_limit THEN reason := 'This expense would exceed the monthly budget including existing commitments.';
    ELSIF p_mode = 'policy' AND (auto_limit <= 0 OR auto_limit <> trunc(auto_limit) OR auto_limit::text IN ('NaN', 'Infinity', '-Infinity') OR exp.amount_cents > auto_limit) THEN reason := 'The owner must decide: outside the automatic approval limit.';
    END IF;
    IF reason IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', reason); END IF;
  END IF;
  UPDATE expense_requests SET status = 'approved', decided_by = p_actor, decided_at = now(), updated_at = now(),
    authority = jsonb_build_object('by', p_mode, 'user', p_actor, 'at', now(), 'atomic', true),
    cfo_check = jsonb_build_object('recommendation', 'approve', 'available_cents', available,
      'reasons', jsonb_build_array('Rechecked funds and commitments atomically before approval.'))
    WHERE id = exp.id RETURNING * INTO exp;
  RETURN jsonb_build_object('ok', true, 'expense', to_jsonb(exp));
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'Financial policy is invalid; reconcile it before approval.');
END $$;
REVOKE ALL ON FUNCTION public.nova_approve_expense(UUID, UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nova_approve_expense(UUID, UUID, UUID, TEXT, BOOLEAN) TO service_role;

-- Recording a payment takes the same lock as approval so it cannot disappear between the cash and budget reads.
CREATE OR REPLACE FUNCTION public.nova_record_expense(p_organization_id UUID, p_expense_id UUID)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE exp expense_requests%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nova_finance:' || p_organization_id::text));
  UPDATE expense_requests SET status = 'recorded', recorded_at = now(), updated_at = now()
    WHERE id = p_expense_id AND organization_id = p_organization_id AND status = 'approved' RETURNING * INTO exp;
  RETURN jsonb_build_object('ok', exp.id IS NOT NULL, 'expense', to_jsonb(exp));
END $$;
REVOKE ALL ON FUNCTION public.nova_record_expense(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nova_record_expense(UUID, UUID) TO service_role;

-- Promote only the model suggestion already saved on this business's task, after an owner review.
-- Re-delivery is idempotent; up to eight reviewed lessons are carried into the next memory version.
CREATE OR REPLACE FUNCTION public.nova_accept_role_learning(p_organization_id UUID, p_work_item_id UUID, p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  item work_items%ROWTYPE; previous operational_memory%ROWTYPE; suggestion TEXT;
  lesson_list JSONB; memory_id UUID; next_version INTEGER;
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'An owner reviewer is required.'); END IF;
  SELECT * INTO item FROM work_items WHERE id = p_work_item_id AND organization_id = p_organization_id AND role_key IN ('ceo_twin','executive_assistant','coo','cfo','cmo');
  IF NOT FOUND OR item.status NOT IN ('in_review','approved','completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Reviewable executive result not found in this business.');
  END IF;
  SELECT content #>> '{reasoning,proposed_lesson}' INTO suggestion FROM work_item_outputs
    WHERE work_item_id = item.id AND content #>> '{reasoning,status}' = 'generated' ORDER BY created_at DESC LIMIT 1;
  IF suggestion IS NULL OR length(btrim(suggestion)) = 0 OR length(suggestion) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'This task has no valid saved learning proposal.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('role_memory:' || p_organization_id::text || ':' || item.role_key));
  SELECT id INTO memory_id FROM operational_memory WHERE scope_type = 'organization' AND scope_id = p_organization_id
    AND key = 'role_learning:' || item.role_key AND source_type = 'work_item' AND source_id = item.id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'already_approved', true, 'memory_id', memory_id); END IF;
  SELECT * INTO previous FROM operational_memory WHERE scope_type = 'organization' AND scope_id = p_organization_id
    AND key = 'role_learning:' || item.role_key AND status = 'active' FOR UPDATE;
  IF previous.content->'lessons' @> jsonb_build_array(jsonb_build_object('work_item_id', item.id)) THEN
    RETURN jsonb_build_object('ok', true, 'already_approved', true, 'memory_id', previous.id);
  END IF;
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM operational_memory
    WHERE scope_type = 'organization' AND scope_id = p_organization_id AND key = 'role_learning:' || item.role_key;
  SELECT COALESCE(jsonb_agg(value ORDER BY n), '[]'::jsonb) INTO lesson_list FROM
    (SELECT value,n FROM jsonb_array_elements(CASE WHEN previous.expires_at > now() THEN COALESCE(previous.content->'lessons','[]'::jsonb) ELSE '[]'::jsonb END) WITH ORDINALITY AS x(value,n) ORDER BY n DESC LIMIT 7) AS recent;
  lesson_list := lesson_list || jsonb_build_array(jsonb_build_object('work_item_id', item.id, 'lesson', suggestion, 'approved_by', p_actor, 'approved_at', now()));
  UPDATE operational_memory SET status = 'superseded' WHERE id = previous.id;
  INSERT INTO operational_memory(scope_type,scope_id,key,version,status,content,source_type,source_id,created_by,expires_at)
    VALUES('organization',p_organization_id,'role_learning:' || item.role_key,next_version,'active',
      jsonb_build_object('approved_by',p_actor,'approved_at',now(),'lessons',lesson_list), 'work_item',item.id,p_actor,now()+interval '1 year') RETURNING id INTO memory_id;
  RETURN jsonb_build_object('ok',true,'memory_id',memory_id);
END $$;
REVOKE ALL ON FUNCTION public.nova_accept_role_learning(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nova_accept_role_learning(UUID, UUID, UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
