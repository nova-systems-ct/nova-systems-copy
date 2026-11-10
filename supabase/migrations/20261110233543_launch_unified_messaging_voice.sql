-- Extend the private inbox to signed SMS/WhatsApp and one Instagram comment reply.
alter table public.nova_channel_threads drop constraint nova_channel_threads_channel_check;
alter table public.nova_channel_threads add constraint nova_channel_threads_channel_check check(channel in ('instagram','tiktok','apple_messages','sms','whatsapp'));
create or replace function public.nova_channel_receive(p_channel text,p_account text,p_peer text,p_thread text,p_external_message text,p_text text,p_received_at timestamptz,p_test boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_thread public.nova_channel_threads;v_contact uuid;v_task uuid;v_message uuid;
begin
 if p_channel is null or p_channel not in ('instagram','tiktok','apple_messages','sms','whatsapp') or p_account is null or p_peer is null or p_thread is null or p_external_message is null or p_text is null
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
 update public.nova_channel_threads set last_inbound_at=greatest(last_inbound_at,p_received_at),updated_at=now(),status=case
  when lower(trim(p_text)) in ('stop','stopall','unsubscribe','cancel','end','quit','revoke','optout') then 'opted_out'
  when p_channel in ('sms','whatsapp') and lower(trim(p_text)) in ('start','unstop') then 'open'
  when status='archived' then 'open' else status end where id=v_thread.id;
 if p_channel in ('sms','whatsapp') then
  update public.nova_crm_contacts set phone=p_peer where id=v_thread.contact_id;
  update public.crm_contacts set phone=p_peer where id in (select crm_contact_id from public.nova_crm_identity_links where legacy_contact_id=v_thread.contact_id and organization_id=v_org);
 end if;
 update public.nova_tasks set status='pending',completed_at=null where id=v_thread.task_id;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome) values(v_thread.contact_id,'channel_'||p_channel,'inbound',p_text,case when p_test then 'test_message_received' else 'message_received' end);
 return jsonb_build_object('ok',true,'thread_id',v_thread.id,'message_id',v_message,'is_test',p_test);
end;$$;

