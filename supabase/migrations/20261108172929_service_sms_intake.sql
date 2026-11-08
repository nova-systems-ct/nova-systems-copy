-- Existing production intake/CRM tables are kept. A service request is not an
-- appointment, so an optional phone and unassigned meeting may be NULL.
alter table public.intake_requests alter column phone drop not null;
alter table public.intake_requests alter column meeting_date drop not null;
alter table public.intake_requests alter column meeting_time drop not null;

create table public.nova_service_sms_receipts (
  request_id uuid primary key references public.intake_requests(id),
  organization_id uuid not null references public.organizations(id),
  contact_id uuid not null references public.nova_crm_contacts(id),
  service_sms_consent boolean not null,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  scope text not null default 'service_request_only' check (scope = 'service_request_only'),
  marketing_consent boolean not null default false check (marketing_consent = false),
  disclosure_version text not null default 'nova-service-sms-web-2026-11-08',
  disclosure text not null default 'I agree to receive automated service text messages from Nova Systems about this request, including booking links, appointment reminders and requested service updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is optional and is not a condition of purchase.',
  source_path text not null default '/service-request',
  privacy_path text not null default '/service-texts/privacy',
  terms_path text not null default '/service-texts/terms',
  received_at timestamptz not null default clock_timestamp(),
  is_test boolean not null default false,
  check (not service_sms_consent or phone_e164 is not null)
);
alter table public.nova_service_sms_receipts enable row level security;
create index nova_service_sms_receipts_org_time_idx on public.nova_service_sms_receipts(organization_id,received_at desc);
create index nova_service_sms_receipts_contact_idx on public.nova_service_sms_receipts(contact_id);
-- No anonymous or signed-in-client policy: this evidence is server-only.
revoke all on public.nova_service_sms_receipts from public, anon, authenticated;
grant select, insert on public.nova_service_sms_receipts to service_role;

create function public.record_nova_service_request(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_request->>'request_id')::uuid;
  v_name text := p_request->>'name';
  v_business text := p_request->>'business_name';
  v_email text := lower(p_request->>'email');
  v_phone text := nullif(p_request->>'phone_e164','');
  v_message text := coalesce(p_request->>'message','');
  v_consent boolean := coalesce((p_request->'service_sms_consent') = 'true'::jsonb, false);
  v_org uuid;
  v_contact uuid;
begin
  if v_id is null or nullif(btrim(v_name),'') is null or nullif(btrim(v_business),'') is null
    or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_name)>100 or length(v_business)>200 or length(v_email)>254 or length(v_message)>2000
    or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
    or (v_consent and v_phone is null)
    or coalesce(p_request->>'disclosure_version','') <> 'nova-service-sms-web-2026-11-08'
  then raise exception 'Invalid service request' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-request:'||v_id::text,0));
  if exists (select 1 from public.nova_service_sms_receipts where request_id=v_id) then
    return jsonb_build_object('ok',true,'duplicate',true,'reference',v_id);
  end if;
  select id into v_org from public.organizations where kind='nova_internal' order by created_at limit 1;
  if v_org is null then raise exception 'Nova request organization is not configured'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-contact:'||v_email,0));
  select id into v_contact from public.nova_crm_contacts
    where lower(email)=v_email or (v_phone is not null and phone=v_phone)
    order by case when lower(email)=v_email then 0 else 1 end,created_at limit 1;
  if v_contact is null then
    insert into public.nova_crm_contacts(business_name,owner_name,phone,email,source,status,notes)
    values(v_business,v_name,v_phone,v_email,'service_request_web','inbound_request',
      'Service request only. No marketing permission. See request receipt '||v_id::text)
    returning id into v_contact;
  end if;

  insert into public.intake_requests(id,name,business_name,phone,email,needs,notes,referral_source,meeting_date,meeting_time,status)
  values(v_id,v_name,v_business,v_phone,v_email,array[]::text[],
    v_message||E'\n\nService texts for this request: '||case when v_consent then 'requested' else 'not authorized' end
      ||E'. No marketing permission.\nConsent receipt: '||v_id::text,
    'service_request_web',null,null,'pending');
  insert into public.nova_service_sms_receipts(request_id,organization_id,contact_id,service_sms_consent,phone_e164)
  values(v_id,v_org,v_contact,v_consent,v_phone);
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)
  values(v_contact,'web','inbound','Service request '||v_id::text||' received. Service-text choice recorded; no marketing permission.','needs_review');
  -- The transaction records evidence and the lead together. No provider or job is invoked.
  return jsonb_build_object('ok',true,'duplicate',false,'reference',v_id,'service_sms_consent',v_consent);
end;
$$;
revoke all on function public.record_nova_service_request(jsonb) from public,anon,authenticated;
grant execute on function public.record_nova_service_request(jsonb) to service_role;
grant select,insert on public.intake_requests,public.nova_crm_contacts,public.nova_crm_activities to service_role;
grant select on public.organizations to service_role;
