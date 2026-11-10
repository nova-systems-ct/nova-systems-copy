-- Add production CRM/audit foundations and the launch operations ledger.
-- =============================================================================================
-- Shared CRM/Order foundations + Nova Audit workflow (2026-09-23) — standalone migration.
-- Safe to run on the live database: every CREATE TABLE uses IF NOT EXISTS, every constraint is
-- additive, zero DROP/TRUNCATE/DELETE/UPDATE statements. Safe to re-run.
--
-- Validated locally against pg-mem (an in-process Postgres-compatible engine) before being
-- handed over — this environment has no Docker/local Postgres available for a full Supabase
-- stack, so pg-mem is the closest available proof that this SQL is syntactically valid and that
-- its constraints (foreign keys, uniqueness, CHECK) behave as intended. It does NOT validate
-- Supabase-specific behavior (RLS policies, auth.uid(), Storage) — that can only be verified
-- once this actually runs against the real Supabase project. See
-- scripts/validate_crm_order_audit_schema.mjs for the pg-mem validation run.
--
-- Prerequisites (already live, confirmed): organizations, is_org_member(), auth.users, leads.
-- =============================================================================================

-- ---------------------------------------------------------------------------------- businesses
-- Central identity-resolution entity shared by CRM and Audit — "resolve business identity from
-- name, website and location... never combine similarly named firms" (master prompt §9).
CREATE TABLE IF NOT EXISTS businesses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id),
  name               TEXT NOT NULL,
  aliases            TEXT[] NOT NULL DEFAULT '{}',
  website            TEXT,
  confirmed_website  BOOLEAN NOT NULL DEFAULT false,
  phone              TEXT,
  address_line       TEXT,
  city               TEXT,
  state              TEXT,
  postal_code        TEXT,
  industry           TEXT,
  confidence         TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confidence IN ('unconfirmed','likely','confirmed')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_organization_idx ON businesses (organization_id);
CREATE INDEX IF NOT EXISTS businesses_name_idx ON businesses (name);

CREATE TABLE IF NOT EXISTS business_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label        TEXT,
  address_line TEXT, city TEXT, state TEXT, postal_code TEXT,
  phone        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_locations_business_idx ON business_locations (business_id);

-- ------------------------------------------------------------------------------- crm_contacts
-- Named crm_contacts (not "contacts") to avoid any future collision with an unrelated concept.
CREATE TABLE IF NOT EXISTS crm_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  business_id    UUID REFERENCES businesses(id),
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  title          TEXT,
  sms_consent    BOOLEAN NOT NULL DEFAULT false,
  email_consent  BOOLEAN NOT NULL DEFAULT false,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  source         TEXT,
  -- Set when a duplicate is merged into another contact after review. The row is kept (history,
  -- audit trail); it is excluded from normal listing and its unique identifiers are released.
  merged_into_id UUID REFERENCES crm_contacts(id),
  merged_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_contacts_organization_idx ON crm_contacts (organization_id);
CREATE INDEX IF NOT EXISTS crm_contacts_business_idx ON crm_contacts (business_id);

-- ----------------------------------------------------------------------------------- crm_deals
CREATE TABLE IF NOT EXISTS crm_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_id     UUID REFERENCES businesses(id),
  contact_id      UUID REFERENCES crm_contacts(id),
  lead_id         UUID REFERENCES leads(id),
  pipeline        TEXT NOT NULL DEFAULT 'nova_sales' CHECK (pipeline IN ('nova_sales','client_sales','crystal_service')),
  stage           TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
                    'new','assigned','attempted','connected','qualified','discovery','proposal',
                    'accepted','payment_condition_satisfied','onboarding',
                    'lost','disqualified','nurture','paused',
                    -- Pilot sales path: prospect → contacted → discovery → audit → recommendation → proposal → pilot
                    'prospect','contacted','audit_ordered','audit_delivered','recommendation','pilot_agreement',
                    'installation','active_pilot','results_review','won_paid','won_extended','closed_no_conversion'
                  )),
  next_action     TEXT,
  next_action_at  TIMESTAMPTZ,
  discovery       JSONB NOT NULL DEFAULT '{}',   -- discovery questionnaire answers (free-form; questions live in the UI)
  win_reason      TEXT,
  stage_history   JSONB NOT NULL DEFAULT '[]',
  owner_user_id   UUID REFERENCES auth.users(id),
  value_cents     INTEGER,
  currency        TEXT NOT NULL DEFAULT 'USD',
  source          TEXT,
  lost_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crm_deals_organization_idx ON crm_deals (organization_id);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals (stage);

-- Notes, tasks and reminders attached to a deal and/or contact.
CREATE TABLE IF NOT EXISTS crm_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id         UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES crm_contacts(id),
  kind            TEXT NOT NULL CHECK (kind IN ('note','task','reminder')),
  body            TEXT NOT NULL,
  due_at          TIMESTAMPTZ,
  done_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_activities_org_due_idx ON crm_activities (organization_id, due_at) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_activities_deal_idx ON crm_activities (deal_id);

