import { useState, useEffect, useCallback, useRef } from 'react'
import { authedFetch } from '../../../lib/apiAuth'
import { useOrg } from '../../../lib/OrgContext'
import { C, css, Card, Badge, Notice, when } from '../ops/ui'
import ExecutiveDesk from './ExecutiveDesk'

async function call(op, { method = 'GET', body } = {}) {
  const r = await authedFetch(`/api/client?resource=hierarchy&op=${op}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `The server answered ${r.status}.`)
  return j
}
const STATUS = { active: ['running', 'Registered · active'], restricted: ['pending', 'Restricted'], suspended: ['paused', 'Paused'], inactive: ['cancelled', 'Retired'], draft: ['draft', 'Draft'], onboarding: ['draft', 'Onboarding'], training: ['draft', 'Training'] }
const smallTitle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: C.gold, fontWeight: 600, margin: '0 0 9px' }
function Instructions({ title, items }) { return <div><h3 style={smallTitle}>{title}</h3><ul style={{ margin: 0, paddingLeft: 17, display: 'grid', gap: 7, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>{items?.map(x => <li key={x}>{x}</li>)}</ul></div> }
function ReportingTree({ caps, ownerName }) {
  const workers = caps.filter(c => c.worker)
  const ids = new Set(workers.map(c => c.worker.id))
  const draw = (c, seen = new Set()) => {
    if (seen.has(c.worker.id)) return null
    const next = new Set([...seen, c.worker.id])
    const children = workers.filter(x => x.worker.manager_worker_id === c.worker.id)
    return <div key={c.key} role="treeitem" aria-expanded={children.length ? true : undefined} style={{ padding: '10px 0' }}><strong style={{ fontSize: 14 }}>{c.name}</strong><span style={{ color: C.dim, marginLeft: 10, fontSize: 12 }}>{c.worker.status}</span>{children.length > 0 && <div role="group" style={{ borderLeft: `1px solid ${C.line}`, marginLeft: 7, paddingLeft: 20 }}>{children.map(x => draw(x, next))}</div>}</div>
  }
  return <Card title="Reporting lines"><p style={{ color: C.dim, fontSize: 13 }}>Saved reporting relationships. Isaac remains the final authority for spending, commitments and policy.</p><div role="tree" aria-label="Reporting lines"><div role="treeitem" aria-expanded="true"><strong>{ownerName}</strong><div role="group" style={{ borderLeft: `1px solid ${C.line}`, marginLeft: 7, paddingLeft: 20 }}>{workers.filter(c => !c.worker.manager_worker_id || !ids.has(c.worker.manager_worker_id)).map(c => draw(c))}</div></div></div></Card>
}
export default function Workforce() {
  const { user, currentMembership, currentOrgId } = useOrg()
  const isOwner = currentMembership?.role === 'nova_super_admin'
  const [data, setData] = useState(null), [people, setPeople] = useState([]), [err, setErr] = useState('')
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(null), [tab, setTab] = useState('All workers'), [search, setSearch] = useState('')
  const [pauseFor, setPauseFor] = useState(null), [reason, setReason] = useState('')
  const request = useRef(0)
  const load = useCallback(async () => {
    const version = ++request.current
    const [c, w] = await Promise.allSettled([call('capabilities'), call('workers')])
    if (request.current !== version) return
    if (c.status === 'fulfilled') { setData(c.value); setErr('') } else setErr(c.reason.message)
    if (w.status === 'fulfilled') setPeople(w.value.filter(x => !x.capability_key))
  }, [])
  useEffect(() => { load(); return () => { request.current++ } }, [load])
  const act = async (key, op, body, message) => { setBusy(key); setMsg(null); try { await call(op, { method: 'POST', body }); setMsg({ tone: 'ok', text: message }); setPauseFor(null); setReason(''); await load() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy('') } }
  const caps = data?.capabilities || [], registered = caps.filter(c => c.worker)
  const ownerName = isOwner ? (user?.user_metadata?.full_name && !/^(local test|test)\b/i.test(user.user_metadata.full_name) ? user.user_metadata.full_name : user?.email || 'Owner') : 'Nova owner'
  const filtered = caps.filter(c => `${c.name} ${c.role} ${c.does}`.toLowerCase().includes(search.toLowerCase()))
  const waiting = caps.reduce((n, c) => n + c.activity.waiting, 0)
  return <div className="ops-wrap" style={{ maxWidth: 1160 }}>
    <style>{css}{`.workforce-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:24px 0}.workforce-metric{border:1px solid ${C.line};padding:19px 22px;border-radius:12px;background:linear-gradient(135deg,#15130e,#101010)}.workforce-metric strong{display:block;font-size:29px;font-weight:500;color:${C.text};margin-bottom:5px}.workforce-metric span{font-size:12px;color:${C.dim}}.workforce-tabs button{background:transparent;border-left:0;border-right:0;border-top:0;cursor:pointer;font-family:inherit}.workforce-proof{overflow-wrap:anywhere}.workforce-proof pre{font-size:12px;white-space:pre-wrap;color:${C.dim};max-height:260px;overflow:auto}@media(max-width:520px){.workforce-metrics{gap:7px}.workforce-metric{padding:14px 10px}.workforce-metric strong{font-size:24px}}`}</style>
    <header style={{ borderBottom: `1px solid ${C.line}`, padding: '10px 0 24px' }}>
      <p style={smallTitle}>Nova / Workforce</p><h1 style={{ fontSize: 'clamp(28px,4vw,38px)', fontWeight: 500, letterSpacing: '-.04em', margin: '9px 0 12px' }}>Who does the work</h1>
      <p style={{ maxWidth: 620, color: C.dim, fontSize: 14, lineHeight: 1.7, margin: 0 }}>One team. Clear responsibility. Recorded results. Registering a worker enables its supported workflow; channel access and approvals still apply.</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        {isOwner && <button className="ops-btn primary" disabled={!!busy || !data} onClick={() => act('install', 'install-workforce', {}, 'Nova workforce installed. Existing pauses were preserved; spending remains locked.')}>{busy === 'install' ? 'Installing…' : 'Install Nova workforce'}</button>}
        <button className="ops-btn" disabled={!!busy} onClick={load}>Refresh results</button>
        <span style={{ color: C.faint, fontSize: 12 }}>Scheduled work depends on host availability. Free hosting has no continuous-uptime guarantee.</span>
      </div>
    </header>
    {err && <Notice tone="bad">Workers could not be loaded: {err}</Notice>}{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    {!data && !err && <p role="status">Loading workers…</p>}
    {data && <>
      <div className="workforce-metrics"><div className="workforce-metric"><strong>{registered.length}<span style={{ fontSize: 17 }}> / {caps.length}</span></strong><span>{registered.length} of {caps.length} workers registered</span></div><div className="workforce-metric"><strong>{waiting}</strong><span>Queued jobs · Nova only</span></div><div className="workforce-metric"><strong>$0</strong><span>New spending authorized</span></div></div>
      <nav className="ops-tabs workforce-tabs" aria-label="Workforce views">{['All workers', 'Reporting lines', ...(isOwner && currentOrgId ? ['Executive desk'] : []), ...(people.length ? ['People'] : [])].map(x => <button key={x} className={`ops-tab ${tab === x ? 'active' : ''}`} aria-pressed={tab === x} onClick={() => setTab(x)}>{x}</button>)}</nav>
      {tab === 'Reporting lines' && <ReportingTree caps={caps} ownerName={ownerName} />}
      {tab === 'Executive desk' && isOwner && currentOrgId && <ExecutiveDesk key={currentOrgId} orgId={currentOrgId} />}
      {tab === 'People' && people.map(p => <Card key={p.id} title={p.display_name}><p style={{ color: C.dim }}>{p.worker_type} · {p.status}</p></Card>)}
      {tab === 'All workers' && <>
        <label htmlFor="worker-search" style={{ display: 'block', ...smallTitle }}>Find a worker</label><input id="worker-search" className="ops-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search role or responsibility" style={{ maxWidth: 460, marginBottom: 18 }} />
        <div style={{ display: 'grid', gap: 14 }}>{filtered.map(c => <Card key={c.key} title={<span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{c.name}<Badge value={(c.worker ? STATUS[c.worker.status] : ['unknown'])[0]} label={c.worker ? (STATUS[c.worker.status] || STATUS.draft)[1] : 'Not registered'} /></span>} actions={isOwner && <>
          {!c.worker ? <button className="ops-btn" disabled={!!busy} onClick={() => act(c.key, 'register-capability', { capability_key: c.key }, `${c.name} registered and active.`)}>Register this worker</button> : c.paused ? <button className="ops-btn" disabled={!!busy} onClick={() => act(c.key, 'set-worker-status', { id: c.worker.id, status: 'active', reason: 'Resumed by the owner from the Workers page' }, `${c.name} resumed.`)}>Resume</button> : <button className="ops-btn" disabled={!!busy} onClick={() => setPauseFor(c.key)}>Pause</button>}
        </>}>
          <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7, margin: '0 0 13px' }}>{c.playbook?.mission || c.does}</p>
          <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', fontSize: 12, color: C.faint }}><span>{c.role}</span><span>{c.activity.last_completed_at ? `Last result ${when(c.activity.last_completed_at)}` : 'No recorded completed work yet'}</span><span>{c.activity.next_scheduled_at ? `Next job ${when(c.activity.next_scheduled_at)}` : 'Waiting for an eligible task'}</span><span>LLM · {c.model?.status || 'unknown'}</span></div>
          {pauseFor === c.key && <div style={{ display: 'flex', gap: 8, marginTop: 15, flexWrap: 'wrap' }}><label htmlFor={`pause-${c.key}`}>Why pause?</label><input id={`pause-${c.key}`} className="ops-input" value={reason} onChange={e => setReason(e.target.value)} /><button className="ops-btn danger" disabled={reason.trim().length < 5 || !!busy} onClick={() => act(c.key, 'set-worker-status', { id: c.worker.id, status: 'suspended', reason }, `${c.name} paused. Queued work waits.`)}>Pause now</button><button className="ops-btn" onClick={() => setPauseFor(null)}>Cancel</button></div>}
          <details style={{ borderTop: `1px solid ${C.line}`, paddingTop: 13, marginTop: 17 }}><summary style={{ color: C.gold, fontSize: 13, cursor: 'pointer' }}>Playbook &amp; activity</summary><div style={{ display: 'grid', gap: 22, marginTop: 23 }}>
            <div className="ops-two"><Instructions title="The job" items={c.playbook?.jobs} /><Instructions title="Proof of work" items={c.playbook?.proof} /></div><div className="ops-two"><Instructions title="Inputs" items={c.playbook?.inputs} /><Instructions title="When to escalate" items={c.playbook?.escalate} /></div>
            <div><h3 style={smallTitle}>Readiness</h3>{c.readiness.map(x => <p key={x.label} style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}><span style={{ color: x.ok ? C.green : C.amber }}>{x.ok ? '✓' : '•'}</span> <strong>{x.label}.</strong> {x.note}</p>)}</div>
            <div className="ops-two"><div><h3 style={smallTitle}>This worker’s LLM</h3><p style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{c.model?.reason}</p><p style={{ fontSize: 12, color: C.faint }}>Separate role instructions and context. Model output cannot authorize a send, payment or policy change.</p></div><Instructions title="Operating limits" items={c.playbook?.boundaries} /></div>
            <div className="workforce-proof"><h3 style={smallTitle}>Saved results · 7 days</h3><p style={{ fontSize: 13 }}>{c.activity.completed_7d} completed · {c.activity.failed_7d} failed · {c.activity.waiting} waiting</p>{c.activity.last_result && <pre>{JSON.stringify(c.activity.last_result, null, 2)}</pre>}<p style={{ color: C.faint, fontSize: 12 }}>Playbook {c.playbook?.version} · {c.job_types.join(', ')}</p></div>
          </div></details>
        </Card>)}</div>
        {!filtered.length && <p style={{ color: C.dim }}>No worker matches that search.</p>}
      </>}
    </>}
  </div>
}
