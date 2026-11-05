import {CAPABILITIES} from '../_workerCapabilities.js';
import {ROLE_KEYS,workerPlaybook} from './playbooks.js';
import {roleReasoning} from './roleModel.js';
// The workflow handler does the work. Optional, bounded reasoning explains its
// measured outcome; it cannot change the outcome or invoke a tool. All specialists
// use distinct role instructions/configuration even when they share model weights.
export async function attachWorkerAdvisory(job,result,options={}){
 if(!job.organization_id||!result||typeof result!=='object'||result.paused||result.deferred||result.skipped||result.reasoning)return result;
 const cap=CAPABILITIES.find(c=>c.job_types.includes(job.job_type));
 if(!cap||ROLE_KEYS.includes(cap.key))return result;
 // Never pass job payload, raw customer content, errors, URLs or secrets into inference.
 const facts={summary:`${cap.name}: the workflow returned a saved result. Advice does not execute a new action.`,output:{worker_state:result.reply_status||result.status||'unknown'}};
 const reasoning=await roleReasoning({playbook:workerPlaybook(cap.key),organizationId:job.organization_id,requestId:`specialist:${job.id}`,facts,...options});
 return {...result,reasoning,playbook_version:workerPlaybook(cap.key).version};
}
