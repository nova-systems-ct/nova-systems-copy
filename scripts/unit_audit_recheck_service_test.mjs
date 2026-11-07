import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
const {recheckFindings}=await import('../api/_auditRecheck.js');
const finding={id:'finding',case_id:'case',origin:'automated_review',check_key:'journey_path:https://fixture.example/book',title:'Analyst-reviewed wording',review_status:'reviewed'};
const tables={audit_findings:[finding],audit_evidence:[],audit_finding_evidence:[]};let sequence=0;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url);assert.equal(u.host,'db.test','Recheck must not bypass the injected guarded source reader');
 const table=u.pathname.replace('/rest/v1/','');const rows=tables[table];assert(rows,table);
 const matches=rows.filter(row=>[...u.searchParams].every(([k,v])=>['select','order','limit'].includes(k)||v.startsWith('eq.')&&String(row[k])===v.slice(3)||v.startsWith('neq.')&&String(row[k])!==v.slice(4)));
 if(!options.method||options.method==='GET')return Response.json(matches);
 const body=JSON.parse(options.body);
 if(options.method==='PATCH'){matches.forEach(row=>Object.assign(row,body));return Response.json(matches);}
 const row={id:`record-${++sequence}`,...body};rows.push(row);return Response.json([row]);
};
for(const [result,wanted] of [['reachable','no_longer_observed'],['broken','still_observed'],['unavailable','not_rechecked']]){
 const r=await recheckFindings({id:'case'},{orgId:'org',website:'https://fixture.example/',deps:{render:async()=>[],crawl:async()=>({journey_checks:[{target:'https://fixture.example/book',result,reason:'fixture'}]})}});
 assert.equal(r.results[0].status,wanted);assert.equal(finding.title,'Analyst-reviewed wording');
}
assert.equal(tables.audit_finding_evidence.length,2,'Positive re-checks must link fresh evidence; an unavailable check cannot prove a repair');
console.log('PASS — automated journey findings participate in explicit re-check, keep reviewed wording and record healthy/broken/unavailable outcomes');
