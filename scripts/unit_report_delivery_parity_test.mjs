import assert from 'node:assert/strict';
import { renderReportPdf } from '../api/_auditExtra.js';
const rep={version:1,status:'approved',approved_at:'2026-11-04T12:00:00Z',approved_content_sha256:'fixture',content:{business_identity:{name:'Isolated review fixture'},diagnostic_investigation:{duration_hours:72,state:'review',coverage:[{label:'News',status:'excluded',excluded:1}],tasks:[{question:'UNIQUE_EXCLUSION_MARKER',status:'waived',exclusion_reason:'EXCLUSION_REASON_MARKER'}]},customer_paths:[{label:'Booking',target:'https://fixture.example/book',result:'broken',reason:'UNIQUE_PATH_MARKER',checked_at:'2026-11-04T12:00:00Z'}]}};
Object.assign(rep.content,{scope_and_method:{tests:[{outcome:'LEGACY_TEST_OUTCOME'}]},estimates_and_assumptions:{statement:'ESTIMATE_STATEMENT',scenarios:[{inputs:{missed_calls:17},result:'SCENARIO_RESULT'}]},software_review:[{name:'SOFTWARE_INVENTORY_MARKER'}],competitor_benchmarks:[{source:'COMPETITOR_EVIDENCE_MARKER'}]});
const bytes=renderReportPdf(rep);const {inflateSync}=await import('node:zlib');const source=bytes.toString('latin1');let decoded=source;
for(const m of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){try{decoded+='\n'+inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');}catch{}}
assert.match(decoded,/EXCLUSION_REASON_MARKER/,'Client PDF must include the approved investigation exclusions');
assert.match(decoded,/UNIQUE_PATH_MARKER/,'Client PDF must include approved customer-path evidence');
for(const marker of ['LEGACY_TEST_OUTCOME','SCENARIO_RESULT','SOFTWARE_INVENTORY_MARKER','COMPETITOR_EVIDENCE_MARKER','17'])assert(decoded.includes(marker),`PDF must preserve ${marker}`);
console.log('PASS — client PDF contains investigation coverage and customer journey evidence');

const {findingSourceRevision}=await import('../api/_auditSnapshot.js');
const active={id:'one',title:'Active',review_status:'reviewed'}, rejected={id:'old',title:'Old',review_status:'rejected'};
assert.equal(findingSourceRevision([active]),findingSourceRevision([active,rejected]),'A fresh draft with rejected history must use the same source basis as approval');
assert.notEqual(findingSourceRevision([active]),findingSourceRevision([{...active,review_status:'rejected'}]),'Withdrawing an active finding must invalidate the previous snapshot');
