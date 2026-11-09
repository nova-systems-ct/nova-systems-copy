-- Staging scheduler command. The matching CRON_SECRET must already be stored as
-- nova_audit_scheduler_token in Supabase Vault, not embedded in this file.
-- Creates/updates this ONE job and leaves it PAUSED until the deployed receiver is verified.
select cron.alter_job(
 job_id := cron.schedule('nova-staging-audit-due-work','*/5 * * * *',
 $command$
 with due as (
   select 1 where exists (
     select 1 from public.jobs
     where job_type in ('audit_research','audit_diagnostic_task','audit_contact_dispatch','audit_contact_observe')
       and ((status='pending' and scheduled_at<=now()) or (status='leased' and leased_until<now()))
   )
 ), request as (
   select floor(extract(epoch from now()))::bigint::text as ts, gen_random_uuid()::text as nonce from due
 )
 select net.http_post(
   url := 'https://nova-staging-demo.onrender.com/api/integrations?op=audit-queue-tick',
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'x-nova-audit-timestamp',ts,
     'x-nova-audit-nonce',nonce,
     'Authorization','Bearer ' || encode(extensions.hmac(
       'nova-audit-tick|' || ts || '|' || nonce,
       (select decrypted_secret from vault.decrypted_secrets where name='nova_audit_scheduler_token'),
       'sha256'),'hex')
   ),
   body := '{"kind":"audit_due_work"}'::jsonb,
   timeout_milliseconds := 200000
 ) from request;
 $command$),
 active := false
);

-- After receiver acceptance, enable explicitly:
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname='nova-staging-audit-due-work'), active := true);
-- Pause/rollback without deleting jobs or customer records:
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname='nova-staging-audit-due-work'), active := false);
