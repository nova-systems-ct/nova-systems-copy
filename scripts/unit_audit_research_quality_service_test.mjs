import assert from 'node:assert/strict';
import {runResearch} from '../api/_researchRun.js';
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.AUDIT_RENDER='off';
const tables={audit_research_runs:[{id:'run1',organization_id:'o',case_id:'a',scope:'full'}],audit_cases:[{id:'a',organization_id:'o',intake:{name:'Factory',location:'Waterbury',industry:'custom manufacturing',website:'https://shop.example/',goal:'Improve RFQ requests'}}],audit_evidence:[],audit_findings:[],audit_finding_evidence:[],audit_competitors:[],public_research_cache:[]};
let seq=0;
function matches(row,[k,v]){
 if(['select','limit','order','on_conflict'].includes(k))return true;
 if(v.startsWith('eq.'))return String(row[k])===v.slice(3);
 if(v.startsWith('neq.'))return String(row[k])!==v.slice(4);
 if(v.startsWith('in.'))return v.slice(4,-1).split(',').includes(String(row[k]));
 throw Error(`Unexpected filter ${k}=${v}`);
}
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);assert.equal(u.host,'db.test','Database boundary must not contact outside providers');
 if(u.pathname==='/rest/v1/rpc/has_permission')return Response.json(true);
 const table=u.pathname.slice('/rest/v1/'.length);const rows=tables[table];assert(rows,table);
 const found=rows.filter(r=>[...u.searchParams].every(x=>matches(r,x)));const b=init.body?JSON.parse(init.body):null;
 if(!init.method||init.method==='GET')return Response.json(found.slice(0,Number(u.searchParams.get('limit'))||found.length));
 if(init.method==='PATCH'){found.forEach(r=>Object.assign(r,structuredClone(b)));return Response.json(found);}
 if(init.method==='POST'){const out=(Array.isArray(b)?b:[b]).map(x=>({id:`row${++seq}`,...structuredClone(x)}));rows.push(...out);return Response.json(out);}
 throw Error(`Unexpected mutation ${init.method}`);
};
let many=false;
const shell=b=>`<html><head><meta name="viewport" content="width=device-width"><title>Factory Waterbury</title></head><body>${b}</body></html>`;
const fetchImpl=async url=>{
 const u=new URL(url);if(u.hostname!=='shop.example')return Response.json([]);
 if(u.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}});
 const controls=many?Array.from({length:8},(_,i)=>`<input name="part${i}" required>`).join(''):'<input name="email" type="email" required><textarea name="request"></textarea>'+Array.from({length:8},()=>'<input type="hidden" name="token">').join('');
 return new Response(shell(u.pathname==='/book'?'<h1>Page not found</h1>':`<h1>Factory Waterbury</h1><a href="/book">Book a consultation</a><a href="/contact">Contact</a><form>${controls}</form>`),{headers:{'content-type':'text/html'}});
};
const deps={fetchImpl,lookup:async()=>[{address:'93.184.216.34',family:4}],resolver:{resolveMx:async()=>[]},render:null};
await runResearch('run1',deps);
assert(tables.audit_findings.some(f=>f.check_key?.startsWith('journey_path:')&&f.priority==='high'),'A broken booking destination must become an evidence-linked actionable finding');
assert(!tables.audit_findings.some(f=>f.check_key?.startsWith('long_form:')),'Hidden fields must not create a conversion problem');
assert(tables.audit_research_runs[0].summary.journey_checks.some(x=>x.result==='broken'));
many=true;tables.audit_research_runs.push({id:'run2',organization_id:'o',case_id:'a',scope:'full'});await runResearch('run2',deps);
const form=tables.audit_findings.find(f=>f.check_key?.startsWith('long_form:'));
assert(form&&form.statement_type==='inference'&&form.confidence==='medium','Form friction is a hypothesis, not a measured loss');
assert.match(form.detail,/8.*required/i);assert.equal(form.financial_impact_status,'unknown');
assert(tables.audit_finding_evidence.some(l=>l.finding_id===form.id));
// Re-running must refresh only Nova's unreviewed draft and link the new observations.
form.title='Outdated draft';tables.audit_research_runs.push({id:'run3',organization_id:'o',case_id:'a',scope:'full'});await runResearch('run3',deps);
assert.notEqual(form.title,'Outdated draft');
form.review_status='reviewed';form.title='Analyst-reviewed wording';tables.audit_research_runs.push({id:'run4',organization_id:'o',case_id:'a',scope:'full'});await runResearch('run4',deps);assert.equal(form.title,'Analyst-reviewed wording');
tables.audit_recommendations=[];tables.audit_reports=[];
const {handleAuditWorkspace}=await import('../api/_auditWorkspace.js');
const res={code:200,status(n){this.code=n;return this;},json(b){this.body=b;return this;}};
await handleAuditWorkspace({method:'POST',headers:{authorization:'Bearer test'},body:{organization_id:'o',case_id:'a'}},res,'draft-report',{id:'analyst'});
assert.equal(res.code,200,JSON.stringify(res.body));
assert(tables.audit_reports[0].content.customer_paths?.some(x=>x.result==='broken'),'The stored PDF report must include the actual path tests');
console.log('PASS — research persists useful path findings, calibrated hypotheses and fresh draft evidence without rewriting reviewed work');
