-- Service-only channel ledger. A draft, provider acceptance and delivery are different states.
create table public.nova_channel_threads (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 channel text not null check(channel in ('instagram','tiktok','apple_messages')),
 account_id text not null check(length(account_id) between 1 and 300),
 external_peer_id text not null check(length(external_peer_id) between 1 and 300),
 external_thread_id text not null check(length(external_thread_id) between 1 and 300),
 contact_id uuid not null references public.nova_crm_contacts(id),
 task_id uuid not null references public.nova_tasks(id),
 display_name text not null,
 is_test boolean not null default false,
 status text not null default 'open' check(status in ('open','paused','opted_out','archived')),
 last_inbound_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(channel,account_id,external_thread_id,is_test)
);
create table public.nova_channel_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.nova_channel_threads(id),
 direction text not null check(direction in ('inbound','outbound')),
 body text not null check(length(body) between 1 and 6000),
 state text not null check(state in ('received','draft','dispatching','accepted','failed','unknown','test_recorded')),
 external_message_id text,
 provider_message_id text,
 error_code text,
 agent_key text,
 created_by uuid,
 created_at timestamptz not null default now(),
 unique(thread_id,external_message_id)
);
create index nova_channel_threads_org_updated on public.nova_channel_threads(organization_id,updated_at desc);
create index nova_channel_messages_thread_created on public.nova_channel_messages(thread_id,created_at);
alter table public.nova_channel_threads enable row level security;
alter table public.nova_channel_messages enable row level security;
revoke all on public.nova_channel_threads,public.nova_channel_messages from public,anon,authenticated;
grant select,insert,update on public.nova_channel_threads,public.nova_channel_messages to service_role;

create function public.nova_channel_receive(p_channel text,p_account text,p_peer text,p_thread text,p_external_message text,p_text text,p_received_at timestamptz,p_test boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_thread public.nova_channel_threads;v_contact uuid;v_task uuid;v_message uuid;
begin
 if p_channel is null or p_channel not in ('instagram','tiktok','apple_messages') or p_account is null or p_peer is null or p_thread is null or p_external_message is null or p_text is null
  or length(p_account) not between 1 and 300 or length(p_peer) not between 1 and 300 or length(p_thread) not between 1 and 300 or length(p_external_message) not between 1 and 500
  or length(trim(p_text)) not between 1 and 6000 or p_received_at is null or not isfinite(p_received_at) or p_received_at>now()+interval '5 minutes'
  then return jsonb_build_object('ok',false,'code','invalid_message');end if;
 if p_test and (p_account<>'TEST-NOVA' or p_peer not like 'TEST-%' or p_text not like 'TEST %') then return jsonb_build_object('ok',false,'code','invalid_message');end if;
 select id into v_org from public.organizations where kind='nova_internal' and status='active' order by created_at limit 1;
 if v_org is null then return jsonb_build_object('ok',false,'code','owner_required');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-channel:'||p_channel||':'||p_account||':'||p_thread||':'||p_test::text,0));
 select * into v_thread from public.nova_channel_threads where channel=p_channel and account_id=p_account and external_thread_id=p_thread and is_test=p_test for update;
 if found and exists(select 1 from public.nova_channel_messages where thread_id=v_thread.id and external_message_id=p_external_message) then
  return jsonb_build_object('ok',true,'duplicate',true,'thread_id',v_thread.id);end if;
 if v_thread.id is null then
  insert into public.nova_crm_contacts(owner_name,business_name,source,status,notes)
   values(case when p_test then 'TEST channel customer' else p_channel||' customer' end,case when p_test then 'TEST channel practice' else null end,
    case when p_test then 'test_channel_' else 'channel_' end||p_channel,'new_lead','Customer initiated a business messaging conversation. No SMS or marketing permission implied.') returning id into v_contact;
  insert into public.nova_tasks(organization_id,engine,title,description,contact_id,status,trigger_type)
   values(v_org,'channel_'||p_channel,case when p_test then 'TEST · ' else '' end||'Review and answer '||p_channel||' inquiry',p_text,v_contact,'pending','channel_inbound') returning id into v_task;
  insert into public.nova_channel_threads(organization_id,channel,account_id,external_peer_id,external_thread_id,contact_id,task_id,display_name,is_test,last_inbound_at)
   values(v_org,p_channel,p_account,p_peer,p_thread,v_contact,v_task,case when p_test then 'Practice customer' else p_channel||' customer' end,p_test,p_received_at) returning * into v_thread;
 end if;
 insert into public.nova_channel_messages(thread_id,direction,body,state,external_message_id,created_at)
  values(v_thread.id,'inbound',p_text,'received',p_external_message,p_received_at) returning id into v_message;
 update public.nova_channel_threads set last_inbound_at=greatest(last_inbound_at,p_received_at),updated_at=now(),status=case when lower(trim(p_text)) in ('stop','unsubscribe') then 'opted_out' when status='archived' then 'open' else status end where id=v_thread.id;
 update public.nova_tasks set status='pending',completed_at=null where id=v_thread.task_id;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome) values(v_thread.contact_id,'channel_'||p_channel,'inbound',p_text,case when p_test then 'test_message_received' else 'message_received' end);
 return jsonb_build_object('ok',true,'thread_id',v_thread.id,'message_id',v_message,'is_test',p_test);
end;$$;