-- Versioned proposals / pilot scope. Prices are NEVER defaulted: price_cents stays NULL unless the
-- referenced product is pricing_approved (enforced in the API). Acceptance needs recorded evidence.
CREATE TABLE IF NOT EXISTS crm_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  deal_id             UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','superseded')),
  scope               JSONB NOT NULL DEFAULT '{}',    -- {items:[{product_id, recommendation_id?, notes}], success_criteria:[...], ...}
  price_cents         INTEGER,
  currency            TEXT NOT NULL DEFAULT 'USD',
  acceptance_evidence TEXT,
  accepted_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, version)
);
CREATE INDEX IF NOT EXISTS crm_proposals_org_idx ON crm_proposals (organization_id);

-- Link existing leads (Stage 5) to a resolved business without altering existing behavior —
-- nullable, purely additive.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);

-- ------------------------------------------------------------------------------------ products
-- Versioned product catalog (master prompt §8). readiness_state uses the exact status
-- vocabulary the master prompt itself defines, so a product's row IS its own honest status —
-- never implied by a route existing.
CREATE TABLE IF NOT EXISTS products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT NOT NULL,
  version                INTEGER NOT NULL DEFAULT 1,
  name                   TEXT NOT NULL,
  category               TEXT,
  description            TEXT,
  prerequisites          JSONB NOT NULL DEFAULT '[]',
  capabilities           JSONB NOT NULL DEFAULT '[]',
  pricing_config         JSONB NOT NULL DEFAULT '{}',
  pricing_approved       BOOLEAN NOT NULL DEFAULT false,
  contract_template_ref  TEXT,
  config_schema          JSONB NOT NULL DEFAULT '{}',
  supported_integrations JSONB NOT NULL DEFAULT '[]',
  readiness_state        TEXT NOT NULL DEFAULT 'not started' CHECK (readiness_state IN (
                            'not started','in development','locally verified','staging verified',
                            'waiting on owner/provider','ready for installation','installed','live verified'
                          )),
  installation_checklist JSONB NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

-- -------------------------------------------------------------------------------------- orders
CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id), -- the CUSTOMER org
  business_id        UUID REFERENCES businesses(id),
  deal_id            UUID REFERENCES crm_deals(id),
  product_id         UUID NOT NULL REFERENCES products(id),
  product_version    INTEGER NOT NULL,
  scope              JSONB NOT NULL DEFAULT '{}',
  price_cents        INTEGER,
  currency           TEXT NOT NULL DEFAULT 'USD',
  agreement_version  TEXT,
  payment_condition  TEXT,
  owner_user_id      UUID REFERENCES auth.users(id),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','scoped','awaiting_acceptance','accepted','waiting_for_inputs',
                        'ready_for_work','in_progress','review','delivered','installed',
                        'monitoring','support','closed','paused','cancelled','refunded','disputed'
                      )),
  status_history     JSONB NOT NULL DEFAULT '[]',
  inputs             JSONB NOT NULL DEFAULT '{}',
  deadline_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_organization_idx ON orders (organization_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  actor_user_id  UUID REFERENCES auth.users(id),
  detail         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id);

-- =============================================================================================
-- Nova Audit workflow (master prompt §8/§9)
-- =============================================================================================

CREATE TABLE IF NOT EXISTS audit_cases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id),
  business_id            UUID REFERENCES businesses(id),
  order_id               UUID REFERENCES orders(id),
  scope                  TEXT NOT NULL DEFAULT 'digital' CHECK (scope IN ('digital','360')),
  status                 TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
                            'intake','inputs_pending','ready','researching','evidence_gathered',
                            'findings_drafted','report_draft','qa_review','approved','delivered',
                            'customer_decision','implementation','outcome_tracking','closed'
                          )),
  clock_basis            TEXT NOT NULL DEFAULT 'elapsed' CHECK (clock_basis IN ('elapsed','business_hours')),
  timezone               TEXT NOT NULL DEFAULT 'America/New_York',
  target_hours           INTEGER NOT NULL DEFAULT 72,
  start_condition_met_at TIMESTAMPTZ,
  due_at                 TIMESTAMPTZ,
  original_due_at        TIMESTAMPTZ,
  paused_at              TIMESTAMPTZ,
  total_paused_seconds   INTEGER NOT NULL DEFAULT 0,
  pause_reason           TEXT,
  owner_user_id          UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_cases_organization_idx ON audit_cases (organization_id);
CREATE INDEX IF NOT EXISTS audit_cases_status_idx ON audit_cases (status);

CREATE TABLE IF NOT EXISTS audit_case_pause_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  paused_at     TIMESTAMPTZ NOT NULL,
  resumed_at    TIMESTAMPTZ,
  reason        TEXT,
  actor_user_id UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS audit_case_pause_events_case_idx ON audit_case_pause_events (case_id);