create or replace function public.nova_channel_owner(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
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
  if v_thread.status='opted_out' and p_action in ('resume','archive') then return jsonb_build_object('ok',false,'code','thread_paused');end if;
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
  if v_thread.last_inbound_at<(now()-(case when v_thread.channel='instagram' and v_thread.external_thread_id like 'comment:%' then interval '7 days' when v_thread.channel='tiktok' then interval '48 hours' else interval '24 hours' end)) then return jsonb_build_object('ok',false,'code','reply_window_closed');end if;
  select count(*) into v_count from public.nova_channel_messages where thread_id=v_thread.id and direction='outbound' and state in ('dispatching','accepted','unknown','test_recorded') and created_at>=v_thread.last_inbound_at;
  if v_count >= (case when v_thread.channel='instagram' and v_thread.external_thread_id like 'comment:%' then 1 else 10 end) then return jsonb_build_object('ok',false,'code','reply_limit');end if;
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


-- Owner-managed provider connection vault. Ciphertext is never returned to a browser.
create table public.nova_provider_connections(organization_id uuid not null references public.organizations(id),channel text not null check(channel in ('twilio','instagram','tiktok','apple_messages')),public_config jsonb not null default '{}',ciphertext text not null,updated_by uuid not null,updated_at timestamptz not null default now(),primary key(organization_id,channel));
create function public.nova_provider_connection(p_actor uuid,p_action text,p_channel text default null,p_config jsonb default '{}'::jsonb,p_ciphertext text default null)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;begin
 select o.id into v_org from public.organizations o join public.organization_members m on m.organization_id=o.id where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor and m.role='nova_super_admin' and m.status='active' order by o.created_at limit 1;
 if v_org is null then return jsonb_build_object('ok',false,'code','owner_required');end if;
 if p_action='save' then
  if p_channel is null or p_channel not in ('twilio','instagram','tiktok','apple_messages') or p_ciphertext is null or length(p_ciphertext) not between 40 and 40000 or jsonb_typeof(p_config)<>'object' then return jsonb_build_object('ok',false,'code','invalid_connection');end if;
  insert into public.nova_provider_connections(organization_id,channel,public_config,ciphertext,updated_by)values(v_org,p_channel,p_config,p_ciphertext,p_actor)on conflict(organization_id,channel)do update set public_config=excluded.public_config,ciphertext=excluded.ciphertext,updated_by=p_actor,updated_at=now();
 end if;
 return jsonb_build_object('ok',true,'connections',coalesce((select jsonb_agg(jsonb_build_object('channel',c.channel,'public_config',c.public_config,'updated_at',c.updated_at,'credentials_stored',true))from public.nova_provider_connections c where organization_id=v_org),'[]'::jsonb));
end;$$;
create function public.nova_provider_runtime()returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('channel',c.channel,'ciphertext',c.ciphertext,'public_config',c.public_config)),'[]'::jsonb)from public.nova_provider_connections c join public.organizations o on o.id=c.organization_id where o.kind='nova_internal' and o.status='active';
$$;
create table public.nova_cost_reservations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),budget_id uuid not null references public.nova_cfo_requests(id),reservation_key text not null,service text not null,ceiling_cents integer not null check(ceiling_cents>0),created_at timestamptz not null default now(),unique(organization_id,reservation_key));
create function public.nova_reserve_cost(p_service text,p_key text,p_ceiling integer)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_budget public.nova_cfo_requests;v_res public.nova_cost_reservations;begin
 select id into v_org from public.organizations where kind='nova_internal' and status='active' order by created_at limit 1;
 if v_org is null or p_key is null or length(p_key) not between 5 and 300 or p_ceiling is null or p_ceiling not between 1 and 1000000 then return jsonb_build_object('ok',false,'code','invalid_budget');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-cost:'||v_org::text||p_service,0));
 select * into v_res from public.nova_cost_reservations where organization_id=v_org and reservation_key=p_key;
 if found then if v_res.service<>p_service or v_res.ceiling_cents<>p_ceiling then return jsonb_build_object('ok',false,'code','reservation_conflict');end if;return jsonb_build_object('ok',true,'duplicate',true,'reservation_id',v_res.id);end if;
 select * into v_budget from public.nova_cfo_requests where organization_id=v_org and service=p_service and status='approved' and expires_at>now() and max_cost_cents-reserved_cents>=p_ceiling order by decided_at,id limit 1 for update;
 if not found then return jsonb_build_object('ok',false,'code','budget_required');end if;
 update public.nova_cfo_requests set reserved_cents=reserved_cents+p_ceiling where id=v_budget.id;
 insert into public.nova_cost_reservations(organization_id,budget_id,reservation_key,service,ceiling_cents)values(v_org,v_budget.id,p_key,p_service,p_ceiling)returning * into v_res;
 return jsonb_build_object('ok',true,'duplicate',false,'reservation_id',v_res.id,'budget_id',v_budget.id,'ceiling_cents',p_ceiling);
