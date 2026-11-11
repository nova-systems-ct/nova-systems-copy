import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowRight,Check,ChevronRight,ClipboardList,Clapperboard,Cpu,Download,Network,Pause,Play,Wallet} from 'lucide-react';
import {authedFetch} from '../../lib/apiAuth';
import {executiveOrder,executiveRoles} from '../../lib/executivePlaybooks';
import {renderCampaignVideo} from '../../lib/campaignVideo';
import '../../styles/NovaLuxe.css';
import './ExecutiveTeam.css';

const endpoint='/api/client?resource=company&op=team';
const names={owner:'Isaac Nova',...Object.fromEntries(Object.entries(executiveRoles).map(([key,role])=>[key,role.name]))};
const channelStatus={connection_required:'Connection needed',dispatch_paused:'Dispatch paused',configured_unverified:'Delivery unverified'};
const stageLabels={ready:'Ready',in_progress:'In progress',review:'Ready for review'};

async function teamRequest({body,missionId,signal}={}) {
  const url=missionId?`${endpoint}&mission_id=${encodeURIComponent(missionId)}`:endpoint;
  const options=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
  const response=await authedFetch(url,{...options,signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'Company HQ could not load. Try reloading your saved work.');
  return result;
}

function draftLocalMessage(worker,agent,input,signal,onProgress) {
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>finish(Error('The on-device model timed out.')),180000);
    function finish(error,value){
      clearTimeout(timer);
      signal.removeEventListener('abort',cancel);
      worker.removeEventListener('message',receive);
      worker.removeEventListener('error',fail);
      if(error)reject(error);else resolve(value);
    }
    function cancel(){finish(signal.reason);}
    function fail(){finish(Error('The on-device model could not start.'));}
    function receive({data}){
      if(data.id!==id)return;
      if(data.type==='progress')onProgress(`Downloading Qwen · ${data.progress}%`);
      if(data.type==='ready')onProgress(`${names[agent]} is drafting on this device…`);
      if(data.type==='result')finish(null,data.text);
      if(data.type==='error')finish(Error('The on-device model could not produce this draft.'));
    }
    signal.addEventListener('abort',cancel,{once:true});
    worker.addEventListener('message',receive);
    worker.addEventListener('error',fail);
    worker.postMessage({id,action:'draft',agent,input});
  });
}

function RoleMap({active,selected,events,onSelect}) {
  const saved=new Set(events.filter(event=>event.step>=0).map(event=>event.sender));
  function roleButton(key){
    const role=executiveRoles[key];
    return <button type="button" className={`executive-role${active===key?' is-working':''}`} aria-pressed={selected===key} onClick={()=>onSelect(key)}>
      <span className="executive-role-icon">{saved.has(key)&&active!==key?<Check size={16}/>:key==='cfo'?<Wallet size={16}/>:key==='zion'?<Clapperboard size={16}/>:<Network size={16}/>}</span>
      <span><strong>{role.name}</strong><small>{active===key?'Working':saved.has(key)?'Work saved':role.detail}</small></span>
    </button>;
  }
  return <div className="executive-map" aria-label="Executive team">
    {roleButton('ceo')}
    <ArrowDown className="executive-connector" size={15}/>
    {roleButton('chief')}
    <div className="executive-branches">
      <div>{roleButton('coo')}</div>
      <div>{roleButton('cmo')}<ArrowDown className="executive-connector" size={15}/>{roleButton('zion')}</div>
      <div>{roleButton('cfo')}</div>
    </div>
  </div>;
}

