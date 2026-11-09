import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { renderAuditPdf } from '../api/_auditPdf.js';
const pdf=renderAuditPdf({version:1,status:'draft',content:{business_identity:{name:'ReadableSentinelName'},executive_summary:'ReadableSentinelBody',owner_goal:'ReadableSentinelGoal'}});
const streams=[...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap(m=>{try{return [inflateSync(Buffer.from(m[1],'latin1')).toString('latin1')];}catch{return [];}});
const blocks=streams.flatMap(s=>[...s.matchAll(/BT\s([\s\S]*?)ET/g)].map(m=>m[1]));
for(const word of ['ReadableSentinelName','ReadableSentinelBody','ReadableSentinelGoal']) {
 const b=blocks.find(b=>b.includes(`(${word}) Tj`)); assert.ok(b,`${word} is present`);
 const tracking=[...b.matchAll(/([-\d.]+) Tc/g)].at(-1)?.[1]; assert.equal(Number(tracking),0,`${word} resets heading tracking before drawing`);
}
assert.ok(blocks.some(b=>/3\.?0* Tc/.test(b)),'the cover label retains intentional tracking');
console.log('4 passed, 0 failed');
