-- Applied to authorized staging by Supabase migration tooling; version returned by its migration history.
-- Provider-owned extension ACLs may retain Supabase's defaults despite REVOKE warnings.
-- The net schema is not exposed through the Data API. Scheduler requests use expiring HMACs,
-- never the reusable Vault secret; the receiver rejects replayed nonces.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke execute on all functions in schema net from public, anon, authenticated;
grant usage on schema net to service_role;
grant execute on all functions in schema net to service_role;
