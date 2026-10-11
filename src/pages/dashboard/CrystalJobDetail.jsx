import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, CheckCircle2, UserPlus, Camera, ClipboardCheck } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, marginBottom: 20 }
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }
const btn = (bg, color) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: bg, border: 'none', borderRadius: 8, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

// Crystal job detail — checklist, before/after evidence, worker assignment, and the real
// completion/approval/billing sequence. Evidence requirements shown here are whatever the job's
// actual service configured (api/client.js's handleCrystalJobs 'complete' action enforces the
// same policy server-side — this page just makes it visible, never a second source of truth).
export default function CrystalJobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checklistLabel, setChecklistLabel] = useState('')
  const [mediaForm, setMediaForm] = useState({ kind: 'before', storage_path: '' })
  const [assignWorkerId, setAssignWorkerId] = useState('')

  const load = useCallback(async () => {
    if (!currentOrg) return
    setError('')
    try {
      const r = await authedFetch(`/api/client?resource=crystal&op=jobs&organization_id=${encodeURIComponent(currentOrg.id)}&id=${encodeURIComponent(id)}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load job')
      setData(await r.json())
    } catch (e) {
      setError(e.message)
    }
  }, [currentOrg, id])

  useEffect(() => { load() }, [load])

  const doAction = async (action, extra = {}) => {
    setBusy(true)
    try {
      const r = await authedFetch('/api/client?resource=crystal&op=jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organization_id: currentOrg.id, id, ...extra }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Action failed')
      await load()
    } catch (e) {
      alert(e.message)
    }
    setBusy(false)
  }

  const addChecklistItem = async () => {
    if (!checklistLabel.trim()) return
    await doAction('add-checklist-item', { label: checklistLabel })
    setChecklistLabel('')
  }
  const toggleChecklistItem = async (itemId) => {
    await doAction('checklist-item', { item_id: itemId })
  }
  const addMedia = async () => {
    if (!mediaForm.storage_path.trim()) return
    await doAction('add-media', mediaForm)
    setMediaForm({ kind: mediaForm.kind, storage_path: '' })
  }
  const assignWorker = async () => {
    if (!assignWorkerId.trim()) return
    await doAction('assign-worker', { worker_user_id: assignWorkerId })
    setAssignWorkerId('')
  }
  const complete = async () => {
    const notes = window.prompt('Completion notes (optional):') || ''
    await doAction('complete', { notes })
  }
  const approveCompletion = async () => {
    const notes = window.prompt('Customer approval notes (how was this confirmed — phone/email/in person):') || ''
    await doAction('approve-completion', { customer_notes: notes })
  }

  if (error) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>
        <button onClick={() => navigate('/dashboard/crystal')} style={{ marginTop: 16, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← Back to Crystal</button>
      </div>
    )
  }
  if (!data) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  const afterPhotoCount = data.media?.filter((m) => m.kind === 'after').length || 0
  const requiredIncomplete = data.checklist?.filter((c) => c.required && !c.completed).length || 0

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <button onClick={() => navigate('/dashboard/crystal')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', marginBottom: 18, fontFamily: 'inherit' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Crystal
      </button>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Job {String(data.id).slice(0, 8)}</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 24 }}>Status: {data.status?.replace(/_/g, ' ')} {data.scheduled_at ? `· ${new Date(data.scheduled_at).toLocaleString()}` : ''}</p>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['scheduled', 'assigned', 'in_progress'].includes(data.status) && (
            <button disabled={busy || requiredIncomplete > 0 && afterPhotoCount === 0} onClick={complete} style={btn(G, '#0a0800')}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Mark Complete (worker action)
            </button>
          )}
          {data.status === 'completed' && (
            <button disabled={busy} onClick={approveCompletion} style={btn('rgba(74,222,128,0.12)', '#4ade80')}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Record Customer Approval
            </button>
          )}
        </div>
        {data.completion && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Completed by worker {String(data.completion.completed_by).slice(0, 8)} on {new Date(data.completion.completed_at).toLocaleString()}</p>
            <p style={{ color: data.completion.customer_approved ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{data.completion.customer_approved ? `Customer approved ${new Date(data.completion.customer_approved_at).toLocaleString()}` : 'Awaiting customer approval'}</p>
          </div>
        )}
      </div>

      <div style={CARD}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus style={{ width: 15, height: 15, color: GOLD }} /> Worker Assignments</h3>
        {!data.assignments?.length ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>No workers assigned yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {data.assignments.map((a) => <p key={a.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{a.role || 'Crew'}: {String(a.worker_user_id).slice(0, 8)}</p>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={assignWorkerId} onChange={(e) => setAssignWorkerId(e.target.value)} placeholder="Worker user ID" style={inp} />
          <button disabled={busy} onClick={assignWorker} style={{ ...btn(G, '#0a0800'), flexShrink: 0 }}><Plus style={{ width: 13, height: 13 }} /> Assign</button>
        </div>
      </div>

      <div style={CARD}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardCheck style={{ width: 15, height: 15, color: GOLD }} /> Checklist</h3>
        {!data.checklist?.length ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>No checklist items yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {data.checklist.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: c.completed ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={c.completed} disabled={c.completed || busy} onChange={() => toggleChecklistItem(c.id)} />
                <span style={{ color: c.completed ? 'rgba(255,255,255,0.35)' : '#fff', fontSize: 13, textDecoration: c.completed ? 'line-through' : 'none' }}>{c.label}{c.required ? ' *' : ''}</span>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={checklistLabel} onChange={(e) => setChecklistLabel(e.target.value)} placeholder="New checklist item" style={inp} />
          <button disabled={busy} onClick={addChecklistItem} style={{ ...btn(G, '#0a0800'), flexShrink: 0 }}><Plus style={{ width: 13, height: 13 }} /> Add</button>
        </div>
      </div>

      <div style={CARD}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Camera style={{ width: 15, height: 15, color: GOLD }} /> Before / After Evidence</h3>
        {!data.media?.length ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>No photos on file yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {data.media.map((m) => (
              <p key={m.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: m.kind === 'after' ? '#4ade80' : GOLD, textTransform: 'uppercase', marginRight: 8 }}>{m.kind}</span>
                {m.storage_path}
              </p>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={mediaForm.kind} onChange={(e) => setMediaForm((f) => ({ ...f, kind: e.target.value }))} style={{ ...inp, width: 110, appearance: 'none', cursor: 'pointer' }}>
            <option value="before" style={{ background: '#111' }}>Before</option>
            <option value="after" style={{ background: '#111' }}>After</option>
          </select>
          <input value={mediaForm.storage_path} onChange={(e) => setMediaForm((f) => ({ ...f, storage_path: e.target.value }))} placeholder="storage path / reference" style={inp} />
          <button disabled={busy} onClick={addMedia} style={{ ...btn(G, '#0a0800'), flexShrink: 0 }}><Plus style={{ width: 13, height: 13 }} /> Add</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10 }}>Evidence requirements (checklist and/or photo count) are configured per service and enforced server-side when marking a job complete — this page doesn't decide what's required, it only shows what's on file.</p>
      </div>
    </div>
  )
}
