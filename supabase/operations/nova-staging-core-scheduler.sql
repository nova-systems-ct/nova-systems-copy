-- Staging only. Reuses the existing scheduler secret inside Vault; never copy its value here.
-- Invokes at most one bounded Core job per tick, only when eligible work is actually due.
DO $setup$
DECLARE command_text text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='nova-staging-audit-due-work' AND command LIKE '%nova_audit_scheduler_token%' AND command LIKE '%nova-staging-demo.onrender.com%' AND command LIKE '%hmac%') THEN
  RAISE EXCEPTION 'Expected staging scheduler and Vault reference were not confirmed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='nova_audit_scheduler_token') THEN RAISE EXCEPTION 'Existing scheduler secret is missing'; END IF;
 command_text:=$tick$
DO $core$
DECLARE scheduler_secret text; timestamp_text text; request_nonce text; signature_text text;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.jobs j
  WHERE j.job_type IN ('channel_conversation_turn','channel_comment_reply','ops_conversation_turn','ops_followup_send','ops_campaign_send','nova_monitoring_review','nova_reporting_snapshot')
   AND ((j.status='pending' AND j.scheduled_at<=now()) OR (j.status='leased' AND j.leased_until<=now()))
   AND (
    NOT EXISTS(SELECT 1 FROM public.workers w WHERE w.capability_key=CASE WHEN j.job_type IN ('channel_conversation_turn','channel_comment_reply') THEN 'channel_inbox' WHEN j.job_type='ops_conversation_turn' THEN 'intake_booking' WHEN j.job_type='nova_monitoring_review' THEN 'monitoring' WHEN j.job_type='nova_reporting_snapshot' THEN 'reporting' ELSE 'followup_revive' END AND w.status IN ('draft','onboarding','training','suspended'))
    OR EXISTS(SELECT 1 FROM public.workers w WHERE w.capability_key=CASE WHEN j.job_type IN ('channel_conversation_turn','channel_comment_reply') THEN 'channel_inbox' WHEN j.job_type='ops_conversation_turn' THEN 'intake_booking' WHEN j.job_type='nova_monitoring_review' THEN 'monitoring' WHEN j.job_type='nova_reporting_snapshot' THEN 'reporting' ELSE 'followup_revive' END AND w.status IN ('active','restricted'))
   )
 ) THEN RETURN; END IF;
 SELECT decrypted_secret INTO scheduler_secret FROM vault.decrypted_secrets WHERE name='nova_audit_scheduler_token';
 IF scheduler_secret IS NULL OR length(scheduler_secret)<32 THEN RAISE EXCEPTION 'Scheduler secret unavailable'; END IF;
 timestamp_text:=floor(extract(epoch FROM clock_timestamp()))::bigint::text;
 request_nonce:=gen_random_uuid()::text;
 signature_text:=encode(extensions.hmac('nova-core-tick|'||timestamp_text||'|'||request_nonce,scheduler_secret,'sha256'),'hex');
 PERFORM net.http_post(
  url:='https://nova-staging-demo.onrender.com/api/integrations?op=core-queue-tick',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||signature_text,'x-nova-audit-timestamp',timestamp_text,'x-nova-audit-nonce',request_nonce),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
END $core$;
$tick$;
 PERFORM cron.schedule('nova-staging-core-due-work','* * * * *',command_text);
END $setup$;
