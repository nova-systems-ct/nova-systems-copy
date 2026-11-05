// Bounded, business-scoped maintenance for the hosted queue. Never sends an alert,
// invokes a paid provider, changes an audit clock or creates a marketing audience.
import {dbGet,dbOne,dbInsert,dbPatch,dbRpc,enc} from '../_sales/core.js';
import {killSwitchStateFor} from './governance.js';
import {killSwitchBlocks} from './rules.js';
import {workerPlaybook} from './playbooks.js';
import {roleReasoning} from './roleModel.js';
export const OPERATIONS_SCHEDULE={nova_monitoring_review:{key:'monitoring',minutes:5},nova_reporting_snapshot:{key:'reporting',minutes:60}};
export async function seedOperationsSchedules(orgId,{now=new Date(),keys=['monitoring','reporting']}={}){
 const ids=[];
 for(const [type,def]of Object.entries(OPERATIONS_SCHEDULE)){
  if(!keys.includes(def.key))continue;
  const existing=await dbOne(`jobs?organization_id=eq.${enc(orgId)}&job_type=eq.${type}&status=in.(pending,leased)&select=id`);
  if(existing){ids.push(existing.id);continue;}
  const ins=await dbInsert('jobs',{job_type:type,organization_id:orgId,payload:{recurring:true},idempotency_key:`${type}:${orgId}:${Math.floor(now.getTime()/(def.minutes*60000))}`},{onConflict:'idempotency_key'});
  if(ins.row)ids.push(ins.row.id);
 }
 return ids;
}
export async function runHostedOperationsJob(job,{now=new Date()}={}){
 const def=OPERATIONS_SCHEDULE[job.job_type];if(!def)throw Error('Unsupported operations job');
 const orgId=job.organization_id;
 const org=orgId?await dbOne(`organizations?id=eq.${enc(orgId)}&kind=eq.nova_internal&select=id`):null;
 if(!org)throw Error('Hosted internal operations must name Nova’s own business');
 const worker=await dbOne(`workers?portfolio_entity_id=is.null&capability_key=eq.${def.key}&status=in.(active,restricted)&select=*`);
 if(!worker||killSwitchBlocks(await killSwitchStateFor(worker,orgId)).blocked)return {paused:true,reason:'Registered worker or emergency control paused'};
 const since=new Date(now.getTime()-7*86400000).toISOString();
 const [jobs,open]=await Promise.all([dbGet(`jobs?organization_id=eq.${enc(orgId)}&created_at=gte.${enc(since)}&select=id,job_type,status,scheduled_at,completed_at&limit=5001`),dbGet(`jobs?organization_id=eq.${enc(orgId)}&status=in.(pending,leased)&select=id,status,scheduled_at,leased_until&order=scheduled_at.asc&limit=5001`)]);
 const metrics={completed_jobs_7d:jobs.filter(j=>j.status==='completed').length,failed_jobs_7d:jobs.filter(j=>['failed','dead_letter'].includes(j.status)).length,overdue_jobs:open.filter(j=>j.status==='pending'&&Date.parse(j.scheduled_at)<now.getTime()-600000).length,stuck_leases:open.filter(j=>j.status==='leased'&&(!j.leased_until||Date.parse(j.leased_until)<=now.getTime())).length,records_limited:jobs.length>5000||open.length>5000};
 if(job.job_type==='nova_monitoring_review'){
  const status=metrics.overdue_jobs||metrics.stuck_leases||metrics.failed_jobs_7d||metrics.records_limited?'degraded':'healthy';
  await dbInsert('ops_health_checks',{organization_id:orgId,check_key:'nova_work_queue',status,detail:metrics});
  const incident=await dbOne(`ops_incidents?organization_id=eq.${enc(orgId)}&check_key=eq.nova_work_queue&status=neq.resolved&select=*`);
  if(status==='degraded'&&!incident)await dbInsert('ops_incidents',{organization_id:orgId,check_key:'nova_work_queue',severity:'warning',title:'Nova has delayed or failed work',detail:metrics});
  else if(status==='degraded')await dbPatch('ops_incidents',`id=eq.${enc(incident.id)}&organization_id=eq.${enc(orgId)}&status=neq.resolved`,{detail:metrics,last_seen_at:now.toISOString(),occurrences:incident.occurrences+1});
  else if(incident)await dbPatch('ops_incidents',`id=eq.${enc(incident.id)}&organization_id=eq.${enc(orgId)}&status=neq.resolved`,{status:'resolved',resolved_at:now.toISOString(),resolution:'Measured queue check recovered',recovery_evidence:{...metrics,at:now.toISOString()}});
 }else{
  const inquiries=await dbGet(`ops_jobs?organization_id=eq.${enc(orgId)}&created_at=gte.${enc(since)}&is_test=eq.false&select=state&limit=5001`);
  metrics.inquiries_7d=inquiries.length;metrics.confirmed_7d=inquiries.filter(j=>j.state==='confirmed').length;metrics.records_limited ||= inquiries.length>5000;
 }
 const reasoning=await roleReasoning({playbook:workerPlaybook(def.key),organizationId:orgId,requestId:`worker-reasoning:${job.id}`,facts:{summary:'Measured Nova operations records',output:metrics}});
 return {organization_id:orgId,worker_id:worker.id,measured_at:now.toISOString(),window_start:since,metrics,reasoning,playbook_version:workerPlaybook(def.key).version,outbound_messages:0,financial_impact:'unknown'};
}
export async function finishOperationsJob(job,result,leaseOwner){
 const out=await dbRpc('nova_complete_operations_job',{p_job:job.id,p_worker:leaseOwner,p_result:result});
 return out?.completed===true;
}
