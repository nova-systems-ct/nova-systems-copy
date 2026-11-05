-- Complete a bounded Nova-internal maintenance job and create its next run in one
-- transaction. Cancellation, lease expiry or a replacement claimant wins over stale work.
CREATE OR REPLACE FUNCTION public.nova_complete_operations_job(p_job uuid,p_worker text,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE parent public.jobs; minutes integer; successor uuid;
BEGIN
 SELECT j.* INTO parent FROM public.jobs j
 WHERE j.id=p_job AND j.status='leased' AND j.leased_by=p_worker
   AND j.leased_until>pg_catalog.clock_timestamp()
   AND j.job_type IN ('nova_monitoring_review','nova_reporting_snapshot')
   AND EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=j.organization_id AND o.kind='nova_internal')
 FOR UPDATE OF j;
 IF NOT FOUND THEN RETURN jsonb_build_object('completed',false); END IF;
 UPDATE public.jobs SET status='completed',result=p_result,completed_at=pg_catalog.clock_timestamp(),last_error=null WHERE id=parent.id;
 IF parent.payload->'recurring'='true'::jsonb THEN
  minutes:=CASE WHEN parent.job_type='nova_monitoring_review' THEN 5 ELSE 60 END;
  INSERT INTO public.jobs(job_type,organization_id,payload,scheduled_at,idempotency_key)
  VALUES(parent.job_type,parent.organization_id,'{"recurring":true}'::jsonb,pg_catalog.clock_timestamp()+pg_catalog.make_interval(mins=>minutes),parent.job_type||':after:'||parent.id::text)
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO successor;
 END IF;
 RETURN jsonb_build_object('completed',true,'next_job_id',successor);
END;
$$;
REVOKE ALL ON FUNCTION public.nova_complete_operations_job(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nova_complete_operations_job(uuid,text,jsonb) TO service_role;
