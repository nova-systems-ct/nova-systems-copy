-- Runs the existing, bounded database worker on the current Supabase instance.
-- It performs no HTTP, provider, model, message or payment calls.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create index if not exists nova_team_background_queued_idx
  on public.nova_team_background_jobs(updated_at) where status='queued';
select cron.schedule('nova-executive-background', '* * * * *',
  $$set statement_timeout='20s'; set lock_timeout='2s'; set role service_role; select public.nova_team_tick(); reset role;$$);
