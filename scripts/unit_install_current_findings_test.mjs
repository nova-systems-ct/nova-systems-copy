import assert from 'node:assert/strict';
import {recommendations,provisionModule} from '../api/_ops/modules.js';
import {buildManifest} from '../api/_ops/install.js';
process.env.SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
const findings=[{id:'rejected',case_id:'latest',title:'Withdrawn',module_key:'website_fixes',review_status:'rejected'}, {id:'fixed',case_id:'latest',title:'Already fixed',module_key:'website_fixes',review_status:'reviewed',recheck_status:'no_longer_observed'}, {id:'current',case_id:'older',title:'Current verified issue',module_key:'website_fixes',review_status:'reviewed',recheck_status:'still_observed'}];
const cases=[{id:'prospect',organization_id:'o',intake:{name:'Other Company'},audit_findings:[{count:5}],created_at:'2026-11-03'}, {id:'latest',organization_id:'o',intake:{name:'Nova Systems'},audit_findings:[{count:2}],created_at:'2026-11-02'}, {id:'older',organization_id:'o',intake:{name:'Nova Systems'},audit_findings:[{count:1}],created_at:'2026-11-01'}];
const writes=[];
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);assert.equal(u.host,'db.test');const table=u.pathname.slice('/rest/v1/'.length);
 let rows=table==='organizations'?[{id:'o',name:'Nova Systems'}]:table==='ops_business_settings'?[{organization_id:'o',display_name:'Nova Systems'}]:table==='audit_cases'?cases:table==='audit_findings'?findings:[];
 if(table==='work_items'&&init.method==='POST'){const row=JSON.parse(init.body);writes.push(row);return Response.json([{id:'task',...row}]);}
 for(const [k,v]of u.searchParams){if(['select','limit','order'].includes(k))continue;if(v.startsWith('eq.'))rows=rows.filter(r=>String(r[k])===v.slice(3));else if(v.startsWith('neq.'))rows=rows.filter(r=>String(r[k])!==v.slice(4));else if(v==='is.null')rows=rows.filter(r=>r[k]==null);else throw Error(`${k}=${v}`);}
 return Response.json(rows);
};
const rec=await recommendations('o');assert.equal(rec.audit.case_id,'older','Recommendations must skip newer audits containing only rejected or no-longer-observed findings');
const manifest=await buildManifest('o');assert.equal(manifest.manifest.audit.case_id,'older','Installer and recommendations must use the same current findings');
assert.deepEqual(manifest.manifest.audit.findings.map(f=>f.id),['current']);
await provisionModule('o','website_fixes',{latestAuditCaseId:'latest',actor:{id:'owner'},results:{}});assert.equal(writes.length,0,'Re-running installation must not create work for withdrawn or fixed problems');
await provisionModule('o','website_fixes',{latestAuditCaseId:'older',actor:{id:'owner'},results:{}});assert.equal(writes.length,1);assert.equal(writes[0].source_ref,'finding:current');
console.log('PASS — audit-driven installer uses current own-business findings and excludes withdrawn/fixed work');
