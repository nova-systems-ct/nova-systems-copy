import {useCallback,useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {useOrg} from '../../lib/OrgContext'
import {authedFetch} from '../../lib/apiAuth'
import {C,css,Card,Field,Notice,when} from './ops/ui'
const initial={provider:'instagram',provider_account_id:'',label:'',token_ref:'NOVA_CHANNEL_TOKEN_',login_mode:'facebook'}
const labels={implemented_test_required:'Built · provider test required',existing_workflow:'Workflow code available',existing_test_workflow:'Test payment workflow',not_implemented:'Connector still to build',publishing_only:'Publishing only',snapshot_builder:'Snapshot builder',not_connected:'Not connected',responsive_web_only:'Responsive web app',per_integration:'Connection-specific work'}
export default function ChannelCenter(){
 const {currentOrg}=useOrg();const org=currentOrg?.id
 const current=useRef(org),sequence=useRef(0),generation=useRef(0);current.current=org
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[view,setView]=useState('connections'),[preparing,setPreparing]=useState(false),[form,setForm]=useState(initial),[evidence,setEvidence]=useState({}),[replies,setReplies]=useState({}),[drafts,setDrafts]=useState({}),[keywords,setKeywords]=useState({})
 const load=useCallback(async()=>{if(!org)return;const request=++sequence.current;try{const r=await authedFetch(`/api/integrations?op=channels&organization_id=${encodeURIComponent(org)}`);const j=await r.json();if(request!==sequence.current||current.current!==org)return;if(!r.ok)throw Error(j.error||'Channels could not be loaded');setData(j);setError('')}catch(e){if(request===sequence.current&&current.current===org)setError(e.message)}},[org])
 useEffect(()=>{generation.current++;setData(null);setBusy(false);setPreparing(false);setForm(initial);setEvidence({});setReplies({});setDrafts({});setKeywords({});setNotice('');setError('');load();return()=>{sequence.current++;generation.current++}},[load])
 const act=async body=>{const epoch=generation.current,active=()=>current.current===org&&generation.current===epoch;setBusy(true);setError('');setNotice('');try{const r=await authedFetch('/api/integrations?op=channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,...body})});const j=await r.json();if(!active())return false;if(!r.ok)throw Error(j.error||'Could not save');setNotice(j.note||'Saved.');await load();return active()}catch(e){if(active())setError(e.message);return false}finally{if(active())setBusy(false)}}
 if(!org)return null
 const connections=data?.connections||[]
 return <section aria-label="Connected business channels" style={{margin:'28px 0 36px',color:C.text,minWidth:0}}>
  <style>{css}</style>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:14}}>
   <div><p style={{color:C.gold,fontSize:11,letterSpacing:'.14em',textTransform:'uppercase',margin:0}}>One customer journey</p><h2 style={{fontFamily:'Georgia,serif',fontSize:30,fontWeight:400,margin:'8px 0'}}>Your connected channels</h2></div>
   <button className="ops-btn" onClick={load} disabled={busy}>Refresh channels</button>
  </div>
  <p style={{color:C.dim,maxWidth:760,lineHeight:1.65}}>Bring supported conversations into the same inquiry and booking workflow. Each business keeps its own account, approved rules, messages and handoff.</p><p style={{color:C.gold}}>Business: {currentOrg.name}</p>
  {error&&<div role="alert"><Notice tone="bad">{error}</Notice></div>}
  {notice&&<Notice>{notice}</Notice>}
  {data?.spending_locked&&<Notice>Sending is locked. You can prepare accounts and review saved conversations without authorizing provider charges.</Notice>}
  <div className="ops-tabs" style={{marginTop:20}}>
   <button className={`ops-tab ${view==='connections'?'active':''}`} style={{background:'none',borderTop:0,borderLeft:0,borderRight:0,cursor:'pointer'}} onClick={()=>setView('connections')}>Connections</button>
   <button className={`ops-tab ${view==='coverage'?'active':''}`} style={{background:'none',borderTop:0,borderLeft:0,borderRight:0,cursor:'pointer'}} onClick={()=>setView('coverage')}>Coverage and applications</button>
  </div>
  {!data&&!error&&<p role="status" style={{color:C.dim}}>Loading channels…</p>}
  {view==='connections'&&<>
   <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:18}}><button className="ops-btn primary" disabled={!data||busy} onClick={()=>setPreparing(!preparing)}>Prepare a connection</button><Link className="ops-tab" to="/dashboard/ops/inbox">Open conversation inbox</Link></div>
   {preparing&&<Card title="Prepare an owned business account">
    <p style={{color:C.dim}}>This saves a connection draft. Account registration and permission review happen in the provider’s portal. Enter a server secret name here, never its value.</p>
    <form onSubmit={async e=>{e.preventDefault();if(await act({action:'prepare',...form})){setPreparing(false);setForm(initial)}}}>
     <div className="ops-two"><Field label="Messaging provider" id="channel-provider"><select id="channel-provider" className="ops-select" value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}><option value="instagram">Instagram</option><option value="facebook">Facebook Messenger</option><option value="whatsapp">WhatsApp Cloud API</option></select></Field>
      <Field label="Business account ID" id="channel-account"><input id="channel-account" className="ops-input" inputMode="numeric" required value={form.provider_account_id} onChange={e=>setForm({...form,provider_account_id:e.target.value})}/></Field></div>
     <Field label="Connection label" id="channel-label"><input id="channel-label" className="ops-input" required value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></Field>
     <Field label="Server secret reference" id="channel-token-ref"><input id="channel-token-ref" className="ops-input" required value={form.token_ref} onChange={e=>setForm({...form,token_ref:e.target.value})}/></Field>
     {form.provider==='instagram'&&<Field label="Instagram authorization method" id="channel-login"><select id="channel-login" className="ops-select" value={form.login_mode} onChange={e=>setForm({...form,login_mode:e.target.value})}><option value="facebook">Facebook Login — linked professional account</option><option value="instagram">Instagram Login — professional account</option></select></Field>}
     <button className="ops-btn primary" disabled={busy}>Save connection draft</button>
    </form>
   </Card>}
   {data&&!connections.length&&<p style={{padding:'24px 0',color:C.dim}}>No channel accounts prepared for this business yet.</p>}
   <div style={{display:'grid',gap:12}}>{connections.map(c=><details key={c.id} style={{border:`1px solid ${C.line}`,borderRadius:10,padding:'16px 18px',minWidth:0}}>
    <summary style={{cursor:'pointer'}}><strong>{c.label}</strong><span style={{color:C.dim,fontSize:12,marginLeft:12}}>{c.provider} · {c.status} · {c.outbound_enabled?'Sending allowed by connection':'Sending off'}</span></summary>
    <div style={{display:'grid',gap:12,marginTop:18,minWidth:0}}>
     <p style={{color:C.dim,margin:0,overflowWrap:'anywhere'}}>Account {c.provider_account_id}. Secret reference: <code>{c.token_ref}</code> — {c.token_configured?'configured':'missing from server'}.</p>
     <p style={{color:C.dim,margin:0}}>Account identity: {c.verified_at?`verified ${when(c.verified_at)}`:'not verified'}. Last signed webhook: {when(c.last_webhook_at)}. Identity verification does not certify messaging permissions.</p>
     <div><button className="ops-btn" disabled={busy||!c.token_configured} onClick={()=>act({action:'verify-account',connection_id:c.id})}>Verify account identity</button></div>
     <Field label="Account authorization evidence or owned-account test reference" id={`channel-proof-${c.id}`}><textarea className="ops-textarea" id={`channel-proof-${c.id}`} value={evidence[c.id]??c.authorization_reference??''} onChange={e=>setEvidence({...evidence,[c.id]:e.target.value})}/></Field>
     <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button className="ops-btn" disabled={busy||!c.verified_at} onClick={()=>act({action:'configure',connection_id:c.id,status:'enabled',automation_enabled:true,outbound_enabled:false,authorization_reference:evidence[c.id]??c.authorization_reference})}>Run conversations with sending off</button>
      <button className="ops-btn" disabled={busy} onClick={()=>act({action:'configure',connection_id:c.id,status:'paused',automation_enabled:false,outbound_enabled:false})}>Pause automation</button>
     </div>
     {c.status!=='enabled'&&<details><summary style={{cursor:'pointer',color:C.dim}}>Correct connection details</summary><form onSubmit={e=>{e.preventDefault();act({action:'edit-draft',connection_id:c.id,label:c.label,token_ref:drafts[c.id]?.token_ref??c.token_ref,login_mode:drafts[c.id]?.login_mode??c.login_mode})}} style={{marginTop:12}}>
      <Field label="Correct server secret reference" id={`secret-${c.id}`}><input id={`secret-${c.id}`} className="ops-input" value={drafts[c.id]?.token_ref??c.token_ref} onChange={e=>setDrafts({...drafts,[c.id]:{...drafts[c.id],token_ref:e.target.value}})}/></Field>
      {c.provider==='instagram'&&<Field label="Correct authorization method" id={`method-${c.id}`}><select id={`method-${c.id}`} className="ops-select" value={drafts[c.id]?.login_mode??c.login_mode} onChange={e=>setDrafts({...drafts,[c.id]:{...drafts[c.id],login_mode:e.target.value}})}><option value="facebook">Facebook Login</option><option value="instagram">Instagram Login</option></select></Field>}
      <button className="ops-btn" disabled={busy}>Save corrected draft</button><p style={{color:C.dim,fontSize:12}}>This clears verification and leaves sending off. Verify the corrected account before enabling it.</p>
     </form></details>}
     {c.provider==='instagram'&&<details><summary style={{cursor:'pointer'}}>Approved comment replies</summary><p style={{color:C.dim}}>Choose a keyword and approve the exact private reply. Only future matching comments qualify; a like never triggers a message. Sending remains subject to account permissions, pauses and the reply window.</p>
      {(data.rules||[]).filter(r=>r.connection_id===c.id).map(r=><div key={r.id} style={{borderBottom:`1px solid ${C.line}`,padding:'12px 0'}}><strong>{r.keyword}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{r.reply}</p><button className="ops-btn" disabled={busy} onClick={()=>act({action:'configure-keyword-rule',connection_id:c.id,rule_id:r.id,enabled:!r.enabled})}>{r.enabled?'Pause rule':'Resume rule'}</button></div>)}
      <form onSubmit={async e=>{e.preventDefault();if(await act({action:'approve-keyword-rule',connection_id:c.id,keyword:keywords[c.id]?.word,text:keywords[c.id]?.reply}))setKeywords({...keywords,[c.id]:{word:'',reply:''}})}} style={{marginTop:16}}>
       <Field label="Comment keyword" id={`keyword-${c.id}`}><input id={`keyword-${c.id}`} className="ops-input" required pattern="[A-Za-z0-9_]{2,32}" value={keywords[c.id]?.word||''} onChange={e=>setKeywords({...keywords,[c.id]:{...keywords[c.id],word:e.target.value}})}/></Field>
       <Field label="Exact private reply" id={`keyword-reply-${c.id}`}><textarea id={`keyword-reply-${c.id}`} className="ops-textarea" required value={keywords[c.id]?.reply||''} onChange={e=>setKeywords({...keywords,[c.id]:{...keywords[c.id],reply:e.target.value}})}/></Field>
       <button className="ops-btn" disabled={busy}>Approve keyword reply</button>
      </form>
     </details>}
     <details><summary style={{color:C.dim,cursor:'pointer'}}>Webhook setup</summary><p style={{color:C.dim,overflowWrap:'anywhere'}}>Callback: {window.location.origin}{data.callback_url}. Store the Meta app secret and verification token in the server settings. Subscribe to the exact account’s messaging events; Instagram comments require their own permitted subscription.</p></details>
    </div>
   </details>)}</div>
   {!!data?.events?.length&&<div style={{marginTop:24}}><h3 style={{fontSize:18}}>Recent channel activity</h3>{data.events.map(e=><article key={e.id} style={{padding:'14px 0',borderBottom:`1px solid ${C.line}`,overflowWrap:'anywhere'}}>
    <p style={{fontSize:12,color:C.dim,margin:'0 0 6px'}}>{e.kind} · {e.status.replace(/_/g,' ')} · {when(e.occurred_at)}</p><p style={{whiteSpace:'pre-wrap',margin:0}}>{e.body||'Attachment or unsupported content — a person must review it.'}</p>
    {e.error_code&&<p style={{color:C.amber}}>{e.error_code}</p>}
    {e.kind==='comment'&&e.status==='needs_review'&&<div style={{marginTop:12}}><Field label="Approved private reply" id={`comment-${e.id}`}><textarea id={`comment-${e.id}`} className="ops-textarea" value={replies[e.id]||''} onChange={x=>setReplies({...replies,[e.id]:x.target.value})}/></Field><button className="ops-btn" disabled={busy||!replies[e.id]?.trim()} onClick={()=>act({action:'approve-comment',connection_id:e.connection_id,event_id:e.id,text:replies[e.id]})}>Approve this private reply</button><p style={{color:C.dim,fontSize:12}}>One approved reply to this comment. Sending gates and the provider’s reply window still apply.</p></div>}
   </article>)}</div>}
  </>}
  {view==='coverage'&&<div style={{display:'grid',gap:10}}>{data?.catalog?.map(item=><details key={item.key} style={{borderBottom:`1px solid ${C.line}`,padding:'14px 0'}}>
   <summary style={{cursor:'pointer'}}><span>{item.name}</span><span style={{display:'block',color:C.dim,fontSize:12,marginTop:4}}>{labels[item.code]||item.code}</span></summary>
   <div style={{padding:'14px 0',color:C.dim,lineHeight:1.65}}><ul>{item.prerequisites.map(p=><li key={p}>{p}</li>)}</ul><a href={item.url} target="_blank" rel="noopener noreferrer" style={{color:C.gold}}>Open official setup portal</a><p>Application packet: prepared, not submitted. No registration or spending is authorized by opening this page.</p><details><summary style={{cursor:'pointer'}}>View prepared use case</summary><p>{data.applications.find(a=>a.channel===item.name)?.use_case}</p><p>Public contact: Isaac Nova · isaac@nova-systems.app · (203) 706-0504. Legal name, address and account ownership still require owner verification in the provider’s secure form.</p></details></div>
  </details>)}</div>}
 </section>
}
