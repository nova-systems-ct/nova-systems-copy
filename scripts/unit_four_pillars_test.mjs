import assert from 'node:assert/strict';
import { importAuditRecords } from '../api/_auditRecords.js';
import { summarizeExport, compareExports, measured, exportFrom } from '../src/lib/auditRecords.js';
import { runInboundSalesWorker } from '../api/_autonomousSales.js';
import { salesIntakeDraft } from '../api/_salesIntakeDraft.js';
import { feedbackReply } from '../api/_reviews.js';
import { printableAudit } from '../src/lib/auditTests.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log('ok  ', name); }
const csv = 'id,date,direction,outcome,extra\r\n"c,1",2026-10-01,inbound,person,"someone, private"\r\nc2,2026-10-02,inbound,voicemail,"line 1\nline 2"\r\nc2,2026-10-02,inbound,voicemail,x\r\nout,2026-10-03,outbound,completed,private';
const args = { kind:'calls', source:'Office line', start:'2026-10-01', end:'2026-10-07', csv };
const s = summarizeExport(args);
check('CSV quotes, repeated calls and outbound calls preserve the correct denominator', () => assert.deepEqual([s.records,s.numerator,s.denominator,s.unknown,s.duplicates,s.excluded],[2,1,2,0,1,1]));
check('completed without disposition is unknown', () => assert.equal(summarizeExport({...args,csv:csv.replace('inbound,person','inbound,completed')}).unknown,1));
check('a changed duplicate rejects the entire file', () => assert.throws(() => summarizeExport({...args,csv:csv.replace('voicemail,x','assistant,x')}),/conflicting/));
check('invalid and out-of-period dates fail', () => assert.throws(() => summarizeExport({...args,csv:csv.replace('2026-10-03','2026-02-30')}),/within/));
check('quotes distinguish open, accepted and unknown', () => {const v=summarizeExport({...args,kind:'quotes',csv:'id,date,status\na,2026-10-01,accepted\nb,2026-10-06,open\nc,2026-10-06,unknown'});assert.deepEqual([v.numerator,v.denominator,v.unknown],[1,2,1]);});
check('invoices retain exact cents and reject excessive balances', () => {const v={...args,kind:'invoices',csv:'id,date,total_cents,outstanding_cents\na,2026-10-01,19900,4900'};assert.match(measured(summarizeExport(v)),/49.00 outstanding of \$199.00/);assert.throws(()=>summarizeExport({...v,csv:v.csv.replace('4900','29900')}),/balances/);});
const after = {...s,start:'2026-10-08',end:'2026-10-14',numerator:2};
check('same source and complete equal non-overlapping windows can be compared',()=>assert.equal(compareExports(s,after).delta,50));
check('overlap, missing outcomes, zero denominator and mismatched sources block trend claims',()=> {for(const patch of [{start:s.end},{unknown:1},{denominator:0},{days:8},{source:'other'}]) assert.ok(compareExports(s,{...after,...patch}).reason);});
const saved = new Map();
const deps = {
  rateLimit:()=>true, requireOrgAccess:async(req,res,org)=>{if(org==='ours')return true;res.status(403).json({});return false;},
  loadAuditCase:async(id,org)=>id==='case' && org==='ours',
  sbWrite:async(table,method,row)=>{ assert.equal(table,'audit_evidence');if(saved.has(row.id))return {ok:false,status:409};saved.set(row.id,row);return {ok:true}; },
  sbSelect:async path=>({ok:true,json:async()=>[saved.get(path.split('id=eq.')[1].split('&')[0])].filter(Boolean)}),
};
async function upload(changes={}) {
  const res={status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
  await importAuditRecords({method:'POST',body:{...args,organization_id:'ours',case_id:'case',permission_ref:'Signed QA fixture',complete:true,...changes}},res,{email:'tester@example.invalid'},deps);
  return res;
}
const initial=await upload(); const duplicate=await upload(); const changed=await upload({csv:csv.replace('inbound,person','inbound,missed')});
check('persisted evidence is stable on retry and cannot silently be overwritten',()=>assert.deepEqual([initial.code,duplicate.code,duplicate.body.repeated,changed.code,saved.size],[201,200,true,409,1]));
const privateRow=[...saved.values()][0], record=exportFrom(privateRow);
check('raw identifiers, phone fields and unrelated CSV cells are never saved or printed',()=>{assert.ok(!JSON.stringify(privateRow).includes('someone, private'));const h=printableAudit({business:'<Owner>',records:[record],tests:[]});assert.ok(h.includes('Front desk and missed-call follow-up') && h.includes('1 of 2 known') && !h.includes('<Owner>'));});
for(const [label,params,expected] of [['missing written permission',{permission_ref:''},422],['partial export',{complete:false},422],['other organization',{organization_id:'theirs'},403],['foreign case',{case_id:'foreign'},404]]) {
  const out=await upload(params);check(label,()=>assert.equal(out.code,expected));
}
check('sales work identifies the need, requests real evidence and avoids invented pricing',()=>{const d=salesIntakeDraft('How much to answer my calls?');assert.equal(d.system,'Call answering');assert.ok(d.evidence.includes('export')&&!d.reply.includes('$'));});
check('a stop request or request for a person takes priority over selling',()=>{assert.equal(salesIntakeDraft('stop messaging about invoices').state,'suppressed');assert.equal(salesIntakeDraft('refund my invoice').state,'handoff');});
check('the business can draft a reply to every rating without exposing personal facts',()=>{assert.match(feedbackReply(2),/privately/);assert.ok(feedbackReply(5));assert.equal(feedbackReply(8),null);});
process.env.SUPABASE_URL='https://sales-store.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-fixture';
process.env.NOVA_SPENDING_LOCK='enabled';
const calls=[], prepared=[];
const inbound={direction:'inbound',id:'message-1',body:'We keep missing phone calls.',created_at:'2026-10-01T14:00:00Z'};
globalThis.fetch=async (url, {body})=>{
  const rpc=new URL(url).pathname.split('/').pop(), args=JSON.parse(body);
  calls.push(rpc);
  let result;
  if(rpc==='nova_company_automation') result={ok:true,enabled:true,thread:{channel:'instagram'},actor:'owner',messages:[inbound]};
  else if(rpc==='nova_provider_runtime') result=[];
  else if(rpc==='nova_automation_record') {prepared.push(args);result={ok:true};}
  else throw new Error('Unexpected provider or send while the spend lock is active');
  return {ok:true,json:async()=>result};
};
const firstDraft=await runInboundSalesWorker('thread-1');
await runInboundSalesWorker('thread-1');
check('enabled inbound worker persists the qualification in the same thread, reusing the same key on retry',()=>{assert.equal(firstDraft.dispatched,false);assert.equal(prepared[0].p_thread,'thread-1');assert.equal(prepared[0].p_body.system,'Call answering');assert.equal(prepared[0].p_key,prepared[1].p_key);assert.equal(prepared[0].p_body.model_invoked,false);});
inbound.body='Please stop messaging me';
check('no dispatch or model was invoked for the qualification',()=>assert.ok(calls.every(c=>['nova_company_automation','nova_provider_runtime','nova_automation_record'].includes(c))));
const suppressed=await runInboundSalesWorker('thread-1');
check('opt-out records no new sales draft',()=>{assert.equal(suppressed.skipped,'customer_declined');assert.equal(prepared.length,2);});
console.log(`${checks} passed, 0 failed`);