end;$$;
create function public.nova_worker_budget_need(p_service text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_actor uuid;begin
 select m.staff_user_id into v_actor from public.organization_members m join public.organizations o on o.id=m.organization_id where o.kind='nova_internal' and o.status='active' and m.role='nova_super_admin' and m.status='active' order by m.created_at limit 1;
 if v_actor is null then return jsonb_build_object('ok',false,'code','owner_required');end if;
 return public.nova_company_owner(v_actor,'request_budget',jsonb_build_object('service',p_service,'request_key','system-activation:'||p_service,'purpose','Verify the provider quote and propose a capped budget before enabling '||p_service||' for autonomous customer work.'));
end;$$;
create function public.nova_automation_record(p_thread uuid,p_key text,p_state text,p_summary text,p_body jsonb default '{}')returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_thread public.nova_channel_threads;begin
 select * into v_thread from public.nova_channel_threads where id=p_thread;
 if not found then return jsonb_build_object('ok',false,'code','thread_not_found');end if;
 if p_key is null or length(p_key)>300 or p_state not in ('completed','draft','budget_blocked','action_required','failed') then return jsonb_build_object('ok',false,'code','invalid_action');end if;
 insert into public.nova_company_runs(organization_id,run_key,worker_key,state,summary,body,contact_id,is_test,execution_mode)values(v_thread.organization_id,p_key,v_thread.channel,p_state,left(p_summary,1000),p_body,v_thread.contact_id,v_thread.is_test,case when p_body->>'model_invoked'='true' then 'hosted_llm' else 'workflow' end)on conflict(organization_id,run_key)do nothing;
 return jsonb_build_object('ok',true);
end;$$;

alter table public.nova_channel_messages add column delivery_state text check(delivery_state in ('delivered','undelivered','failed'));
create function public.nova_channel_delivery(p_channel text,p_account text,p_sid text,p_status text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_msg public.nova_channel_messages;v_contact uuid;begin
 if p_channel not in ('sms','whatsapp') or p_status not in ('delivered','undelivered','failed') then return jsonb_build_object('ok',false,'code','invalid_result');end if;
 select m.* into v_msg from public.nova_channel_messages m join public.nova_channel_threads t on t.id=m.thread_id where t.channel=p_channel and t.account_id=p_account and m.provider_message_id=p_sid and m.state='accepted' for update of m;
 if not found then return jsonb_build_object('ok',true,'matched',false);end if;
 if v_msg.delivery_state is not null then return jsonb_build_object('ok',true,'duplicate',true);end if;
 update public.nova_channel_messages set delivery_state=p_status where id=v_msg.id;
 select contact_id into v_contact from public.nova_channel_threads where id=v_msg.thread_id;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_contact,'channel_'||p_channel,'internal','Provider delivery update for a saved reply.','provider_'||p_status);
 return jsonb_build_object('ok',true,'matched',true,'delivery_state',p_status);
end;$$;

alter table public.nova_voice_sessions add column account_id text;
create table public.nova_voice_turns(session_id uuid not null references public.nova_voice_sessions(id),turn_number integer not null check(turn_number between 0 and 12),inbound_text text not null,outbound_text text,state text not null default 'claimed' check(state in ('claimed','completed')),created_at timestamptz not null default now(),primary key(session_id,turn_number));
create function public.nova_voice_receive(p_call text,p_from text,p_account text,p_turn integer,p_text text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_org uuid;v_session public.nova_voice_sessions;v_turn public.nova_voice_turns;v_contact uuid;v_task uuid;begin
 if p_call is null or p_call!~'^CA[0-9a-fA-F]{32}$' or p_from is null or p_from!~'^\+[1-9][0-9]{7,14}$' or p_account is null or p_account!~'^AC[0-9a-fA-F]{32}$' or p_turn is null or p_turn not between 0 and 12 or length(coalesce(p_text,''))>2000 then return jsonb_build_object('ok',false,'code','invalid_call');end if;
 select id into v_org from public.organizations where kind='nova_internal' and status='active' order by created_at limit 1;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nova-voice:'||p_call,0));
 select * into v_session from public.nova_voice_sessions where organization_id=v_org and external_call_id=p_call for update;
 if not found then
  if p_turn<>0 then return jsonb_build_object('ok',false,'code','unknown_call');end if;
  insert into public.nova_crm_contacts(owner_name,phone,source,status,notes)values('Phone customer',p_from,'inbound_voice','new_lead','Customer initiated a phone call to Nova. No marketing permission implied.')returning id into v_contact;
  insert into public.nova_tasks(organization_id,engine,title,description,contact_id,status,trigger_type)values(v_org,'voice','Review incoming phone inquiry','Caller '||p_from||'. Review the signed call transcript and agree a next step.',v_contact,'pending','voice_inbound')returning id into v_task;
  insert into public.nova_voice_sessions(organization_id,external_call_id,contact_id,task_id,account_id)values(v_org,p_call,v_contact,v_task,p_account)returning * into v_session;
 end if;
 if v_session.account_id is distinct from p_account then return jsonb_build_object('ok',false,'code','wrong_account');end if;
 if v_session.created_at<now()-interval '180 seconds' or p_turn>=10 then return jsonb_build_object('ok',true,'end_call',true,'session_id',v_session.id);end if;
 select * into v_turn from public.nova_voice_turns where session_id=v_session.id and turn_number=p_turn;
 if found then return jsonb_build_object('ok',true,'duplicate',true,'state',v_turn.state,'reply',v_turn.outbound_text,'session_id',v_session.id);end if;
 if p_turn>0 and not exists(select 1 from public.nova_voice_turns where session_id=v_session.id and turn_number=p_turn-1 and state='completed')then return jsonb_build_object('ok',false,'code','turn_order');end if;
 insert into public.nova_voice_turns(session_id,turn_number,inbound_text)values(v_session.id,p_turn,coalesce(p_text,''));
 update public.nova_voice_sessions set transcript=transcript||jsonb_build_array(jsonb_build_object('direction','inbound','text',coalesce(p_text,''),'turn',p_turn,'at',now())),updated_at=now() where id=v_session.id;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_session.contact_id,'voice','inbound',left(coalesce(nullif(p_text,''),'Customer called Nova.'),2000),'voice_transcript_received');
 return jsonb_build_object('ok',true,'claimed',true,'session_id',v_session.id,'transcript',v_session.transcript);
end;$$;
create function public.nova_voice_finish(p_session uuid,p_turn integer,p_reply text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_session public.nova_voice_sessions;begin
 if length(trim(coalesce(p_reply,'')))not between 1 and 2000 then return jsonb_build_object('ok',false,'code','invalid_reply');end if;
 select * into v_session from public.nova_voice_sessions where id=p_session for update;
 if not found then return jsonb_build_object('ok',false,'code','unknown_call');end if;
 update public.nova_voice_turns set outbound_text=p_reply,state='completed' where session_id=p_session and turn_number=p_turn and state='claimed';
 if not found then return jsonb_build_object('ok',true,'duplicate',true);end if;
 update public.nova_voice_sessions set transcript=transcript||jsonb_build_array(jsonb_build_object('direction','outbound','text',p_reply,'turn',p_turn,'at',now())),updated_at=now() where id=p_session;
 insert into public.nova_crm_activities(contact_id,engine,direction,summary,outcome)values(v_session.contact_id,'voice','outbound',p_reply,'voice_reply_prepared');
 return jsonb_build_object('ok',true);
end;$$;

do $$declare n text;begin foreach n in array array['nova_provider_connections','nova_cost_reservations','nova_voice_turns']loop execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant select,insert,update on public.%I to service_role',n);end loop;end$$;
revoke all on function public.nova_provider_connection(uuid,text,text,jsonb,text),public.nova_provider_runtime(),public.nova_reserve_cost(text,text,integer),public.nova_worker_budget_need(text),public.nova_automation_record(uuid,text,text,text,jsonb),public.nova_channel_delivery(text,text,text,text),public.nova_voice_receive(text,text,text,integer,text),public.nova_voice_finish(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.nova_provider_connection(uuid,text,text,jsonb,text),public.nova_provider_runtime(),public.nova_reserve_cost(text,text,integer),public.nova_worker_budget_need(text),public.nova_automation_record(uuid,text,text,text,jsonb),public.nova_channel_delivery(text,text,text,text),public.nova_voice_receive(text,text,text,integer,text),public.nova_voice_finish(uuid,integer,text) to service_role;
