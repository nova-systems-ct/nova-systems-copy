-- Reviewed on-device AI output is saved privately; it never dispatches a message or paid model call.
create table public.nova_worker_drafts(
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 request_id uuid not null references public.nova_worker_runs(request_id),
 agent_key text not null check(agent_key in ('intake','scheduling','follow_up')),
 body text not null check(length(body) between 5 and 4000),
 generation_source text not null default 'on_device_client' check(generation_source='on_device_client'),
 model_id text not null default 'HuggingFaceTB/SmolLM2-360M-Instruct',
 model_revision text not null default 'a10cc1512eabd3dde888204e902eca88bddb4951',
 playbook_version text not null default 'nova-local-workers-2026-11-09',
 reviewed boolean not null default true check(reviewed),
 created_by uuid not null,
 created_at timestamptz not null default now()
);
create index nova_worker_drafts_org_created on public.nova_worker_drafts(organization_id,created_at desc);
create index nova_worker_drafts_request on public.nova_worker_drafts(request_id);
alter table public.nova_worker_drafts enable row level security;
revoke all on public.nova_worker_drafts from public,anon,authenticated;
grant select,insert on public.nova_worker_drafts to service_role;

create or replace function public.nova_launch_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_id uuid; v_start timestamptz; v_end timestamptz; v_test boolean; v_cancel jsonb; v_run public.nova_worker_runs; v_draft public.nova_worker_drafts; v_agent text; v_body text; v_draft_id uuid;
begin
  select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id
    where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.status='active'
      and m.role='nova_super_admin' order by o.created_at limit 1;
  if v_org is null then return jsonb_build_object('ok',false,'code','owner_required'); end if;
  if p_action='save_draft' then
    v_id:=(p_payload->>'id')::uuid; v_draft_id:=(p_payload->>'draft_id')::uuid;
    v_agent:=p_payload->>'agent_key';v_body:=trim(p_payload->>'body');
    if v_draft_id is null or v_agent is null or v_agent not in ('intake','scheduling','follow_up') or v_body is null or length(v_body)<5 or length(v_body)>4000
      then return jsonb_build_object('ok',false,'code','invalid_draft'); end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-service-request:'||v_id::text,0));
    select * into v_run from public.nova_worker_runs where request_id=v_id and organization_id=v_org for update;
    if not found or v_run.state='cancelled' then return jsonb_build_object('ok',false,'code','request_not_active'); end if;
    insert into public.nova_worker_drafts(id,organization_id,request_id,agent_key,body,created_by)
    values(v_draft_id,v_org,v_id,v_agent,v_body,p_actor) on conflict(id) do nothing returning * into v_draft;
    if not found then
      select * into v_draft from public.nova_worker_drafts where id=v_draft_id;
      if v_draft.organization_id<>v_org or v_draft.request_id<>v_id or v_draft.agent_key<>v_agent or v_draft.body<>v_body
        then return jsonb_build_object('ok',false,'code','draft_conflict'); end if;
    else
      insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)
      values(v_run.contact_id,'local_ai_'||v_agent,'internal','Reviewed on-device draft for request '||v_id::text||E'\n'||v_body,'draft_only_not_sent');
    end if;
  elsif p_action='cancel_request' then
    v_id:=(p_payload->>'id')::uuid;
    select public.nova_launch_cancel(w.request_id,w.management_hash) into v_cancel from public.nova_worker_runs w where w.request_id=v_id and w.organization_id=v_org;
    if v_cancel is null then return jsonb_build_object('ok',false,'code','request_not_found'); end if;
    if not coalesce((v_cancel->>'ok')::boolean,false) then return v_cancel; end if;
  elsif p_action in ('add_slot','withdraw_slot') then
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
      where w.organization_id=v_org order by w.created_at desc limit 40)r),'[]'::jsonb),
    'drafts',coalesce((select jsonb_agg(to_jsonb(d)-'organization_id'-'created_by' order by created_at desc) from (select * from public.nova_worker_drafts where organization_id=v_org order by created_at desc limit 80)d),'[]'::jsonb));
end;
$$;