CREATE TABLE IF NOT EXISTS audit_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  source         TEXT NOT NULL,
  capture_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  method         TEXT,
  observation    TEXT NOT NULL,
  snapshot_path  TEXT, -- private storage path only, never a public URL — see resume/vault pattern
  author         TEXT NOT NULL,
  source_quality TEXT CHECK (source_quality IN ('high','medium','low','unavailable')),
  confidence     TEXT CHECK (confidence IN ('high','medium','low')),
  privacy_level  TEXT NOT NULL DEFAULT 'internal' CHECK (privacy_level IN ('internal','client_visible')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_evidence_case_idx ON audit_evidence (case_id);

CREATE TABLE IF NOT EXISTS audit_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  -- Separates observation/inference/estimate/recommendation as the master prompt requires —
  -- "stated_claim" covers what the customer told us, distinct from what was directly observed.
  statement_type TEXT NOT NULL CHECK (statement_type IN ('observed_fact','stated_claim','inference','estimate','unknown')),
  detail         TEXT NOT NULL,
  priority       TEXT CHECK (priority IN ('high','medium','low')),
  confidence         TEXT CHECK (confidence IN ('high','medium','low')),
  recommended_action TEXT,
  review_status      TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','reviewed','rejected')),
  reviewed_by        UUID REFERENCES auth.users(id),
  reviewed_at        TIMESTAMPTZ,
  -- Only meaningful for statement_type='estimate': a RANGE with stated assumptions, never a point value.
  estimate_low          NUMERIC,
  estimate_high         NUMERIC,
  estimate_unit         TEXT,
  estimate_assumptions  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_findings_case_idx ON audit_findings (case_id);

CREATE TABLE IF NOT EXISTS audit_finding_evidence (
  finding_id  UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES audit_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS audit_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  finding_id         UUID REFERENCES audit_findings(id),
  mechanism          TEXT NOT NULL,
  impact_estimate    TEXT,
  effort_range       TEXT,
  cost_range         TEXT,
  dependencies       TEXT,
  owner              TEXT,
  uncertainty        TEXT,
  verification_plan  TEXT,
  priority_rank      INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_recommendations_case_idx ON audit_recommendations (case_id);

-- Immutable approved versions — "edited versions require new review": application code must
-- INSERT a new row for an edit after approval, never UPDATE an approved one. Enforced at the
-- application layer (api/client.js) since expressing "no UPDATE once approved" cleanly in a
-- portable CHECK/trigger here would need a trigger function — flagged as a real, not-yet-added
-- defense-in-depth item in docs/PRODUCT_BUILD_STATE.md rather than silently assumed solved by
-- application code alone.
CREATE TABLE IF NOT EXISTS audit_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  content      JSONB NOT NULL DEFAULT '{}',
  content_sha256          TEXT,   -- hash of content at draft time
  approved_content_sha256 TEXT,   -- hash re-computed at approval; delivery re-checks it is unchanged
  approved_by  UUID REFERENCES auth.users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

CREATE TABLE IF NOT EXISTS audit_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
  delivery_method       TEXT NOT NULL,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_accepted_at  TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT,
  delivered_by          UUID REFERENCES auth.users(id),
  confirmation          TEXT,   -- how delivery was confirmed (provider event id, customer reply); required to claim 'delivered'
  report_content_sha256 TEXT    -- exact content version that was delivered
);
CREATE INDEX IF NOT EXISTS audit_deliveries_report_idx ON audit_deliveries (report_id);

CREATE TABLE IF NOT EXISTS audit_outcomes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES audit_cases(id) ON DELETE CASCADE,
  metric             TEXT NOT NULL,
  baseline_period    TEXT,
  comparison_period  TEXT,
  baseline_value     NUMERIC,
  comparison_value   NUMERIC,
  confounders        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_outcomes_case_idx ON audit_outcomes (case_id);


-- All new business/audit tables are private to the authorized server API.
alter table public.businesses enable row level security;
revoke all on public.businesses from public,anon,authenticated;
grant select,insert,update,delete on public.businesses to service_role;
alter table public.business_locations enable row level security;
revoke all on public.business_locations from public,anon,authenticated;
grant select,insert,update,delete on public.business_locations to service_role;
alter table public.crm_contacts enable row level security;
revoke all on public.crm_contacts from public,anon,authenticated;
grant select,insert,update,delete on public.crm_contacts to service_role;
alter table public.crm_deals enable row level security;
revoke all on public.crm_deals from public,anon,authenticated;
grant select,insert,update,delete on public.crm_deals to service_role;
alter table public.crm_activities enable row level security;
revoke all on public.crm_activities from public,anon,authenticated;
grant select,insert,update,delete on public.crm_activities to service_role;
alter table public.crm_proposals enable row level security;
revoke all on public.crm_proposals from public,anon,authenticated;
grant select,insert,update,delete on public.crm_proposals to service_role;
alter table public.products enable row level security;
revoke all on public.products from public,anon,authenticated;
grant select,insert,update,delete on public.products to service_role;
alter table public.orders enable row level security;
revoke all on public.orders from public,anon,authenticated;
grant select,insert,update,delete on public.orders to service_role;
alter table public.order_events enable row level security;
revoke all on public.order_events from public,anon,authenticated;
grant select,insert,update,delete on public.order_events to service_role;
alter table public.audit_cases enable row level security;
revoke all on public.audit_cases from public,anon,authenticated;
grant select,insert,update,delete on public.audit_cases to service_role;
alter table public.audit_case_pause_events enable row level security;
revoke all on public.audit_case_pause_events from public,anon,authenticated;
grant select,insert,update,delete on public.audit_case_pause_events to service_role;
alter table public.audit_evidence enable row level security;
revoke all on public.audit_evidence from public,anon,authenticated;
grant select,insert,update,delete on public.audit_evidence to service_role;
alter table public.audit_findings enable row level security;
revoke all on public.audit_findings from public,anon,authenticated;
grant select,insert,update,delete on public.audit_findings to service_role;
alter table public.audit_finding_evidence enable row level security;
revoke all on public.audit_finding_evidence from public,anon,authenticated;
grant select,insert,update,delete on public.audit_finding_evidence to service_role;
alter table public.audit_recommendations enable row level security;
revoke all on public.audit_recommendations from public,anon,authenticated;
grant select,insert,update,delete on public.audit_recommendations to service_role;
alter table public.audit_reports enable row level security;
revoke all on public.audit_reports from public,anon,authenticated;
grant select,insert,update,delete on public.audit_reports to service_role;
alter table public.audit_deliveries enable row level security;
revoke all on public.audit_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.audit_deliveries to service_role;
alter table public.audit_outcomes enable row level security;
revoke all on public.audit_outcomes from public,anon,authenticated;
grant select,insert,update,delete on public.audit_outcomes to service_role;
-- Company operations: service-only records; no purchase or external send is performed by these RPCs.
create table public.nova_cfo_requests(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),request_key text not null,
 service text not null check(service in ('voice','sms','whatsapp','apple_messages','hosted_ai','email','marketing','other')),
 purpose text not null check(length(purpose) between 5 and 2000),max_cost_cents integer check(max_cost_cents between 1 and 10000000),currency text not null default 'USD' check(currency='USD'),
 status text not null check(status in ('quote_required','awaiting_owner','approved','rejected','revoked')),cfo_memo text not null,
 requested_by uuid,decided_by uuid,decided_at timestamptz,expires_at timestamptz,reserved_cents integer not null default 0 check(reserved_cents>=0),created_at timestamptz not null default now(),
 unique(organization_id,request_key),check(max_cost_cents is null or reserved_cents<=max_cost_cents)
);
create index nova_cfo_org_status on public.nova_cfo_requests(organization_id,status,created_at desc);
create table public.nova_company_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),run_key text not null,worker_key text not null,
 state text not null check(state in ('completed','draft','budget_blocked','action_required','failed')),summary text not null,body jsonb not null default '{}',
 contact_id uuid references public.nova_crm_contacts(id),task_id uuid references public.nova_tasks(id),is_test boolean not null default false,execution_mode text not null default 'workflow' check(execution_mode in ('workflow','on_device_llm','hosted_llm')),
 created_by uuid,created_at timestamptz not null default now(),unique(organization_id,run_key)
);
create index nova_company_runs_org_created on public.nova_company_runs(organization_id,created_at desc);
create table public.nova_company_settings(organization_id uuid primary key references public.organizations(id),auto_reply boolean not null default false,updated_by uuid not null,updated_at timestamptz not null default now());
create table public.nova_audit_field_notes(case_id uuid not null references public.audit_cases(id),section_key text not null check(section_key in ('intake','booking','payments','software','experience','marketing','follow_up','security')),observation text not null default '' check(length(observation)<=3000),source text not null default '' check(length(source)<=400),confidence text not null default 'medium' check(confidence in ('low','medium','high')),steps jsonb not null default '[false,false,false]',evidence_id uuid references public.audit_evidence(id),tags text not null default '' check(length(tags)<=200),photo_path text not null default '' check(length(photo_path)<=400),updated_by uuid not null,updated_at timestamptz not null default now(),primary key(case_id,section_key));
create table public.nova_crm_identity_links(organization_id uuid not null references public.organizations(id),legacy_contact_id uuid not null references public.nova_crm_contacts(id),crm_contact_id uuid not null references public.crm_contacts(id),primary key(organization_id,legacy_contact_id));
create table public.nova_voice_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),external_call_id text not null,contact_id uuid not null references public.nova_crm_contacts(id),task_id uuid not null references public.nova_tasks(id),is_test boolean not null default false,transcript jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,external_call_id));

