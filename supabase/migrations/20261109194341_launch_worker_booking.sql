-- Nova's production launch workflow uses the existing CRM/intake tables.
-- All writes are atomic. No model, email, SMS, call, payment or external calendar is invoked.
create table public.nova_booking_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check(status in ('available','booked','cancelled')),
  is_test boolean not null default false,
  request_id uuid unique references public.intake_requests(id),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check(ends_at > starts_at and ends_at <= starts_at + interval '4 hours'),
  check((status = 'booked') = (request_id is not null))
);
create index nova_booking_slots_org_start_idx on public.nova_booking_slots(organization_id,starts_at);
create index nova_booking_slots_available_idx on public.nova_booking_slots(organization_id,is_test,starts_at) where status='available';
alter table public.nova_booking_slots enable row level security;
revoke all on public.nova_booking_slots from public,anon,authenticated;
grant select,insert,update on public.nova_booking_slots to service_role;

create table public.nova_worker_runs (
  request_id uuid primary key references public.intake_requests(id),
  organization_id uuid not null references public.organizations(id),
  contact_id uuid not null references public.nova_crm_contacts(id),
  slot_id uuid references public.nova_booking_slots(id),
  meeting_id uuid references public.nova_book_meetings(id),
  task_id uuid not null references public.nova_tasks(id),
  service_key text not null,
  state text not null check(state in ('request_ready','booked','cancelled')),
  management_hash text not null check(management_hash ~ '^[0-9a-f]{64}$'),
  playbook_version text not null default 'nova-intake-booking-2026-11-09',
  execution_mode text not null default 'workflow' check(execution_mode='workflow'),
  is_test boolean not null default false,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nova_worker_runs_org_created_idx on public.nova_worker_runs(organization_id,created_at desc);
create index nova_worker_runs_contact_idx on public.nova_worker_runs(contact_id);
create index nova_worker_runs_slot_idx on public.nova_worker_runs(slot_id) where slot_id is not null;
create index nova_worker_runs_meeting_idx on public.nova_worker_runs(meeting_id) where meeting_id is not null;
create index nova_worker_runs_task_idx on public.nova_worker_runs(task_id);
alter table public.nova_worker_runs enable row level security;
revoke all on public.nova_worker_runs from public,anon,authenticated;
grant select,insert,update on public.nova_worker_runs to service_role;
grant select,insert,update on public.nova_tasks,public.nova_book_meetings,public.intake_requests,public.nova_crm_activities to service_role;
grant update on public.nova_service_sms_receipts to service_role;

create function public.nova_launch_availability(p_test boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('ok',true,'timezone','America/New_York','slots',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'kind','phone') order by s.starts_at)
    from (select bs.* from public.nova_booking_slots bs join public.organizations o on o.id=bs.organization_id
      where o.kind='nova_internal' and o.status='active' and bs.status='available' and bs.is_test=p_test
        and bs.starts_at>now()+interval '30 minutes' and bs.starts_at<now()+interval '60 days'
      order by bs.starts_at limit 80) s
  ),'[]'::jsonb));
$$;