function WorkReceipts({events}) {
  const marketing=events.find(event=>event.sender==='cmo')?.receipt;
  const production=events.find(event=>event.sender==='zion')?.receipt;
  const operations=events.find(event=>event.sender==='coo')?.receipt;
  const finance=events.find(event=>event.sender==='cfo')?.receipt;
  const [preview,setPreview]=useState(null);
  const [progress,setProgress]=useState(null);
  const [error,setError]=useState('');
  const previewController=useRef(null);
  useEffect(()=>()=>previewController.current?.abort(),[]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);

  async function renderVideo(){
    const controller=new AbortController();
    previewController.current=controller;
    setError('');setProgress(0);
    try{
      const blob=await renderCampaignVideo(production.scenes,setProgress,controller.signal);
      setPreview({url:URL.createObjectURL(blob),extension:blob.type.startsWith('video/mp4')?'mp4':'webm'});
    }catch(error){if(!controller.signal.aborted)setError(error.message);}
    finally{if(!controller.signal.aborted)setProgress(null);}
  }

  if(!marketing&&!production&&!operations&&!finance)return null;
  return <section className="luxe-panel executive-receipts" aria-labelledby="executive-receipts-title">
    <div className="luxe-panel-title"><h2 id="executive-receipts-title"><ClipboardList size={20}/> Saved work</h2></div>
    {operations&&<div className="executive-receipt"><strong>Operations review</strong><p>{operations.pending_tasks} pending tasks · {operations.booked_appointments} upcoming appointments at the handoff</p><Link className="luxe-link" to="/dashboard/calendar">Open calendar <ArrowRight size={14}/></Link></div>}
    {marketing&&<div className="executive-receipt">
      <div className="luxe-panel-title"><strong>Platform drafts</strong><Link className="luxe-link" to="/dashboard/marketing">Open content pipeline <ArrowRight size={14}/></Link></div>
      <div className="executive-drafts">{marketing.drafts.map(draft=><article key={draft.asset_id}>
        <span className="luxe-badge">{draft.platform} · Draft</span><p>{draft.caption}</p>
      </article>)}</div>
    </div>}
    {production&&<div className="executive-receipt"><strong>Zion’s video script</strong><p className="executive-script">{production.script}</p>
      <div className="luxe-actions"><button className="luxe-outline" type="button" onClick={renderVideo} disabled={progress!==null}>
        <Clapperboard size={16}/>{progress===null?'Render video preview':`Rendering · ${progress}%`}
      </button>{preview&&<a className="luxe-outline" href={preview.url} download={`nova-zion-preview.${preview.extension}`}><Download size={16}/>Download video</a>}</div>
      {error&&<p role="alert" className="luxe-alert">{error}</p>}
      {preview&&<video className="executive-video" src={preview.url} aria-label="Zion video preview" controls playsInline/>}
    </div>}
    {finance&&<div className="executive-receipt"><strong>CFO review</strong><p>${(finance.spent_cents/100).toFixed(2)} used · {finance.open_requests} open budget requests at the handoff</p><Link className="luxe-link" to="/dashboard/cfo">Open CFO desk <ArrowRight size={14}/></Link></div>}
  </section>;
}