create function public.nova_company_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_id uuid;v_key text;v_service text;v_purpose text;v_amount integer;v_budget public.nova_cfo_requests;v_run public.nova_worker_runs;v_slot public.nova_booking_slots;v_contact public.nova_crm_contacts;v_note public.nova_audit_field_notes;v_case public.audit_cases;v_task uuid;v_evidence uuid;v_count integer:=0;v_body text;v_test boolean:=false;v_voice public.nova_voice_sessions;v_steps jsonb;
begin
 select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.status='active' and m.role='nova_super_admin' order by o.created_at limit 1;
 if v_org is null then return jsonb_build_object('ok',false,'code','owner_required');end if;
 if p_action='overview' then
  return jsonb_build_object('ok',true,'revenue_cents',null,'budgets',coalesce((select jsonb_agg(to_jsonb(b) order by created_at desc) from (select * from public.nova_cfo_requests where organization_id=v_org order by created_at desc limit 100)b),'[]'::jsonb),'runs',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from (select * from public.nova_company_runs where organization_id=v_org order by created_at desc limit 100)r),'[]'::jsonb),'voice_sessions',coalesce((select jsonb_agg(to_jsonb(s) order by updated_at desc) from(select * from public.nova_voice_sessions where organization_id=v_org order by updated_at desc limit 30)s),'[]'::jsonb),'auto_reply',coalesce((select auto_reply from public.nova_company_settings where organization_id=v_org),false));
 end if;
 if p_action='request_budget' then
  v_service:=p_payload->>'service';v_purpose:=trim(p_payload->>'purpose');v_key:=p_payload->>'request_key';v_amount:=nullif(p_payload->>'max_cost_cents','')::integer;
  if v_service is null or v_service not in ('voice','sms','whatsapp','apple_messages','hosted_ai','email','marketing','other') or v_purpose is null or length(v_purpose) not between 5 and 2000 or v_key is null or length(v_key) not between 5 and 200 or (v_amount is not null and (v_amount<1 or v_amount>10000000)) then return jsonb_build_object('ok',false,'code','invalid_budget');end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-budget:'||v_org::text||v_key,0));
  select * into v_budget from public.nova_cfo_requests where organization_id=v_org and request_key=v_key;
  if found then
   if v_budget.service<>v_service or v_budget.purpose<>v_purpose or v_budget.max_cost_cents is distinct from v_amount then return jsonb_build_object('ok',false,'code','request_conflict');end if;
   return jsonb_build_object('ok',true,'duplicate',true,'budget',to_jsonb(v_budget));end if;
  insert into public.nova_cfo_requests(organization_id,request_key,service,purpose,max_cost_cents,status,cfo_memo,requested_by)
   values(v_org,v_key,v_service,v_purpose,v_amount,case when v_amount is null then 'quote_required' else 'awaiting_owner' end,
    case when v_amount is null then 'CFO review: obtain a current provider quote and a spending cap. Do not activate this service or spend funds.' else 'CFO review: this is a proposed maximum, not a verified vendor price. Isaac must explicitly approve the stated USD cap before any spending. No account settings are changed by approval.' end,p_actor) returning * into v_budget;
  return jsonb_build_object('ok',true,'budget',to_jsonb(v_budget),'spending_enabled',false);
 end if;
 if p_action in ('approve_budget','reject_budget','revoke_budget') then
  select * into v_budget from public.nova_cfo_requests where id=(p_payload->>'id')::uuid and organization_id=v_org for update;
  if not found then return jsonb_build_object('ok',false,'code','budget_not_found');end if;
  if p_action='approve_budget' then
   if v_budget.status<>'awaiting_owner' or v_budget.max_cost_cents is null or (p_payload->>'approved_max_cost_cents')::integer is distinct from v_budget.max_cost_cents then return jsonb_build_object('ok',false,'code','budget_changed');end if;
   update public.nova_cfo_requests set status='approved',decided_by=p_actor,decided_at=now(),expires_at=now()+interval '7 days' where id=v_budget.id;
  elsif p_action='reject_budget' then
   if v_budget.status not in ('quote_required','awaiting_owner') then return jsonb_build_object('ok',false,'code','budget_changed');end if;
   update public.nova_cfo_requests set status='rejected',decided_by=p_actor,decided_at=now() where id=v_budget.id;
  else
   if v_budget.status<>'approved' then return jsonb_build_object('ok',false,'code','budget_changed');end if;
   update public.nova_cfo_requests set status='revoked',decided_by=p_actor,decided_at=now() where id=v_budget.id;
  end if;
  return jsonb_build_object('ok',true,'spending_enabled',false);
 end if;
 if p_action='auto_reply' then
  if jsonb_typeof(p_payload->'enabled')<>'boolean' then return jsonb_build_object('ok',false,'code','invalid_action');end if;
  insert into public.nova_company_settings(organization_id,auto_reply,updated_by)values(v_org,(p_payload->>'enabled')::boolean,p_actor) on conflict(organization_id)do update set auto_reply=excluded.auto_reply,updated_by=p_actor,updated_at=now();
  return jsonb_build_object('ok',true,'auto_reply',(p_payload->>'enabled')::boolean,'spending_enabled',false);
 end if;
 if p_action='run_committee' then
  v_id:=(p_payload->>'run_id')::uuid;v_test:=coalesce((p_payload->>'is_test')::boolean,false);
  if v_id is null then return jsonb_build_object('ok',false,'code','invalid_action');end if;
  v_key:='committee:'||v_id::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-committee:'||v_org::text,0));
  if exists(select 1 from public.nova_company_runs where organization_id=v_org and run_key=v_key) then return jsonb_build_object('ok',true,'duplicate',true);end if;
  for v_contact in select c.* from public.nova_crm_contacts c where c.id in (select contact_id from public.nova_worker_runs where organization_id=v_org and state<>'cancelled' and is_test=v_test union select contact_id from public.nova_channel_threads where organization_id=v_org and status='open' and is_test=v_test) order by c.created_at desc limit 25 loop
   if exists(select 1 from public.nova_company_runs where organization_id=v_org and run_key='followup:'||v_contact.id::text) then continue;end if;
   v_body:='Hi '||coalesce(nullif(v_contact.owner_name,''),'there')||', I’m Nova’s assistant. Thanks for reaching out'||case when nullif(v_contact.business_name,'') is not null then ' about '||v_contact.business_name else '' end||'. Which part of handling customer inquiries or booking appointments needs the most attention? You can share the details or choose an available introduction at https://nova-systems.app/service-request. Scope and pricing are confirmed after we understand what you need.';
   insert into public.nova_tasks(organization_id,engine,title,description,contact_id,assigned_to,trigger_type,status)values(v_org,'harvest',case when v_test then 'TEST · ' else '' end||'Review prepared customer follow-up',v_body||E'\nDraft only. No external message has been sent.',v_contact.id,'Isaac Nova','committee_followup','pending')returning id into v_task;
   insert into public.nova_company_runs(organization_id,run_key,worker_key,state,summary,body,contact_id,task_id,is_test,created_by) values(v_org,'followup:'||v_contact.id::text,'harvest','draft','Prepared a CRM follow-up and review task',jsonb_build_object('message',v_body,'sent',false),v_contact.id,v_task,v_test,p_actor);
   insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_contact.id,'harvest','internal',v_body,'draft_not_sent');v_count:=v_count+1;
  end loop;
  insert into public.nova_tasks(organization_id,engine,title,description,assigned_to,trigger_type,status)values(v_org,'marketing_committee',case when v_test then 'TEST · ' else '' end||'Review launch campaign brief','Review the prepared launch copy in Workers. Confirm the destination account and channel readiness before publication. No ad spend is authorized.','Isaac Nova','committee_launch','pending')returning id into v_task;
  insert into public.nova_company_runs(organization_id,run_key,worker_key,state,summary,body,task_id,is_test,created_by)values(v_org,'marketing:'||v_id::text,'marketing','draft','Prepared launch copy and an owner review task',jsonb_build_object('headline','Less chasing. More getting it done.','caption','Customer inquiries getting scattered across calls and messages? Nova Systems helps organize requests, appointment booking and follow-up into a clear workflow. Tell us what needs attention: https://nova-systems.app/service-request','comment_cta','Message NOVA to discuss your business workflow.','outreach_opener','Hi, I’m Isaac from Nova Systems in Waterbury. How does your team handle a new inquiry while everyone is working? I’m speaking with local business owners about simplifying intake and booking.','published',false,'price','Scope and pricing require an owner-approved proposal.'),v_task,v_test,p_actor);
  if not v_test then
   foreach v_service in array array['voice','hosted_ai','whatsapp','apple_messages'] loop
    insert into public.nova_cfo_requests(organization_id,request_key,service,purpose,status,cfo_memo,requested_by)values(v_org,'launch-provider:'||v_service,v_service,'Obtain the provider quote, verify the account and propose a capped activation budget for '||v_service||'.','quote_required','CFO review: no provider price or allowance has been verified. Keep spending blocked and request Isaac’s decision on a quoted cap.',p_actor)on conflict(organization_id,request_key)do nothing;
   end loop;
  end if;
  insert into public.nova_company_runs(organization_id,run_key,worker_key,state,summary,body,is_test,created_by)values(v_org,v_key,'launch_committee','completed','Prepared '||v_count::text||' CRM follow-ups, launch copy and review tasks',jsonb_build_object('followup_drafts',v_count,'marketing_drafts',1,'external_messages_sent',0,'purchases',0),v_test,p_actor);
  return jsonb_build_object('ok',true,'followup_drafts',v_count,'marketing_drafts',1,'external_messages_sent',0,'spending_enabled',false);
 end if;
 if p_action in ('audit_field','save_audit_field') then
  select * into v_case from public.audit_cases where id=(p_payload->>'case_id')::uuid and organization_id=v_org;
  if not found then return jsonb_build_object('ok',false,'code','case_not_found');end if;
  if p_action='save_audit_field' then
   v_key:=p_payload->>'section_key';v_steps:=p_payload->'steps';
   if length(coalesce(p_payload->>'tags',''))>200 or length(coalesce(p_payload->>'photo_path',''))>400 or v_key is null or v_key not in ('intake','booking','payments','software','experience','marketing','follow_up','security') or v_steps is null or jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps)<>3 or exists(select 1 from jsonb_array_elements(v_steps) as t(value) where jsonb_typeof(t.value)<>'boolean') or length(coalesce(p_payload->>'observation',''))>3000 or length(coalesce(p_payload->>'source',''))>400 or coalesce(p_payload->>'confidence','medium') not in ('low','medium','high') then return jsonb_build_object('ok',false,'code','invalid_evidence');end if;
   if (v_steps->>1)::boolean and (length(trim(coalesce(p_payload->>'observation','')))<5 or length(trim(coalesce(p_payload->>'source','')))<2) then return jsonb_build_object('ok',false,'code','evidence_required');end if;
   select * into v_note from public.nova_audit_field_notes where case_id=v_case.id and section_key=v_key;
   v_evidence:=v_note.evidence_id;
   if length(trim(coalesce(p_payload->>'observation','')))>=5 and length(trim(coalesce(p_payload->>'source','')))>=2 then
    if v_evidence is null then
     insert into public.audit_evidence(case_id,source,method,observation,author,confidence,source_quality,privacy_level,snapshot_path)values(v_case.id,p_payload->>'source','In-person assessment: '||v_key,p_payload->>'observation',p_actor::text,coalesce(p_payload->>'confidence','medium'),'medium','internal',nullif(p_payload->>'photo_path',''))returning id into v_evidence;
    else update public.audit_evidence set source=p_payload->>'source',observation=p_payload->>'observation',confidence=coalesce(p_payload->>'confidence','medium'),capture_date=now(),snapshot_path=nullif(p_payload->>'photo_path','') where id=v_evidence and case_id=v_case.id;end if;
   end if;
   insert into public.nova_audit_field_notes(case_id,section_key,observation,source,confidence,steps,evidence_id,tags,photo_path,updated_by)values(v_case.id,v_key,coalesce(p_payload->>'observation',''),coalesce(p_payload->>'source',''),coalesce(p_payload->>'confidence','medium'),v_steps,v_evidence,coalesce(p_payload->>'tags',''),coalesce(p_payload->>'photo_path',''),p_actor)on conflict(case_id,section_key)do update set observation=excluded.observation,source=excluded.source,confidence=excluded.confidence,steps=excluded.steps,evidence_id=excluded.evidence_id,tags=excluded.tags,photo_path=excluded.photo_path,updated_by=p_actor,updated_at=now();
   update public.audit_cases set updated_at=now() where id=v_case.id;
  end if;
  return jsonb_build_object('ok',true,'case',to_jsonb(v_case),'business',(select to_jsonb(b) from public.businesses b where id=v_case.business_id),'notes',coalesce((select jsonb_agg(to_jsonb(n)) from public.nova_audit_field_notes n where case_id=v_case.id),'[]'::jsonb));
 end if;
 if p_action='reschedule' then
  v_id:=(p_payload->>'request_id')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-request:'||v_id::text,0));
  select * into v_run from public.nova_worker_runs where request_id=v_id and organization_id=v_org for update;
  if not found or v_run.state<>'booked' then return jsonb_build_object('ok',false,'code','request_not_active');end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-launch-calendar:'||v_org::text,0));
  select * into v_slot from public.nova_booking_slots where id=(p_payload->>'slot_id')::uuid and organization_id=v_org for update;
  if not found or v_slot.status<>'available' or v_slot.is_test<>v_run.is_test or v_slot.starts_at<=now()+interval '30 minutes' or v_slot.starts_at>=now()+interval '60 days' or exists(select 1 from public.nova_booking_slots where id=v_run.slot_id and starts_at<=now()) then return jsonb_build_object('ok',false,'code','slot_unavailable');end if;
  update public.nova_booking_slots set status='available',request_id=null where id=v_run.slot_id and request_id=v_id;
  update public.nova_booking_slots set status='booked',request_id=v_id where id=v_slot.id;
  update public.nova_book_meetings set meeting_date=(v_slot.starts_at at time zone 'America/New_York')::date,meeting_time=to_char(v_slot.starts_at at time zone 'America/New_York','HH24:MI') where id=v_run.meeting_id;
  update public.intake_requests set meeting_date=to_char(v_slot.starts_at at time zone 'America/New_York','YYYY-MM-DD'),meeting_time=to_char(v_slot.starts_at at time zone 'America/New_York','HH24:MI') where id=v_id;
  update public.nova_worker_runs set slot_id=v_slot.id,updated_at=now() where request_id=v_id;
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_run.contact_id,'scheduling','internal','Appointment rescheduled to '||v_slot.starts_at::text||'. No customer notification sent.',case when v_run.is_test then 'test_only' else 'rescheduled' end);
  return jsonb_build_object('ok',true,'starts_at',v_slot.starts_at,'notification_sent',false);
 end if;
 if p_action='voice_practice' then
  v_key:=p_payload->>'session_id';v_body:=trim(p_payload->>'text');
  if v_key is null or length(v_key) not between 10 and 100 or v_body is null or length(v_body) not between 1 and 2000 then return jsonb_build_object('ok',false,'code','invalid_message');end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-voice-practice:'||v_org::text||v_key,0));
  select * into v_voice from public.nova_voice_sessions where organization_id=v_org and external_call_id='TEST-'||v_key;
  if not found then
   insert into public.nova_crm_contacts(owner_name,business_name,phone,email,source,status)values('TEST phone customer','TEST voice-agent practice','+12035550198','voice-practice@example.invalid','test_voice_practice','new_lead')returning * into v_contact;
   insert into public.nova_tasks(organization_id,engine,title,description,contact_id,status,trigger_type)values(v_org,'voice','TEST · Review phone inquiry',v_body,v_contact.id,'pending','test_voice_inbound')returning id into v_task;
   insert into public.nova_voice_sessions(organization_id,external_call_id,contact_id,task_id,is_test)values(v_org,'TEST-'||v_key,v_contact.id,v_task,true)returning * into v_voice;
  end if;
  if jsonb_array_length(v_voice.transcript)>=30 then return jsonb_build_object('ok',false,'code','practice_limit');end if;
  v_steps:=v_voice.transcript||jsonb_build_array(jsonb_build_object('direction','inbound','text',v_body,'at',now()));
  if length(trim(coalesce(p_payload->>'reply','')))>0 then v_steps:=v_steps||jsonb_build_array(jsonb_build_object('direction','outbound','text',left(p_payload->>'reply',2000),'at',now(),'mode','reviewed_practice'));end if;
  update public.nova_voice_sessions set transcript=v_steps,updated_at=now() where id=v_voice.id;
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_voice.contact_id,'voice','inbound',v_body,'test_voice_transcript_not_called');
  return jsonb_build_object('ok',true,'session_id',v_voice.id,'contact_id',v_voice.contact_id,'task_id',v_voice.task_id,'transcript',v_steps,'phone_call_made',false);
 end if;
 return jsonb_build_object('ok',false,'code','invalid_action');
