-- Existing staging only. Requires the already installed pg_cron/pg_net and
-- nova_audit_scheduler_token in Vault. No secret is embedded in this command.
-- Run after deployment; it deliberately leaves the schedule paused for acceptance.
select cron.alter_job(job_id := cron.schedule('nova-staging-executive-due-work','*/5 * * * *',
$command$
with due as (
 select 1 where exists(select 1 from public.jobs
  where job_type in ('role_ea_brief','role_coo_check','role_cfo_review','role_cmo_review')
  and ((status='pending' and scheduled_at<=now()) or (status='leased' and leased_until<now())))
), request as(select floor(extract(epoch from now()))::bigint::text ts,gen_random_uuid()::text nonce from due)
select net.http_post(
 url:='https://nova-staging-demo.onrender.com/api/integrations?op=executive-queue-tick',
 headers:=jsonb_build_object('Content-Type','application/json','x-nova-audit-timestamp',ts,'x-nova-audit-nonce',nonce,
 'Authorization','Bearer '||encode(extensions.hmac('nova-executive-tick|'||ts||'|'||nonce,
 (select decrypted_secret from vault.decrypted_secrets where name='nova_audit_scheduler_token'),'sha256'),'hex')),
 body:='{"kind":"executive_due_work"}'::jsonb,timeout_milliseconds:=200000
) from request;
$command$),active:=false);

-- After actual hosted execution passes:
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname='nova-staging-executive-due-work'),active:=true);
-- Rollback: set active false and NOVA_EXECUTIVE_HTTP_WORKER_ENABLED=false.
