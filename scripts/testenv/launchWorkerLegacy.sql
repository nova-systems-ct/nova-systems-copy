-- Production legacy tables used by the launch workflow. Local tests only.
create table public.nova_book_meetings(id uuid primary key default gen_random_uuid(),contact_id uuid,contact_name text,contact_email text,contact_phone text,meeting_type text,meeting_date date,meeting_time text,status text,notes text,created_at timestamptz default now());
alter table public.nova_tasks add column if not exists organization_id uuid references public.organizations(id);
alter table public.nova_tasks add column if not exists engine text;
alter table public.nova_tasks add column if not exists contact_id uuid;
alter table public.nova_tasks add column if not exists source_recommendation_id uuid;
alter table public.nova_tasks add column if not exists trigger_type text;
alter table public.nova_tasks add column if not exists completed_at timestamptz;
alter table public.nova_book_meetings enable row level security;
alter table public.nova_tasks enable row level security;
create table public.permissions(id uuid primary key default gen_random_uuid(),key text unique not null);
create table public.role_permissions(role text not null,permission_id uuid references public.permissions(id));
insert into public.permissions(key) values('admin.view');
insert into public.role_permissions(role,permission_id) select r.role,p.id from (values('nova_super_admin'),('nova_admin'),('nova_developer'))r(role) cross join public.permissions p;
grant select on public.permissions,public.role_permissions to service_role;
