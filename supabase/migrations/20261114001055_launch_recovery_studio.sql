-- Extend the existing production asset ledger; do not create a competing pipeline.
alter table public.content_assets add column if not exists script text;
alter table public.content_assets add column if not exists reviewed_by uuid;
alter table public.content_assets add column if not exists reviewed_at timestamptz;
alter table public.content_assets add column if not exists scene_plan jsonb not null default '[]';
alter table public.content_assets add column if not exists source_notes text;
alter table public.content_assets add column if not exists revision integer not null default 1;
alter table public.content_assets add column if not exists creation_method text not null default 'existing';
alter table public.content_assets add column if not exists metrics jsonb not null default '{}';
alter table public.content_assets add column if not exists metrics_source text;
alter table public.content_assets add column if not exists metrics_recorded_at timestamptz;
alter table public.content_ideas add column if not exists studio_request jsonb;
alter table public.content_assets enable row level security;
alter table public.content_ideas enable row level security;
alter table public.marketing_brands enable row level security;
-- These ledgers are served through organization-checked APIs. The old SELECT
-- policies admitted staff from any organization; remove that direct access.
revoke all on public.content_assets,public.content_ideas,public.marketing_brands from public,anon,authenticated;
grant select,insert,update on public.content_assets,public.content_ideas,public.marketing_brands to service_role;

