import assert from 'node:assert/strict';
import { guardedModelCall } from '../api/_aiSpend.js';
const old={...process.env};
Object.assign(process.env,{NOVA_SPENDING_LOCK:'disabled',NOVA_AI_PAID_CALLS:'enabled',ANTHROPIC_API_KEY:'fixture-not-a-key',NOVA_AI_PRICES:JSON.stringify({fixture:{input_per_mtok:1,output_per_mtok:1,version:'fixture'}})});
try {
 let calls=0;let settlement;
 const out=await guardedModelCall({purpose:'isolated-test',body:{model:'fixture',max_tokens:100,messages:[{role:'user',content:'fixture'}]},fetchImpl:async()=>{calls++;throw Object.assign(new Error('uncertain network'),{name:'AbortError'});},rpcImpl:async(name,args)=>{if(name==='ai_spend_reserve')return {ok:true,id:'fixture-id'};settlement=args;}});
 assert.equal(calls,1,'An ambiguous billable attempt must not be retried under the same reservation');
 assert.equal(out.ok,false);assert.equal(settlement.p_usage_basis,'unknown');assert.equal(settlement.p_actual_usd,null);
 calls=0;
 const duplicate=await guardedModelCall({purpose:'isolated-test',requestId:'duplicate',body:{model:'fixture',max_tokens:100,messages:[]},fetchImpl:async()=>{calls++;return Response.json({});},rpcImpl:async()=>({ok:false,id:'existing',reason:'duplicate_request'})});
 assert.equal(duplicate.blocked,true);assert.equal(calls,0);
 await guardedModelCall({purpose:'isolated-test',body:{model:'fixture',max_tokens:100,messages:[]},fetchImpl:async()=>Response.json({content:[],usage:{input_tokens:10}}),rpcImpl:async(name,args)=>{if(name==='ai_spend_reserve')return {ok:true,id:'partial'};settlement=args;}});
 assert.equal(settlement.p_usage_basis,'unknown','Partial usage cannot reduce the conservative committed cost');
 delete process.env.NOVA_SPENDING_LOCK;
 const locked=await guardedModelCall({purpose:'isolated-test',body:{model:'fixture'},fetchImpl:async()=>{throw Error('Locked model must never be called');},rpcImpl:async()=>{throw Error('Locked model must never reserve');}});
 assert.equal(locked.reason,'spending_locked');
 console.log('PASS — single-dispatch spending reservation, ambiguous usage and duplicate refusal');
} finally { for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old); }