create function public.nova_channel_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_thread public.nova_channel_threads;v_message public.nova_channel_messages;v_id uuid;v_body text;v_count integer;v_state text;
begin
 select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id
  where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.status='active' and m.role='nova_super_admin' order by o.created_at limit 1;
 if v_org is null then return jsonb_build_object('ok',false,'code','owner_required');end if;
 if p_action='overview' then
  return jsonb_build_object('ok',true,'threads',coalesce((select jsonb_agg(to_jsonb(t) order by updated_at desc) from (select * from public.nova_channel_threads where organization_id=v_org and status<>'archived' order by updated_at desc limit 60)t),'[]'::jsonb),
   'messages',coalesce((select jsonb_agg(to_jsonb(m) order by created_at) from (select m.* from public.nova_channel_messages m join public.nova_channel_threads t on t.id=m.thread_id where t.organization_id=v_org and t.status<>'archived' order by m.created_at desc limit 300)m),'[]'::jsonb));
 end if;
 select * into v_thread from public.nova_channel_threads where id=(p_payload->>'thread_id')::uuid and organization_id=v_org for update;
 if not found then return jsonb_build_object('ok',false,'code','thread_not_found');end if;
 if p_action in ('pause','resume','archive') then
  if v_thread.status='opted_out' and p_action='resume' then return jsonb_build_object('ok',false,'code','thread_paused');end if;
  update public.nova_channel_threads set status=case p_action when 'pause' then 'paused' when 'resume' then 'open' else 'archived' end,updated_at=now() where id=v_thread.id;
  if p_action='archive' then update public.nova_tasks set status='cancelled' where id=v_thread.task_id and status='pending';end if;
  return jsonb_build_object('ok',true,'thread_id',v_thread.id);
 end if;
 if p_action not in ('save_draft','send_reply') then return jsonb_build_object('ok',false,'code','invalid_action');end if;
 v_id:=(p_payload->>'reply_id')::uuid;v_body:=trim(p_payload->>'body');
 if v_id is null or v_body is null or length(v_body) not between 1 and 2000 then return jsonb_build_object('ok',false,'code','invalid_message');end if;
 select * into v_message from public.nova_channel_messages where id=v_id;
 if found then
  if v_message.thread_id<>v_thread.id or v_message.body<>v_body or v_message.direction<>'outbound' then return jsonb_build_object('ok',false,'code','reply_conflict');end if;
  if p_action='save_draft' or v_message.state<>'draft' then return jsonb_build_object('ok',true,'dispatch',false,'state',v_message.state,'reply_id',v_id,'duplicate',true);end if;
 end if;
 if p_action='send_reply' then
  if v_thread.status<>'open' then return jsonb_build_object('ok',false,'code','thread_paused');end if;
  if exists(select 1 from public.nova_channel_messages where thread_id=v_thread.id and state in ('dispatching','unknown')) then return jsonb_build_object('ok',false,'code','reply_unconfirmed');end if;
  if v_thread.last_inbound_at<(now()-(case when v_thread.channel='tiktok' then interval '48 hours' else interval '24 hours' end)) then return jsonb_build_object('ok',false,'code','reply_window_closed');end if;
  select count(*) into v_count from public.nova_channel_messages where thread_id=v_thread.id and direction='outbound' and state in ('dispatching','accepted','unknown','test_recorded') and created_at>=v_thread.last_inbound_at;
  if v_count>=10 then return jsonb_build_object('ok',false,'code','reply_limit');end if;
 end if;
 v_state:=case when p_action='save_draft' then 'draft' when v_thread.is_test then 'test_recorded' else 'dispatching' end;
 insert into public.nova_channel_messages(id,thread_id,direction,body,state,agent_key,created_by)
  values(v_id,v_thread.id,'outbound',v_body,v_state,v_thread.channel,p_actor)
  on conflict(id) do update set state=excluded.state where public.nova_channel_messages.thread_id=v_thread.id and public.nova_channel_messages.body=v_body and public.nova_channel_messages.state='draft' returning * into v_message;
 if not found then return jsonb_build_object('ok',false,'code','reply_conflict');end if;
 update public.nova_channel_threads set updated_at=now() where id=v_thread.id;
 if v_state='test_recorded' then
  insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome) values(v_thread.contact_id,'channel_'||v_thread.channel,'outbound',v_body,'test_recorded_not_sent');
  update public.nova_tasks set status='completed',completed_at=now() where id=v_thread.task_id;
 end if;
 return jsonb_build_object('ok',true,'dispatch',v_state='dispatching','state',v_state,'reply_id',v_id,'is_test',v_thread.is_test);
end;$$;

create function public.nova_channel_finish(p_reply uuid,p_state text,p_provider_id text default null,p_error text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_msg public.nova_channel_messages;v_thread public.nova_channel_threads;
begin
 if p_state is null or p_state not in ('accepted','failed','unknown') or (p_state='accepted' and coalesce(length(p_provider_id),0)=0) then return jsonb_build_object('ok',false,'code','invalid_result');end if;
 select * into v_msg from public.nova_channel_messages where id=p_reply for update;
 if not found then return jsonb_build_object('ok',false,'code','reply_not_found');end if;
 if v_msg.state<>'dispatching' then return jsonb_build_object('ok',true,'duplicate',true,'state',v_msg.state);end if;
 select * into v_thread from public.nova_channel_threads where id=v_msg.thread_id;
 update public.nova_channel_messages set state=p_state,provider_message_id=left(p_provider_id,500),error_code=left(p_error,100) where id=p_reply;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome) values(v_thread.contact_id,'channel_'||v_thread.channel,'outbound',v_msg.body,'provider_'||p_state);
 if p_state='accepted' then update public.nova_tasks set status='completed',completed_at=now() where id=v_thread.task_id;end if;
 return jsonb_build_object('ok',true,'state',p_state,'reply_id',p_reply,'delivery_verified',false);
end;$$;

revoke all on function public.nova_channel_receive(text,text,text,text,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.nova_channel_owner(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.nova_channel_finish(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.nova_channel_receive(text,text,text,text,text,text,timestamptz,boolean),public.nova_channel_owner(uuid,text,jsonb),public.nova_channel_finish(uuid,text,text,text) to service_role;
