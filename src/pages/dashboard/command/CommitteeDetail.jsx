import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Video } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

export default function CommitteeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [unit, setUnit] = useState(null)
  const [positions, setPositions] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [units, pos, mtgs] = await Promise.all([
        authedFetch('/api/client?resource=hierarchy&op=org-units').then((r) => r.json()),
        authedFetch('/api/client?resource=hierarchy&op=positions').then((r) => r.json()),
        authedFetch('/api/client?resource=meetings&op=meetings').then((r) => r.json()),
      ])
      setUnit(units.find((u) => u.id === id) || null)
      setPositions(pos.filter((p) => p.org_unit_id === id))
      setMeetings(mtgs.filter((m) => m.committee_org_unit_id === id))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const meetNow = async () => {
    setBusy(true); setError('')
    try {
      const r = await authedFetch('/api/client?resource=meetings&op=meet-now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${unit.name} — ad hoc session`, committee_org_unit_id: id, reason: 'Opened from the committee page.' }) })
      const data = await r.json(); if (!r.ok) throw new Error(data.error)
      navigate('/dashboard/command/meetings')
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  if (!unit) return <div style={{ padding: 48 }}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Not found.</p></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <Link to="/dashboard/command/committees" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none', marginBottom: 16 }}><ArrowLeft style={{ width: 13, height: 13 }} /> Committees</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{unit.name}</h1>
          {unit.mission && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>{unit.mission}</p>}
        </div>
        <button disabled={busy} onClick={meetNow} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}><Video style={{ width: 14, height: 14 }} /> Meet Now</button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 16 }}>{error}</p>}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Seats</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {positions.map((p) => <div key={p.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{p.title}</div>)}
          {positions.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No seats defined for this committee yet.</p>}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Past meetings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {meetings.map((m) => <div key={m.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{m.title} — {m.status} ({new Date(m.opened_at).toLocaleDateString()})</div>)}
          {meetings.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No meetings yet for this committee.</p>}
        </div>
      </section>
    </div>
  )
}