create function public.nova_launch_request(p_request jsonb,p_management_hash text,p_service text,p_slot uuid default null,p_test boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_id uuid := (p_request->>'request_id')::uuid;
  v_org uuid; v_base jsonb; v_contact uuid; v_task uuid; v_meeting uuid;
  v_slot public.nova_booking_slots; v_run public.nova_worker_runs;
  v_state text; v_steps jsonb;
begin
  if v_id is null or p_management_hash is null or p_management_hash !~ '^[0-9a-f]{64}$'
    or p_service is null or p_service not in ('calls','messages','booking','follow_up','systems','not_sure')
    or p_test is null then raise exception 'Invalid worker request' using errcode='22023'; end if;
  if p_test and (coalesce(p_request->>'email','') !~ '^[^@]+@example\.invalid$'
    or (nullif(p_request->>'phone_e164','') is not null and p_request->>'phone_e164' !~ '^\+1[2-9][0-9]{2}55501[0-9]{2}$'))
    then raise exception 'Test requests require reserved test contact details' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-request:'||v_id::text,0));
  select * into v_run from public.nova_worker_runs where request_id=v_id;
  if found then
    if v_run.management_hash <> p_management_hash then return jsonb_build_object('ok',false,'code','request_conflict'); end if;
    if v_run.slot_id is not null then select * into v_slot from public.nova_booking_slots where id=v_run.slot_id; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'reference',v_id,'state',v_run.state,'steps',v_run.steps,
      'service_sms_consent',(select service_sms_consent from public.nova_service_sms_receipts where request_id=v_id),
      'booking',case when v_run.state='booked' then jsonb_build_object('starts_at',v_slot.starts_at,'ends_at',v_slot.ends_at,'kind','phone') else null end);
  end if;
  -- A legacy receipt cannot be adopted by a caller who guessed/reused its UUID.
  if exists(select 1 from public.nova_service_sms_receipts where request_id=v_id) then return jsonb_build_object('ok',false,'code','request_conflict'); end if;
  select id into v_org from public.organizations where kind='nova_internal' and status='active' order by created_at limit 1;
  if v_org is null then raise exception 'Nova organization unavailable'; end if;
  -- Every scheduling mutation takes this same lock: no overlapping publication or double booking.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-launch-calendar:'||v_org::text,0));
  if p_slot is not null then
    select * into v_slot from public.nova_booking_slots where id=p_slot and organization_id=v_org for update;
    if not found or v_slot.status<>'available' or v_slot.is_test<>p_test
      or v_slot.starts_at<=now()+interval '30 minutes' or v_slot.starts_at>=now()+interval '60 days'
      then return jsonb_build_object('ok',false,'code','slot_unavailable'); end if;
    if nullif(p_request->>'phone_e164','') is null then return jsonb_build_object('ok',false,'code','phone_required'); end if;
  end if;
  v_base := public.record_nova_service_request(p_request);
  select contact_id into v_contact from public.nova_service_sms_receipts where request_id=v_id;
  if v_contact is null then raise exception 'Request contact unavailable'; end if;
  v_state := case when p_slot is not null then 'booked' else 'request_ready' end;
  update public.intake_requests set needs=array[p_service],status=case when p_slot is null then 'pending' else 'confirmed' end,
    referral_source=case when p_test then 'test_worker_launch' else 'worker_launch_web' end,
    meeting_date=case when p_slot is not null then to_char(v_slot.starts_at at time zone 'America/New_York','YYYY-MM-DD') else null end,
    meeting_time=case when p_slot is not null then to_char(v_slot.starts_at at time zone 'America/New_York','HH24:MI') else null end where id=v_id;
  if p_test then update public.nova_service_sms_receipts set is_test=true where request_id=v_id; end if;
  if p_slot is not null then
    insert into public.nova_book_meetings(contact_id,contact_name,contact_email,contact_phone,meeting_type,meeting_date,meeting_time,status,notes)
    values(v_contact,p_request->>'name',p_request->>'email',p_request->>'phone_e164','Nova introduction',
      (v_slot.starts_at at time zone 'America/New_York')::date,to_char(v_slot.starts_at at time zone 'America/New_York','HH24:MI'),'confirmed',
      case when p_test then 'TEST ONLY. ' else '' end||'Request '||v_id::text||'. Published Nova availability. Phone appointment; no external calendar sync.') returning id into v_meeting;
    update public.nova_booking_slots set status='booked',request_id=v_id where id=p_slot;
  end if;
  insert into public.nova_tasks(organization_id,engine,title,description,contact_id,assigned_to,trigger_type,status)
  values(v_org,'booking_worker',case when p_test then 'TEST — ' else '' end||case when p_slot is null then 'Review new service request' else 'Prepare booked Nova introduction' end,
    'Request '||v_id::text||E'\nService: '||p_service||E'\nBusiness: '||coalesce(p_request->>'business_name','')||
    E'\nCustomer request: '||coalesce(p_request->>'message','')||
    case when p_slot is null then E'\nAppointment not booked. Arrange a time with this customer.' else E'\nPhone appointment: '||v_slot.starts_at::text end||
    E'\nUse this request only; no marketing consent. SMS, calls, email and paid AI were not dispatched.',
    v_contact,'Isaac Nova','inbound_service_request','pending') returning id into v_task;
  v_steps:=jsonb_build_array(
    jsonb_build_object('key','request','label','Request and service need captured','status','completed'),
    jsonb_build_object('key','crm','label','CRM contact and activity saved','status','completed'),
    jsonb_build_object('key','consent','label','Your exact text-message choice recorded','status','completed'),
    jsonb_build_object('key','booking','label',case when p_slot is null then 'Appointment time still to be arranged' else 'Published appointment time reserved' end,'status',case when p_slot is null then 'pending' else 'completed' end),
    jsonb_build_object('key','task','label','Follow-up task created for Nova','status','completed'));
  insert into public.nova_worker_runs(request_id,organization_id,contact_id,slot_id,meeting_id,task_id,service_key,state,management_hash,is_test,steps)
  values(v_id,v_org,v_contact,p_slot,v_meeting,v_task,p_service,v_state,p_management_hash,p_test,v_steps);
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)
  values(v_contact,'booking_worker','internal','Request '||v_id::text||': '||v_state||'; follow-up task '||v_task::text||'. No outbound message sent.',case when p_test then 'test_only' else v_state end);
  return jsonb_build_object('ok',true,'duplicate',false,'reference',v_id,'state',v_state,'steps',v_steps,
    'service_sms_consent',coalesce((p_request->'service_sms_consent')='true'::jsonb,false),
    'booking',case when p_slot is not null then jsonb_build_object('starts_at',v_slot.starts_at,'ends_at',v_slot.ends_at,'kind','phone') else null end);