create function public.nova_studio_owner(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  org uuid; brand uuid; pack_id uuid; asset_id uuid; idea public.content_ideas;
  asset public.content_assets; pack jsonb; draft jsonb; metrics_input jsonb; k text;
begin
  select o.id into org from public.organizations o join public.organization_members m on m.organization_id=o.id
  where o.kind='nova_internal' and o.status='active' and m.staff_user_id=p_actor
    and m.role='nova_super_admin' and m.status='active' order by o.created_at limit 1;
  if org is null then return jsonb_build_object('ok',false,'code','owner_required'); end if;
  if p_action='create_brand' then
    if length(trim(coalesce(p_payload->>'name',''))) not between 2 and 100
      or coalesce(p_payload->>'key','') !~ '^[a-z][a-z0-9_-]{1,39}$' then
      return jsonb_build_object('ok',false,'code','invalid_content');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(org::text||':brand:'||(p_payload->>'key'),0));
    if not exists(select 1 from public.marketing_brands where organization_id=org and key=p_payload->>'key') then
      insert into public.marketing_brands(organization_id,key,name,kind)
      values(org,p_payload->>'key',trim(p_payload->>'name'),'company');
    end if;
  elsif p_action='save_pack' then
    brand:=(p_payload->>'brand_id')::uuid; pack_id:=(p_payload->>'pack_id')::uuid; pack:=p_payload->'pack';
    if not exists(select 1 from public.marketing_brands where id=brand and organization_id=org) then
      return jsonb_build_object('ok',false,'code','brand_not_found'); end if;
    if pack_id is null or length(trim(coalesce(pack->>'title',''))) not between 3 and 160
      or length(trim(coalesce(pack->>'source_notes',''))) not between 8 and 3000
      or length(coalesce(pack->>'script',''))>5000
      or jsonb_typeof(pack->'drafts') is distinct from 'array'
      or jsonb_typeof(pack->'scenes') is distinct from 'array' then
      return jsonb_build_object('ok',false,'code','invalid_content'); end if;
    if jsonb_array_length(pack->'drafts') not between 1 and 4 or jsonb_array_length(pack->'scenes') not between 2 and 8
      or exists(select 1 from jsonb_array_elements(pack->'drafts') d where coalesce(d->>'platform','') not in ('instagram','facebook','tiktok','youtube') or length(trim(coalesce(d->>'caption',''))) not between 1 and 2200)
      or (select count(distinct d->>'platform') from jsonb_array_elements(pack->'drafts') d)<>jsonb_array_length(pack->'drafts')
      or exists(select 1 from jsonb_array_elements(pack->'scenes') s where length(trim(coalesce(s->>'text',''))) not between 1 and 180 or length(coalesce(s->>'detail',''))>100 or coalesce(s->>'seconds','') !~ '^([2-9]|1[012])$') then
      return jsonb_build_object('ok',false,'code','invalid_content'); end if;
    perform pg_advisory_xact_lock(hashtextextended(pack_id::text,0));
    select * into idea from public.content_ideas where id=pack_id;
    if found then
      if idea.organization_id<>org or idea.brand_id<>brand or idea.studio_request is distinct from pack then
        return jsonb_build_object('ok',false,'code','request_conflict'); end if;
    else
      insert into public.content_ideas(id,organization_id,brand_id,pillar,title,notes,status,created_by,studio_request)
      values(pack_id,org,brand,'CMO studio',pack->>'title',pack->>'source_notes','idea',p_actor,pack);
      for draft in select value from jsonb_array_elements(pack->'drafts') loop
        insert into public.content_assets(organization_id,brand_id,idea_id,platform,format,caption,script,status,generated_by,scene_plan,source_notes,creation_method)
        values(org,brand,pack_id,draft->>'platform',case when draft->>'platform'='youtube' then 'short' when draft->>'platform'='tiktok' then 'short_video' else 'reel' end,
          draft->>'caption',pack->>'script','draft',case when pack->>'generated_by'='local_ai' then 'ai' else 'manual' end,
          pack->'scenes',pack->>'source_notes',case when pack->>'generated_by'='local_ai' then 'local_ai' else 'template' end);
      end loop;
    end if;
  elsif p_action in ('update_asset','approve','reject','metrics') then
    asset_id:=(p_payload->>'asset_id')::uuid;
    select * into asset from public.content_assets where id=asset_id and organization_id=org for update;
    if not found then return jsonb_build_object('ok',false,'code','content_not_found'); end if;
    if asset.revision is distinct from (p_payload->>'revision')::integer then return jsonb_build_object('ok',false,'code','content_changed'); end if;
    if p_action='update_asset' then
      if asset.status='published' or length(trim(coalesce(p_payload->>'caption',''))) not between 1 and 2200
        or length(coalesce(p_payload->>'script',''))>5000 or length(trim(coalesce(p_payload->>'source_notes',''))) not between 8 and 3000 then
        return jsonb_build_object('ok',false,'code','invalid_content'); end if;
      update public.content_assets set caption=p_payload->>'caption',script=p_payload->>'script',source_notes=p_payload->>'source_notes',status='draft',reviewed_by=null,reviewed_at=null,revision=revision+1 where id=asset.id;
    elsif p_action in ('approve','reject') then
      if asset.status='published' or (p_action='approve' and length(trim(coalesce(asset.source_notes,'')))<8) then return jsonb_build_object('ok',false,'code','invalid_content'); end if;
      update public.content_assets set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewed_by=p_actor,reviewed_at=now(),revision=revision+1 where id=asset.id;
    else
      metrics_input:=p_payload->'metrics';
      if jsonb_typeof(metrics_input) is distinct from 'object' or length(trim(coalesce(p_payload->>'source',''))) not between 8 and 1000 then return jsonb_build_object('ok',false,'code','invalid_metrics'); end if;
      foreach k in array array['views','likes','comments','shares','leads'] loop
        if coalesce(metrics_input->>k,'') !~ '^[0-9]{1,9}$' then return jsonb_build_object('ok',false,'code','invalid_metrics'); end if;
      end loop;
      update public.content_assets set metrics=jsonb_build_object('views',(metrics_input->>'views')::int,'likes',(metrics_input->>'likes')::int,'comments',(metrics_input->>'comments')::int,'shares',(metrics_input->>'shares')::int,'leads',(metrics_input->>'leads')::int),metrics_source=p_payload->>'source',metrics_recorded_at=now(),revision=revision+1 where id=asset.id;
    end if;
  elsif p_action<>'overview' then return jsonb_build_object('ok',false,'code','invalid_action'); end if;
  return jsonb_build_object('ok',true,'brands',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.marketing_brands b where b.organization_id=org),'[]'),
    'assets',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from (select id,brand_id,idea_id,platform,format,caption,script,status,scene_plan,source_notes,revision,creation_method,metrics,metrics_source,metrics_recorded_at,created_at from public.content_assets where organization_id=org order by created_at desc,id limit 120) a),'[]'),
    'publishing',jsonb_build_object('enabled',false,'reason','Connect and verify the destination accounts before publishing. Saved content and downloads are available now.'));
