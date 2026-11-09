// Real disposable Postgres/PostgREST and production form handler. No provider sends.
// Catches phone-only submissions being treated as SMS requests, and service
// permission leaking into the marketing audience.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startTestEnv} from './testenv/env.mjs';
import {makeCaller} from './testenv/call.mjs';
import {setupTestBusiness,clearProviderEnv} from './testenv/opsFixture.mjs';
import {handleFormIntake,handleSmsInbound} from '../api/_wave1Handlers.js';
import {twilioSignature} from '../api/_wave1.js';
import {createPostgrestRepo} from '../api/_wave1Repo.js';
clearProviderEnv();
const env=await startTestEnv({migrations:JSON.parse(fs.readFileSync('supabase/migration-manifest.json')).order,bootstrap:'platform',publicBuckets:[]});
try {
 Object.assign(process.env,env.appEnv,{NOVA_SPENDING_LOCK:'locked'});
 const {evaluateOpsSend}=await import('../api/_ops/messaging.js');
 assert.deepEqual(env.migrationErrors,[]);
 const q=async(s,p)=>(await env.sql(s,p)).rows;
 const client=makeCaller((await import('../api/client.js')).default);
 const nova=(await q("insert into organizations(name,slug,kind) values('TEST Nova','form-sms-test','nova_internal') returning id"))[0].id;
 const owner=await env.createUser({email:'form-sms-owner@nova.test',role:'nova_super_admin',orgId:nova});
 const {biz}=await setupTestBusiness({env,client,ownerToken:owner.token,name:'TEST SMS consent'});
 const token='test-form-sms-consent-0123456789';
 await q('update wave1_org_settings set form_token=$1 where organization_id=$2',[token,biz]);
 const repo=createPostgrestRepo({url:env.base,key:env.serviceKey});
 const body={submission_id:'phone-only',rendered_at:Date.now()-5000,fields:{name:'TEST Requester',phone:'+12035550191',message:'Please help with this request'}};
 let r=await handleFormIntake({token,body},repo);
 assert.equal(r.status,200);
 let conv=(await q('select * from wave1_conversations where id=$1',[r.internal.conversationId]))[0];
 assert.equal(conv.channel,'form','A phone field alone must continue on the web, not initiate SMS');
 assert.equal(conv.customer_initiated_at,null);
 assert.equal(r.internal.continuesBySms,false);
 assert.equal((await q("select count(*)::int n from jobs where job_type in ('ops_conversation_turn','ops_sms_turn')"))[0].n,0);
 console.log('PASS — phone-only submission neither starts an SMS conversation nor queues a text');

 const policy={version:'test-service-sms-v1',text:'TEST business service messages only',source_path:'/book',privacy_path:'/privacy',terms_path:'/terms'};
 const opted={...body,submission_id:'service-opt-in',fields:{...body.fields,phone:'+12035550192',service_sms_consent:true,service_sms_consent_version:policy.version,sms_consent:true}};
 r=await handleFormIntake({token,body:opted,serviceSmsPolicy:policy},repo);
 assert.equal(r.status,200);assert.equal(r.internal.continuesBySms,true);
 conv=(await q('select * from wave1_conversations where id=$1',[r.internal.conversationId]))[0];
 const contact=(await q('select * from crm_contacts where id=$1',[r.internal.contactId]))[0];
 assert.equal(conv.channel,'sms');assert(conv.customer_initiated_at);
 assert.equal(contact.sms_consent,false,'Service consent must not add a contact to marketing/Revive');
 assert.equal((await q('select job_type from jobs where payload->>\'conversation_id\'=$1',[conv.id]))[0].job_type,'ops_sms_turn');
 const events=await q("select payload_summary from wave1_source_events where organization_id=$1 and source='web_form' and source_event_id=$2",[biz,`${biz}:service-opt-in`]);
 const proof=events[0].payload_summary.sms_service_opt_in;
 assert.equal(proof.granted,true);assert.equal(proof.scope,'service_request_only');
 assert.equal(proof.disclosure,'TEST business service messages only');assert.equal(proof.version,'test-service-sms-v1');assert.equal(proof.phone_e164,'+12035550192');assert(proof.recorded_at);
 assert.equal((await handleFormIntake({token,body:opted,serviceSmsPolicy:policy},repo)).body.duplicate,true);
 assert.equal((await q('select count(*)::int n from jobs where payload->>\'conversation_id\'=$1',[conv.id]))[0].n,1);
 const send={purpose:'booking_link',contact,conversation:conv,org:{timezone:'America/New_York',quiet_hours:{start:0,end:0}}};
 assert.equal(evaluateOpsSend(send).allowed,true);
 assert.equal(evaluateOpsSend({...send,purpose:'reactivation'}).allowed,false,'Service permission must never authorize a promotion');
 assert.equal(evaluateOpsSend({...send,contact:{...contact,suppressed:true}}).allowed,false);
 console.log('PASS — versioned service permission has saved evidence, one dedicated SMS job, no marketing permission, and STOP still wins');

 const web={...opted,submission_id:'web-service-opt-in',continue_on_web:true,fields:{...opted.fields,phone:'+12035550193'}};
 r=await handleFormIntake({token,body:web,serviceSmsPolicy:policy},repo);
 conv=(await q('select * from wave1_conversations where id=$1',[r.internal.conversationId]))[0];
 assert.equal(conv.channel,'form');assert.equal(r.internal.continuesBySms,false);assert(conv.customer_initiated_at);
 assert.equal((await q('select count(*)::int n from jobs where payload->>\'conversation_id\'=$1',[conv.id]))[0].n,0);
 for(const fields of [{service_sms_consent:true,service_sms_consent_version:'old'},{service_sms_consent:true,service_sms_consent_version:policy.version,phone:''}]){
  const denied=await handleFormIntake({token,body:{...opted,submission_id:`invalid-${Math.random()}`,fields:{...opted.fields,...fields}},serviceSmsPolicy:policy},repo);
  assert.equal(denied.status,422);
 }
 r=await handleFormIntake({token,body:{...opted,submission_id:'string-is-not-checkbox',fields:{...opted.fields,phone:'+12035550194',service_sms_consent:'true'}},serviceSmsPolicy:policy},repo);
 assert.equal(r.internal.continuesBySms,false);
 assert.equal((await q('select sms_consent from crm_contacts where id=$1',[r.internal.contactId]))[0].sms_consent,false);
 assert.equal((await q("select count(*)::int n from wave1_messages where direction='outbound'"))[0].n,0);
 const novaToken='test-nova-public-form-0123456789';
 await q('insert into wave1_org_settings(organization_id,form_token) values($1,$2)',[nova,novaToken]);
 r=await handleFormIntake({token:novaToken,body:{...body,submission_id:'old-flag-on-nova',fields:{...body.fields,phone:'+12035550195',sms_consent:true}}},repo);
 assert.equal((await q('select sms_consent from crm_contacts where id=$1',[r.internal.contactId]))[0].sms_consent,false,'Using Nova’s form token directly must not bypass its service-only policy');
 assert.equal((await q('select channel from wave1_conversations where id=$1',[r.internal.conversationId]))[0].channel,'form');
 console.log('PASS — web booking remains on web, stale disclosures and missing phones fail, and string/malicious marketing flags grant nothing');
 const ourNumber=(await q('select sms_number_ref from wave1_org_settings where organization_id=$1',[biz]))[0].sms_number_ref;
 const url='https://nova.test/api/client?resource=wave1&op=sms-inbound',authToken='TEST-only-token';
 for(const [i,bodyText,providerOptOut] of [[1,'REVOKE',null],[2,'OPTOUT',null],[3,'BAJA','STOP'],[4,'STOP','START']]){
  const params={From:'+12035550192',To:ourNumber,MessageSid:`SM_TEST_OPTOUT_${i}`,Body:bodyText,...(providerOptOut?{OptOutType:providerOptOut}:{})};
  const jobsBefore=(await q('select count(*)::int n from jobs'))[0].n;
  const out=await handleSmsInbound({url,params,signature:twilioSignature(url,params,authToken)},repo,{TWILIO_AUTH_TOKEN:authToken});
  assert.equal(out.status,200);
  const stopped=(await q('select suppressed,sms_consent from crm_contacts where id=$1',[contact.id]))[0];
  assert.equal(stopped.suppressed,true,`${bodyText} / ${providerOptOut} must immediately suppress the contact`);
  assert.equal(stopped.sms_consent,false);assert.equal((await q('select count(*)::int n from jobs'))[0].n,jobsBefore,'Carrier-handled keyword must not queue another automated reply');
  await q('update crm_contacts set suppressed=false where id=$1',[contact.id]);
 }
 console.log('PASS — all carrier STOP variants and signed localized opt-outs suppress immediately; STOP takes priority and queues no bot reply');
 const restart={From:'+12035550192',To:ourNumber,MessageSid:'SM_TEST_SERVICE_START',Body:'START'};
 await handleSmsInbound({url,params:restart,signature:twilioSignature(url,restart,authToken)},repo,{TWILIO_AUTH_TOKEN:authToken});
 const restarted=(await q('select suppressed,sms_consent from crm_contacts where id=$1',[contact.id]))[0];
 assert.equal(restarted.suppressed,false);
 assert.equal(restarted.sms_consent,false,'START must not upgrade service-only permission into marketing consent');
 console.log('PASS — re-subscribing a service-only contact does not authorize marketing');
}catch(e){console.error(e);process.exitCode=1;}finally{await env.stop();}
process.exit(process.exitCode??0);
