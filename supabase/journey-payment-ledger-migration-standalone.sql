-- Apply after customer-journey. One transaction owns a journey's payment, receipt and balance.
CREATE OR REPLACE FUNCTION public.nova_post_journey_payment(
  p_org uuid, p_journey uuid, p_amount integer, p_source text, p_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  j public.journeys%ROWTYPE;
  invoice public.journey_documents%ROWTYPE;
  receipt public.journey_documents%ROWTYPE;
  basis integer;
  due integer;
  next_seq integer;
  event_key text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_source IS NULL OR p_source NOT IN ('provider_verified','owner_recorded')
     OR p_reference IS NULL OR length(trim(p_reference)) NOT BETWEEN 1 AND 120 THEN
    RETURN jsonb_build_object('error','invalid_payment');
  END IF;
  SELECT * INTO j FROM public.journeys WHERE id=p_journey AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  SELECT * INTO receipt FROM public.journey_documents WHERE organization_id=p_org AND journey_id=j.id
    AND kind='receipt' AND payment_reference=p_reference ORDER BY seq LIMIT 1;
  IF FOUND THEN
    IF receipt.amount_cents <> p_amount OR receipt.payment_source IS DISTINCT FROM p_source THEN
      RETURN jsonb_build_object('error','reference_conflict');
    END IF;
    RETURN jsonb_build_object('repeated',true,'journey',to_jsonb(j));
  END IF;
  event_key := j.id::text || ':payment:' || p_reference;
  IF EXISTS(SELECT 1 FROM public.journey_events WHERE idempotency_key=event_key) THEN
    RETURN jsonb_build_object('error','reconcile_legacy_payment');
  END IF;
  IF j.stage NOT IN ('deposit_due','balance_due') THEN RETURN jsonb_build_object('error','wrong_stage'); END IF;
  SELECT * INTO invoice FROM public.journey_documents WHERE organization_id=p_org AND journey_id=j.id
    AND kind=CASE WHEN j.stage='deposit_due' THEN 'deposit_invoice' ELSE 'balance_invoice' END
    AND status='issued' ORDER BY seq DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','wrong_stage'); END IF;
  IF j.stage='deposit_due' THEN
    SELECT (detail->>'deposit_cents')::integer INTO basis FROM public.journey_events
      WHERE organization_id=p_org AND journey_id=j.id AND action='quote_accepted' ORDER BY created_at LIMIT 1;
    due := least(invoice.amount_cents,coalesce(basis,invoice.amount_cents)-j.paid_cents);
  ELSE
    due := least(invoice.amount_cents,j.total_cents-j.paid_cents);
  END IF;
  IF due IS NULL OR p_amount > due THEN RETURN jsonb_build_object('error','excess_payment'); END IF;
  INSERT INTO public.journey_events(organization_id,journey_id,agent,action,status,detail,idempotency_key)
    VALUES(p_org,j.id,'accounting','payment_recorded','done',jsonb_build_object('amount_cents',p_amount,'source',p_source,'reference',p_reference),event_key);
  SELECT coalesce(max(seq),0)+1 INTO next_seq FROM public.journey_documents WHERE journey_id=j.id AND kind='receipt';
  INSERT INTO public.journey_documents(organization_id,journey_id,kind,seq,body,amount_cents,status,payment_source,payment_reference)
    VALUES(p_org,j.id,'receipt',next_seq,
      'Receipt' || chr(10) || 'Amount received: $' || to_char(p_amount / 100.0,'FM9999999990.00') || chr(10) || 'Reference: ' || p_reference || chr(10) ||
      CASE WHEN p_source='provider_verified' THEN 'Confirmed by the payment provider.' ELSE 'Entered by the business; not confirmed by a payment provider.' END,
      p_amount,'paid',p_source,p_reference);
  IF p_amount = due THEN UPDATE public.journey_documents SET status='paid' WHERE id=invoice.id; END IF;
  UPDATE public.journeys SET paid_cents=paid_cents+p_amount,updated_at=now() WHERE id=j.id RETURNING * INTO j;
  RETURN jsonb_build_object('repeated',false,'journey',to_jsonb(j));
END;
$$;
REVOKE ALL ON FUNCTION public.nova_post_journey_payment(uuid,uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nova_post_journey_payment(uuid,uuid,integer,text,text) TO service_role;
