// Real investigation service and API against an isolated PostgREST boundary double.
// No provider, production database, or customer is contacted.
import assert from 'node:assert/strict';
import {buildInvestigation,diagnosticAction,runDiagnosticTask} from '../api/_auditDiagnostic.js';
import {crawlSite} from '../api/_publicResearch.js';
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const now=()=>new Date('2026-11-01T15:00:00Z');
let seq=0;
const tables={audit_cases:[{id:'a',organization_id:'orgA',updated_at:'2026-11-01T14:00:00Z',intake:{name:'A',industry:'Manufacturing',website:'https://factory.example'},target_hours:72,clock_basis:'elapsed',start_condition_met_at:now().toISOString(),clock_policy_approved_at:now().toISOString()}],jobs:[],audit_evidence:[],audit_research_runs:[],audit_findings:[],audit_finding_evidence:[]};
const clone=x=>structuredClone(x);
function matches(row,[key,v]){
 if(['select','limit','order','on_conflict'].includes(key))return true;
 if(v.startsWith('eq.'))return String(row[key])===v.slice(3);
 if(v.startsWith('in.'))return v.slice(4,-1).split(',').includes(row[key]);
 throw Error(`Unsupported test filter ${key}=${v}`);
}
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);assert.equal(u.host,'db.test','Unexpected external request');
 const table=u.pathname.replace('/rest/v1/','');
 if(table==='rpc/has_permission')return Response.json(JSON.parse(init.body).target_org_id==='orgA');
 const rows=tables[table];assert(rows,`Unknown table ${table}`);
 const list=rows.filter(r=>[...u.searchParams].every(f=>matches(r,f)));
 const method=init.method||'GET';const b=init.body?JSON.parse(init.body):null;
 if(method==='GET')return Response.json(clone(list.slice(0,Number(u.searchParams.get('limit'))||list.length)));
 if(method==='PATCH'){list.forEach(r=>Object.assign(r,clone(b)));return Response.json(clone(list));}
 if(method==='POST'){
  if(table==='audit_evidence'){assert(b.author,'Evidence must have its real schema-required author');assert.equal('created_by' in b,false,'Evidence schema has author, not created_by');}
  if(b.idempotency_key&&rows.some(r=>r.idempotency_key===b.idempotency_key))return Response.json([]);
  const row={id:`id${++seq}`,status:table==='audit_research_runs'?'queued':undefined,...b};rows.push(row);return Response.json([row]);
 }
 throw Error('Unexpected method');
};
const caller={id:'analyst'};
await diagnosticAction(clone(tables.audit_cases[0]),{action:'prepare',duration_hours:72},caller,now());
let c=clone(tables.audit_cases[0]);const stale=clone(c);
await diagnosticAction(c,{action:'start'},caller,now());assert.equal(tables.jobs.length,4);
await diagnosticAction(clone(tables.audit_cases[0]),{action:'start'},caller,now());assert.equal(tables.jobs.length,4,'Start retry must not duplicate research jobs');
await assert.rejects(()=>diagnosticAction(stale,{action:'cancel'},caller,now()),/changed in another session/);
const job=clone(tables.jobs[0]);
await assert.rejects(()=>runDiagnosticTask({...job,organization_id:'orgB'}),/not found/);
const other=clone(tables.jobs[1]);await assert.rejects(()=>runDiagnosticTask(other,{now}),/not due/);
let researchCalls=0;
const research=async(id)=>{researchCalls++;const row=tables.audit_research_runs.find(r=>r.id===id);Object.assign(row,{status:'completed',summary:{limitations:[],pages_read:2}});return row;};
await runDiagnosticTask(job,{now,research});await runDiagnosticTask(job,{now,research});
assert.equal(researchCalls,1,'Queue redelivery must reuse the recorded research result');
assert.equal(tables.audit_research_runs.length,1);
let p=tables.audit_cases[0].intake.investigation;
assert.equal(p.tasks[0].status,'completed');
await diagnosticAction(clone(tables.audit_cases[0]),{action:'cancel'},caller,now());
const cancelled=await runDiagnosticTask(tables.jobs[2],{now,research});assert.equal(cancelled.skipped,true);assert.equal(researchCalls,1);
// API authorization uses the real case/org guard, not just a supplied case ID.
const {handleAuditWorkspace}=await import('../api/_auditWorkspace.js');
const res=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
let r=res();await handleAuditWorkspace({method:'GET',query:{organization_id:'orgA',case_id:'a'},headers:{authorization:'Bearer test'}},r,'diagnostic',caller);assert.equal(r.code,200);assert.equal(r.body.investigation.status,'cancelled');
r=res();await handleAuditWorkspace({method:'POST',body:{organization_id:'orgB',case_id:'a',action:'prepare'},headers:{authorization:'Bearer test'}},r,'diagnostic',caller);assert.equal(r.code,403);
// robots.txt itself must use the private-network and redirect guard.
let network=0;
await crawlSite('http://127.0.0.1/',{fetchImpl:async()=>{network++;return new Response('',{status:404});},lookup:async()=>[{address:'127.0.0.1'}]});
assert.equal(network,0,'A private URL must not receive even a robots.txt request');
console.log('PASS — durable scheduling, replay, cancellation, tenant access and public-source guards passed');
let pages=[];
const forbidden=await crawlSite('https://factory.example/private-article',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async(url)=>{pages.push(new URL(url).pathname);return new Response('User-agent: *\nDisallow: /',{status:200,headers:{'content-type':'text/plain'}});}});
assert.deepEqual(pages,['/robots.txt'],'A robots-disallowed starting page must not be fetched');assert.equal(forbidden.reachable,false);

