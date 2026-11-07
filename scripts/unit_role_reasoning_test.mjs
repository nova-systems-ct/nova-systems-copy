import assert from 'node:assert/strict';
import { rolePlaybook, ROLE_KEYS, approvedRoleMemories } from '../api/_hierarchy/playbooks.js';
import { roleReasoning } from '../api/_hierarchy/roleModel.js';
import { cfoCapabilityReport } from '../api/_hierarchy/costRegister.js';
for (const role of ROLE_KEYS) {
 const p = rolePlaybook(role); assert(p.jobs.length && p.tools.length && p.proof.length && p.escalate.length && p.boundaries.length);
}
const base = { playbook: rolePlaybook('cfo'), organizationId: 'orgA', facts: { balance: 'unknown' }, requestId: 'fixture' };
let calls = 0;
const never = async () => { calls++; throw Error('Must not reach a provider'); };
assert.equal((await roleReasoning({ ...base, env: {}, fetchImpl: never })).status, 'disabled');
assert.equal((await roleReasoning({ ...base, env: { NOVA_ROLE_MODEL: 'anthropic' }, paidCall: never })).status, 'blocked'); assert.equal(calls, 0);
const local = await roleReasoning({ ...base, playbook:{...base.playbook,jobs:['Check the supplied ledger totals only'],proof:['Return source record IDs'],escalate:['Missing ledger']}, env: { NOVA_ROLE_MODEL: 'local', NOVA_LOCAL_MODEL: 'fixture', NOVA_LOCAL_MODEL_OFFLINE_CONFIRMED: 'true' }, fetchImpl: async (url, init) => {
 if(url.endsWith('/api/show'))return Response.json({model_info:{architecture:'fixture'}});
 assert.equal(url, 'http://127.0.0.1:11434/api/chat'); const b = JSON.parse(init.body); assert.equal(b.stream, false); assert.equal(b.options.num_predict, 600); assert.match(b.messages[0].content, /No tool calls/);
 assert(b.messages[0].content.includes('Check the supplied ledger totals only')&&b.messages[0].content.includes('Return source record IDs')&&b.messages[0].content.includes('Missing ledger'),'The model must receive this worker’s jobs, proof and escalation rules, not just its title');
 return Response.json({ message: { content: JSON.stringify({ summary: 'Funds are unknown.', next_actions: ['Request a dated balance.'], proposed_lesson: 'Keep the balance date visible.' }) } });
} });
assert.equal(local.advisory_only, true); assert.equal(local.status, 'generated');
const invalid = await roleReasoning({ ...base, env: { NOVA_ROLE_MODEL: 'local', NOVA_LOCAL_MODEL: 'fixture', NOVA_LOCAL_MODEL_OFFLINE_CONFIRMED: 'true' }, fetchImpl: async url => url.endsWith('/api/show') ? Response.json({model_info:{architecture:'fixture'}}) : Response.json({ message: { content: '{"action":"spend","amount":500}' } }) });
assert.equal(invalid.status, 'invalid');
const unavailable = await roleReasoning({ ...base, env: { NOVA_ROLE_MODEL: 'local', NOVA_LOCAL_MODEL: 'fixture', NOVA_LOCAL_MODEL_OFFLINE_CONFIRMED: 'true' }, fetchImpl: async () => { throw Error('offline'); }, paidCall: never });
assert.equal(unavailable.status, 'blocked'); assert.equal(calls, 0, 'No paid fallback after local failure');
const row = { id: 'memory', scope_type: 'organization', scope_id: 'orgA', key: 'role_learning:cfo', status: 'active', content: { approved_by: 'owner' }, expires_at: '2027-01-01' };
const memory = approvedRoleMemories([row, { ...row, scope_id: 'orgB' }, { ...row, content: {} }, { ...row, expires_at: '2020-01-01' }, { ...row, key: 'role_learning:cmo' }], { organizationId: 'orgA', role: 'cfo', now: new Date('2026-11-04') });
assert.equal(memory.length, 1);
const report = cfoCapabilityReport({ now: new Date('2026-11-04'), env: {} });
assert.equal(report.spending_authorized_by_this_report_cents, 0); assert.equal(report.exact_monthly_total_cents, null); assert(report.spending_locked);
for (const item of report.items) { assert(item.free_alternative && item.paid_reason && item.requirements.length); assert.match(item.source, /^https:\/\//); }
assert.match(report.items.find(x => x.key === 'phone_sms').application, /blocked/);
console.log('PASS — all role playbooks, disabled/locked/local reasoning, invalid output refusal, no paid fallback, organization memory scope and CFO cost register');

let hostedBody;
await roleReasoning({...base,env:{NOVA_ROLE_MODEL:'anthropic',NOVA_SPENDING_LOCK:'disabled'},facts:{summary:'PRIVATE_SUMMARY',output:{available_cents:123456789,decisions:[{purpose:'SECRET_EXPENSE'}],executive_results:[{role_key:'cfo',status:'blocked',title:'PRIVATE_TITLE'}]}},memories:[{content:{lessons:[{lesson:'SECRET_APPROVED_NOTE'}]}}],paidCall:async request=>{hostedBody=JSON.stringify(request.body);return {ok:false,reason:'fixture'};}});
for(const secret of ['PRIVATE_SUMMARY','123456789','SECRET_EXPENSE','PRIVATE_TITLE','SECRET_APPROVED_NOTE'])assert(!hostedBody.includes(secret),`Hosted context must exclude ${secret}`);
await roleReasoning({...base,env:{NOVA_ROLE_MODEL:'anthropic',NOVA_SPENDING_LOCK:'disabled',NOVA_ROLE_MODEL_NAME:'global-model',NOVA_WORKER_MODEL_NAME_CFO:'chosen-cfo-model'},paidCall:async request=>{hostedBody=request.body;return {ok:false,reason:'test boundary only'};}});
assert.equal(hostedBody.model,'chosen-cfo-model','A worker must use its own configured model rather than silently using the global selection');
let overrideCalls=0;const ownOff=await roleReasoning({...base,env:{NOVA_ROLE_MODEL:'local',NOVA_LOCAL_MODEL:'test-downloaded',NOVA_LOCAL_MODEL_OFFLINE_CONFIRMED:'true',NOVA_WORKER_MODEL_CFO:'off'},fetchImpl:async()=>{overrideCalls++;throw Error('Must remain off');}});assert.equal(ownOff.status,'disabled');assert.equal(overrideCalls,0);
console.log('PASS — hosted prompt excludes raw summaries, money, task text, expenses and memory prose');
