-- Local integration environment bootstrap. Recreates, on a DISPOSABLE PostgreSQL, the Supabase scaffolding
-- (roles, auth schema, storage schema) and the pre-existing production tables that Nova's migrations extend.
-- It is a reconstruction from docs/data-model.md and supabase/schema-update.sql — NOT a copy of production.
-- Where production's exact shape was unknown, the minimum needed by the migrations is defined.

create extension if not exists pgcrypto;

-- ---- roles (as on Supabase) ----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'test'; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default: new public tables/functions/sequences are granted to these roles. Reproduced so that the
-- lockdown migration is tested against the same starting condition production has.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ---- auth schema (users table + uid()) -----------------------------------------------------------------
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}',
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- ---- storage schema (metadata only; the object bytes live in the stub server's memory) -------------------
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

-- ---- pre-existing Nova tables (identity + tenancy) -------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique,
  kind text not null default 'client' check (kind in ('nova_internal', 'client')),
  client_id uuid, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Live role list per docs/data-model.md (verified against production 2026-09-26: the check rejects nova_sales_candidate).
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_type text not null default 'staff',
  staff_user_id uuid,                    -- production has NO foreign key to auth.users here (verified: a nonexistent id was accepted)
  client_account_id uuid,
  role text not null,
  status text not null default 'active',
  permissions jsonb,
  created_at timestamptz not null default now(),
  constraint organization_members_member_type_check check (member_type in ('staff', 'client_account')),
  constraint organization_members_role_check check (role in ('nova_super_admin','nova_admin','nova_auditor','nova_marketing','nova_sales','nova_developer','client_owner','client_admin','client_marketing','client_employee','client_viewer'))
);

-- ---- pre-existing operating tables that schema-update.sql only ALTERs -----------------------------------
create table if not exists public.clients (id uuid primary key default gen_random_uuid(), full_name text, business_name text, phone text, email text, status text, payment_status text, created_at timestamptz default now());
create table if not exists public.leads (id uuid primary key default gen_random_uuid(), name text, email text, phone text, company text, service_needed text, created_at timestamptz default now());
create table if not exists public.intake_submissions (id uuid primary key default gen_random_uuid(), name text, email text, phone text, status text, created_at timestamptz default now());
create table if not exists public.contracts (id uuid primary key default gen_random_uuid(), client_name text, client_email text, contract_type text, custom_notes text, status text default 'pending', sent_at timestamptz default now(), signed_at timestamptz, signed_name text, signature_data text, pdf_url text, created_at timestamptz default now());
create table if not exists public.client_invoices (id uuid primary key default gen_random_uuid(), client_name text, amount numeric, status text, created_at timestamptz default now());
create table if not exists public.meetings (id uuid primary key default gen_random_uuid(), name text, email text, starts_at timestamptz, created_at timestamptz default now());
create table if not exists public.nova_tasks (id uuid primary key default gen_random_uuid(), title text, status text default 'open', description text, due_date date, assigned_to text, created_at timestamptz default now());
create table if not exists public.referral_tracking (id uuid primary key default gen_random_uuid(), referrer text, created_at timestamptz default now());
create table if not exists public.contact_submissions (id uuid primary key default gen_random_uuid(), name text, email text, message text, created_at timestamptz default now());
create table if not exists public.newsletter_subscribers (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now());
create table if not exists public.newsletter_sends (id uuid primary key default gen_random_uuid(), subject text, created_at timestamptz default now());
create table if not exists public.wave_one_applications (id uuid primary key default gen_random_uuid(), name text, email text, created_at timestamptz default now());
create table if not exists public.vault_documents (id uuid primary key default gen_random_uuid(), file_name text, created_at timestamptz default now());
create table if not exists public.blog_posts (id uuid primary key default gen_random_uuid(), title text, created_at timestamptz default now());
create table if not exists public.portfolio (id uuid primary key default gen_random_uuid(), title text, created_at timestamptz default now());

-- RLS on the identity tables, matching production's verified behaviour (permissions-matrix.md: "role-escalation writes are
-- rejected — no UPDATE policy exists for authenticated"; users read only their own membership rows).
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy own_org_read on public.organizations for select to authenticated using (exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.staff_user_id = auth.uid() and m.status = 'active'));
create policy own_membership_read on public.organization_members for select to authenticated using (staff_user_id = auth.uid());