end;$$;

-- Server-only read of owner-selected automation settings, never a browser credential bypass.
create function public.nova_company_automation(p_thread uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_build_object('ok',true,'enabled',coalesce(s.auto_reply,false),'actor',s.updated_by,'thread',to_jsonb(t),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by created_at)from(select * from public.nova_channel_messages where thread_id=t.id order by created_at desc limit 12)m),'[]'::jsonb)) from public.nova_channel_threads t left join public.nova_company_settings s on s.organization_id=t.organization_id where t.id=p_thread and t.status='open'),'{}'::jsonb);
$$;

create function public.nova_bridge_channel_contact()returns trigger language plpgsql security invoker set search_path='' as $$
declare v_legacy public.nova_crm_contacts;v_new uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-crm-link:'||new.organization_id::text||new.contact_id::text,0));
 if exists(select 1 from public.nova_crm_identity_links where organization_id=new.organization_id and legacy_contact_id=new.contact_id)then return new;end if;
 select * into v_legacy from public.nova_crm_contacts where id=new.contact_id;
 insert into public.crm_contacts(organization_id,name,email,phone,source,sms_consent,email_consent,do_not_contact)values(new.organization_id,coalesce(v_legacy.owner_name,'Customer inquiry'),v_legacy.email,v_legacy.phone,v_legacy.source,false,false,false)returning id into v_new;
 insert into public.nova_crm_identity_links(organization_id,legacy_contact_id,crm_contact_id)values(new.organization_id,new.contact_id,v_new);
 return new;
