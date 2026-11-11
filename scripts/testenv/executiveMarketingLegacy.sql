-- Test-only subset of the hosted marketing schema used by the executive RPC.
create table public.marketing_brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  key text not null,
  name text not null,
  kind text not null
);
create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  brand_id uuid not null references public.marketing_brands(id),
  pillar text,
  title text not null,
  notes text,
  status text not null default 'idea' check(status in ('idea','in_progress','archived')),
  created_by uuid,
  created_at timestamptz default now()
);
create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  brand_id uuid not null references public.marketing_brands(id),
  idea_id uuid references public.content_ideas(id),
  platform text not null,
  format text not null,
  caption text,
  status text not null default 'draft' check(status in ('draft','pending_approval','approved','ready_to_publish','published','rejected')),
  generated_by text not null default 'ai' check(generated_by in ('ai','manual')),
  created_at timestamptz default now()
);
insert into public.marketing_brands(organization_id,key,name,kind)
select id,'nova','Nova Systems','company' from public.organizations where kind='nova_internal';
