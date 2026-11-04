import { approveContact } from './_auditTransport.js';
import { discoverPublicNews } from './_auditDiscovery.js';
// Full Nova Audit investigations. Durable state lives beside the existing intake; queue jobs
// are checkpoints, not 72-hour HTTP requests. No website content can authorize an action.
import crypto from 'node:crypto';
import { dbOne, dbGet, dbInsert, dbPatch, enc } from './_sales/core.js';
import { runResearch } from './_researchRun.js';
import { crawlSite } from './_publicResearch.js';
const HOUR = 3600000;
const text = (v, max=1000) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max);
const error = (message,status=400) => Object.assign(new Error(message),{status});
const iso = (v) => { const d=new Date(v); if (!v || !Number.isFinite(d.getTime())) throw error('A valid timestamp is required.'); return d.toISOString(); };
export const AREAS = {acquisition:'Customer acquisition and offers',costs:'Costs and revenue evidence',identity:'Business identity and locations',website:'Website and buying journey',social:'Social discovery and conversations',reputation:'Reviews and reputation',news:'Public news and business context',competitors:'Relevant competitors',contact:'Calls, email and inquiry response',operations:'Existing systems and handoffs',retention:'Follow-up and customer retention'};
export function buildInvestigation(c, input={}, now=new Date()) {
  const hours=Number(input.duration_hours ?? 72);
  if (!Number.isInteger(hours) || hours<24 || hours>72) throw error('Choose a whole number of hours from 24 to 72.');
  const start=now.toISOString(); const industry=c.intake?.industry || ''; const manufacturing=/manufactur|factory|industrial|fabricat|wholesale/i.test(industry);
  const plan={id:crypto.randomUUID(),version:1,status:'draft',duration_hours:hours,created_at:start,planned_start_at:start,deadline_at:new Date(now.getTime()+hours*HOUR).toISOString(),industry,goal:c.intake?.goal || null,tasks:[]};
  const add=(area,question,kind='review',offset=0)=>plan.tasks.push({id:crypto.randomUUID(),area,question,kind,status:'planned',scheduled_at:new Date(now.getTime()+offset*HOUR).toISOString()});
  for(const offset of [0,24,48].filter(h=>h<hours)) add('website',offset ? 'Re-check the public journey and compare with the baseline; changes are not proof of recovery.' : 'Establish the public website, identity, DNS and competitor baseline.','research',offset);
  add('acquisition','Review public offers, discovery channels and the route to a qualified inquiry; distinguish visibility from actual customer acquisition.');
  add('costs','Review published pricing and visible fees. Optional owner-supplied software, sales and cost records can substantiate waste; unseen finances remain unknown.');
  add('identity','Confirm the exact business, branches and owned channels. Record conflicting identities rather than combining them.');
  add('social','Find confirmed public social profiles; test the visible route from discovery to inquiry. Record unavailable platform access.');
  add('reputation','Review permitted public feedback. Attribute complaints to their authors; corroborate operational claims before diagnosis.');
  add('news','Search public reporting and official business sources for relevant developments. Resolve entity matches and distinguish allegations from established facts.','discovery');
  add('competitors',manufacturing?'Compare relevant suppliers by capabilities, RFQ access, service area and published lead-time information.':'Compare relevant businesses by customer need, location or service area, offer and buying journey. Record why each peer belongs.');
  add('operations',manufacturing?'Map request-for-quote → specification → quote → approval → production → delivery handoffs and existing systems.':'Map inquiry → qualification → booking/order → payment → delivery handoffs and existing systems.');
  add('retention','Check follow-up, repeat-purchase and reactivation mechanisms. Private volumes and revenue stay unknown without supplied records.');
  if(input.in_person===true) add('operations','Observe the agreed on-site process and hardware with permission. This is not a safety inspection.','in_person');
  return plan;
}
export function testGate(task, a, now=new Date()) {
  const no=reason=>({allowed:false,reason});
  if(task.is_competitor) return no('Competitors are researched from public sources only.');
  if(!a?.authorized_by_name || !a?.at || !a?.evidence) return no('Record the business authorization and its evidence first.');
  if(a.cancelled_at) return no('The business withdrew permission.');
  if(!a.ends_on || !Number.isFinite(Date.parse(`${a.ends_on}T23:59:59Z`)) || now.getTime()>Date.parse(`${a.ends_on}T23:59:59Z`)) return no('Test permission has expired or has no valid end date.');
  if(!a.channels?.includes(task.channel)) return no(`Permission does not cover ${task.channel}.`);
  if(!Array.isArray(a.targets) || !a.targets.length) return no('Record the exact destinations covered by the business authorization.');
  if(!a.targets.includes(task.target)) return no('This destination is outside the authorized targets.');
  if(!task.target) return no('An exact test destination is required.');
  return {allowed:true};
}
export function recordTestResult(task,input,now=new Date()) {
  const source=text(input.source,500),observation=text(input.observation,3000);
  if(!source || !observation) throw error('Record the evidence source and what actually happened.');
  const at=iso(input.performed_at); if(Date.parse(at)>now.getTime()) throw error('A test cannot be performed in the future.');
  const outcomes=task.kind==='contact'?['answered','responded','auto_reply','voicemail','no_response','not_applicable']:['observed','verified_working','issue_observed','unavailable','not_applicable'];
  if(!outcomes.includes(input.outcome)) throw error('Choose a supported observed outcome.');
  let seconds=null; let response=null;
  if(input.responded_at) {response=iso(input.responded_at); seconds=(Date.parse(response)-Date.parse(at))/1000; if(seconds<0) throw error('A response cannot occur before the test.'); if(Date.parse(response)>now.getTime()) throw error('A response cannot be in the future.');}
  if(input.outcome==='no_response') {if(!input.observed_until)throw error('Record the observation window before concluding no response.');const until=iso(input.observed_until); if(Date.parse(until)<=Date.parse(at)||Date.parse(until)>now.getTime()) throw error('The observation window must end after the test and no later than now.');}
  return {status:input.outcome==='unavailable'?'blocked':'completed',outcome:input.outcome,source,observation,performed_at:at,responded_at:response,response_seconds:seconds,observed_until:input.observed_until?iso(input.observed_until):null,within_published_hours:typeof input.within_published_hours==='boolean'?input.within_published_hours:null,meaningful_response:['responded','answered'].includes(input.outcome),recorded_at:now.toISOString()};
}
export function proposeDiagnosticFinding(task) {
  if (!task.evidence_id || task.status !== 'completed') return null;
  const unanswered = task.kind === 'contact' && task.outcome === 'no_response' && task.within_published_hours === true;
  if (!unanswered && task.outcome !== 'issue_observed') return null;
  const window = unanswered ? (Date.parse(task.observed_until) - Date.parse(task.performed_at)) / HOUR : null;
  if (unanswered && (!Number.isFinite(window) || window <= 0)) return null;
  return {
    title: unanswered ? `No response observed to the authorized ${task.channel} test` : text(task.question, 300),
    statement_type: 'observed_fact', confidence: 'medium', priority: 'medium',
    detail: unanswered ? `One ${task.channel} test to ${task.target}, placed within published hours at ${task.performed_at}, had no observed response by ${task.observed_until} (${Math.round(window * 100) / 100} hours). ${task.observation}` : task.observation,
    customer_impact: 'Possible customer friction; the effect on actual conversions has not been measured.',
    financial_impact_status: 'unknown', review_status: 'draft', origin: 'automated_review',
    limitations: 'This is one test or observation under the recorded conditions, not a measured business-wide failure rate or revenue loss. Confirm against operating records and other tests.',
    recommended_action: unanswered ? 'Confirm routing, business hours and the response policy; inspect the existing system first, then repeat an authorized test after any change.' : 'Confirm the observation, inspect the existing system and verify a remedy with a repeat test.',
    nova_can_implement: 'unknown', module_key: unanswered ? 'agents_booking' : null,
    evidence_ids: [task.evidence_id],
  };
}
async function saveProposedFinding(caseId, plan, task) {
  const proposal = proposeDiagnosticFinding(task); if (!proposal) return;
  const checkKey = `diagnostic:${plan.id}:${task.id}`;
  let existing = await dbOne(`audit_findings?case_id=eq.${enc(caseId)}&check_key=eq.${enc(checkKey)}&select=id`);
  const { evidence_ids, ...fields } = proposal;
  if (!existing) {
    const inserted = await dbInsert('audit_findings', { ...fields, case_id: caseId, check_key: checkKey });
    existing = inserted.row || await dbOne(`audit_findings?case_id=eq.${enc(caseId)}&check_key=eq.${enc(checkKey)}&select=id`);
  }
  if (!existing) throw error('Could not persist the diagnostic finding.',409);
  for (const id of evidence_ids) await dbInsert('audit_finding_evidence', { finding_id: existing.id, evidence_id: id }, { onConflict: 'finding_id,evidence_id' });
}
export function investigationSummary(plan) {
  if(!plan) return null;
  const tasks=plan.tasks || []; const completed=tasks.filter(t=>t.status==='completed').length;
  const coverage=Object.entries(AREAS).map(([key,label])=>{
    const list=tasks.filter(t=>t.area===key);
    const checked=list.filter(t=>t.status==='completed').length;
    const excluded=list.filter(t=>t.status==='waived').length;
    const status=!list.length?'not_planned':excluded===list.length?'excluded':list.some(t=>t.requires_review&&!t.reviewed_by&&t.status==='completed')?'needs_review':checked+excluded===list.length?(excluded?'checked_with_exclusions':'checked'):list.some(t=>t.status==='blocked')?'blocked':'incomplete';
    return {key,label,total:list.length,completed:checked,excluded,status};
  });
  return {id:plan.id,state:plan.status,duration_hours:plan.duration_hours,started_at:plan.started_at||null,deadline_at:plan.deadline_at,completed,total:tasks.length,blocked:tasks.filter(t=>t.status==='blocked').length,ready_for_review:tasks.length>0&&tasks.every(t=>t.status==='waived'||(t.status==='completed'&&(!t.requires_review||t.reviewed_by))),customer_failures:tasks.filter(t=>t.kind==='contact'&&t.status==='completed'&&t.outcome==='no_response'&&t.within_published_hours===true).length,coverage};
}
async function getCase(orgId,caseId){const c=await dbOne(`audit_cases?id=eq.${enc(caseId)}&organization_id=eq.${enc(orgId)}&select=*`);if(!c)throw error('Audit not found',404);return c;}
async function save(c,p){
  const stamp=new Date(Math.max(Date.now(),Date.parse(c.updated_at||0)+1)).toISOString();
  const filter=`id=eq.${enc(c.id)}&organization_id=eq.${enc(c.organization_id)}&updated_at=eq.${enc(c.updated_at)}`;
  const [row]=await dbPatch('audit_cases',filter,{intake:{...c.intake,investigation:p},updated_at:stamp});
  if(!row)throw error('The audit changed in another session. Reload before retrying.',409);return row;
}
async function enqueue(c,p,task){return dbInsert('jobs',{job_type:'audit_diagnostic_task',organization_id:c.organization_id,payload:{case_id:c.id,investigation_id:p.id,task_id:task.id,attempt:task.attempt||0},scheduled_at:task.scheduled_at,idempotency_key:`audit-diagnostic:${p.id}:${task.id}:${task.attempt||0}`},{onConflict:'idempotency_key'});}
export async function diagnosticAction(c,body,caller,now=new Date()){
  let p=c.intake?.investigation;
  if(body.action==='prepare') {if(p)throw error('An investigation already exists. Reuse its recorded history.',409);p=buildInvestigation(c,body,now);await save(c,p);return p;}
  if(!p)throw error('Prepare the investigation first.',409);
  p=structuredClone(p);
  if(body.action==='start'){
    if(!['draft','running'].includes(p.status))throw error('This investigation cannot be started.',409);
    if(!c.start_condition_met_at || !c.clock_policy_approved_at)throw error('Approve the delivery policy and start the audit clock first.',409);
    if(Number(c.target_hours)!==p.duration_hours || c.clock_basis!=='elapsed')throw error('The approved clock must use the same 24–72 calendar-hour duration.',409);
    if(!p.started_at){p.started_at=c.start_condition_met_at;p.deadline_at=new Date(Date.parse(p.started_at)+p.duration_hours*HOUR).toISOString();for(const t of p.tasks){const offset=Date.parse(t.scheduled_at)-Date.parse(p.planned_start_at);t.scheduled_at=new Date(Date.parse(p.started_at)+offset).toISOString();}p.status='running';c=await save(c,p);}
    // Repeating Start repairs a partial enqueue failure without duplicating jobs.
    for(const t of p.tasks.filter(t=>['research','source','discovery'].includes(t.kind)&&t.status==='planned'))await enqueue(c,p,t);
    return p;
  }
  if(body.action==='cancel'){p.status='cancelled';p.cancelled_at=now.toISOString();await save(c,p);return p;}
  if(body.action==='finish') {if(p.status!=='running')throw error('Only a running investigation can be submitted for review.',409);if(!investigationSummary(p).ready_for_review)throw error('Resolve every test or record an explicit coverage exclusion before review.',409);p.status='review';p.review_requested_at=now.toISOString();await save(c,p);return p;}
  if(!['draft','running'].includes(p.status))throw error('This investigation is closed for edits.',409);
  if(body.action==='add'){
    if(p.tasks.length>=60)throw error('An investigation is limited to 60 bounded checks.');
    const kind=body.kind; if(!['source','contact','review','in_person'].includes(kind))throw error('Choose a supported investigation check.');
    const task={id:crypto.randomUUID(),area:AREAS[body.area]?body.area:'contact',kind,question:text(body.question,600),target:text(body.target,500),status:'planned',scheduled_at:iso(body.scheduled_at||now.toISOString())};
    if(!task.question)throw error('Describe the question this check will answer.');
    if(Date.parse(task.scheduled_at)>Date.parse(p.deadline_at))throw error('Schedule the check within the agreed investigation window.');
    if(kind==='source'){let u;try{u=new URL(task.target);}catch{throw error('Enter the exact public source URL.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw error('Use a public HTTP(S) URL without credentials.');task.identity_confirmed=body.identity_confirmed===true;if(!task.identity_confirmed)throw error('Confirm that this public source belongs to or specifically concerns this business.');}
    if(kind==='contact'){
      task.channel=body.channel; if(!['phone','email','form','sms','social'].includes(task.channel))throw error('Choose phone, email, form, SMS or social.');
      task.is_competitor=body.is_competitor===true;const gate=testGate(task,c.active_test_authorization,new Date(task.scheduled_at));if(!gate.allowed)throw error(gate.reason,409);
      task.authorization_snapshot=structuredClone(c.active_test_authorization);
      task.test_identity=text(body.test_identity,250);if(task.test_identity.length<5 || /urgent|emergency|asap|accident/i.test(task.test_identity))throw error('Record a truthful, non-urgent test identity.');
      const day=task.scheduled_at.slice(0,10); const count=p.tasks.filter(t=>t.kind==='contact'&&t.status!=='waived'&&t.target===task.target&&t.channel===task.channel&&t.scheduled_at.slice(0,10)===day).length;
      if(count>=Math.min(3,Number(c.active_test_authorization.max_per_day)||1))throw error('The authorized daily destination/channel test limit is reached.',409);
      task.language=body.language==='es-US'?'es-US':'en-US'; task.speech_transcription=body.speech_transcription===true;
      task.execution='manual'; task.execution_note='Analyst execution unless this exact phone/email test receives separate owner dispatch approval and provider gates pass.';
    }
    p.tasks.push(task);c=await save(c,p);if(p.status==='running'&&kind==='source')await enqueue(c,p,task);return p;
  }
  const task=p.tasks.find(t=>t.id===body.task_id);if(!task)throw error('Investigation check not found',404);
  if(body.action==='approve-dispatch') {
    if(p.status!=='running'||task.kind!=='contact')throw error('Start the investigation and select a customer contact test.',409);
    const gate=testGate(task,c.active_test_authorization,now);if(!gate.allowed)throw error(gate.reason,409);
    if(task.dispatch&&['dispatching','provider_accepted','unknown'].includes(task.dispatch.state))throw error('Reconcile the existing provider attempt before another approval.',409);
    task.dispatch_approval=approveContact(task,caller,body,now);task.execution='automatic';
    c=await save(c,p);
    await dbInsert('jobs',{job_type:'audit_contact_dispatch',organization_id:c.organization_id,payload:{case_id:c.id,investigation_id:p.id,task_id:task.id,approval_id:task.dispatch_approval.id},scheduled_at:task.scheduled_at,idempotency_key:`audit-contact:${task.dispatch_approval.id}`},{onConflict:'idempotency_key'});
    return p;
  }
  if(body.action==='review-source') {
    if(task.status!=='completed'||!task.requires_review)throw error('This source is not awaiting analyst review.',409);
    if(!text(body.observation,3000))throw error('Record the analyst assessment and remaining uncertainty.');
    task.reviewed_by=caller.id;task.reviewed_at=now.toISOString();task.review_note=text(body.observation,3000);await save(c,p);return p;
  }
  if(['completed','waived'].includes(task.status))throw error('This check already has a final recorded outcome.',409);
  if(body.action==='retry') {
    if(p.status!=='running' || !['source','research','discovery'].includes(task.kind))throw error('Only running automated checks can be retried.',409);
    if((task.attempt||0)>=3)throw error('Three explicit retries used. Inspect the source or record a coverage exclusion.',409);
    task.history=[...(task.history||[]),{status:task.status,run_id:task.run_id||null,observation:task.observation||null,at:now.toISOString()}];
    task.attempt=(task.attempt||0)+1;task.research_id=crypto.randomUUID();delete task.run_id;
    task.status='planned';task.scheduled_at=now.toISOString();c=await save(c,p);await enqueue(c,p,task);return p;
  }
  if(body.action==='waive'){if(!text(body.reason,600))throw error('Record why this area is excluded.');Object.assign(task,{status:'waived',exclusion_reason:text(body.reason,600),recorded_by:caller.id});}
  else if(body.action==='record'){
    if(['research','source','discovery'].includes(task.kind))throw error('Automated checks must be completed by the worker; exclude them explicitly if unavailable.',409);
    if(task.kind==='contact'){
      const at=new Date(body.performed_at);
      const authorization=structuredClone(task.dispatch?.authorization_snapshot||task.authorization_snapshot||c.active_test_authorization);
      if(authorization?.cancelled_at&&Date.parse(authorization.cancelled_at)>at.getTime())delete authorization.cancelled_at;
      const cancellation=c.active_test_authorization?.cancelled_at;
      if(cancellation&&Date.parse(cancellation)<=at.getTime())authorization.cancelled_at=cancellation;
      const gate=testGate(task,authorization,at);if(!gate.allowed)throw error(gate.reason,409);
    }
    const result=recordTestResult(task,body,now);
    if(task.kind==='contact' && (p.status!=='running' || !p.started_at || Date.parse(result.performed_at)<Date.parse(p.started_at) || Date.parse(result.performed_at)<Date.parse((task.dispatch?.authorization_snapshot||task.authorization_snapshot||c.active_test_authorization).at))) throw error('Customer tests must occur after the investigation starts and after permission is recorded.',409);
    // Persist the source as evidence; a retry reuses this task's evidence marker.
    const marker=`diagnostic:${p.id}:${task.id}`;
    let ev=await dbOne(`audit_evidence?case_id=eq.${enc(c.id)}&method=eq.${enc(marker)}&select=id`);
    if(!ev)ev=(await dbInsert('audit_evidence',{case_id:c.id,source:result.source,method:marker,capture_date:result.performed_at,observation:JSON.stringify(result),confidence:'medium',author:caller.id,source_quality:'medium'})).row;
    Object.assign(task,result,{evidence_id:ev?.id,recorded_by:caller.id,reviewed_by:caller.id});
    await saveProposedFinding(c.id,p,task);
  }else throw error('Unknown investigation action.');
  await save(c,p);return p;
}
export async function runDiagnosticTask(job,{now=()=>new Date(),research=runResearch,crawl=crawlSite,discover=discoverPublicNews}={}){
  let c=await getCase(job.organization_id,job.payload?.case_id);let p=c.intake?.investigation;
  if(!p||p.id!==job.payload?.investigation_id||p.status!=='running'||c.archived_at)return {skipped:true,reason:'Investigation inactive or archived.'};
  if(c.paused_at)throw error('Audit clock paused; investigation task will retry.',409);
  const task=p.tasks.find(t=>t.id===job.payload?.task_id);if(!task)throw error('Investigation task missing',404);
  if((job.payload.attempt||0)!==(task.attempt||0))return {skipped:true,reason:'Superseded attempt.'};
  if(['completed','waived'].includes(task.status))return {skipped:true,reason:'Already recorded.'};
  if(Date.parse(task.scheduled_at)>now().getTime())throw error('Investigation task is not due.',409);
  let result;
  if(task.kind==='research'){
    // Bind one run to the task before executing: job retries resume the same run, not another scan.
    const researchId=task.research_id||task.id;
    if(!task.run_id){const active=await dbOne(`audit_research_runs?case_id=eq.${enc(c.id)}&status=in.(queued,running)&select=id`);if(active && active.id !== researchId)throw error('Another public research run is active. Retry after it finishes.',409);const previous=await dbOne(`audit_research_runs?id=eq.${enc(researchId)}&case_id=eq.${enc(c.id)}&select=id`);if(!previous){const ins=await dbInsert('audit_research_runs',{id:researchId,organization_id:c.organization_id,case_id:c.id,scope:'full',requested_by:null});if(!ins.row)throw error('Research already started; retry.',409);}task.run_id=researchId;c=await save(c,p);}
    const run=await dbOne(`audit_research_runs?id=eq.${enc(task.run_id)}&case_id=eq.${enc(c.id)}&select=*`);
    const out=['completed','partial'].includes(run?.status)?run:await research(task.run_id);
    if (!out.summary) throw error('The research run did not produce a persisted summary. Retry or inspect the failed run.',409);
    const summary=out.summary;result={status:summary.limitations?.length?'blocked':'completed',observation:`Public research recorded. ${summary.limitations?.join(' ')||'Review evidence for coverage.'}`,research_summary:summary,candidates:summary.discovered_channels||[],requires_review:true,recorded_at:now().toISOString()};
  }else if(task.kind==='discovery'){
    const discovery=await discover({name:c.intake?.name,location:c.intake?.location},{now});
    const note=`Public-news discovery: ${discovery.status}. ${discovery.candidates.length} candidate article(s). ${discovery.note}`;
    const marker=`diagnostic:${p.id}:${task.id}`;
    let ev=await dbOne(`audit_evidence?case_id=eq.${enc(c.id)}&method=eq.${enc(marker)}&select=id`);
    if(!ev)ev=(await dbInsert('audit_evidence',{case_id:c.id,source:discovery.source||'GDELT public news index',method:marker,capture_date:now().toISOString(),observation:note,confidence:'medium',author:'Nova diagnostic worker',source_quality:discovery.status==='searched'?'medium':'unavailable'})).row;
    result={status:discovery.status==='searched'?'completed':'blocked',observation:note,evidence_id:ev?.id,candidates:discovery.candidates,recorded_at:now().toISOString(),requires_review:true};
  }else if(task.kind==='source'){
    const cr=await crawl(task.target,{maxPages:1,now});
    const readable=cr.reachable&&(!cr.rendered_by_script||cr.read_with==='browser')&&cr.pages?.some(x=>x.status>=200&&x.status<300);
    const note=readable?`Public source read; relevance and claims require analyst review. ${String(cr.site_text||'').slice(0,2500)}`:`Could not read public source: ${cr.error||cr.skipped?.map(s=>s.reason).join('; ')||'blocked or script-rendered content'}.`;
    const marker=`diagnostic:${p.id}:${task.id}`;let ev=await dbOne(`audit_evidence?case_id=eq.${enc(c.id)}&method=eq.${enc(marker)}&select=id`);
    if(!ev)ev=(await dbInsert('audit_evidence',{case_id:c.id,source:task.target,method:marker,capture_date:now().toISOString(),observation:note,confidence:readable?'medium':'low',author:'Nova diagnostic worker',source_quality:readable?'medium':'unavailable'})).row;
    result={status:readable?'completed':'blocked',observation:note,evidence_id:ev?.id,recorded_at:now().toISOString(),requires_review:true};
  }else return {skipped:true,reason:'Analyst or authorized provider execution required.'};
  // Re-read before merging: preserve edits to other tasks and stop if cancelled during research.
  c=await getCase(job.organization_id,c.id);p=c.intake?.investigation;
  if(p?.status!=='running'||p.id!==job.payload.investigation_id)return {skipped:true,reason:'Investigation stopped during research.'};
  const current=p.tasks.find(t=>t.id===task.id);if(!current||(current.attempt||0)!==(job.payload.attempt||0)||['completed','waived'].includes(current.status))return {skipped:true,reason:'Outcome already finalized.'};
  Object.assign(current,result);await save(c,p);return {task_id:task.id,status:result.status};
}