end;$$;
create trigger nova_channel_crm_bridge after insert on public.nova_channel_threads for each row execute function public.nova_bridge_channel_contact();
create trigger nova_booking_crm_bridge after insert on public.nova_worker_runs for each row execute function public.nova_bridge_channel_contact();
create trigger nova_voice_crm_bridge after insert on public.nova_voice_sessions for each row execute function public.nova_bridge_channel_contact();

do $$declare name text;begin foreach name in array array['nova_cfo_requests','nova_company_runs','nova_company_settings','nova_audit_field_notes','nova_crm_identity_links','nova_voice_sessions']loop execute format('alter table public.%I enable row level security',name);execute format('revoke all on public.%I from public,anon,authenticated',name);execute format('grant select,insert,update on public.%I to service_role',name);end loop;end$$;
revoke all on function public.nova_company_owner(uuid,text,jsonb),public.nova_company_automation(uuid),public.nova_bridge_channel_contact() from public,anon,authenticated;
grant execute on function public.nova_company_owner(uuid,text,jsonb),public.nova_company_automation(uuid),public.nova_bridge_channel_contact() to service_role;

-- Existing account storage: a private bucket for authorized audit evidence.
insert into storage.buckets(id,name,public)values('nova-vault','nova-vault',false)on conflict(id)do nothing;
