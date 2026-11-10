// Optional actual inference acceptance. Uses the same pinned runtime and locally verified public weights.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {protectDraft} from '../public/sms-program/draft-policy.js';
import {MODEL,REVISION,PLAYBOOKS} from '../src/lib/localAIPlaybooks.js';
const root=process.env.NOVA_MODEL_RUNTIME;assert(root,'Set NOVA_MODEL_RUNTIME to the local @huggingface/transformers test runtime.');
const {pipeline,env}=await import(pathToFileURL(path.join(root,'node_modules/@huggingface/transformers/dist/transformers.node.mjs')));
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=path.join(root,'model-cache')+'/';
const localModel=fs.existsSync(path.join(root,'model-cache',MODEL,REVISION))?path.join(root,'model-cache',MODEL,REVISION):path.join(root,'model-cache',MODEL);
const p=await pipeline('text-generation',localModel,{dtype:'q4',device:'cpu'});const results=[];
for(const [role,playbook] of Object.entries(PLAYBOOKS)){
 const result=await p([{role:'system',content:playbook},{role:'user',content:'Customer business: Elm Street Plumbing. This business owner wants business software that captures inquiries when calls are missed during jobs. No appointment with Nova Systems is booked yet.'}],{max_new_tokens:80,do_sample:false,repetition_penalty:1.1});
 const messages=result[0].generated_text;const text=typeof messages==='string'?messages:[...messages].reverse().find(x=>x.role==='assistant')?.content;
 assert(text?.length>15);const protectedDraft=protectDraft(role,'I run Elm Street Plumbing and want a system that collects requests when calls are missed.',text);results.push({role,model:MODEL,revision:REVISION,execution:'actual_local_cpu_inference',model_candidate:text,...protectedDraft});assert(!/10\s*AM|\[Date\]/i.test(protectedDraft.text));console.log('PASS — actual local model generated a '+role+' draft.');
}
fs.mkdirSync('docs/qa/free-launch',{recursive:true});fs.writeFileSync('docs/qa/free-launch/actual-model-drafts.json',JSON.stringify(results,null,2)+'\n');await p.dispose();
