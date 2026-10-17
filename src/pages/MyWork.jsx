import { useState } from 'react'
import { authedFetch } from '../lib/apiAuth'
import { C, css, Card, Field, Loading, ErrorBox, Empty, Badge, PageHeader, Notice, useLoad, useAction, when } from './dashboard/ops/ui'

// One place for any Nova staff member: tasks assigned to them, results handed to them, and escalations routed to them.
// Every button calls the same server rules the owner's screens use; nothing here grants extra rights.
const call = (resource, op, { method = 'GET', body } = {}) => authedFetch(`/api/client?resource=${resource}&op=${op}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
  .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status }); return j })

export default function MyWork() {
  const d = useLoad(() => call('handoffs', 'my-work'), [])
  const act = useAction()
  const run = (resource, op, body, ok) => act.run(() => call(resource, op, { method: 'POST', body }), ok).then(d.reload)
  if (d.loading) return <><style>{css}</style><Loading /></>
  if (d.error) return <><style>{css}</style><ErrorBox error={d.error} onRetry={d.reload} /></>
  const { assigned, results_to_receive: results, escalations } = d.data
  return (
    <div style={{ padding: 16, color: C.text }}>
      <style>{css}</style>
      <PageHeader title="My work" sub="Tasks assigned to you, results handed to you, and anything escalated to you." />
      {act.view}
      <Card title={`Assigned to me (${assigned.length})`}>
        {!assigned.length ? <Empty>Nothing assigned to you right now.</Empty> : assigned.map((w) => <Task key={w.id} w={w} run={run} busy={act.busy} />)}
      </Card>
      <Card title={`Results to receive (${results.length})`} style={{ marginTop: 16 }}>
        {!results.length ? <Empty>No results waiting for you.</Empty> : results.map((w) => (
          <div key={w.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '10px 0' }}>
            <strong>{w.title}</strong> <span style={{ color: C.faint, fontSize: 12 }}>completed {when(w.completed_at)}</span>
            {w.result_action && <div style={{ fontSize: 13, color: C.dim }}>Next: {w.result_action}</div>}
            <button className="ops-btn primary" style={{ marginTop: 6 }} disabled={act.busy} onClick={() => run('handoffs', 'receive-result', { id: w.id }, 'Receipt confirmed.')}>I've received it</button>
          </div>
        ))}
      </Card>
      <Card title={`Escalated to me (${escalations.length})`} style={{ marginTop: 16 }}>
        {!escalations.length ? <Empty>No escalations.</Empty> : escalations.map((e) => <Escalation key={e.id} e={e} run={run} busy={act.busy} />)}
      </Card>
    </div>
  )
}

function Task({ w, run, busy }) {
  const [out, setOut] = useState({ source: '', observation: '', content: '' })
  const late = !w.acknowledged_at && w.ack_due_at && new Date(w.ack_due_at) < new Date()
  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, padding: '10px 0' }}>
      <div><strong>{w.title}</strong> <Badge value={w.status === 'rejected' ? 'blocked' : w.status === 'in_review' ? 'partial' : 'ready'} label={w.status.replace(/_/g, ' ')} /></div>
      {w.description && <div style={{ fontSize: 13, color: C.dim }}>{w.description}</div>}
      <div style={{ fontSize: 12, color: C.faint }}>{w.due_at ? `Due ${when(w.due_at)}` : 'No deadline'}{w.acknowledged_at ? ` · acknowledged ${when(w.acknowledged_at)}` : w.ack_due_at ? ` · acknowledge by ${when(w.ack_due_at)}` : ''}</div>
      {late && <Notice tone="bad">Acknowledgment is overdue — your manager has been told.</Notice>}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {!w.acknowledged_at && ['assigned', 'in_progress'].includes(w.status) && <button className="ops-btn primary" disabled={busy} onClick={() => run('workitems', 'acknowledge-work-item', { id: w.id }, 'Acknowledged.')}>Acknowledge</button>}
        {w.status === 'assigned' && <button className="ops-btn" disabled={busy} onClick={() => run('workitems', 'start-work-item', { id: w.id }, 'Started.')}>Start</button>}
      </div>
      {w.status === 'in_progress' && (
        <div style={{ marginTop: 8 }}>
          <div className="ops-two">
            <Field label="Evidence source (URL or record)" id={`ev-s-${w.id}`}><input id={`ev-s-${w.id}`} className="ops-input" value={out.source} onChange={(e) => setOut({ ...out, source: e.target.value })} /></Field>
            <Field label="What you observed" id={`ev-o-${w.id}`}><input id={`ev-o-${w.id}`} className="ops-input" value={out.observation} onChange={(e) => setOut({ ...out, observation: e.target.value })} /></Field>
          </div>
          <button className="ops-btn" disabled={busy} onClick={() => run('workitems', 'add-evidence', { work_item_id: w.id, source: out.source, observation: out.observation }, 'Evidence recorded.')}>Add evidence</button>
          <Field label="Your result" id={`out-${w.id}`}><textarea id={`out-${w.id}`} className="ops-textarea" rows={3} value={out.content} onChange={(e) => setOut({ ...out, content: e.target.value })} /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ops-btn" disabled={busy} onClick={() => run('workitems', 'add-output', { work_item_id: w.id, content: out.content }, 'Result saved.')}>Save result</button>
            <button className="ops-btn primary" disabled={busy} onClick={() => run('workitems', 'submit-for-review', { id: w.id }, 'Submitted for review.')}>Submit for review</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Escalation({ e, run, busy }) {
  const [res, setRes] = useState('')
  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, padding: '10px 0' }}>
      <div><strong>{e.work_item?.title || e.subject_type}</strong> <span style={{ color: C.faint, fontSize: 12 }}>{when(e.created_at)}</span></div>
      <div style={{ fontSize: 13, color: C.amber }}>{e.reason}</div>
      <Field label="What you did about it" id={`res-${e.id}`}><input id={`res-${e.id}`} className="ops-input" value={res} onChange={(x) => setRes(x.target.value)} /></Field>
      <button className="ops-btn" disabled={busy} onClick={() => run('handoffs', 'resolve-escalation', { id: e.id, resolution: res }, 'Escalation resolved.')}>Resolve</button>
    </div>
  )
}
