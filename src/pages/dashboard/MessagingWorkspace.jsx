import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,ArrowRight,MessageSquare,RefreshCw,Sparkles,ShieldCheck,Pause,Play} from 'lucide-react';
import {authedFetch} from '../../lib/apiAuth';
import {PLAYBOOKS} from '../../lib/localAIPlaybooks';
import './Workspace.css';

const CREW={instagram:{name:'Mira',initial:'M',channel:'Instagram',goal:'Turn an inbound question into a clear next step.'},tiktok:{name:'Kai',initial:'K',channel:'TikTok',goal:'Qualify the inquiry and move the conversation forward.'},apple_messages:{name:'Ellis',initial:'E',channel:'Apple Messages',goal:'Resolve the request or arrange a human handoff.'},sms:{name:'Atlas',initial:'A',channel:'SMS',goal:'Answer a customer inquiry and arrange the next useful step.'},whatsapp:{name:'Noor',initial:'N',channel:'WhatsApp',goal:'Help the customer explain their service need and arrange an introduction.'}};
const STATES={received:'Customer message',draft:'Saved draft · not sent',dispatching:'Dispatch result pending',accepted:'Provider accepted · delivery unverified',failed:'Provider rejected',unknown:'Uncertain result · do not resend',test_recorded:'Practice reply recorded · not sent'};
async function workspaceRequest(body){
 const r=await authedFetch('/api/client?resource=channels',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Workspace could not load.');return d;
}
export default function MessagingWorkspace(){
 const [data,setData]=useState({threads:[],messages:[],channels:[]}),[selected,setSelected]=useState(''),[tests,setTests]=useState(false),[busy,setBusy]=useState(false),[aiBusy,setAiBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[draft,setDraft]=useState(''),[replyId,setReplyId]=useState(''),[mode,setMode]=useState('operator'),[modelStatus,setModelStatus]=useState('Model loads when you run a worker'),[sendAfter,setSendAfter]=useState(false),[practiceChannel,setPracticeChannel]=useState('instagram');
 const controller=useRef(null),bound=useRef(null);
 const refresh=useCallback(async()=>{const d=await workspaceRequest();setData(d);return d;},[]);
 useEffect(()=>{let active=true;workspaceRequest().then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;controller.current?.stop();};},[]);
 const threads=data.threads.filter(t=>tests||!t.is_test),thread=threads.find(t=>t.id===selected),messages=data.messages.filter(m=>m.thread_id===selected),crew=CREW[thread?.channel];
 async function perform(action,body={}){setBusy(true);setError('');try{const d=await workspaceRequest({action,...body});await refresh();return d;}catch(e){setError(e.message);return null;}finally{setBusy(false);}}
 function choose(id){if(aiBusy||busy)return;setSelected(id);setDraft('');setReplyId('');setNotice('');setSendAfter(false);bound.current=null;}
 async function practice(){const d=await perform('practice',{channel:practiceChannel});if(d){setTests(true);choose(d.thread_id);setSelected(d.thread_id);setNotice('Practice conversation created in your private CRM. Nothing was sent to a social account.');}}
 async function saveOrSend(action,text=draft,id=replyId,target=thread){
  if(!target||!text.trim())return;
  const d=await perform(action,{thread_id:target.id,reply_id:id||crypto.randomUUID(),body:text});
  if(d){setNotice(action==='save_draft'?'Draft saved privately. No message was sent.':STATES[d.state]||'Action recorded.');if(action==='send_reply'){setDraft('');setReplyId('');}}
 }
 async function run(){
  if(!thread||!crew)return;setAiBusy(true);setError('');setNotice('');const target=thread;const id=crypto.randomUUID();bound.current=target.id;
  try{
   if(!controller.current){const client='/sms-program/local-ai-client.js';const {createLocalAI}=await import(/* @vite-ignore */ client);controller.current=createLocalAI(setModelStatus);}
   const context=messages.filter(m=>!['draft','failed'].includes(m.state)).slice(-8).map(m=>(m.direction==='inbound'?'Customer: ':'Nova: ')+m.body).join('\n').slice(-2400);
   const result=await controller.current.run(target.channel,context);if(bound.current!==target.id)return;
   setDraft(result.text.slice(0,2000));setReplyId(id);setMode(result.output_mode);
   if(sendAfter)await saveOrSend('send_reply',result.text.slice(0,2000),id,target);
  }catch(e){setError(e.message);}finally{setAiBusy(false);}
 }
 const blocked=busy||aiBusy,channel=data.channels.find(c=>c.key===thread?.channel),canSend=thread?.is_test||(channel?.configured&&channel?.send_enabled);
 return <div className="nova-workspace">
  <header className="workspace-topline"><p>NOVA SYSTEMS <span>/</span> CONVERSATIONS</p><Link to="/dashboard/integrations">Manage connections <ArrowUpRight size={14}/></Link></header>
  <section className="workspace-title"><div><p className="workspace-kicker">CUSTOMER WORK, CONNECTED</p><h1>Every conversation.<br/><em>A next step.</em></h1><p>Your workers share the context. Your CRM keeps the record.</p></div><div className="workspace-header-actions"><button className="workspace-outline" disabled={blocked||!data.channels.some(c=>c.key==='tiktok'&&c.configured)} onClick={()=>perform('sync_tiktok').then(d=>{if(d)setNotice('TikTok sync finished. '+d.recorded+' new text messages were recorded. This sync checks recent conversations.');})}>Sync TikTok</button><button className="workspace-outline" disabled={blocked} onClick={()=>perform('overview')}><RefreshCw size={14}/> Refresh inbox</button></div></section>
  {error&&<div className="workspace-alert" role="alert">{error}</div>}{notice&&<div className="workspace-notice" role="status">{notice}</div>}
  <section className="workspace-channel-strip" aria-label="Channel connections">{data.channels.map(c=><a key={c.key} href={c.setup_url} target="_blank" rel="noreferrer" title={c.requirement}><span>{c.name}</span><small>{c.status==='connection_required'?'Account needed':c.status==='dispatch_paused'?'Delivery paused':'Configured · unverified'}</small><ArrowUpRight size={12}/></a>)}</section>
  <div className="workspace-inbox">
   <aside className="workspace-thread-list"><div className="workspace-list-heading"><h2>Conversations</h2><span>{threads.length}</span></div><label className="workspace-check"><input type="checkbox" checked={tests} onChange={e=>{setTests(e.target.checked);choose('');}} disabled={blocked}/> Show practice conversations</label>
    {threads.length?threads.map(t=><button className={'workspace-thread '+(selected===t.id?'selected':'')} key={t.id} onClick={()=>choose(t.id)} disabled={blocked}><span className="workspace-thread-avatar">{CREW[t.channel]?.initial||'N'}</span><span><strong>{t.display_name}</strong><small>{t.is_test?'PRACTICE · ':''}{CREW[t.channel]?.channel} · {t.status}</small></span><ArrowRight size={13}/></button>):<div className="workspace-empty"><MessageSquare size={24}/><h3>Ready for the first hello.</h3><p>Connected business accounts will bring customer messages here.</p></div>}
    <div className="workspace-practice"><p className="workspace-kicker">TRY THE WORKFLOW</p><p>Create a labelled practice conversation, run a worker and see the saved CRM action.</p><label htmlFor="workspace-practice-channel">Practice channel</label><select id="workspace-practice-channel" value={practiceChannel} onChange={e=>setPracticeChannel(e.target.value)} disabled={blocked}>{Object.entries(CREW).map(([key,c])=><option key={key} value={key}>{c.channel}</option>)}</select><button className="workspace-outline" disabled={blocked} onClick={practice}>Start a practice conversation <ArrowRight size={13}/></button></div>
   </aside>
   <section className="workspace-conversation" aria-label="Conversation and worker">
    {thread?<><div className="workspace-conversation-header"><div><p className="workspace-kicker">{thread.is_test?'PRIVATE PRACTICE · ':''}{crew?.channel}</p><h2>{thread.display_name}</h2></div><button className="workspace-icon-button" disabled={blocked||thread.status==='opted_out'} onClick={()=>perform(thread.status==='paused'?'resume':'pause',{thread_id:thread.id})}>{thread.status==='paused'?<Play size={14}/>:<Pause size={14}/>} {thread.status==='paused'?'Resume':'Pause'}</button></div>
     <div className="workspace-message-list">{messages.map(m=><article key={m.id} className={'workspace-message '+(m.direction==='outbound'?'outgoing':'incoming')}><p>{m.body}</p><small>{m.delivery_state==='delivered'?'Provider delivery verified':m.delivery_state==='undelivered'?'Provider reported undelivered':STATES[m.state]} · {new Date(m.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</small></article>)}</div>
     <div className="workspace-composer"><div className="workspace-worker-row"><span className="workspace-worker-avatar">{crew?.initial}</span><div><strong>{crew?.name} <span>· your {crew?.channel} worker</span></strong><p>{crew?.goal}</p></div><Sparkles size={16}/></div>
      <details className="workspace-playbook"><summary>View this worker’s playbook</summary><p>{PLAYBOOKS[thread.channel]}</p><p>Runs the shared Qwen model on this device with a separate playbook and fresh context. First use downloads about 750 MB. It stops when this page closes.</p></details>
      <label className="workspace-check"><input type="checkbox" checked={sendAfter} disabled={blocked||!canSend||thread.status!=='open'} onChange={e=>setSendAfter(e.target.checked)}/>{thread.is_test?'Record the practice reply when the worker finishes':'Send the reply to this conversation when the worker finishes'}</label>
      <button className="workspace-gold" disabled={blocked||thread.status!=='open'} onClick={run}><Sparkles size={14}/>{aiBusy?'Worker is thinking…':'Run '+crew?.name}<ArrowRight size={14}/></button>{aiBusy&&<button className="workspace-icon-button" onClick={()=>controller.current?.stop()}>Stop worker</button>}<p className="workspace-model-status" role="status">{modelStatus}</p>
      <label className="workspace-reply-label">{mode==='verified_template'?'Verified template · review the response':'Your reply · review before sending'}<textarea value={draft} onChange={e=>{setDraft(e.target.value);setReplyId(crypto.randomUUID());setMode('operator');}} maxLength={2000} rows={4} disabled={blocked} placeholder="Write a reply or run the worker…"/></label>
      <div className="workspace-compose-actions"><button className="workspace-icon-button" disabled={blocked} onClick={()=>{setDraft(d=>(d+'\n\nChoose your next step: https://nova-systems.app/service-request').trim().slice(0,2000));setReplyId(crypto.randomUUID());}}>Add booking link <ArrowUpRight size={12}/></button><div><button className="workspace-outline" disabled={blocked||!draft.trim()} onClick={()=>saveOrSend('save_draft')}>Save draft</button><button className="workspace-gold" disabled={blocked||!draft.trim()||!canSend||thread.status!=='open'} onClick={()=>saveOrSend('send_reply')}>{thread.is_test?'Record practice reply':'Send reply'} <ArrowRight size={13}/></button></div></div>
      <p className="workspace-footnote"><ShieldCheck size={12}/>{thread.is_test?'Practice replies stay in the CRM. No platform message is sent.':!canSend?'Connect this account and enable delivery before sending. Drafts remain available.':'A provider acceptance is recorded separately from delivery. Uncertain sends are never automatically retried.'}</p>
      <div className="workspace-thread-footer"><Link to="/dashboard/intake-forms">Open booking desk <ArrowUpRight size={12}/></Link><button disabled={blocked} onClick={()=>perform('archive',{thread_id:thread.id}).then(d=>{if(d)choose('');})}>Archive conversation</button></div>
     </div></>:<div className="workspace-select-state"><span className="workspace-orbit"><MessageSquare size={30}/></span><p className="workspace-kicker">ONE PLACE TO KEEP THINGS MOVING</p><h2>Pick up<br/><em>the conversation.</em></h2><p>Select a customer message or start a private practice.<br/>Your next action will be recorded in the CRM.</p><Link className="workspace-outline" to="/dashboard/intake-forms">Manage requests & appointments <ArrowUpRight size={14}/></Link></div>}
   </section>
  </div>
 </div>;
}
