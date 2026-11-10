import {createLocalAI} from './local-ai-client.js';
const $=id=>document.getElementById(id);
const ai=createLocalAI(s=>{$('local-ai-status').textContent=s;});
let output=null;
$('local-ai-form').addEventListener('submit',async e=>{
 e.preventDefault();const input=$('local-ai-input').value.trim();if(!input)return;
 $('local-ai-run').disabled=true;$('local-ai-stop').hidden=false;$('local-ai-use').hidden=true;$('local-ai-error').textContent='';output=null;
 try{output=await ai.run('intake',input);$('local-ai-output').value=output.text;$('local-ai-output-label').textContent=output.output_mode==='verified_template'?'Verified template · review before using':'AI draft · review before using';$('local-ai-result').hidden=false;$('local-ai-use').hidden=false;}
 catch(e){$('local-ai-error').textContent=e.message;}
 finally{$('local-ai-run').disabled=false;$('local-ai-stop').hidden=true;}
});
$('local-ai-stop').addEventListener('click',()=>ai.stop());
$('local-ai-use').addEventListener('click',()=>{
 const input=$('local-ai-input').value.trim();const draft=$('local-ai-output').value.trim();
 $('message').value=(input+'\n\nReviewed planning draft: '+draft).slice(0,2000);
 $('local-ai-status').textContent='Added to your request below. Review the details, then send when ready.';$('message').focus();
});
window.addEventListener('pagehide',()=>ai.stop());
window.addEventListener('nova-request-saved',()=>ai.stop());
