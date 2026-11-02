// Executable audit contact transports. Disabled unless an operator explicitly activates sending,
// supplies bounded pricing AND an atomic approved budget, and an owner approves this exact test.
// No live provider is called by importing this module or by preparing an investigation.
import crypto from 'node:crypto';
import {dbOne,dbInsert,dbPatch,dbRpc,enc} from './_sales/core.js';
import {escapeXml,twiml,validateTwilioSignature} from './_twilio.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const safe=(a,b)=>{try{return crypto.timingSafeEqual(Buffer.from(String(a)),Buffer.from(String(b)));}catch{return false;}};
const secret=e=>e.AUDIT_CALLBACK_SECRET||e.CLIENT_SESSION_SECRET;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const snapshot=t=>({channel:t.channel,target:t.target,question:t.question,test_identity:t.test_identity,language:t.language||'en-US',speech_transcription:t.speech_transcription===true});
export function approveContact(task,caller,input,now=new Date()){
 if(!caller.roles?.includes('nova_super_admin'))throw fail('Only the Nova owner can approve automated contact tests.',403);
 if(!['email','phone'].includes(task.channel))throw fail('Automated dispatch currently supports email and phone only.');
 const max=Number(input.max_cost_usd);const expires=new Date(input.expires_at);
 if(!Number.isFinite(max)||max<=0||!Number.isFinite(expires.getTime())||expires<=now||expires-now>86400000)throw fail('Approve a positive cost ceiling and an expiry within 24 hours.');
 return {id:crypto.randomUUID(),approved_by:caller.id,approved_at:now.toISOString(),expires_at:expires.toISOString(),max_cost_usd:max,response_window_minutes:Math.max(1,Math.min(4320,Number(input.response_window_minutes)||240)),content_sha256:hash(snapshot(task))};
}
export function transportGate(task,e=process.env,now=new Date()){
 const no=reason=>({allowed:false,reason});const a=task.dispatch_approval;
 if(e.NOVA_AUDIT_SEND_ENABLED!=='true')return no('Automated audit contact sending is disabled. No provider was contacted.');
 if(!a||!a.approved_by||Date.parse(a.expires_at)<=now.getTime()||!Number.isFinite(Date.parse(a.expires_at)))return no('This exact test needs a current owner approval.');
 if(a.content_sha256!==hash(snapshot(task)))return no('The test changed after approval.');
 let price;try{price=JSON.parse(e.NOVA_AUDIT_TEST_PRICES||'{}')[task.channel];}catch{return no('Provider pricing is not configured.');}
 if(!price?.version||!Number.isFinite(Number(price.max_usd))||Number(price.max_usd)<=0)return no('A conservative, versioned maximum provider cost is required.');
 if(Number(price.max_usd)>a.max_cost_usd)return no('Provider cost exceeds the owner-approved test ceiling.');
 if(!secret(e))return no('Secure callback signing is not configured.');
 if(task.channel==='email'){
  if(!e.RESEND_API_KEY||!e.NOVA_AUDIT_FROM||!e.NOVA_AUDIT_REPLY_DOMAIN)return no('Email sender and receiving domain are not connected.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(task.target)||/[\r\n]/.test(task.target))return no('A single valid authorized email destination is required.');
  if(!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(e.NOVA_AUDIT_REPLY_DOMAIN))return no('The receiving domain is invalid.');
 }else if(task.channel==='phone'){
  if(!/^\+[1-9]\d{7,14}$/.test(task.target)||!e.TWILIO_ACCOUNT_SID||!e.TWILIO_AUTH_TOKEN||!e.TWILIO_PHONE_NUMBER)return no('Phone provider, caller ID and E.164 destination are required.');
  try{if(new URL(e.APP_BASE_URL).protocol!=='https:')throw Error();}catch{return no('A public HTTPS callback address is required.');}
 }else return no('This channel requires an analyst; no automatic transport is installed.');
 return {allowed:true,max_usd:Number(price.max_usd),pricing_version:price.version};
}
function tokenFor(q,e){return crypto.createHmac('sha256',secret(e)).update(['nova-audit-call',q.organization_id,q.case_id,q.task_id,q.attempt,q.expires,q.event].join('|')).digest('hex');}
function callbackUrl(ctx,event,e,now){const q={op:'audit-call-event',organization_id:ctx.organization_id,case_id:ctx.case_id,task_id:ctx.task_id,attempt:ctx.attempt,expires:String(Math.floor(now.getTime()/1000)+7200),event};q.token=tokenFor(q,e);return `${e.APP_BASE_URL.replace(/\/$/,'')}/api/integrations?${new URLSearchParams(q)}`;}
export function verifyCallbackToken(q,e=process.env,now=new Date()){
 if(!secret(e)||!q.token||!['status','speech'].includes(q.event)||!Number.isFinite(Number(q.expires)))return false;
 if(Number(q.expires)<now.getTime()/1000||Number(q.expires)>now.getTime()/1000+7300)return false;
 return safe(q.token,tokenFor(q,e));
}
function replyAlias(ctx,e){const prefix=`audit+${ctx.case_id}.${ctx.task_id.slice(0,8)}`;const sig=crypto.createHmac('sha256',secret(e)).update(`nova-audit-reply|${ctx.organization_id}|${ctx.case_id}|${ctx.task_id}|${ctx.attempt}`).digest('hex').slice(0,12);return `${prefix}.${sig}@${e.NOVA_AUDIT_REPLY_DOMAIN}`;}
export function buildContactRequest(task,ctx,e=process.env,now=new Date()){
 if(task.channel==='email')return {url:'https://api.resend.com/emails',init:{method:'POST',signal:undefined,headers:{Authorization:`Bearer ${e.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`nova-audit:${ctx.attempt}`},body:JSON.stringify({from:e.NOVA_AUDIT_FROM,to:[task.target],reply_to:replyAlias({...ctx,task_id:task.id},e),subject:`Authorized Nova audit: ${task.question.slice(0,110)}`,text:`This is Nova Systems' automated, authorized audit test.\n${task.test_identity}\n\n${task.question}\n\nPlease reply to this email. No purchase or booking is being requested.`,tags:[{name:'nova_case',value:ctx.case_id},{name:'nova_task',value:task.id},{name:'nova_org',value:ctx.organization_id}]})}};
 if(task.channel!=='phone')throw fail('No automatic transport for this channel.');
 const context={...ctx,task_id:task.id};const speech=callbackUrl(context,'speech',e,now),status=callbackUrl(context,'status',e,now);
 const lang=task.language==='es-US'?'es-US':'en-US';
 const intro=lang==='es-US'?'Esta es una prueba automatizada de auditoría de Nova Systems, autorizada por el negocio.':'This is an automated Nova Systems audit test authorized by the business.';
 const say=`<Say language="${lang}">${escapeXml(`${intro} ${task.test_identity}. ${task.question}`)}</Say>`;
 const script=task.speech_transcription===true?`<Gather input="speech" language="${lang}" timeout="8" speechTimeout="auto" action="${escapeXml(speech)}" method="POST">${say}</Gather><Hangup/>`:`${say}<Pause length="8"/><Hangup/>`;
 const params=new URLSearchParams({To:task.target,From:e.TWILIO_PHONE_NUMBER,Twiml:twiml(script),TimeLimit:'60',Timeout:'20',StatusCallback:status,StatusCallbackMethod:'POST',StatusCallbackEvent:'completed'});
 return {url:`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Calls.json`,init:{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()}};
}
export function interpretCallEvent(body){return {provider_status:String(body.CallStatus||'unknown').slice(0,40),duration_seconds:/^\d+$/.test(String(body.CallDuration))?Number(body.CallDuration):null,speech_text:String(body.SpeechResult||'').slice(0,2000),meaningful_response:false,requires_review:true};}
async function load(org,id){const c=await dbOne(`audit_cases?id=eq.${enc(id)}&organization_id=eq.${enc(org)}&select=*`);if(!c)throw fail('Audit not found',404);return c;}
async function merge(c,taskId,patch){const plan=structuredClone(c.intake.investigation);const task=plan.tasks.find(t=>t.id===taskId);if(!task)throw fail('Audit test not found',404);Object.assign(task,patch);const stamp=new Date(Math.max(Date.now(),Date.parse(c.updated_at)+1)).toISOString();const [saved]=await dbPatch('audit_cases',`id=eq.${enc(c.id)}&organization_id=eq.${enc(c.organization_id)}&updated_at=eq.${enc(c.updated_at)}`,{intake:{...c.intake,investigation:plan},updated_at:stamp});if(!saved)throw fail('Audit changed while updating its test. Retry after reloading.',409);return saved;}
export async function dispatchDiagnosticContact(job,{e=process.env,now=()=>new Date(),fetchImpl=fetch,rpc=dbRpc}={}){
 let c=await load(job.organization_id,job.payload.case_id);const p=c.intake?.investigation;let task=p?.tasks.find(t=>t.id===job.payload.task_id);
 if(!task||p.id!==job.payload.investigation_id||p.status!=='running'||c.archived_at||c.paused_at)return {skipped:true,reason:'Investigation inactive, archived or paused.'};
 if(task.dispatch_approval?.id!==job.payload.approval_id)return {skipped:true,reason:'Approval superseded.'};
 if(task.dispatch&&['dispatching','provider_accepted','unknown'].includes(task.dispatch.state))return {skipped:true,reason:'An attempt already exists; reconcile it instead of sending again.'};
 const {testGate}=await import('./_auditDiagnostic.js');const permission=testGate(task,c.active_test_authorization,now());const gate=permission.allowed?transportGate(task,e,now()):permission;
 if(!gate.allowed){await merge(c,task.id,{dispatch:{state:'blocked',reason:gate.reason,at:now().toISOString()}});return {blocked:true,reason:gate.reason};}
 if(Date.parse(task.scheduled_at)>now().getTime())throw fail('Customer test is not due.',409);
 if(task.speech_transcription===true&&c.active_test_authorization.speech_transcription!==true)throw fail('Business permission does not cover speech transcription.',409);
 const attempt=task.dispatch_approval.id;
 // Persist intent before the remote side effect. An uncertain outcome never automatically re-sends.
 c=await merge(c,task.id,{dispatch:{state:'dispatching',attempt,started_at:now().toISOString(),authorization_snapshot:structuredClone(c.active_test_authorization)}});
 let reservation;try{reservation=await rpc('ai_spend_reserve',{p_request_id:`audit-test:${attempt}`,p_organization_id:c.organization_id,p_purpose:`audit_test_${task.channel}:${c.organization_id}`,p_provider:task.channel==='phone'?'twilio':'resend',p_model:`audit_${task.channel}`,p_pricing_version:gate.pricing_version,p_reserve_usd:gate.max_usd});}catch{reservation={ok:false,reason:'Spending guard unavailable'};}
 if(!reservation?.ok){await merge(c,task.id,{dispatch:{state:'blocked',attempt,reason:reservation?.reason||'No approved provider budget'}});return {blocked:true,reason:reservation?.reason||'No approved provider budget'};}
 // Re-check revocation immediately before sending; the reservation alone is not permission.
 c=await load(c.organization_id,c.id);task=c.intake.investigation.tasks.find(t=>t.id===task.id);
 const fresh=testGate(task,c.active_test_authorization,now());
 if(['completed','waived'].includes(task.status)||c.intake.investigation.status!=='running'||c.paused_at||c.archived_at||task.dispatch_approval?.id!==attempt||!fresh.allowed||!transportGate(task,e,now()).allowed)return {blocked:true,reason:'Permission or investigation changed before dispatch; no send attempted.'};
 const request=buildContactRequest(task,{organization_id:c.organization_id,case_id:c.id,attempt},e,now());
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);let providerId=null;let state='unknown';let reason=null;
 try{const response=await fetchImpl(request.url,{...request.init,signal:controller.signal});const data=await response.json().catch(()=>({}));providerId=data.id||data.sid||null;if(response.ok&&providerId)state='provider_accepted';else {state=response.ok?'unknown':'rejected';reason=`Provider returned HTTP ${response.status}`;}}catch{reason='Provider outcome unknown after timeout or network failure; reconcile before retrying.';}finally{clearTimeout(timer);}
 // A callback may have updated the case while the request was in flight. Merge only this dispatch.
 c=await load(c.organization_id,c.id);task=c.intake.investigation.tasks.find(t=>t.id===task.id);
 providerId ||= task.dispatch?.provider_id || null;
 if(providerId && task.dispatch?.events?.length)state='provider_accepted';
 const dispatch={...task.dispatch,state,attempt,provider_id:providerId,provider:task.channel==='phone'?'twilio':'resend',reason,accepted_at:state==='provider_accepted'?now().toISOString():null,max_reserved_usd:gate.max_usd};
 c=await merge(c,task.id,{dispatch});
 if(state==='provider_accepted') {
  const due=new Date(Math.min(Date.parse(c.intake.investigation.deadline_at),now().getTime()+Math.max(1,Math.min(4320,Number(task.dispatch_approval.response_window_minutes)||240))*60000)).toISOString();
  await dbInsert('jobs',{job_type:'audit_contact_observe',organization_id:c.organization_id,payload:{case_id:c.id,investigation_id:c.intake.investigation.id,task_id:task.id,attempt},scheduled_at:due,idempotency_key:`audit-observe:${attempt}`},{onConflict:'idempotency_key'});
 }
 try{await rpc('ai_spend_settle',{p_id:reservation.id,p_status:state==='provider_accepted'?'settled':'failed',p_input_tokens:null,p_output_tokens:null,p_actual_usd:null,p_usage_basis:'unknown',p_latency_ms:0,p_outcome:state});}catch{/* Reservation keeps counting at its maximum if settlement fails. */}
 return {state,provider_id:providerId,delivered:false,responded:false};
}
export async function handleAuditCallEvent(req,res,{e=process.env,now=()=>new Date()}={}){
 const q=req.query||{};if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 if(!verifyCallbackToken(q,e,now()))return res.status(403).json({error:'Invalid or expired audit callback'});
 const full=`${e.APP_BASE_URL?.replace(/\/$/,'')}${req.url}`;
 if(!validateTwilioSignature(req,e.TWILIO_AUTH_TOKEN,full))return res.status(403).json({error:'Invalid provider signature'});
 try{
  const c=await load(q.organization_id,q.case_id);const task=c.intake?.investigation?.tasks.find(t=>t.id===q.task_id);
  if(!task||task.channel!=='phone'||task.dispatch?.attempt!==q.attempt)return res.status(404).json({error:'Audit call not found'});
  if(req.body?.AccountSid && req.body.AccountSid!==e.TWILIO_ACCOUNT_SID)return res.status(403).json({error:'Provider account mismatch'});
  if(task.dispatch.provider_id&&task.dispatch.provider_id!==req.body?.CallSid)return res.status(403).json({error:'Provider call mismatch'});
  const event={...interpretCallEvent(req.body||{}),received_at:now().toISOString(),kind:q.event};
  const events=[...(task.dispatch.events||[]).filter(x=>x.kind!==q.event),event];
  await merge(c,task.id,{dispatch:{...task.dispatch,provider_id:req.body.CallSid,state:'provider_accepted',events,requires_review:true}});
  if(q.event==='speech'){res.setHeader('Content-Type','text/xml');return res.status(200).send(twiml('<Say>Thank you. The authorized test is complete.</Say><Hangup/>'));}
  return res.status(200).json({received:true});
 }catch(err){return res.status(err.status||500).json({error:err.status?err.message:'Could not save the audit callback'});}
}
export async function handleAuditEmailEvent(event,{e=process.env,now=()=>new Date()}={}){
 const data=event.data||{};const tags=Array.isArray(data.tags)?Object.fromEntries(data.tags.map(x=>[x.name,x.value])):data.tags||{};
 let c,task;
 if(event.type==='email.received'){
  if(!secret(e)||!e.NOVA_AUDIT_REPLY_DOMAIN)return {handled:false};
  const addresses=Array.isArray(data.to)?data.to:[data.to];
  for(const address of addresses){const m=/^audit\+([0-9a-f-]{36})\.([0-9a-f]{8})\.([0-9a-f]{12})@(.+)$/i.exec(String(address||''));if(!m||m[4].toLowerCase()!==e.NOVA_AUDIT_REPLY_DOMAIN.toLowerCase())continue;
   c=await dbOne(`audit_cases?id=eq.${enc(m[1])}&select=*`);if(!c)continue;
   const matches=(c.intake?.investigation?.tasks||[]).filter(t=>t.id.slice(0,8)===m[2]&&t.channel==='email'&&t.dispatch?.attempt);
   if(matches.length!==1)continue;task=matches[0];const expected=replyAlias({organization_id:c.organization_id,case_id:c.id,task_id:task.id,attempt:task.dispatch.attempt},e);if(!safe(address,expected)){task=null;continue;}break;
  }
  if(!task)return {handled:false};
  const from=String(data.from||'').match(/<([^>]+)>/)?.[1]||String(data.from||'');
  if(from.toLowerCase()!==task.target.toLowerCase())return {handled:false,reason:'Unexpected response sender'};
  const response={provider_email_id:data.email_id||null,received_at:event.created_at||now().toISOString(),classification:'unreviewed_incoming_email',meaningful_response:false};
  await merge(c,task.id,{dispatch:{...task.dispatch,response_candidate:response,requires_review:true}});return {handled:true};
 }
 if(!tags.nova_case||!tags.nova_task||!tags.nova_org)return {handled:false};
 c=await load(tags.nova_org,tags.nova_case);task=c.intake?.investigation?.tasks.find(t=>t.id===tags.nova_task);
 if(!task||task.channel!=='email'||task.dispatch?.provider_id!==data.email_id)return {handled:false};
 const states={'email.delivered':'delivered','email.bounced':'bounced','email.failed':'failed','email.complained':'complained'};if(!states[event.type])return {handled:false};
 if(['bounced','complained'].includes(task.dispatch.delivery_state)&&states[event.type]==='delivered')return {handled:true};
 await merge(c,task.id,{dispatch:{...task.dispatch,delivery_state:states[event.type],delivery_at:event.created_at||now().toISOString()}});return {handled:true};
}

export async function observeDiagnosticContact(job,{now=()=>new Date()}={}) {
 if(job.scheduled_at && Date.parse(job.scheduled_at)>now().getTime())throw fail('The response observation window is not due.',409);
 let c=await load(job.organization_id,job.payload.case_id);const p=c.intake?.investigation;const task=p?.tasks.find(t=>t.id===job.payload.task_id);
 if(!task||p.id!==job.payload.investigation_id||p.status!=='running'||c.archived_at||task.dispatch?.attempt!==job.payload.attempt||['completed','waived'].includes(task.status))return {skipped:true};
 const dispatch=task.dispatch;
 if(dispatch.state!=='provider_accepted')return {skipped:true,reason:'No confirmed provider acceptance.'};
 const marker=`diagnostic-contact:${p.id}:${task.id}:${dispatch.attempt}`;
 let ev=await dbOne(`audit_evidence?case_id=eq.${enc(c.id)}&method=eq.${enc(marker)}&select=id`);
 const observation={channel:task.channel,target:task.target,provider_id:dispatch.provider_id,accepted_at:dispatch.accepted_at,observed_until:now().toISOString(),delivery_state:dispatch.delivery_state||'unknown',response_candidate:dispatch.response_candidate||null,call_events:dispatch.events||[],interpretation:'Provider records only. A delivery receipt, connected call or incoming email is not proof of a useful human response. Analyst review is required.'};
 if(!ev)ev=(await dbInsert('audit_evidence',{case_id:c.id,source:`${dispatch.provider} provider event log for ${dispatch.provider_id}`,method:marker,capture_date:now().toISOString(),observation:JSON.stringify(observation),author:'Nova customer-test observer',source_quality:'high',confidence:'high'})).row;
 await merge(c,task.id,{status:'awaiting_review',requires_review:true,automation_evidence_id:ev?.id,automation_observation:observation});
 return {recorded:true,evidence_id:ev?.id,requires_review:true};
}
