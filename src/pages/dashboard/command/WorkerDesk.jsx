import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Circle, Pause, Play, ShieldAlert, UserX } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

async function call(resource, op, body = {}, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=${resource}&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=${resource}&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

const Field = ({ label, children }) => (
  <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    <div style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>{children}</div>
  </div>
)

// The Worker Desk — the individual worker's real record: identity, contract, current assignment,
// truthful presence, evidence/outputs, escalation path, cost, and controls. Every field reads from
// the same tested hierarchy/governance/workitems endpoints; nothing here is decorative.
export default function WorkerDesk() {
  const { id } = useParams()
  const [worker, setWorker] = useState(null)
  const [history, setHistory] = useState([])
  const [contract, setContract] = useState(null)
  const [presence, setPresence] = useState(null)
  const [killStatus, setKillStatus] = useState(null)
  const [workItems, setWorkItems] = useState([])
  const [currentItem, setCurrentItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [w, c, p, ks, items] = await Promise.all([
        call('hierarchy', 'worker', { id }, 'GET'),
        call('governance', 'worker-contract', { worker_id: id }, 'GET').catch(() => null),
        call('workitems', 'worker-presence', { worker_id: id }, 'GET').catch(() => null),
        call('governance', 'kill-switch-status', { worker_id: id }, 'GET').catch(() => null),
        call('workitems', 'work-items', { worker_id: id }, 'GET').catch(() => []),
      ])
      setWorker(w.worker); setHistory(w.status_history || [])
      setContract(c); setPresence(p); setKillStatus(ks); setWorkItems(items || [])
      const active = (items || []).find((wi) => wi.status === 'in_progress' || wi.status === 'in_review')
      if (active) setCurrentItem(await call('workitems', 'work-item', { id: active.id }, 'GET'))
      else setCurrentItem(null)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await load() } catch (e) { setError(e.message) } setBusy(false) }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  if (!worker) return <div style={{ padding: 48 }}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Not found.</p></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <Link to="/dashboard/command/workforce" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none', marginBottom: 16 }}><ArrowLeft style={{ width: 13, height: 13 }} /> Workforce</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{worker.display_name}</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: presence?.working ? '#4ade80' : 'rgba(255,255,255,0.4)' }}><Circle style={{ width: 9, height: 9, fill: 'currentColor' }} /> {presence?.working ? 'Working' : 'Not working'}</span>
        {killStatus?.blocked && <span style={{ fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert style={{ width: 12, height: 12 }} /> Paused ({killStatus.scope})</span>}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{worker.worker_type} · status: {worker.status}{worker.positions?.title ? ` · ${worker.positions.title}` : ''}{worker.org_units?.name ? ` · ${worker.org_units.name}` : ''}</p>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 16 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginTop: 24 }}>
        <Field label="Mission">{worker.mission || 'Not set'}</Field>
        <Field label="Responsibilities">{worker.responsibilities || 'Not set'}</Field>
        <Field label="Manager">{worker.manager_worker_id || 'None'}</Field>
        <Field label="Escalation path">{worker.escalation_worker_id || 'Follows the standard chain (Manager → Executive → CEO Twin → Owner)'}</Field>
        <Field label="Model / provider">{worker.model_provider || 'N/A (human)'}</Field>
        <Field label="Data clearance">{worker.data_classification}</Field>
        <Field label="Spending limit">{worker.spending_limit_cents ? `$${(worker.spending_limit_cents / 100).toFixed(2)}` : '$0.00 (none granted)'}</Field>
        <Field label="Communication permission">{worker.communication_permission ? 'Granted' : 'Not granted'}</Field>
        <Field label="Contract">{contract?.contract ? `v${contract.contract.version} — ${contract.status}` : 'None drafted'}</Field>
        <Field label="Approved tools">{(worker.approved_tools || []).length ? worker.approved_tools.join(', ') : 'None recorded'}</Field>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Current assignment</h2>
        {currentItem ? (
          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{currentItem.work_item.title}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>Status: {currentItem.work_item.status} · {currentItem.evidence.length} evidence record(s) · {currentItem.outputs.length} output(s)</p>
            {currentItem.evidence.map((e) => <p key={e.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>• {e.source}: {e.observation}</p>)}
            {currentItem.outputs.map((o) => <p key={o.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Output: {JSON.stringify(o.content).slice(0, 200)}</p>)}
            {currentItem.reviews.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Reviewer decision: {currentItem.reviews[0].decision} — {currentItem.reviews[0].notes}</p>}
          </div>
        ) : <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No active assignment.</p>}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Completed work &amp; performance history</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {workItems.filter((w) => w.status === 'completed').map((w) => <div key={w.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{w.title} — completed {new Date(w.completed_at).toLocaleDateString()}</div>)}
          {workItems.filter((w) => w.status === 'completed').length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No completed work yet.</p>}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Status activity log</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((e) => <div key={e.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{e.from_status || 'new'} → {e.to_status} — {e.reason} ({new Date(e.created_at).toLocaleString()})</div>)}
        </div>
      </section>

      <section style={{ marginTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Controls</h2>
        <input placeholder="Reason (required for status/pause changes)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', maxWidth: 500, padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', marginBottom: 12, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!killStatus?.blocked ? (
            <button disabled={busy || reason.trim().length < 5} onClick={() => act(() => call('governance', 'engage-kill-switch', { scope_type: 'worker', scope_id: id, reason }))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px solid #f87171', borderRadius: 7, color: '#f87171', fontSize: 12, cursor: 'pointer' }}><Pause style={{ width: 13, height: 13 }} /> Pause</button>
          ) : (
            <button disabled={busy} onClick={() => act(async () => { const s = await call('governance', 'kill-switches', {}, 'GET'); const row = s.find((k) => k.scope_type === 'worker' && k.scope_id === id && k.engaged); if (row) await call('governance', 'disengage-kill-switch', { id: row.id, reason: reason || 'Resumed from Worker Desk.' }) })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px solid #4ade80', borderRadius: 7, color: '#4ade80', fontSize: 12, cursor: 'pointer' }}><Play style={{ width: 13, height: 13 }} /> Resume</button>
          )}
          {currentItem?.work_item?.status === 'in_progress' && (
            <button disabled={busy} onClick={() => act(() => call('workitems', 'submit-for-review', { id: currentItem.work_item.id }))} style={{ padding: '9px 14px', background: 'none', border: `1px solid ${GOLD}55`, borderRadius: 7, color: GOLD, fontSize: 12, cursor: 'pointer' }}>Request review</button>
          )}
          {worker.status !== 'suspended' && worker.status !== 'inactive' && (
            <button disabled={busy || reason.trim().length < 5} onClick={() => act(() => call('hierarchy', 'set-worker-status', { id, status: 'suspended', reason }))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px solid #f87171', borderRadius: 7, color: '#f87171', fontSize: 12, cursor: 'pointer' }}><UserX style={{ width: 13, height: 13 }} /> Suspend</button>
          )}
          {worker.status === 'suspended' && (
            <button disabled={busy || reason.trim().length < 5} onClick={() => act(() => call('hierarchy', 'set-worker-status', { id, status: 'active', reason }))} style={{ padding: '9px 14px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reinstate</button>
          )}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 14 }}>Reassign and reduce-authority are not yet dedicated one-click controls — reassign a work item from the Workforce/work-item screens, and authority is governed by this worker's operating contract, editable via the Governance API.</p>
      </section>
    </div>
  )
}
