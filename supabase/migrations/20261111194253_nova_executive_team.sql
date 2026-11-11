create table public.nova_team_missions (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null,
  objective text not null check (length(objective) between 8 and 1000),
  focus text not null check (focus in ('audit','agents','demand')),
  state text not null default 'ready' check (state in ('ready','in_progress','review')),
  next_step integer not null default 0 check (next_step between 0 and 7),
  task_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nova_team_missions_org_updated on public.nova_team_missions(organization_id,updated_at desc);

create table public.nova_team_events (
  mission_id uuid not null references public.nova_team_missions(id),
  step integer not null check (step between -1 and 6),
  sender text not null,
  recipient text not null,
  message text not null,
  receipt jsonb not null default '{}',
  model_note text check (length(model_note)<=2000),
  created_at timestamptz not null default now(),
  primary key (mission_id,step)
);

alter table public.nova_team_missions enable row level security;
alter table public.nova_team_events enable row level security;
revoke all on public.nova_team_missions,public.nova_team_events from public,anon,authenticated;
grant select,insert,update on public.nova_team_missions,public.nova_team_events to service_role;

create function public.nova_team_owner(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  org_id uuid;
  mission_id_arg uuid;
  mission public.nova_team_missions;
  requested_step integer;
  roles text[]:=array['ceo','chief','coo','cmo','zion','cfo','ceo'];
  sender_key text;
  recipient_key text;
  message_text text;
  result jsonb:='{}';
  model_note_text text;
  task_ref uuid;
  task_role text;
  task_title text;
  previous_assignee text;
  brand_ref uuid;
  idea_ref uuid;
  instagram_ref uuid;
  tiktok_ref uuid;
  caption_instagram text;
  caption_tiktok text;
  hook_text text;
  script_text text;
  owner_objective text;
  focus_key text;
  duplicate_step boolean:=false;
begin
  select o.id into org_id
  from public.organizations o
  join public.organization_members m on m.organization_id=o.id
  where o.kind='nova_internal' and o.status='active'
    and m.staff_user_id=p_actor and m.status='active' and m.role='nova_super_admin'
  order by o.created_at limit 1;
  if org_id is null then
    return jsonb_build_object('ok',false,'code','owner_required');
  end if;

  if p_action='assign' then
    task_ref:=(p_payload->>'task_id')::uuid;
    task_role:=trim(p_payload->>'assignee');
    if task_role is null or length(task_role) not between 2 and 80 then
      return jsonb_build_object('ok',false,'code','invalid_assignee');
    end if;
    select title,assigned_to into task_title,previous_assignee from public.nova_tasks
    where id=task_ref and organization_id=org_id and status='pending' for update;
    if not found then
      return jsonb_build_object('ok',false,'code','task_not_available');
    end if;
    if previous_assignee is not distinct from task_role then
      return jsonb_build_object('ok',true,'task_id',task_ref,'assigned_to',task_role,'duplicate',true);
    end if;
    update public.nova_tasks set assigned_to=task_role where id=task_ref and organization_id=org_id;
    insert into public.nova_company_runs(
      organization_id,run_key,worker_key,state,summary,body,task_id,created_by
    ) values(
      org_id,'assignment:'||gen_random_uuid()::text,'chief','completed',
      'Assigned '||task_title||' to '||task_role,
      jsonb_build_object('assignee',task_role),task_ref,p_actor
    );
    return jsonb_build_object('ok',true,'task_id',task_ref,'assigned_to',task_role);
  end if;

  mission_id_arg:=nullif(p_payload->>'mission_id','')::uuid;
  if p_action='start' then
    owner_objective:=trim(p_payload->>'objective');
    focus_key:=p_payload->>'focus';
    if mission_id_arg is null or owner_objective is null
      or length(owner_objective) not between 8 and 1000
      or focus_key is null or focus_key not in ('audit','agents','demand') then
      return jsonb_build_object('ok',false,'code','invalid_mission');
    end if;
    insert into public.nova_team_missions(id,organization_id,created_by,objective,focus)
    values(mission_id_arg,org_id,p_actor,owner_objective,focus_key)
    on conflict(id) do nothing;
    select * into mission from public.nova_team_missions
    where id=mission_id_arg and organization_id=org_id for update;
    if not found or mission.objective<>owner_objective or mission.focus<>focus_key then
      return jsonb_build_object('ok',false,'code','mission_conflict');
    end if;
    insert into public.nova_team_events(mission_id,step,sender,recipient,message)
    values(mission.id,-1,'owner','ceo',mission.objective)
    on conflict(mission_id,step) do nothing;
  elsif p_action='advance' then
    select * into mission from public.nova_team_missions
    where id=mission_id_arg and organization_id=org_id for update;
    if not found then
      return jsonb_build_object('ok',false,'code','mission_not_found');
    end if;
    requested_step:=(p_payload->>'expected_step')::integer;
    if requested_step is null or requested_step not between 0 and 6 or requested_step>mission.next_step then
      return jsonb_build_object('ok',false,'code','step_changed');
    end if;
    duplicate_step:=requested_step<mission.next_step;
    if not duplicate_step then
      sender_key:=roles[requested_step+1];
      recipient_key:=coalesce(roles[requested_step+2],'owner');
      model_note_text:=nullif(left(trim(p_payload->>'model_note'),2000),'');

      case requested_step
      when 0 then
        message_text:='The campaign brief is saved. Chief of staff, assign preparation, production and budget review.';
        result:=jsonb_build_object('title','Campaign brief','objective',mission.objective,
          'focus',mission.focus,'budget_cents',0,'review_required',true);
      when 1 then
        foreach task_role in array array['coo','cmo','zion','cfo'] loop
          task_title:=case task_role
            when 'coo' then 'Check campaign readiness'
            when 'cmo' then 'Prepare Instagram and TikTok drafts'
            when 'zion' then 'Write the campaign video script'
            else 'Check the campaign budget'
          end;
          insert into public.nova_tasks(organization_id,engine,title,description,assigned_to,trigger_type,status)
          values(org_id,task_role,task_title,mission.objective,upper(task_role),'executive_mission','pending')
          returning id into task_ref;
          mission.task_ids:=mission.task_ids||jsonb_build_object(task_role,task_ref);
        end loop;
        message_text:='Four tasks are assigned. COO, check the operating queue and channel readiness.';
        result:=jsonb_build_object('title','Assignments saved','task_ids',mission.task_ids);
      when 2 then
        result:=jsonb_build_object(
          'title','Operations review',
          'pending_tasks',(select count(*) from public.nova_tasks where organization_id=org_id and status='pending'),
          'booked_appointments',(select count(*) from public.nova_booking_slots where organization_id=org_id and status='booked' and not is_test and starts_at>now()),
          'channel_readiness',coalesce(p_payload->'channel_readiness','[]'::jsonb)
        );
        message_text:='I checked the task queue, calendar and channel settings. CMO, prepare the platform drafts for review.';
      when 3 then
        select id into brand_ref from public.marketing_brands
        where organization_id=org_id and key='nova' limit 1;
        if brand_ref is null then
          return jsonb_build_object('ok',false,'code','brand_required');
        end if;
        hook_text:=case mission.focus
          when 'audit' then 'Find what’s lost. Build what’s next.'
          when 'agents' then 'Give every inquiry a clear next step.'
          else 'Turn a defined audience into a follow-up plan.'
        end;
        caption_instagram:=hook_text||' Nova Systems helps connect customer intake, appointments and follow-up. See how the workflow fits your business. https://nova-systems.app/service-request';
        caption_tiktok:=case mission.focus
          when 'audit' then 'Where do customer requests get lost? Look at the handoff from inquiry to booking. Start a Nova conversation through the link in bio.'
          when 'agents' then 'An inquiry arrives while you are working. What happens next? See a customer request, a saved follow-up task and a real booking flow. Link in bio.'
          else 'A new lead needs a next step. Start with the right audience, a clear offer and a way to track follow-up. Explore Nova through the link in bio.'
        end;
        insert into public.content_ideas(organization_id,brand_id,pillar,title,notes,status,created_by)
        values(org_id,brand_ref,'Nova launch',hook_text,mission.objective,'idea',p_actor)
        returning id into idea_ref;
        insert into public.content_assets(organization_id,brand_id,idea_id,platform,format,caption,status,generated_by)
        values(org_id,brand_ref,idea_ref,'instagram','reel',caption_instagram,'draft','manual')
        returning id into instagram_ref;
        insert into public.content_assets(organization_id,brand_id,idea_id,platform,format,caption,status,generated_by)
        values(org_id,brand_ref,idea_ref,'tiktok','short_video',caption_tiktok,'draft','manual')
        returning id into tiktok_ref;
        result:=jsonb_build_object('title','Platform drafts','idea_id',idea_ref,'drafts',jsonb_build_array(
          jsonb_build_object('platform','Instagram','asset_id',instagram_ref,'caption',caption_instagram),
          jsonb_build_object('platform','TikTok','asset_id',tiktok_ref,'caption',caption_tiktok)
        ));
        message_text:='Instagram and TikTok drafts are saved in the content pipeline. Zion, turn the brief into a short video script.';
      when 4 then
        hook_text:=case mission.focus
          when 'audit' then 'Find what’s lost. Build what’s next.'
          when 'agents' then 'Give every inquiry a clear next step.'
          else 'Give every new lead a next step.'
        end;
        script_text:=hook_text||E'\nStart by following one real customer request.\nSee the inquiry, appointment and follow-up task in one workflow.\nExperience Nova at nova-systems.app.';
        result:=jsonb_build_object('title','Zion video script','script',script_text,'scenes',jsonb_build_array(
          jsonb_build_object('seconds',4,'text',hook_text),
          jsonb_build_object('seconds',4,'text','One request. One clear next step.'),
          jsonb_build_object('seconds',4,'text','Experience Nova','detail','nova-systems.app')
        ),'state','script_ready');
        message_text:='The video script and three scenes are saved. CFO, verify the cost of the work and return it for review.';
      when 5 then
        result:=jsonb_build_object('title','Budget review','mission_cap_cents',0,'spent_cents',0,
          'open_requests',(select count(*) from public.nova_cfo_requests where organization_id=org_id and status in ('quote_required','awaiting_owner')),
          'dispatch_status','paused');
        message_text:='This mission used $0. The drafts and script are ready for Isaac’s review.';
      when 6 then
        result:=jsonb_build_object('title','Campaign ready for review','draft_count',2,'script_count',1,'spent_cents',0);
        message_text:='Isaac, review the two platform drafts and Zion’s script. The handoff record shows what each worker completed.';
      end case;

      if mission.task_ids ? sender_key then
        update public.nova_tasks set status='completed',completed_at=now()
        where id=(mission.task_ids->>sender_key)::uuid and organization_id=org_id and status='pending'
          and assigned_to=upper(sender_key);
      end if;
      insert into public.nova_team_events(mission_id,step,sender,recipient,message,receipt,model_note)
      values(mission.id,requested_step,sender_key,recipient_key,message_text,result,model_note_text);
      update public.nova_team_missions
      set next_step=requested_step+1,
        state=case when requested_step=6 then 'review' else 'in_progress' end,
        task_ids=mission.task_ids,updated_at=now()
      where id=mission.id returning * into mission;
    end if;
  elsif p_action='overview' then
    select * into mission from public.nova_team_missions
    where organization_id=org_id and (mission_id_arg is null or id=mission_id_arg)
    order by updated_at desc limit 1;
    if mission_id_arg is not null and not found then
      return jsonb_build_object('ok',false,'code','mission_not_found');
    end if;
  else
    return jsonb_build_object('ok',false,'code','invalid_action');
  end if;

  return jsonb_build_object(
    'ok',true,
    'duplicate',duplicate_step,
    'mission',case when mission.id is null then null else to_jsonb(mission) end,
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.step) from public.nova_team_events e where e.mission_id=mission.id),'[]'),
    'missions',coalesce((select jsonb_agg(to_jsonb(m) order by m.updated_at desc) from (
      select id,objective,focus,state,next_step,updated_at
      from public.nova_team_missions where organization_id=org_id order by updated_at desc limit 30
    )m),'[]'),
    'pending_tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
      select id,title,assigned_to,engine,created_at
      from public.nova_tasks where organization_id=org_id and status='pending'
      order by created_at desc limit 30
    )t),'[]')
  );
end;
$$;
revoke all on function public.nova_team_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nova_team_owner(uuid,text,jsonb) to service_role;
