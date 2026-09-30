import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

async function call(resource, op, body = {}, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=${resource}&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=${resource}&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const err = new Error(data.error || 'Request failed'); err.body = data; throw err }
  return data
}

// Hierarchy-specific approvals: pending CEO Twin/Authority Matrix policy versions, and escalations
// currently at the Owner level. The pre-existing generic Approval Inbox (audit reports, Zion, etc.)
// is a separate screen — this one is scoped to the governance layer built in this pass.
export default function Approvals() {
  const [ceoTwin, setCeoTwin] = useState(null)
  const [matrix, setMatrix] = useState(null)
  const [escalations, setEscalations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reauth, setReauth] = useState({}) // { [target]: {password, reason} }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [ct, am, esc] = await Promise.all([
        call('hierarchy', 'ceo-twin', {}, 'GET'),
        call('hierarchy', 'authority-matrix', {}, 'GET'),
        call('governance', 'escalations', { status: 'routed' }, 'GET'),
      ])
      setCeoTwin(ct); setMatrix(am); setEscalations(esc.filter((e) => e.level === 'owner'))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const approve = async (targetType, id) => {
    setBusy(true); setError('')
    try {
      const op = targetType === 'ceo_twin_policy' ? 'approve-ceo-twin-policy' : 'approve-authority-matrix'
      await call('hierarchy', op, { config_id: id, confirm: true })
      await load()
    } catch (e) {
      if (e.body?.requires === 'confirm-reauth') setReauth((s) => ({ ...s, [targetType]: { needsReauth: true, id } }))
      else setError(e.message)
    }
    setBusy(false)
  }
  const doReauth = async (targetType, id) => {
    const r = reauth[targetType] || {}
    setBusy(true); setError('')
    try {
      await call('governance', 'confirm-reauth', { target_type: targetType, target_id: id, password: r.password || '', reason: r.reason || '' })
      setReauth((s) => ({ ...s, [targetType]: undefined }))
      await approve(targetType, id)
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Governance Approvals</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Policy versions awaiting owner approval, and escalations that have reached the top of the chain.</p>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {[{ key: 'ceo_twin_policy', label: 'CEO Twin Policy', data: ceoTwin }, { key: 'authority_matrix', label: 'Authority Matrix', data: matrix }].map(({ key, label, data }) => (
        data?.provisional && (
          <div key={key} style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 12 }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{label} — {data.status}</p>
            {reauth[key]?.needsReauth ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input type="password" placeholder="Your password" style={{ ...inp, flex: 1, minWidth: 140 }} onChange={(e) => setReauth((s) => ({ ...s, [key]: { ...s[key], password: e.target.value } }))} />
                <input placeholder="Reason for self-approving" style={{ ...inp, flex: 1, minWidth: 200 }} onChange={(e) => setReauth((s) => ({ ...s, [key]: { ...s[key], reason: e.target.value } }))} />
                <button disabled={busy} onClick={() => doReauth(key, data.config_id)} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Confirm &amp; approve</button>
              </div>
            ) : (
              <button disabled={busy} onClick={() => approve(key, data.config_id)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '9px 14px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><CheckCircle2 style={{ width: 13, height: 13 }} /> Approve</button>
            )}
          </div>
        )
      ))}

      <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '24px 0 12px' }}>Escalations at Owner level</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {escalations.map((e) => <div key={e.id} style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{e.subject_type}: {e.reason}</div>)}
        {escalations.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Nothing waiting at Owner level. Resolve escalations from the Governance screen.</p>}
      </div>
    </div>
  )
}
