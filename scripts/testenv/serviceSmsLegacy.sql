-- Shapes relevant to this feature, checked against production metadata on 2026-11-08.
-- Only used in the disposable local database; never applied to a hosted project.
-- organizations is provided by the shared test bootstrap with the same fields.
insert into public.organizations(name,kind) values('TEST Nova Systems','nova_internal');
create table public.intake_requests(id uuid primary key default gen_random_uuid(),name text not null,business_name text not null,phone text not null,email text not null,business_type text,needs text[],notes text,referral_source text,meeting_date text not null,meeting_time text not null,status text default 'pending',created_at timestamptz default now());
create table public.nova_crm_contacts(id uuid primary key default gen_random_uuid(),business_name text,owner_name text,phone text,email text,website text,city text,industry text,source text,status text default 'cold_lead',lead_score integer,deal_value numeric,notes text,audit_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.nova_crm_activities(id uuid primary key default gen_random_uuid(),contact_id uuid references public.nova_crm_contacts(id),engine text,direction text,summary text,outcome text,created_at timestamptz default now());
alter table public.intake_requests enable row level security;
alter table public.nova_crm_contacts enable row level security;
alter table public.nova_crm_activities enable row level security;