end;
$$;

create function public.nova_launch_cancel(p_request_id uuid,p_management_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_run public.nova_worker_runs; v_steps jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-request:'||p_request_id::text,0));
  select * into v_run from public.nova_worker_runs where request_id=p_request_id for update;
  if not found or v_run.management_hash<>p_management_hash then return jsonb_build_object('ok',false,'code','request_not_found'); end if;
  if v_run.state='cancelled' then return jsonb_build_object('ok',true,'state','cancelled','duplicate',true); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-launch-calendar:'||v_run.organization_id::text,0));
  if v_run.slot_id is not null then
    if exists(select 1 from public.nova_booking_slots where id=v_run.slot_id and starts_at<=now())
      then return jsonb_build_object('ok',false,'code','appointment_started'); end if;
    update public.nova_booking_slots set status='available',request_id=null where id=v_run.slot_id and request_id=p_request_id;
    update public.nova_book_meetings set status='cancelled' where id=v_run.meeting_id;
  end if;
  update public.intake_requests set status='cancelled' where id=p_request_id;
  update public.nova_tasks set status='cancelled',completed_at=now() where id=v_run.task_id;
  v_steps:=v_run.steps||jsonb_build_array(jsonb_build_object('key','cancel','label','Request cancelled and appointment released','status','completed'));
  update public.nova_worker_runs set state='cancelled',steps=v_steps,updated_at=now() where request_id=p_request_id;
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)
  values(v_run.contact_id,'booking_worker','inbound','Customer cancelled request '||p_request_id::text,case when v_run.is_test then 'test_only' else 'cancelled' end);
  return jsonb_build_object('ok',true,'state','cancelled','duplicate',false);
end;
$$;

create function public.nova_launch_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_id uuid; v_start timestamptz; v_end timestamptz; v_test boolean;
begin
  select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id
    where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.status='active'
      and m.role='nova_super_admin' order by o.created_at limit 1;
  if v_org is null then return jsonb_build_object('ok',false,'code','owner_required'); end if;
  if p_action in ('add_slot','withdraw_slot') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-launch-calendar:'||v_org::text,0));
    if p_action='add_slot' then
      v_start:=(p_payload->>'starts_at')::timestamptz; v_end:=(p_payload->>'ends_at')::timestamptz;
      v_test:=coalesce(p_payload->'is_test'='true'::jsonb,false);
      if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end)
        or v_start<=now()+interval '30 minutes' or v_start>=now()+interval '60 days'
        or v_end<=v_start or v_end>v_start+interval '4 hours'
        then return jsonb_build_object('ok',false,'code','invalid_slot'); end if;
      if exists(select 1 from public.nova_booking_slots where organization_id=v_org and is_test=v_test and status<>'cancelled'
        and starts_at<v_end and ends_at>v_start) then return jsonb_build_object('ok',false,'code','slot_overlap'); end if;
      insert into public.nova_booking_slots(organization_id,starts_at,ends_at,is_test,created_by)
        values(v_org,v_start,v_end,v_test,p_actor) returning id into v_id;
    else
      v_id:=(p_payload->>'id')::uuid;
      update public.nova_booking_slots set status='cancelled' where id=v_id and organization_id=v_org and status='available';
      if not found then return jsonb_build_object('ok',false,'code','slot_not_available'); end if;
    end if;
  elsif p_action<>'overview' then return jsonb_build_object('ok',false,'code','unknown_action'); end if;
  return jsonb_build_object('ok',true,'slot_id',v_id,'timezone','America/New_York',
    'slots',coalesce((select jsonb_agg(to_jsonb(s)-'created_by' order by starts_at) from (select * from public.nova_booking_slots where organization_id=v_org and ends_at>now()-interval '1 day' order by starts_at limit 150)s),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from (
      select w.request_id,w.service_key,w.state,w.is_test,w.steps,w.created_at,w.execution_mode,w.task_id,
        i.name,i.business_name,i.email,i.phone,i.notes,s.starts_at,s.ends_at,t.status as follow_up_status
      from public.nova_worker_runs w join public.intake_requests i on i.id=w.request_id
      join public.nova_tasks t on t.id=w.task_id left join public.nova_booking_slots s on s.id=w.slot_id
      where w.organization_id=v_org order by w.created_at desc limit 40)r),'[]'::jsonb));
end;
$$;

revoke all on function public.nova_launch_availability(boolean),public.nova_launch_request(jsonb,text,text,uuid,boolean),public.nova_launch_cancel(uuid,text),public.nova_launch_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nova_launch_availability(boolean),public.nova_launch_request(jsonb,text,text,uuid,boolean),public.nova_launch_cancel(uuid,text),public.nova_launch_owner(uuid,text,jsonb) to service_role;
grant select on public.organization_members to service_role;
