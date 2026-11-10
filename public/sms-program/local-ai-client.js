import {protectDraft} from './draft-policy.js';
// One model instance per controller; every generation starts a fresh role-specific context.
export function createLocalAI(onStatus=()=>{}){
 let worker=null,pending=null;
 const stop=()=>{worker?.terminate();worker=null;if(pending){pending.reject(new Error('On-device AI stopped.'));pending=null;}onStatus('stopped');};
 const run=(agent,input,facts={})=>new Promise((resolve,reject)=>{
  if(pending){reject(new Error('Wait for the current draft or stop AI first.'));return;}
  if(!worker){worker=new Worker('/ai-runtime/nova-local-worker.js',{type:'module'});worker.onmessage=({data:d})=>{
   if(!pending||d.id!==pending.id)return;
   if(d.type==='progress')onStatus('Downloading local model · '+d.progress+'%');
   if(d.type==='ready')onStatus('Writing on your device…');
   if(d.type==='result'){const p=pending;pending=null;const safe=protectDraft(p.agent,p.input,d.text,p.facts);onStatus(safe.output_mode==='verified_template'?'Verified template ready · model details held':'Draft ready · on-device model');p.resolve({...d,...safe});}
   if(d.type==='error'){const p=pending;pending=null;onStatus('Could not run on-device AI');p.reject(new Error(d.message));}
  };worker.onerror=()=>{const p=pending;pending=null;worker?.terminate();worker=null;onStatus('Could not run on-device AI');p?.reject(new Error('On-device AI could not load. The booking form remains available.'));};}
  const id=crypto.randomUUID();pending={id,resolve,reject,agent,input,facts};onStatus('Loading on-device AI…');worker.postMessage({id,action:'generate',agent,input});
 });
 return {run,stop};
}
