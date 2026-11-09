-- Owner cancellation reuses the same atomic cancellation workflow after owner/organization authorization.
-- No management secret is returned to the browser.
create or replace function public.nova_launch_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_id uuid; v_start timestamptz; v_end timestamptz; v_test boolean; v_cancel jsonb;
begin
  select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id
    where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.status='active'
      and m.role='nova_super_admin' order by o.created_at limit 1;
  if v_org is null then return jsonb_build_object('ok',false,'code','owner_required'); end if;
  if p_action='cancel_request' then
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
      where w.organization_id=v_org order by w.created_at desc limit 40)r),'[]'::jsonb));
end;
$$;
