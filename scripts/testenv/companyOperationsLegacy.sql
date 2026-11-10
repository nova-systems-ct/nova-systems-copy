-- Disposable test-only reconstruction of the existing production permission RPC.
-- Not part of the hosted migration and never deployed as new authorization code.
create function public.has_permission(target_org_id uuid,permission_key text)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role=m.role join public.permissions p on p.id=rp.permission_id where m.organization_id=target_org_id and m.staff_user_id=auth.uid() and m.member_type='staff' and m.status='active' and p.key=permission_key);
$$;
revoke all on function public.has_permission(uuid,text) from public,anon;
grant execute on function public.has_permission(uuid,text) to authenticated,service_role;
-- Existing production vault metadata columns, omitted by the minimal base scaffold.
alter table public.vault_documents add column client_id uuid;
alter table public.vault_documents add column client_name text;
alter table public.vault_documents add column type text;
alter table public.vault_documents add column storage_path text;
alter table public.vault_documents add column file_url text;
alter table public.vault_documents add column file_size bigint;
alter table public.vault_documents add column status text;
alter table public.vault_documents add column source text;