end $$;
revoke all on function public.nova_studio_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nova_studio_owner(uuid,text,jsonb) to service_role;

create table public.nova_team_background_jobs (
  mission_id uuid primary key references public.nova_team_missions(id),
  actor_id uuid not null,
  status text not null default 'queued' check(status in ('queued','paused','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nova_team_background_jobs enable row level security;
revoke all on public.nova_team_background_jobs from public,anon,authenticated;
grant select,insert,update on public.nova_team_background_jobs to service_role;

create function public.nova_team_background(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; mission uuid; job public.nova_team_background_jobs;
begin
  result:=public.nova_team_owner(p_actor,'overview',p_payload);
  if not coalesce((result->>'ok')::boolean,false) then return result; end if;
  mission:=(result->'mission'->>'id')::uuid;
  if p_action in ('enqueue','pause') then
    if mission is null then return jsonb_build_object('ok',false,'code','mission_not_found'); end if;
    if p_action='enqueue' then
      insert into public.nova_team_background_jobs(mission_id,actor_id,status)
      values(mission,p_actor,case when (result->'mission'->>'next_step')::int=7 then 'completed' else 'queued' end)
      on conflict(mission_id) do update set status=excluded.status,actor_id=p_actor,last_error=null,attempts=0,updated_at=now();
    else update public.nova_team_background_jobs set status='paused',updated_at=now() where mission_id=mission and status='queued'; end if;
  elsif p_action<>'overview' then return jsonb_build_object('ok',false,'code','invalid_action'); end if;
  select * into job from public.nova_team_background_jobs where mission_id=mission;
  return result||jsonb_build_object('background',case when job.mission_id is null then null else to_jsonb(job) end);
end $$;
revoke all on function public.nova_team_background(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nova_team_background(uuid,text,jsonb) to service_role;

-- Executes only bounded database work. No HTTP, model, message or payment call.
create function public.nova_team_tick() returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.nova_team_background_jobs; result jsonb; step_no integer; done integer:=0;
begin
  for job in select * from public.nova_team_background_jobs where status='queued' order by updated_at for update skip locked limit 3 loop
    begin
      result:=public.nova_team_owner(job.actor_id,'overview',jsonb_build_object('mission_id',job.mission_id));
      if not coalesce((result->>'ok')::boolean,false) then raise exception 'owner_or_mission_unavailable'; end if;
      step_no:=(result->'mission'->>'next_step')::int;
      while step_no<7 loop
        result:=public.nova_team_owner(job.actor_id,'advance',jsonb_build_object('mission_id',job.mission_id,'expected_step',step_no,'channel_readiness',jsonb_build_array(jsonb_build_object('name','External channels','status','not_checked_in_database_worker'))));
        if not coalesce((result->>'ok')::boolean,false) then raise exception 'step_failed'; end if;
        step_no:=(result->'mission'->>'next_step')::int;
      end loop;
      update public.nova_team_background_jobs set status='completed',attempts=attempts+1,last_error=null,last_run_at=now(),updated_at=now() where mission_id=job.mission_id;
      done:=done+1;
    exception when others then
      update public.nova_team_background_jobs set status=case when attempts>=2 then 'failed' else 'queued' end,attempts=attempts+1,last_error='The saved mission could not advance. Review its dependencies and resume.',last_run_at=now(),updated_at=now() where mission_id=job.mission_id;
    end;
  end loop;
  return jsonb_build_object('completed',done,'provider_calls',0,'spent_cents',0);
end $$;
revoke all on function public.nova_team_tick() from public,anon,authenticated;
grant execute on function public.nova_team_tick() to service_role;
