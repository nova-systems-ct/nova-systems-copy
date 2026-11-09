-- Native RCS and documented MSP Apple/TikTok adapters share the fenced, tenant-scoped customer journey.
-- Credential assignment is server-admin-only; client owners cannot point a draft at another business’s environment key.
ALTER TABLE wave1_conversations DROP CONSTRAINT wave1_conversations_channel_check;
ALTER TABLE wave1_conversations ADD CONSTRAINT wave1_conversations_channel_check CHECK(channel IN ('sms','voice','email','form','instagram','facebook','whatsapp','android_rcs','apple_messages','tiktok'));
ALTER TABLE ops_jobs DROP CONSTRAINT ops_jobs_source_channel_check;
ALTER TABLE ops_jobs ADD CONSTRAINT ops_jobs_source_channel_check CHECK(source_channel IN ('sms','voice','form','staff','missed_call','campaign','instagram','facebook','whatsapp','android_rcs','apple_messages','tiktok'));
ALTER TABLE channel_connections DROP CONSTRAINT channel_connections_provider_check;
ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_provider_check CHECK(provider IN ('instagram','facebook','whatsapp','android_rcs','apple_messages','tiktok'));
ALTER TABLE channel_connections DROP CONSTRAINT channel_connections_provider_account_id_check;
ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_provider_account_id_check CHECK((provider='android_rcs' AND provider_account_id ~ '^[A-Za-z0-9._@-]{1,128}$') OR (provider='apple_messages' AND provider_account_id ~ '^[A-Za-z0-9._:-]{1,128}$') OR (provider='tiktok' AND provider_account_id ~ '^[A-Za-z0-9._:@=+/-]{1,128}$') OR (provider IN ('instagram','facebook','whatsapp') AND provider_account_id ~ '^[0-9]{1,50}$'));
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS transport_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(transport_config)='object');
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS webhook_secret_ref text CHECK(webhook_secret_ref IS NULL OR webhook_secret_ref ~ '^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$');
ALTER TABLE channel_events ADD COLUMN IF NOT EXISTS transport_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(transport_metadata)='object');
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS credentials_assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS credentials_assigned_at timestamptz;
CREATE OR REPLACE FUNCTION nova_channel_ingest(p_event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c channel_connections; e channel_events; ident channel_identities; conv wave1_conversations;
 person uuid; mid uuid; at_time timestamptz; keyword text; queued boolean := false; watermark timestamptz; rule channel_comment_rules; matches integer;
BEGIN
 IF p_event->>'provider' NOT IN ('instagram','facebook','whatsapp','android_rcs','apple_messages','tiktok') OR p_event->>'kind' NOT IN ('message','comment','unsupported') OR length(coalesce(p_event->>'sender_id','')) NOT BETWEEN 1 AND 256 OR length(coalesce(p_event->>'event_id','')) NOT BETWEEN 1 AND 256 OR length(coalesce(p_event->>'text',''))>4000 THEN RAISE EXCEPTION 'Invalid channel event'; END IF;
 SELECT * INTO c FROM channel_connections WHERE provider=p_event->>'provider' AND provider_account_id=p_event->>'account_id' AND verified_at IS NOT NULL AND credentials_assigned_by IS NOT NULL AND credentials_assigned_at IS NOT NULL;
 IF c.id IS NULL THEN RETURN jsonb_build_object('ignored',true,'reason','account_not_verified'); END IF;
 at_time := (p_event->>'at')::timestamptz;
 IF at_time IS NULL OR NOT isfinite(at_time) OR at_time>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid event time'; END IF;
 at_time:=least(at_time,now());
 PERFORM pg_advisory_xact_lock(hashtextextended(c.id::text||':'||(p_event->>'sender_id'),0));
 SELECT * INTO e FROM channel_events WHERE connection_id=c.id AND provider_event_id=p_event->>'event_id';
 IF e.id IS NOT NULL THEN RETURN jsonb_build_object('duplicate',true,'event_id',e.id); END IF;
 INSERT INTO channel_events(organization_id,connection_id,provider_event_id,sender_id,kind,body,occurred_at,transport_metadata,status)
 VALUES(c.organization_id,c.id,p_event->>'event_id',p_event->>'sender_id',p_event->>'kind',p_event->>'text',at_time,jsonb_build_object('conversation_id',left(p_event->'metadata'->>'conversation_id',256)),CASE WHEN p_event->>'kind'='message' THEN 'received' ELSE 'needs_review' END) RETURNING * INTO e;
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
   INSERT INTO jobs(job_type,organization_id,payload,idempotency_key) VALUES('channel_'||CASE c.provider WHEN 'android_rcs' THEN 'rcs' WHEN 'apple_messages' THEN 'apple' ELSE c.provider END||'_turn',c.organization_id,jsonb_build_object('conversation_id',conv.id,'message_id',mid,'event_id',e.id),'channel-turn:'||e.id) ON CONFLICT(idempotency_key) DO NOTHING;
   queued:=true;
 END IF;
 UPDATE channel_events SET conversation_id=conv.id,message_id=mid,status=CASE WHEN queued THEN 'queued' ELSE 'needs_review' END WHERE id=e.id;
 RETURN jsonb_build_object('event_id',e.id,'conversation_id',conv.id,'message_id',mid,'contact_id',ident.contact_id,'queued',queued,'suppressed',ident.suppressed);
END $$;

CREATE OR REPLACE FUNCTION nova_channel_lock(p_org uuid,p_conversation uuid,p_token uuid,p_release boolean DEFAULT false,p_message uuid DEFAULT NULL,p_job uuid DEFAULT NULL,p_worker text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed uuid; first_message uuid;
BEGIN
 IF p_release THEN
  UPDATE channel_threads SET lock_token=NULL,lock_expires_at=NULL,lock_job_id=NULL,lock_worker=NULL WHERE organization_id=p_org AND conversation_id=p_conversation AND lock_token=p_token RETURNING id INTO changed;
 ELSE
  IF p_job IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs WHERE id=p_job AND organization_id=p_org AND job_type IN ('channel_conversation_turn',(SELECT 'channel_'||CASE cc.provider WHEN 'android_rcs' THEN 'rcs' WHEN 'apple_messages' THEN 'apple' ELSE cc.provider END||'_turn' FROM channel_threads tt JOIN channel_connections cc ON cc.id=tt.connection_id WHERE tt.organization_id=p_org AND tt.conversation_id=p_conversation)) AND status='leased' AND leased_by=p_worker AND leased_until>clock_timestamp() AND payload->>'message_id'=p_message::text AND payload->>'conversation_id'=p_conversation::text) THEN RETURN false; END IF;
  UPDATE channel_events e SET status='needs_review',error_code='late_event_requires_review' FROM channel_threads t WHERE t.organization_id=p_org AND t.conversation_id=p_conversation AND e.organization_id=p_org AND e.conversation_id=p_conversation AND e.status='queued' AND e.occurred_at<t.last_processed_at;
  SELECT message_id INTO first_message FROM channel_events WHERE organization_id=p_org AND conversation_id=p_conversation AND status='queued' AND kind='message' ORDER BY occurred_at,created_at,id LIMIT 1;
  IF p_message IS NULL OR first_message IS DISTINCT FROM p_message THEN RETURN false; END IF;
  UPDATE channel_threads SET lock_token=p_token,lock_expires_at=clock_timestamp()+interval '2 minutes',lock_job_id=p_job,lock_worker=p_worker WHERE organization_id=p_org AND conversation_id=p_conversation AND (lock_token IS NULL OR lock_expires_at<clock_timestamp()) RETURNING id INTO changed;
 END IF;
 RETURN changed IS NOT NULL;
END $$;

-- Retain existing work while moving pending legacy events to their channel-specific pause control.
UPDATE jobs j SET job_type='channel_'||CASE c.provider WHEN 'android_rcs' THEN 'rcs' WHEN 'apple_messages' THEN 'apple' ELSE c.provider END||'_turn' FROM channel_events e JOIN channel_connections c ON c.id=e.connection_id WHERE j.job_type='channel_conversation_turn' AND j.status='pending' AND j.payload->>'event_id'=e.id::text AND j.organization_id=e.organization_id;

UPDATE jobs j SET job_type='ops_sms_turn' FROM wave1_conversations c WHERE j.job_type='ops_conversation_turn' AND j.status='pending' AND j.organization_id=c.organization_id AND j.payload->>'conversation_id'=c.id::text AND c.channel='sms';

REVOKE ALL ON FUNCTION nova_channel_ingest(jsonb),nova_channel_lock(uuid,uuid,uuid,boolean,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nova_channel_ingest(jsonb),nova_channel_lock(uuid,uuid,uuid,boolean,uuid,uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';
