-- Additive channel routing. Credentials remain in the server secret store, never these tables.
ALTER TABLE wave1_conversations DROP CONSTRAINT IF EXISTS wave1_conversations_channel_check;
ALTER TABLE wave1_conversations ADD CONSTRAINT wave1_conversations_channel_check CHECK(channel IN ('sms','voice','email','form','instagram','facebook','whatsapp'));
ALTER TABLE ops_jobs DROP CONSTRAINT IF EXISTS ops_jobs_source_channel_check;
ALTER TABLE ops_jobs ADD CONSTRAINT ops_jobs_source_channel_check CHECK(source_channel IN ('sms','voice','form','staff','missed_call','campaign','instagram','facebook','whatsapp'));
CREATE UNIQUE INDEX IF NOT EXISTS crm_contact_id_org ON crm_contacts(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS wave1_conversation_id_org ON wave1_conversations(id,organization_id);
CREATE TABLE IF NOT EXISTS channel_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 provider text NOT NULL CHECK(provider IN ('instagram','facebook','whatsapp')),
 provider_account_id text NOT NULL CHECK(provider_account_id ~ '^[0-9]{1,50}$'), label text NOT NULL,
 login_mode text NOT NULL DEFAULT 'facebook' CHECK(login_mode IN ('facebook','instagram')),
 token_ref text NOT NULL CHECK(token_ref ~ '^NOVA_CHANNEL_TOKEN_[A-Z0-9_]{1,80}$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','enabled','paused')),
 automation_enabled boolean NOT NULL DEFAULT false, outbound_enabled boolean NOT NULL DEFAULT false,
 verified_at timestamptz, authorization_reference text, last_webhook_at timestamptz, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_account_id), UNIQUE(id,organization_id)
);
CREATE TABLE IF NOT EXISTS channel_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 connection_id uuid NOT NULL, external_user_id text NOT NULL,
 contact_id uuid NOT NULL, suppressed boolean NOT NULL DEFAULT false,
 suppression_at timestamptz, suppression_event_id text,
 marketing_consent boolean NOT NULL DEFAULT false, consent_source text, consent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(connection_id,organization_id) REFERENCES channel_connections(id,organization_id),
 FOREIGN KEY(contact_id,organization_id) REFERENCES crm_contacts(id,organization_id),
 UNIQUE(connection_id,external_user_id), UNIQUE(organization_id,connection_id,id)
);
CREATE TABLE IF NOT EXISTS channel_comment_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, connection_id uuid NOT NULL,
 keyword text NOT NULL CHECK(keyword ~ '^[A-Z0-9_]{2,32}$'),
 reply text NOT NULL CHECK(length(trim(reply))>0 AND octet_length(reply)<=1000),
 enabled boolean NOT NULL DEFAULT true, approved_by uuid NOT NULL REFERENCES auth.users(id),
 approved_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(connection_id,organization_id) REFERENCES channel_connections(id,organization_id),
 UNIQUE(id,connection_id,organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_one_active_keyword ON channel_comment_rules(connection_id,keyword) WHERE enabled;
CREATE TABLE IF NOT EXISTS channel_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 connection_id uuid NOT NULL, identity_id uuid NOT NULL, conversation_id uuid NOT NULL UNIQUE,
 lock_token uuid, lock_expires_at timestamptz, lock_job_id uuid REFERENCES jobs(id), lock_worker text,
 last_processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,connection_id,identity_id) REFERENCES channel_identities(organization_id,connection_id,id),
 FOREIGN KEY(conversation_id,organization_id) REFERENCES wave1_conversations(id,organization_id)
);
CREATE TABLE IF NOT EXISTS channel_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, connection_id uuid NOT NULL,
 provider_event_id text NOT NULL, sender_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('message','comment','unsupported')),
 body text, occurred_at timestamptz NOT NULL, conversation_id uuid, message_id uuid REFERENCES wave1_messages(id),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','queued','processed','needs_review','approved','submitting','provider_accepted','failed','ambiguous')),
 processed_at timestamptz, execution_started_at timestamptz, execution_token uuid,
 approved_reply text, approved_by uuid REFERENCES auth.users(id), approved_at timestamptz, approved_rule_id uuid,
 provider_message_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(connection_id,organization_id) REFERENCES channel_connections(id,organization_id),
 FOREIGN KEY(approved_rule_id,connection_id,organization_id) REFERENCES channel_comment_rules(id,connection_id,organization_id),
 FOREIGN KEY(conversation_id,organization_id) REFERENCES wave1_conversations(id,organization_id),
 UNIQUE(connection_id,provider_event_id)
);
CREATE INDEX IF NOT EXISTS channel_events_business_recent ON channel_events(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS channel_turn_results (
 message_id uuid PRIMARY KEY REFERENCES wave1_messages(id), organization_id uuid NOT NULL,
 conversation_id uuid NOT NULL, contact_id uuid NOT NULL, reply text, purpose text NOT NULL,
 result jsonb NOT NULL, is_test boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conversation_id,organization_id) REFERENCES wave1_conversations(id,organization_id),
 FOREIGN KEY(contact_id,organization_id) REFERENCES crm_contacts(id,organization_id)
);
CREATE OR REPLACE FUNCTION nova_channel_ingest(p_event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c channel_connections; e channel_events; ident channel_identities; conv wave1_conversations;
 person uuid; mid uuid; at_time timestamptz; keyword text; queued boolean := false; watermark timestamptz; rule channel_comment_rules; matches integer;
BEGIN
 IF p_event->>'provider' NOT IN ('instagram','facebook','whatsapp') OR p_event->>'kind' NOT IN ('message','comment','unsupported') OR length(coalesce(p_event->>'sender_id','')) NOT BETWEEN 1 AND 256 OR length(coalesce(p_event->>'event_id','')) NOT BETWEEN 1 AND 256 OR length(coalesce(p_event->>'text',''))>4000 THEN RAISE EXCEPTION 'Invalid channel event'; END IF;
 SELECT * INTO c FROM channel_connections WHERE provider=p_event->>'provider' AND provider_account_id=p_event->>'account_id' AND verified_at IS NOT NULL;
 IF c.id IS NULL THEN RETURN jsonb_build_object('ignored',true,'reason','account_not_verified'); END IF;
 at_time := (p_event->>'at')::timestamptz;
 IF at_time IS NULL OR NOT isfinite(at_time) OR at_time>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid event time'; END IF;
 at_time:=least(at_time,now());
 PERFORM pg_advisory_xact_lock(hashtextextended(c.id::text||':'||(p_event->>'sender_id'),0));
 SELECT * INTO e FROM channel_events WHERE connection_id=c.id AND provider_event_id=p_event->>'event_id';
 IF e.id IS NOT NULL THEN RETURN jsonb_build_object('duplicate',true,'event_id',e.id); END IF;
 INSERT INTO channel_events(organization_id,connection_id,provider_event_id,sender_id,kind,body,occurred_at,status)
 VALUES(c.organization_id,c.id,p_event->>'event_id',p_event->>'sender_id',p_event->>'kind',p_event->>'text',at_time,CASE WHEN p_event->>'kind'='message' THEN 'received' ELSE 'needs_review' END) RETURNING * INTO e;
 UPDATE channel_connections SET last_webhook_at=now() WHERE id=c.id;
 IF e.kind='comment' THEN
  IF c.provider='instagram' AND c.status='enabled' AND c.automation_enabled AND at_time>=now()-interval '7 days' THEN
   SELECT count(*) INTO matches FROM channel_comment_rules r WHERE r.connection_id=c.id AND r.enabled AND r.approved_at<=at_time AND upper(e.body) ~ ('(^|[^A-Z0-9_])'||r.keyword||'([^A-Z0-9_]|$)');
   IF matches=1 THEN
    SELECT * INTO rule FROM channel_comment_rules r WHERE r.connection_id=c.id AND r.enabled AND r.approved_at<=at_time AND upper(e.body) ~ ('(^|[^A-Z0-9_])'||r.keyword||'([^A-Z0-9_]|$)');
    UPDATE channel_events SET status='approved',approved_reply=rule.reply,approved_by=rule.approved_by,approved_at=now(),approved_rule_id=rule.id WHERE id=e.id;
    INSERT INTO jobs(job_type,organization_id,payload,idempotency_key) VALUES('channel_comment_reply',c.organization_id,jsonb_build_object('event_id',e.id),'channel-comment:'||e.id) ON CONFLICT(idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('event_id',e.id,'queued',true);
   END IF;
  END IF;
  RETURN jsonb_build_object('event_id',e.id,'needs_review',true);
 END IF;
 SELECT * INTO ident FROM channel_identities WHERE connection_id=c.id AND external_user_id=e.sender_id;
 IF ident.id IS NULL THEN
   INSERT INTO crm_contacts(organization_id,name,source) VALUES(c.organization_id,initcap(c.provider)||' contact (name not provided)',c.provider) RETURNING id INTO person;
   INSERT INTO channel_identities(organization_id,connection_id,external_user_id,contact_id) VALUES(c.organization_id,c.id,e.sender_id,person) RETURNING * INTO ident;
 END IF;
 SELECT * INTO conv FROM wave1_conversations WHERE organization_id=c.organization_id AND contact_id=ident.contact_id AND channel=c.provider;
 IF conv.id IS NULL THEN
   INSERT INTO wave1_conversations(organization_id,contact_id,channel,customer_initiated_at,last_inbound_at)
   VALUES(c.organization_id,ident.contact_id,c.provider,at_time,at_time) RETURNING * INTO conv;
   INSERT INTO channel_threads(organization_id,connection_id,identity_id,conversation_id) VALUES(c.organization_id,c.id,ident.id,conv.id);
 ELSE
   UPDATE wave1_conversations SET last_inbound_at=greatest(last_inbound_at,at_time),customer_initiated_at=greatest(customer_initiated_at,at_time),contact_replied_since_trigger=true WHERE id=conv.id AND organization_id=c.organization_id;
 END IF;
 keyword:=upper(trim(coalesce(e.body,'')));
 SELECT last_processed_at INTO watermark FROM channel_threads WHERE conversation_id=conv.id AND organization_id=c.organization_id;
 IF keyword IN ('STOP','UNSUBSCRIBE','CANCEL','END','QUIT') AND (ident.suppression_at IS NULL OR at_time>=ident.suppression_at) THEN
   UPDATE channel_identities SET suppressed=true,suppression_at=at_time,suppression_event_id=e.provider_event_id WHERE id=ident.id; ident.suppressed:=true;
 ELSIF keyword IN ('START','UNSTOP') AND (ident.suppression_at IS NULL OR at_time>ident.suppression_at) THEN
   UPDATE channel_identities SET suppressed=false,suppression_at=at_time,suppression_event_id=e.provider_event_id WHERE id=ident.id; ident.suppressed:=false;
 END IF;
 INSERT INTO wave1_messages(organization_id,conversation_id,direction,body,purpose,status,provider,provider_sid,idempotency_key,created_at)
 VALUES(c.organization_id,conv.id,'inbound',e.body,CASE WHEN keyword IN ('STOP','UNSUBSCRIBE','CANCEL','END','QUIT','START','UNSTOP') THEN 'channel_keyword' ELSE 'message' END,'received','channel:'||c.id,e.provider_event_id,'channel-in:'||e.id,at_time) RETURNING id INTO mid;
 IF e.kind='unsupported' THEN UPDATE wave1_conversations SET staff_takeover=true WHERE id=conv.id AND organization_id=c.organization_id;
 ELSIF c.status='enabled' AND c.automation_enabled AND at_time>=now()-interval '24 hours' AND (watermark IS NULL OR at_time>=watermark) AND NOT ident.suppressed AND keyword NOT IN ('START','UNSTOP') AND NOT conv.staff_takeover THEN
   INSERT INTO jobs(job_type,organization_id,payload,idempotency_key) VALUES('channel_conversation_turn',c.organization_id,jsonb_build_object('conversation_id',conv.id,'message_id',mid,'event_id',e.id),'channel-turn:'||e.id) ON CONFLICT(idempotency_key) DO NOTHING;
   queued:=true;
 END IF;
 UPDATE channel_events SET conversation_id=conv.id,message_id=mid,status=CASE WHEN queued THEN 'queued' ELSE 'needs_review' END WHERE id=e.id;
 RETURN jsonb_build_object('event_id',e.id,'conversation_id',conv.id,'message_id',mid,'contact_id',ident.contact_id,'queued',queued,'suppressed',ident.suppressed);
END $$;
CREATE OR REPLACE FUNCTION nova_channel_finish(p_org uuid,p_conversation uuid,p_message uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE ev channel_events; held channel_threads;
BEGIN
 SELECT * INTO held FROM channel_threads WHERE organization_id=p_org AND conversation_id=p_conversation AND lock_token=p_token AND lock_expires_at>clock_timestamp() FOR UPDATE;
 IF held.id IS NULL THEN RETURN false; END IF;
 IF held.lock_job_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs WHERE id=held.lock_job_id AND status='leased' AND leased_by=held.lock_worker AND leased_until>clock_timestamp()) THEN RETURN false; END IF;
 SELECT * INTO ev FROM channel_events WHERE organization_id=p_org AND conversation_id=p_conversation AND message_id=p_message AND status='queued' FOR UPDATE;
 IF ev.id IS NULL THEN RETURN false; END IF;
 UPDATE channel_events SET status='processed',processed_at=now() WHERE id=ev.id;
 UPDATE channel_threads SET last_processed_at=greatest(last_processed_at,ev.occurred_at),lock_token=NULL,lock_expires_at=NULL,lock_job_id=NULL,lock_worker=NULL WHERE id=held.id;
 RETURN true;
END $$;
DROP FUNCTION IF EXISTS nova_channel_lock(uuid,uuid,uuid,boolean);
DROP FUNCTION IF EXISTS nova_channel_lock(uuid,uuid,uuid,boolean,uuid);
CREATE OR REPLACE FUNCTION nova_channel_lock(p_org uuid,p_conversation uuid,p_token uuid,p_release boolean DEFAULT false,p_message uuid DEFAULT NULL,p_job uuid DEFAULT NULL,p_worker text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed uuid; first_message uuid;
BEGIN
 IF p_release THEN
  UPDATE channel_threads SET lock_token=NULL,lock_expires_at=NULL,lock_job_id=NULL,lock_worker=NULL WHERE organization_id=p_org AND conversation_id=p_conversation AND lock_token=p_token RETURNING id INTO changed;
 ELSE
  IF p_job IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs WHERE id=p_job AND organization_id=p_org AND job_type='channel_conversation_turn' AND status='leased' AND leased_by=p_worker AND leased_until>clock_timestamp() AND payload->>'message_id'=p_message::text AND payload->>'conversation_id'=p_conversation::text) THEN RETURN false; END IF;
  UPDATE channel_events e SET status='needs_review',error_code='late_event_requires_review' FROM channel_threads t WHERE t.organization_id=p_org AND t.conversation_id=p_conversation AND e.organization_id=p_org AND e.conversation_id=p_conversation AND e.status='queued' AND e.occurred_at<t.last_processed_at;
  SELECT message_id INTO first_message FROM channel_events WHERE organization_id=p_org AND conversation_id=p_conversation AND status='queued' AND kind='message' ORDER BY occurred_at,created_at,id LIMIT 1;
  IF p_message IS NULL OR first_message IS DISTINCT FROM p_message THEN RETURN false; END IF;
  UPDATE channel_threads SET lock_token=p_token,lock_expires_at=clock_timestamp()+interval '2 minutes',lock_job_id=p_job,lock_worker=p_worker WHERE organization_id=p_org AND conversation_id=p_conversation AND (lock_token IS NULL OR lock_expires_at<clock_timestamp()) RETURNING id INTO changed;
 END IF;
 RETURN changed IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION nova_channel_renew(p_org uuid,p_conversation uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed uuid;
BEGIN
 UPDATE channel_threads t SET lock_expires_at=clock_timestamp()+interval '2 minutes' WHERE organization_id=p_org AND conversation_id=p_conversation AND lock_token=p_token AND lock_expires_at>clock_timestamp() AND (lock_job_id IS NULL OR EXISTS(SELECT 1 FROM jobs j WHERE j.id=t.lock_job_id AND j.status='leased' AND j.leased_by=t.lock_worker AND j.leased_until>clock_timestamp())) RETURNING id INTO changed;
 RETURN changed IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION nova_defer_job(p_job uuid,p_worker text,p_seconds integer,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed uuid;
BEGIN
 UPDATE jobs SET status='pending',scheduled_at=now()+make_interval(secs=>greatest(5,least(p_seconds,3600))),attempts=greatest(0,attempts-1),leased_by=NULL,leased_until=NULL,last_error=left(p_reason,500) WHERE id=p_job AND status='leased' AND leased_by=p_worker AND leased_until>now() RETURNING id INTO changed;
 RETURN changed IS NOT NULL;
END $$;
-- Every reused booking/state write in a channel turn carries this fence in PostgREST headers.
-- Both rows stay locked through the write, including writes made inside ops_hold_slot.
CREATE OR REPLACE FUNCTION nova_channel_assert_turn(p_org uuid,p_conversation uuid,p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE held channel_threads; live_job uuid;
BEGIN
 SELECT * INTO held FROM channel_threads WHERE organization_id=p_org AND conversation_id=p_conversation AND lock_token=p_token AND lock_expires_at>clock_timestamp() FOR UPDATE;
 IF held.id IS NULL OR held.lock_job_id IS NULL THEN RAISE EXCEPTION 'Channel execution lease lost' USING ERRCODE='P0001'; END IF;
 SELECT id INTO live_job FROM jobs WHERE id=held.lock_job_id AND organization_id=p_org AND status='leased' AND leased_by=held.lock_worker AND leased_until>clock_timestamp() FOR UPDATE;
 IF live_job IS NULL THEN RAISE EXCEPTION 'Channel job lease lost' USING ERRCODE='P0001'; END IF;
END $$;
CREATE OR REPLACE FUNCTION nova_channel_write_fence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE h jsonb; token text; org_id uuid; conv_id uuid; row_data jsonb;
BEGIN
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; token:=h->>'x-nova-channel-turn';
 IF token IS NULL THEN RETURN NEW; END IF;
 org_id:=(h->>'x-nova-channel-org')::uuid;conv_id:=(h->>'x-nova-channel-conversation')::uuid;
 PERFORM nova_channel_assert_turn(org_id,conv_id,token::uuid);
 row_data:=to_jsonb(NEW);
 IF row_data->>'organization_id' IS NOT NULL AND row_data->>'organization_id'<>org_id::text THEN RAISE EXCEPTION 'Channel business mismatch'; END IF;
 IF TG_TABLE_NAME='wave1_conversations' AND row_data->>'id'<>conv_id::text THEN RAISE EXCEPTION 'Channel conversation mismatch'; END IF;
 IF TG_TABLE_NAME IN ('wave1_messages','ops_jobs') AND row_data->>'conversation_id' IS DISTINCT FROM conv_id::text THEN RAISE EXCEPTION 'Channel thread mismatch'; END IF;
 IF TG_TABLE_NAME IN ('ops_bookings','ops_agreements') AND NOT EXISTS(SELECT 1 FROM ops_jobs WHERE id=(row_data->>'job_id')::uuid AND organization_id=org_id AND conversation_id=conv_id) THEN RAISE EXCEPTION 'Channel booking mismatch'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['wave1_conversations','wave1_messages','ops_jobs','ops_bookings','ops_agreements','ops_transitions','ops_incidents','ops_followups','crm_contacts','channel_events','channel_turn_results'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS nova_channel_execution_fence ON %I',t);
  EXECUTE format('CREATE TRIGGER nova_channel_execution_fence BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION nova_channel_write_fence()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION nova_channel_begin_turn(p_org uuid,p_conversation uuid,p_message uuid,p_token uuid) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE ev channel_events;
BEGIN
 PERFORM nova_channel_assert_turn(p_org,p_conversation,p_token);
 SELECT * INTO ev FROM channel_events WHERE organization_id=p_org AND conversation_id=p_conversation AND message_id=p_message AND status='queued' FOR UPDATE;
 IF ev.id IS NULL THEN RETURN 'unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM channel_turn_results WHERE message_id=p_message AND organization_id=p_org AND conversation_id=p_conversation) THEN RETURN 'resume'; END IF;
 IF ev.execution_started_at IS NOT NULL AND ev.execution_token IS DISTINCT FROM p_token THEN
  UPDATE channel_events SET status='needs_review',error_code='incomplete_turn_requires_review' WHERE id=ev.id;
  UPDATE wave1_conversations SET staff_takeover=true WHERE id=p_conversation AND organization_id=p_org;
  RETURN 'uncertain';
 END IF;
 UPDATE channel_events SET execution_started_at=now(),execution_token=p_token WHERE id=ev.id;
 RETURN 'fresh';
END $$;
CREATE OR REPLACE FUNCTION nova_channel_prepare_reply(p_org uuid,p_conversation uuid,p_message uuid,p_token uuid,p_state text,p_context jsonb,p_contact uuid,p_reply text,p_purpose text,p_result jsonb,p_is_test boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM nova_channel_assert_turn(p_org,p_conversation,p_token);
 IF NOT EXISTS(SELECT 1 FROM channel_events WHERE organization_id=p_org AND conversation_id=p_conversation AND message_id=p_message AND status='queued' AND execution_token=p_token) THEN RAISE EXCEPTION 'Channel turn not started'; END IF;
 INSERT INTO channel_turn_results(message_id,organization_id,conversation_id,contact_id,reply,purpose,result,is_test) VALUES(p_message,p_org,p_conversation,p_contact,p_reply,p_purpose,p_result,p_is_test);
 UPDATE wave1_conversations SET engine_state=p_state,engine_context=p_context WHERE id=p_conversation AND organization_id=p_org;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION nova_approve_channel_comment(p_org uuid,p_event uuid,p_actor uuid,p_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE ev channel_events;
BEGIN
 IF length(trim(p_text))=0 OR octet_length(p_text)>1000 THEN RAISE EXCEPTION 'Invalid approved text'; END IF;
 SELECT * INTO ev FROM channel_events WHERE id=p_event AND organization_id=p_org AND kind='comment' FOR UPDATE;
 IF ev.id IS NULL OR ev.occurred_at<now()-interval '7 days' OR ev.occurred_at>now() THEN RETURN jsonb_build_object('ok',false,'reason','Comment unavailable or outside the private reply window'); END IF;
 IF ev.status NOT IN ('needs_review','approved') OR (ev.status='approved' AND (ev.approved_by IS DISTINCT FROM p_actor OR ev.approved_reply IS DISTINCT FROM p_text)) THEN RETURN jsonb_build_object('ok',false,'reason','This comment already has a different approval or send attempt'); END IF;
 UPDATE channel_events SET status='approved',approved_reply=p_text,approved_by=p_actor,approved_at=coalesce(approved_at,now()) WHERE id=ev.id;
 INSERT INTO jobs(job_type,organization_id,payload,idempotency_key) VALUES('channel_comment_reply',p_org,jsonb_build_object('event_id',ev.id),'channel-comment:'||ev.id) ON CONFLICT(idempotency_key) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'event_id',ev.id);
END $$;
CREATE OR REPLACE FUNCTION nova_channel_claim_comment(p_org uuid,p_event uuid,p_job uuid,p_worker text) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE live_job uuid; ev channel_events; c channel_connections;
BEGIN
 SELECT id INTO live_job FROM jobs WHERE id=p_job AND organization_id=p_org AND job_type='channel_comment_reply' AND payload->>'event_id'=p_event::text AND status='leased' AND leased_by=p_worker AND leased_until>clock_timestamp() FOR UPDATE;
 IF live_job IS NULL THEN RETURN 'job_lease_lost'; END IF;
 SELECT * INTO ev FROM channel_events WHERE id=p_event AND organization_id=p_org AND kind='comment' AND status='approved' FOR UPDATE;
 IF ev.id IS NULL THEN RETURN 'already_attempted'; END IF;
 SELECT * INTO c FROM channel_connections WHERE id=ev.connection_id AND organization_id=p_org;
 IF c.provider<>'instagram' OR c.verified_at IS NULL OR c.status<>'enabled' OR NOT c.automation_enabled OR NOT c.outbound_enabled THEN RETURN 'paused'; END IF;
 IF ev.approved_rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM channel_comment_rules WHERE id=ev.approved_rule_id AND organization_id=p_org AND connection_id=c.id AND enabled AND reply=ev.approved_reply) THEN RETURN 'paused'; END IF;
 IF EXISTS(SELECT 1 FROM wave1_org_settings WHERE organization_id=p_org AND (paused OR 'instagram'=ANY(channels_paused))) THEN RETURN 'paused'; END IF;
 IF ev.occurred_at<clock_timestamp()-interval '7 days' OR ev.occurred_at>clock_timestamp() THEN RETURN 'private_reply_window_closed'; END IF;
 IF EXISTS(SELECT 1 FROM channel_identities i JOIN crm_contacts p ON p.id=i.contact_id AND p.organization_id=i.organization_id WHERE i.organization_id=p_org AND i.connection_id=c.id AND i.external_user_id=ev.sender_id AND (i.suppressed OR p.suppressed OR p.do_not_contact)) THEN RETURN 'suppressed_opt_out'; END IF;
 UPDATE channel_events SET status='submitting' WHERE id=ev.id;
 RETURN 'claimed';
END $$;
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_turn_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON channel_connections,channel_identities,channel_threads,channel_events,channel_comment_rules,channel_turn_results FROM PUBLIC,anon,authenticated;
GRANT ALL ON channel_connections,channel_identities,channel_threads,channel_events,channel_comment_rules,channel_turn_results TO service_role;
REVOKE ALL ON FUNCTION nova_channel_ingest(jsonb),nova_channel_lock(uuid,uuid,uuid,boolean,uuid,uuid,text),nova_channel_renew(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nova_channel_ingest(jsonb),nova_channel_lock(uuid,uuid,uuid,boolean,uuid,uuid,text),nova_channel_renew(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION nova_channel_finish(uuid,uuid,uuid,uuid),nova_defer_job(uuid,text,integer,text),nova_approve_channel_comment(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nova_channel_finish(uuid,uuid,uuid,uuid),nova_defer_job(uuid,text,integer,text),nova_approve_channel_comment(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION nova_channel_assert_turn(uuid,uuid,uuid),nova_channel_write_fence(),nova_channel_begin_turn(uuid,uuid,uuid,uuid),nova_channel_prepare_reply(uuid,uuid,uuid,uuid,text,jsonb,uuid,text,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nova_channel_assert_turn(uuid,uuid,uuid),nova_channel_write_fence(),nova_channel_begin_turn(uuid,uuid,uuid,uuid),nova_channel_prepare_reply(uuid,uuid,uuid,uuid,text,jsonb,uuid,text,text,jsonb,boolean) TO service_role;
REVOKE ALL ON FUNCTION nova_channel_claim_comment(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nova_channel_claim_comment(uuid,uuid,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
