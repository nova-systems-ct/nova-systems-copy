// Real DB, API and worker; only the documented Infobip network response is a local stand-in.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {startTestEnv} from './testenv/env.mjs';
import {makeCaller} from './testenv/call.mjs';
import {clearProviderEnv,setupTestBusiness} from './testenv/opsFixture.mjs';
clearProviderEnv();
const env=await startTestEnv({migrations:JSON.parse(fs.readFileSync('supabase/migration-manifest.json')).order,bootstrap:'platform',publicBuckets:[]});
const originalFetch=globalThis.fetch,outgoing=[];
try{
 assert.deepEqual(env.migrationErrors,[]);
 Object.assign(process.env,env.appEnv,{APP_BASE_URL:'https://nova.test',NOVA_SPENDING_LOCK:'locked',NOVA_CHANNEL_SEND_ENABLED:'false',NOVA_ROLE_MODEL:'off',NOVA_CHANNEL_TOKEN_TIKTOK_TEST:'LOCAL-API-KEY',NOVA_CHANNEL_WEBHOOK_TIKTOK_TEST:'LOCAL-only-webhook-secret-at-least-32-characters'});
 globalThis.fetch=async(url,init={})=>{
  const u=new URL(url);
  if(u.origin==='https://test.api.infobip.com'){
   assert.equal(u.pathname,'/tiktok/1/messages'); assert.equal(init.headers.Authorization,'App LOCAL-API-KEY');
   const body=JSON.parse(init.body);outgoing.push(body);const message=body.messages[0];
   return Response.json({messages:[{messageId:message.destinations[0].messageId,status:{groupName:'PENDING',name:'PENDING_ACCEPTED'}}]});
  }
  assert(['127.0.0.1','localhost'].includes(u.hostname),'No real external provider in this test');return originalFetch(url,init);
 };
 const q=async(sql,args)=>(await env.sql(sql,args)).rows;
 const nova=(await q("insert into organizations(name,slug,kind) values('TEST Nova TikTok','tiktok-nova','nova_internal') returning id"))[0].id;
 const admin=await env.createUser({email:'tiktok-admin@nova.test',role:'nova_super_admin',orgId:nova});
 const client=makeCaller((await import('../api/client.js')).default);
 const {biz}=await setupTestBusiness({env,client,ownerToken:admin.token});
 const owner=await env.createUser({email:'tiktok-owner@business.test',role:'client_owner',orgId:biz});
 const handler=(await import('../api/integrations.js')).default,channel=makeCaller(handler);
 const act=(body,token=owner.token)=>channel({op:'channels',body:{organization_id:biz,...body},token});
 let r=await act({action:'prepare',provider:'tiktok',provider_account_id:'owned-tiktok-business',label:'TEST TikTok Messages',token_ref:'NOVA_CHANNEL_TOKEN_TIKTOK_TEST',webhook_secret_ref:'NOVA_CHANNEL_WEBHOOK_TIKTOK_TEST',transport_config:{api_base:'https://test.api.infobip.com',account_region:'BR'}});
 assert.equal(r.status,200,JSON.stringify(r.body));const id=r.body.connection.id;
 assert.equal((await act({action:'assign-credentials',connection_id:id})).status,403);
 assert.equal((await act({action:'assign-credentials',connection_id:id},admin.token)).status,200);
 assert.equal((await act({action:'verify-account',connection_id:id})).status,409,'No invented account verification before a matching provider callback');
 const us=await act({action:'prepare',provider:'tiktok',provider_account_id:'owned-us-tiktok',label:'TEST actual US region',token_ref:'NOVA_CHANNEL_TOKEN_TIKTOK_TEST',webhook_secret_ref:'NOVA_CHANNEL_WEBHOOK_TIKTOK_TEST',transport_config:{api_base:'https://test.api.infobip.com',account_region:'US'}});
 assert.equal(us.status,200);assert.equal((await act({action:'verify-account',connection_id:us.body.connection.id})).status,409);
 assert.equal((await act({action:'configure',connection_id:us.body.connection.id,status:'enabled',automation_enabled:true,authorization_reference:'TEST region must not be bypassed'})).status,409);

 let sequence=0;
 const incoming=async(text,{destination='owned-tiktok-business',auth=true,messageId}={})=>{
  const body=Buffer.from(JSON.stringify({results:[{integrationType:'TIKTOK',sender:'opaque-tiktok-user+base64=',to:destination,messageId:messageId||`TEST-tiktok-${++sequence}`,receivedAt:new Date().toISOString(),message:{type:'TEXT',text,conversationId:'TEST-conversation'}}]}));
  const req=Readable.from([body]);Object.assign(req,{method:'POST',query:{op:'tiktok-webhook',connection_id:id},headers:{authorization:auth?'Basic '+Buffer.from(`nova:${process.env.NOVA_CHANNEL_WEBHOOK_TIKTOK_TEST}`).toString('base64'):'bad'}});
  const res={code:200,status(c){this.code=c;return this},json(b){this.body=b;return this}};await handler(req,res);return res;
 };
 assert.equal((await incoming('Hello',{auth:false})).code,403);
 assert.equal((await incoming('Hello',{destination:'other-business'})).code,503);
 r=await incoming('Hello');assert.equal(r.code,200);assert.equal(r.body.awaiting_verification,true);
 assert.equal((await q('select count(*)::int as n from channel_events'))[0].n,0,'Routing proof must not start unverified automation');
 assert.equal((await act({action:'verify-account',connection_id:id})).status,200);
 assert.equal((await act({action:'configure',connection_id:id,status:'enabled',automation_enabled:true,outbound_enabled:false,authorization_reference:'LOCAL TEST exact sender and callback'})).status,200);
 const {createPostgresJobStore}=await import('../worker/postgresJobStore.mjs'),W=await import('../worker/index.mjs');
 const store=createPostgresJobStore({url:env.base,serviceKey:env.serviceKey});const run=()=>W.processOneJob(store,{mode:'postgres',url:env.base,serviceKey:env.serviceKey,store});
 await incoming('Hello',{messageId:'first'});await incoming('Hello',{messageId:'first'});
 assert.equal((await q("select count(*)::int as n from jobs where job_type='channel_tiktok_turn'"))[0].n,1);
 // This channel has an independent pause; another active channel cannot override it.
 await q("insert into workers(worker_type,display_name,status,capability_key) values('service_account','TEST TikTok worker','suspended','tiktok_inbox'),('service_account','TEST Instagram worker','active','instagram_inbox')");
 assert.equal(await run(),false);assert.equal(outgoing.length,0);
 await q("update workers set status='active' where capability_key='tiktok_inbox'");
 // Claimable types are cached briefly by the laptop runtime; clear its test clock by using the hosted path below.
 const [{id:queuedId}]=await q("select id from jobs where job_type='channel_tiktok_turn'");
 const {runChannelTurn}=await import('../api/_channels/service.js');
 const [leased]=await q("update jobs set status='leased',leased_by='TEST-TikTok-owned-lease',leased_until=now()+interval '2 minutes' where id=$1 returning *",[queuedId]);
 const locked=await runChannelTurn(leased);assert.equal(locked.reply_status,'blocked');assert.equal(outgoing.length,0);
 await q("update jobs set status='completed',leased_by=null,leased_until=null where id=$1",[queuedId]);
 const contact=(await q('select * from crm_contacts where organization_id=$1',[biz]))[0];assert.equal(contact.phone_e164,null);assert.equal(contact.sms_consent,false);
 process.env.NOVA_SPENDING_LOCK='disabled';process.env.NOVA_CHANNEL_SEND_ENABLED='true';await q('update channel_connections set outbound_enabled=true where id=$1',[id]);
 const next=async(text)=>{await incoming(text);const [job]=await q("update jobs set status='leased',leased_by='TEST-TikTok-next',leased_until=now()+interval '2 minutes' where id=(select id from jobs where job_type='channel_tiktok_turn' and status='pending' order by created_at limit 1) returning *");assert(job);await runChannelTurn(job);await q("update jobs set status='completed',leased_by=null,leased_until=null where id=$1",[job.id]);};
 await next('1');await next('1');
 const [job]=await q('select state,source_channel from ops_jobs where organization_id=$1',[biz]);assert.equal(job.state,'awaiting_agreement');assert.equal(job.source_channel,'tiktok');
 assert(outgoing.some(x=>x.messages[0].content.text.includes('/service/')),'The agreement stays in TikTok Messages');
 const before=outgoing.length;await incoming('STOP');assert.equal((await q('select suppressed from channel_identities where organization_id=$1',[biz]))[0].suppressed,true);assert.equal(outgoing.length,before);

 const outsider=await env.createUser({email:'tiktok-outsider@nova.test',role:'client_owner',orgId:nova});assert.equal((await act({action:'configure',connection_id:id,status:'paused'},outsider.token)).status,403);
 console.log('PASS — scoped TikTok connection, authenticated routing proof, independent worker pause, duplicate protection, spending lock, real service/time/agreement journey, STOP and tenant denial. US account activation is refused. MSP responses are local stand-ins; no live TikTok acceptance claimed.');
}catch(e){console.error(e);process.exitCode=1;}finally{globalThis.fetch=originalFetch;await env.stop();}
process.exit(process.exitCode??0);
