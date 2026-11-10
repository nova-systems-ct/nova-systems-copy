// Pinned open-source runtime/model. Inputs stay in this Worker; no inference API is called.
import {pipeline,env} from '@huggingface/transformers';
import {MODEL,REVISION,PLAYBOOKS} from '../lib/localAIPlaybooks.js';
let generator=null, busy=false;
self.addEventListener('message',async({data})=>{
 const {id,action,agent='intake',input=''}=data||{};
 if(!id||busy) return;
 if(!Object.hasOwn(PLAYBOOKS,agent)){self.postMessage({id,type:'error',message:'Unknown worker playbook.'});return;}
 busy=true;
 try{
  if(!generator){
   env.allowLocalModels=false;
   env.remoteHost=import.meta.env.MODE==='test'?self.location.origin+'/__model_assets/':'https://huggingface.co/';
   env.remotePathTemplate='{model}/resolve/'+REVISION+'/';
   env.backends.onnx.wasm.numThreads=1;
   env.backends.onnx.wasm.wasmPaths='/ai-runtime/';
   generator=await pipeline('text-generation',MODEL,{revision:REVISION,dtype:'q4',device:'wasm',progress_callback:p=>{
    if(p.status==='progress'&&p.file?.endsWith('.onnx'))self.postMessage({id,type:'progress',progress:Math.round(p.progress||0)});
   }});
  }
  self.postMessage({id,type:'ready',model:MODEL});
  if(action==='load'){busy=false;return;}
  if(typeof input!=='string'||!input.trim()||input.length>2400)throw Error('Enter a request of up to 2,400 characters.');
  const result=await generator([{role:'system',content:PLAYBOOKS[agent]},{role:'user',content:input}],{max_new_tokens:96,do_sample:false,repetition_penalty:1.1});
  const output=result[0]?.generated_text;
  const content=typeof output==='string'?output:[...(Array.isArray(output)?output:[])].reverse().find(m=>m.role==='assistant')?.content;
  if(!content?.trim())throw Error('The local model did not produce a draft.');
  self.postMessage({id,type:'result',text:content.trim().slice(0,4000),model:MODEL,revision:REVISION,playbook:'nova-local-'+agent+'-2026-11-09'});
 }catch(error){console.error('[nova-local-ai]',String(error?.name||'RuntimeError'),String(error?.message||'failed').replace(/https?:\/\/\S+/g,'[model asset]').slice(0,400));self.postMessage({id,type:'error',message:error?.message?.startsWith('Enter a request')?error.message:'On-device AI could not run in this browser. Your booking form still works. Try a current desktop browser.'});}
 finally{busy=false;}
});