export default function ExecutiveTeam(){
  const [data,setData]=useState(null);
  const [objective,setObjective]=useState('');
  const [focus,setFocus]=useState('audit');
  const [selected,setSelected]=useState('ceo');
  const [working,setWorking]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [localAI,setLocalAI]=useState(false);
  const [modelStatus,setModelStatus]=useState('');
  const [assignee,setAssignee]=useState('');
  const [taskId,setTaskId]=useState('');
  const lifetime=useRef(null);
  const worker=useRef(null);
  const pause=useRef(false);
  const startKey=useRef(null);
  const mission=data?.mission;
  const events=data?.events||[];
  const role=executiveRoles[selected];

  const load=useCallback(async missionId=>{
    const signal=lifetime.current.signal;
    setBusy(true);setError('');
    try{setData(await teamRequest({missionId,signal}));}
    catch(error){if(!signal.aborted)setError(error.message);}
    finally{if(!signal.aborted)setBusy(false);}
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    lifetime.current=controller;
    load();
    return ()=>{controller.abort();worker.current?.terminate();worker.current=null;};
  },[load]);

  async function run(current){
    const signal=lifetime.current.signal;
    pause.current=false;
    setBusy(true);setError('');setNotice('');setModelStatus('');
    let modelEnabled=localAI;
    try{
      if(!current){
        const cleanObjective=objective.trim();
        if(startKey.current?.objective!==cleanObjective||startKey.current.focus!==focus){
          startKey.current={id:crypto.randomUUID(),objective:cleanObjective,focus};
        }
        current=await teamRequest({body:{action:'start',mission_id:startKey.current.id,objective:cleanObjective,focus},signal});
        setData(current);setObjective('');startKey.current=null;
      }
      while(current.mission.next_step<executiveOrder.length&&!pause.current&&!signal.aborted){
        const step=current.mission.next_step;
        const key=executiveOrder[step];
        setWorking(key);
        let note=null;
        if(modelEnabled){
          try{
            worker.current||=new Worker(new URL('../../workers/localAI.worker.js',import.meta.url),{type:'module'});
            const incoming=current.events.at(-1);
            const input=`Campaign focus: ${current.mission.focus}\nOwner objective: ${current.mission.objective}\nPrevious handoff: ${incoming?.message||''}\nPrevious proposed message: ${incoming?.model_note?.slice(0,600)||''}`;
            note=await draftLocalMessage(worker.current,key,input.slice(0,2400),signal,setModelStatus);
          }catch(error){
            if(signal.aborted)return;
            worker.current?.terminate();worker.current=null;
            modelEnabled=false;
            setModelStatus(`${error.message} Saved workflow steps can continue.`);
          }
        }
        current=await teamRequest({body:{action:'advance',mission_id:current.mission.id,expected_step:step,model_note:note},signal});
        setData(current);
      }
      if(signal.aborted)return;
      if(modelEnabled)setModelStatus('On-device proposals saved in the handoff log.');
      setNotice(current.mission.state==='review'?'Campaign ready for review. Two platform drafts and Zion’s script are saved.':'Paused after the last saved handoff.');
    }catch(error){if(!signal.aborted)setError(error.message);}
    finally{if(!signal.aborted){setBusy(false);setWorking(null);}}
  }

  async function assign(event){
    event.preventDefault();
    const signal=lifetime.current.signal;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await teamRequest({body:{action:'assign',task_id:taskId,assignee},signal});
      setTaskId('');setAssignee('');setNotice(`Assignment saved for ${result.assigned_to}.`);
      setData(await teamRequest({missionId:mission?.id,signal}));
    }catch(error){if(!signal.aborted)setError(error.message);}
    finally{if(!signal.aborted)setBusy(false);}
  }

  return <div className="luxe-page executive-page">
    <section className="luxe-heading executive-heading">
      <div><h1>Company <em>HQ</em></h1><p>Assign the work. Follow each handoff.</p></div>
      <Link className="luxe-outline" to="/dashboard/cfo"><Wallet size={16}/>CFO & budgets</Link>
    </section>
    {error&&<div className="luxe-alert" role="alert">{error} <button type="button" className="luxe-link" disabled={busy} onClick={()=>load(mission?.id)}>Reload saved work</button></div>}
    {notice&&<p className="luxe-alert" role="status">{notice}</p>}
    <div className="executive-grid">
      <section className="luxe-panel executive-team-panel">
        <div className="luxe-panel-title"><h2><Network size={20}/> Executive team</h2></div>
        <RoleMap active={working} selected={selected} events={events} onSelect={setSelected}/>
        <article className="executive-playbook"><h3>{role.name}</h3><p>{role.goal}</p><strong>{role.tool}</strong>
          <ol>{role.playbook.map(item=><li key={item}>{item}</li>)}</ol>
        </article>
      </section>
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2><ClipboardList size={20}/> Campaign brief</h2><span className="luxe-badge">$0 budget</span></div>
        <form className="luxe-form" onSubmit={event=>{event.preventDefault();run();}}>
          <label>Objective<textarea value={objective} onChange={event=>setObjective(event.target.value)} minLength={8} maxLength={1000} required placeholder="Prepare a Nova Audit campaign for local service businesses." disabled={busy}/></label>
          <label>Focus<select aria-label="Focus" value={focus} onChange={event=>setFocus(event.target.value)} disabled={busy}><option value="audit">Nova Audit</option><option value="agents">Nova Agents</option><option value="demand">Nova Demand</option></select></label>
          <label className="executive-model-choice"><input type="checkbox" checked={localAI} onChange={event=>setLocalAI(event.target.checked)} disabled={busy}/><span><Cpu size={15}/> Generate proposals on this device<small>Each role uses its own playbook with a shared Qwen model. First use downloads about 750 MB.</small></span></label>
          <button type="submit" className="luxe-button" disabled={busy||!data||objective.trim().length<8}><Play size={15}/>Start mission</button>
        </form>
        {data?.missions.length>0&&<div className="executive-mission">
          <label>Saved mission<select aria-label="Saved mission" value={mission?.id||''} disabled={busy} onChange={event=>load(event.target.value)}>{data.missions.map(item=><option key={item.id} value={item.id}>{item.objective.slice(0,90)}</option>)}</select></label>
          {mission&&<><div className="executive-progress"><span>{stageLabels[mission.state]}</span><span>{mission.next_step} of {executiveOrder.length} steps</span></div>
            <progress value={mission.next_step} max={executiveOrder.length} aria-label="Mission progress"/>
            <div className="luxe-actions">{working?<button type="button" className="luxe-outline" onClick={()=>{pause.current=true;setNotice('Pausing after this handoff is saved.');}}><Pause size={15}/>Pause after this step</button>:mission.state!=='review'&&<button type="button" className="luxe-outline" disabled={busy} onClick={()=>run(data)}><Play size={15}/>Resume mission</button>}</div></>}
        </div>}
        {modelStatus&&<p className="executive-model-status" role="status">{modelStatus}</p>}
      </section>
    </div>
    <div className="executive-grid executive-log-grid">
      <section className="luxe-panel" aria-labelledby="handoff-title">
        <div className="luxe-panel-title"><h2 id="handoff-title"><Network size={20}/> Handoff log</h2><span className="luxe-badge">{events.length} saved</span></div>
        {events.length?<ol className="executive-timeline">{events.map(event=><li key={event.step}>
          <div className="executive-handoff"><strong>{names[event.sender]}</strong><ChevronRight size={14}/><span>{names[event.recipient]}</span></div>
          <p>{event.message}</p>
          {event.model_note&&<details><summary>On-device proposal</summary><p>{event.model_note}</p></details>}
        </li>)}</ol>:<p className="luxe-empty">Start a mission to record its first handoff.</p>}
      </section>
      <WorkReceipts key={mission?.id||'empty'} events={events}/>
    </div>
    <div className="executive-grid">
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2><ClipboardList size={20}/> Task assignment</h2><Link className="luxe-link" to="/dashboard/tasks">Tasks <ArrowRight size={14}/></Link></div>
        {data?.pending_tasks.length?<form className="luxe-form" onSubmit={assign}>
          <label>Pending task<select aria-label="Pending task" value={taskId} onChange={event=>setTaskId(event.target.value)} required disabled={busy}><option value="">Choose a task</option>{data.pending_tasks.map(task=><option key={task.id} value={task.id}>{task.title} · {task.assigned_to||'Unassigned'}</option>)}</select></label>
          <label>Worker or staff name<input value={assignee} onChange={event=>setAssignee(event.target.value)} minLength={2} maxLength={80} required disabled={busy}/></label>
          <button type="submit" className="luxe-outline" disabled={busy||!taskId||assignee.trim().length<2}>Save assignment <ArrowRight size={14}/></button>
        </form>:<p className="luxe-empty">No pending tasks to assign.</p>}
      </section>
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2><Network size={20}/> Channels</h2><Link className="luxe-link" to="/dashboard/integrations">Connections <ArrowRight size={14}/></Link></div>
        <ul className="executive-channels">{data?.channels.map(channel=><li key={channel.key}><span>{channel.name}</span><span className="luxe-badge">{channelStatus[channel.status]||'Check connection'}</span></li>)}</ul>
        <Link className="luxe-link" to="/dashboard/workers">Phone practice <ArrowRight size={14}/></Link>
      </section>
    </div>
  </div>;
}