const second={...clone(tables.audit_cases[0]),id:'second',updated_at:'2026-11-01T14:00:00Z',intake:{name:'Factory',industry:'Manufacturing'},active_test_authorization:{authorized_by_name:'Business owner',at:'2026-11-01T14:00:00Z',evidence:'Signed authorization',ends_on:'2026-11-05',channels:['email'],targets:['info@factory.example'],max_per_day:1}};
tables.audit_cases.push(second);
await diagnosticAction(clone(second),{action:'prepare'},caller,now());
await diagnosticAction(clone(second),{action:'start'},caller,now());
await diagnosticAction(clone(second),{action:'add',kind:'contact',channel:'email',target:'info@factory.example',question:'Does an RFQ inquiry reach the sales team?',test_identity:'Nova authorized test',scheduled_at:now().toISOString()},caller,now());
const contact=second.intake.investigation.tasks.at(-1);
await assert.rejects(()=>diagnosticAction(clone(second),{action:'add',kind:'contact',channel:'email',target:'info@factory.example',question:'Duplicate test',test_identity:'Nova authorized test'},caller,now()),/daily/);
await diagnosticAction(clone(second),{action:'record',task_id:contact.id,outcome:'no_response',performed_at:now().toISOString(),observed_until:'2026-11-01T16:00:00Z',within_published_hours:true,source:'Authorized test inbox thread',observation:'No reply in one hour'},caller,new Date('2026-11-01T16:00:00Z'));
assert.equal(tables.audit_findings.length,1);assert.equal(tables.audit_finding_evidence.length,1);
assert.equal(tables.audit_findings[0].review_status,'draft');assert.equal(tables.audit_findings[0].financial_impact_status,'unknown');
const before=tables.audit_evidence.length;
await assert.rejects(()=>diagnosticAction(clone(second),{action:'record',task_id:contact.id},caller,now()),/final recorded/);
assert.equal(tables.audit_evidence.length,before);
const src={action:'add',kind:'source',area:'news',question:'What does this public article actually report?',target:'https://factory.example/article',identity_confirmed:true};
await diagnosticAction(clone(second),src,caller,now());
const sourceJob=tables.jobs.at(-1);
const crawl=async()=>({reachable:true,pages:[{status:200}],site_text:'Factory announces a second production line.'});
await runDiagnosticTask(sourceJob,{now,crawl});await runDiagnosticTask(sourceJob,{now,crawl});
assert.equal(tables.audit_evidence.length,before+1,'Source replay must not duplicate its evidence');
assert.equal(second.intake.investigation.tasks.at(-1).requires_review,true,'Reading news must not automatically establish its claims as facts');
second.active_test_authorization.cancelled_at=now().toISOString();
await assert.rejects(()=>diagnosticAction(clone(second),{action:'add',kind:'contact',channel:'email',target:'info@factory.example',question:'Revoked test',test_identity:'Nova authorized test'},caller,now()),/withdrew/);
console.log('PASS — real evidence persistence, finding links, daily limits, source replay and revocation passed');
// Executable email/phone adapters are exercised only with injected providers and synthetic keys.
const {dispatchDiagnosticContact,handleAuditEmailEvent,observeDiagnosticContact,handleAuditCallEvent}=await import('../api/_auditTransport.js');
const crypto=await import('node:crypto');
const owner={id:'owner',roles:['nova_super_admin']};
const contactCase={...clone(second),id:crypto.randomUUID(),updated_at:'2026-11-01T14:00:00Z',intake:{name:'Isolated transport fixture',industry:'Manufacturing'},active_test_authorization:{authorized_by_name:'Fixture owner',at:'2026-11-01T14:00:00Z',evidence:'Synthetic authorization',ends_on:'2026-11-05',channels:['email','phone'],targets:['owner@business.example','+12035550123'],max_per_day:1}};
tables.audit_cases.push(contactCase);
await diagnosticAction(clone(contactCase),{action:'prepare'},caller,now());await diagnosticAction(clone(contactCase),{action:'start'},caller,now());
await diagnosticAction(clone(contactCase),{action:'add',kind:'contact',channel:'email',target:'owner@business.example',question:'What is your quote process?',test_identity:'Authorized Nova test'},caller,now());
const emailTask=()=>contactCase.intake.investigation.tasks.find(t=>t.kind==='contact'&&t.channel==='email');
await diagnosticAction(clone(contactCase),{action:'approve-dispatch',task_id:emailTask().id,max_cost_usd:0.1,expires_at:'2026-11-01T16:00:00Z'},owner,now());
const dispatchJob=clone(tables.jobs.at(-1));let sends=0;let sentBody;
const e={NOVA_AUDIT_SEND_ENABLED:'true',NOVA_SPENDING_LOCK:'disabled',RESEND_API_KEY:'fixture',NOVA_AUDIT_FROM:'audit@nova.example',NOVA_AUDIT_REPLY_DOMAIN:'inbound.nova.example',CLIENT_SESSION_SECRET:'fixture-secret',NOVA_AUDIT_TEST_PRICES:JSON.stringify({email:{max_usd:0.01,version:'fixture'},phone:{max_usd:0.05,version:'fixture'}}),TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'fixture-token',TWILIO_PHONE_NUMBER:'+12035550199',APP_BASE_URL:'https://nova.example'};
const rpc=async(name,args)=>{if(name==='ai_spend_reserve'){assert.match(args.p_purpose,/orgA/);return {ok:true,id:'fixture-reservation'};}assert.equal(name,'ai_spend_settle');return null;};
const provider=async(url,init)=>{sends++;sentBody=JSON.parse(init.body);return Response.json({id:'email-fixture-id'});};
const off=await dispatchDiagnosticContact(dispatchJob,{e:{},now,fetchImpl:provider,rpc:async()=>{throw Error('Disabled sending must not reserve');}});assert.equal(off.blocked,true);assert.equal(sends,0);
await dispatchDiagnosticContact(dispatchJob,{e,now,fetchImpl:provider,rpc});await dispatchDiagnosticContact(dispatchJob,{e,now,fetchImpl:provider,rpc});
assert.equal(sends,1,'Provider acceptance prevents job redelivery from sending again');assert.equal(emailTask().dispatch.state,'provider_accepted');assert.equal(emailTask().dispatch.delivery_state,undefined);
await handleAuditEmailEvent({type:'email.delivered',created_at:'2026-11-01T15:01:00Z',data:{email_id:'email-fixture-id',tags:{nova_case:contactCase.id,nova_org:'orgA',nova_task:emailTask().id}}},{e,now});
assert.equal(emailTask().dispatch.delivery_state,'delivered');
await handleAuditEmailEvent({type:'email.received',created_at:'2026-11-01T15:05:00Z',data:{email_id:'incoming-fixture',from:'Owner <owner@business.example>',to:[sentBody.reply_to]}},{e,now});
assert.equal(emailTask().dispatch.response_candidate.meaningful_response,false,'Incoming mail must be classified before treating it as useful help');
const observeJob=clone(tables.jobs.find(j=>j.job_type==='audit_contact_observe'&&j.payload.task_id===emailTask().id));
await assert.rejects(()=>observeDiagnosticContact(observeJob,{now}),/not due/);
const evCount=tables.audit_evidence.length;
await observeDiagnosticContact(observeJob,{now:()=>new Date('2026-11-01T19:00:00Z')});await observeDiagnosticContact(observeJob,{now:()=>new Date('2026-11-01T19:00:00Z')});
assert.equal(tables.audit_evidence.length,evCount+1);assert.equal(emailTask().status,'awaiting_review');
await diagnosticAction(clone(contactCase),{action:'add',kind:'contact',channel:'phone',target:'+12035550123',question:'Is quoting available?',test_identity:'Authorized Nova test'},caller,now());
const phoneTask=()=>contactCase.intake.investigation.tasks.find(t=>t.channel==='phone');
await diagnosticAction(clone(contactCase),{action:'approve-dispatch',task_id:phoneTask().id,max_cost_usd:0.1,expires_at:'2026-11-01T16:00:00Z'},owner,now());
const phoneJob=clone(tables.jobs.at(-1));let phonePayload;
await dispatchDiagnosticContact(phoneJob,{e,now,rpc,fetchImpl:async(url,init)=>{phonePayload=new URLSearchParams(init.body);return Response.json({sid:'CAfixture'});}});
const callback=new URL(phonePayload.get('StatusCallback'));const body={CallSid:'CAfixture',AccountSid:e.TWILIO_ACCOUNT_SID,CallStatus:'completed',CallDuration:'8'};
let signed=callback.toString();for(const key of Object.keys(body).sort())signed+=key+body[key];
const signature=crypto.createHmac('sha1',e.TWILIO_AUTH_TOKEN).update(signed).digest('base64');
const req={method:'POST',url:callback.pathname+callback.search,query:Object.fromEntries(callback.searchParams),body,headers:{'x-twilio-signature':signature}};
let cr=res();cr.setHeader=()=>{};cr.send=x=>(cr.body=x,cr);await handleAuditCallEvent(req,cr,{e,now});assert.equal(cr.code,200);assert.equal(phoneTask().dispatch.events[0].meaningful_response,false);
cr=res();await handleAuditCallEvent({...req,headers:{'x-twilio-signature':'invalid'}},cr,{e,now});assert.equal(cr.code,403);
console.log('PASS — disabled sending, exact-once intent, provider receipts, reply routing, observation windows and signed callbacks passed');
// Recording a historical authorized test is evidence capture, not a new contact action.
await diagnosticAction(clone(contactCase),{action:'record',task_id:phoneTask().id,outcome:'answered',performed_at:'2026-11-01T15:00:00Z',responded_at:'2026-11-01T15:01:00Z',source:'Fixture call transcript reviewed by analyst',observation:'The fixture response answered the quote question',within_published_hours:true},caller,new Date('2026-11-06T15:00:00Z'));
assert.equal(phoneTask().status,'completed');
