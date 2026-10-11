import { useState, useEffect, useCallback } from 'react'
import { Users, Loader2, Circle } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const STATUS_CFG = {
  draft: { label: 'Draft', color: 'rgba(255,255,255,0.4)' },
  onboarding: { label: 'Onboarding', color: '#a78bfa' },
  training: { label: 'Training', color: '#a78bfa' },
  restricted: { label: 'Restricted', color: GOLD },
  active: { label: 'Active', color: '#4ade80' },
  suspended: { label: 'Suspended', color: '#f87171' },
  inactive: { label: 'Inactive', color: 'rgba(255,255,255,0.25)' },
}

// Truthful presence: "Working" is rendered ONLY when /api/client?resource=workitems&op=worker-presence
// says working=true — that endpoint re-checks a real heartbeat against the linked work item's CURRENT
// status server-side (api/_hierarchy/rules.js isWorkerActuallyWorking). Nothing here is decorative.
export default function Workforce() {
  const [workers, setWorkers] = useState([])
  const [presence, setPresence] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const wRes = await authedFetch('/api/client?resource=hierarchy&op=workers')
      if (!wRes.ok) throw new Error((await wRes.json().catch(() => ({}))).error || 'Failed to load workers')
      const list = await wRes.json()
      setWorkers(list)
      const entries = await Promise.all(list.map(async (w) => {
        const r = await authedFetch(`/api/client?resource=workitems&op=worker-presence&worker_id=${encodeURIComponent(w.id)}`)
        return [w.id, r.ok ? await r.json() : null]
      }))
      setPresence(Object.fromEntries(entries))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Workforce</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Every worker's real status and truthful live presence — "Working" only appears when a real, recent heartbeat is tied to a genuinely in-progress work item.</p>
      </div>
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}><p style={{ color: '#f87171', fontSize: 13 }}>{error}</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workers.map((w) => {
          const cfg = STATUS_CFG[w.status] || STATUS_CFG.draft
          const p = presence[w.id]
          return (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{w.display_name}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{w.worker_type}{w.positions?.title ? ` · ${w.positions.title}` : ''}</p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: p?.working ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                <Circle style={{ width: 8, height: 8, fill: 'currentColor' }} /> {p?.working ? 'Working' : 'Not working'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
            </div>
          )
        })}
        {workers.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
            <Users style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No workers yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
