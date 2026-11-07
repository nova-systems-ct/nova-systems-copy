// Bounded on-demand audit worker. Intended for a scheduler that calls ONLY when due work exists,
// not for keeping a free web service awake. It never processes unrelated sales/marketing jobs.
import crypto from 'node:crypto';
import {createPostgresJobStore} from '../worker/postgresJobStore.mjs';
import {dbGet,dbOne,dbPatch,dbInsert,enc} from './_sales/core.js';
import {heldJobTypes} from './_workerCapabilities.js';
import {runDiagnosticTask} from './_auditDiagnostic.js';
import {dispatchDiagnosticContact,observeDiagnosticContact} from './_auditTransport.js';
import {runResearch} from './_researchRun.js';
import {attachWorkerAdvisory} from './_hierarchy/workerAdvisory.js';
export const AUDIT_JOB_TYPES=['audit_research','audit_diagnostic_task','audit_contact_dispatch','audit_contact_observe'];
const same=(a,b)=>{try{return crypto.timingSafeEqual(Buffer.from(String(a)),Buffer.from(String(b)));}catch{return false;}};
function targetOK(e){try{return e.SUPABASE_SERVICE_ROLE_KEY&&new URL(e.SUPABASE_URL).hostname===`${e.NOVA_WORKER_TARGET_REF}.supabase.co`;}catch{return false;}}
export function schedulerSignature(timestamp,nonce,secret,prefix='nova-audit-tick'){return crypto.createHmac('sha256',secret).update(`${prefix}|${timestamp}|${nonce}`).digest('hex');}
const actualHandlers={audit_research:job=>runResearch(job.payload.run_id),audit_diagnostic_task:runDiagnosticTask,audit_contact_dispatch:dispatchDiagnosticContact,audit_contact_observe:observeDiagnosticContact};
export async function handleAuditQueueTick(req,res,{e=process.env,store,handlers=actualHandlers,jobTypes=AUDIT_JOB_TYPES,enableFlag='NOVA_AUDIT_HTTP_WORKER_ENABLED',signaturePrefix='nova-audit-tick',receiptPrefix='audit-tick',deferPaused=false,finalize=null,heldTypes=async()=>heldJobTypes(await dbGet('workers?capability_key=not.is.null&select=status,capability_key')),rememberNonce=async nonce=>{const r=await dbInsert('jobs',{job_type:'audit_tick_receipt',status:'completed',payload:{},completed_at:new Date().toISOString(),idempotency_key:`${receiptPrefix}:${nonce}`},{onConflict:'idempotency_key'});return !!r.row;},now=()=>new Date()}={}){
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const ts=String(req.headers?.['x-nova-audit-timestamp']||'');const nonce=String(req.headers?.['x-nova-audit-nonce']||'');
 const fresh=/^\d{10}$/.test(ts)&&Math.abs(now().getTime()/1000-Number(ts))<=300&&/^[0-9a-f-]{36}$/i.test(nonce);
 const authenticated=e.CRON_SECRET&&fresh&&same(req.headers?.authorization,`Bearer ${schedulerSignature(ts,nonce,e.CRON_SECRET,signaturePrefix)}`);
 if(!authenticated)return res.status(403).json({error:'Fresh scheduler signature required'});
 if(e[enableFlag]!=='true'||!targetOK(e))return res.status(503).json({error:'Audit queue receiver disabled or project target not confirmed'});
 const workerId=`audit-http-${crypto.randomUUID()}`;
 try{
  if(!await rememberNonce(nonce))return res.status(409).json({error:'Scheduler request already processed'});
  const held=await heldTypes();const types=jobTypes.filter(t=>!held.includes(t));
  if(!types.length)return res.status(200).json({processed:false,reason:'Registered worker paused'});
  const queue=store||createPostgresJobStore({url:e.SUPABASE_URL,serviceKey:e.SUPABASE_SERVICE_ROLE_KEY});
  const job=await queue.claimNext({workerId,leaseSeconds:120,jobTypes:types});
  if(!job)return res.status(200).json({processed:false});
  const own=`id=eq.${enc(job.id)}&status=eq.leased&leased_by=eq.${enc(workerId)}&leased_until=gt.now${job.organization_id?`&organization_id=eq.${enc(job.organization_id)}`:''}`;
  // Keep the lease alive during a bounded research run. Completion/failure preserves cancellation.
  const renew=queue.renewLease?setInterval(()=>queue.renewLease(job.id,workerId,120).catch(()=>{}),20000):null;
  try{
   let caseId=job.payload?.case_id;
   if(!caseId&&job.payload?.run_id)caseId=(await dbOne(`audit_research_runs?id=eq.${enc(job.payload.run_id)}&organization_id=eq.${enc(job.organization_id)}&select=case_id`))?.case_id;
   const c=caseId?await dbOne(`audit_cases?id=eq.${enc(caseId)}&organization_id=eq.${enc(job.organization_id)}&select=paused_at,archived_at`):null;
   if(c?.paused_at){await dbPatch('jobs',own,{status:'pending',scheduled_at:new Date(Date.now()+900000).toISOString(),attempts:Math.max(0,Number(job.attempts)-1),leased_by:null,leased_until:null,last_error:'Audit clock paused; work deferred without consuming a retry.'});return res.status(200).json({processed:false,deferred:true});}
   const result=await attachWorkerAdvisory(job,c?.archived_at?{skipped:true,reason:'Audit archived'}:await handlers[job.job_type](job));
   if(deferPaused&&(result?.paused||result?.deferred)){await dbPatch('jobs',own,{status:'pending',scheduled_at:new Date(Date.now()+(result.deferred?5000:900000)).toISOString(),attempts:Math.max(0,Number(job.attempts)-1),leased_by:null,leased_until:null,last_error:'Business or worker paused; retained for later processing.'});return res.status(200).json({processed:false,deferred:true});}
   if(finalize){if(!await finalize({job,result,workerId,own}))return res.status(200).json({processed:false,reason:'Execution lease changed; completion withheld'});}
   else await dbPatch('jobs',own,{status:'completed',result,completed_at:new Date().toISOString()});
   return res.status(200).json({processed:true,job_id:job.id,job_type:job.job_type});
  }catch(err){
   await dbPatch('jobs',own,{status:Number(job.attempts)>=Number(job.max_attempts)?'dead_letter':'pending',last_error:String(err.message).slice(0,500),scheduled_at:new Date(Date.now()+30000*Math.pow(2,Math.min(Number(job.attempts)||1,5)-1)).toISOString(),leased_by:null,leased_until:null});
   return res.status(200).json({processed:true,job_id:job.id,retry_recorded:true});
  }finally{if(renew)clearInterval(renew);}
 }catch{return res.status(503).json({error:'Audit queue could not be processed. No success was recorded.'});}
}
