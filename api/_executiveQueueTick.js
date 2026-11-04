// Internal, deterministic executive work only. No outbound transport or payment
// handler is present in this allowlist. The real handlers save reviewable results.
import {handleAuditQueueTick} from './_auditQueueTick.js';
import {dbInsert} from './_sales/core.js';
import {ROLES,ROLE_OF_JOB,runRoleTask} from './_hierarchy/roles.js';
export const EXECUTIVE_JOB_TYPES=Object.keys(ROLE_OF_JOB);
export const executiveSlotKey=(type,org,at)=>`${type}:${org}:${Math.floor(new Date(at).getTime()/(ROLES[ROLE_OF_JOB[type]].every_minutes*60000))}`;
export async function runExecutiveJob(job,{run=runRoleTask,enqueue=async row=>dbInsert('jobs',row,{onConflict:'idempotency_key'}),now=()=>new Date()}={}){
 const role=ROLE_OF_JOB[job.job_type];if(!role)throw Error('Unsupported executive job');
 if(!job.organization_id)throw Error('An executive job must name its business');
 const result=await run(role,{orgId:job.organization_id,jobId:job.id,workItemId:job.payload?.work_item_id});
 const recurring=job.payload?.recurring===true || Number(job.payload?.every_minutes)>0;
 if(result.status==='blocked'||result.paused===true){
  await enqueue({job_type:job.job_type,organization_id:job.organization_id,payload:{recurring,work_item_id:result.work_item_id||job.payload?.work_item_id||null},scheduled_at:new Date(now().getTime()+15*60000).toISOString(),idempotency_key:`executive-deferred:${job.id}`});
 } else if(recurring&&!result.skipped){
  const at=new Date(now().getTime()+ROLES[role].every_minutes*60000);
  await enqueue({job_type:job.job_type,organization_id:job.organization_id,payload:{recurring:true},scheduled_at:at.toISOString(),idempotency_key:executiveSlotKey(job.job_type,job.organization_id,at)});
 }
 return result;
}
const handlers=Object.fromEntries(EXECUTIVE_JOB_TYPES.map(type=>[type,runExecutiveJob]));
export function handleExecutiveQueueTick(req,res,opts={}){
 return handleAuditQueueTick(req,res,{...opts,handlers:opts.handlers||handlers,jobTypes:EXECUTIVE_JOB_TYPES,enableFlag:'NOVA_EXECUTIVE_HTTP_WORKER_ENABLED',signaturePrefix:'nova-executive-tick',receiptPrefix:'executive-tick'});
}
