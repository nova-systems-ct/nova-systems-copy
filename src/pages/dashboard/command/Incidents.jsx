import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Loader2, Plus } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const SEV_COLOR = { critical: '#f87171', high: '#fb923c', medium: GOLD, low: 'rgba(255,255,255,0.4)', unknown: 'rgba(255,255,255,0.3)' }

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState(''); const [reason, setReason] = useState(''); const [severity, setSeverity] = useState('high')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await authedFetch('/api/client?resource=meetings&op=meetings')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load')
      setIncidents((await r.json()).filter((m) => m.meeting_type === 'incident'))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openIncident = async () => {
    setCreating(true); setError('')
    try {
      const r = await authedFetch('/api/client?resource=meetings&op=open-incident', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, reason, severity }) })
      const data = await r.json(); if (!r.ok) throw new Error(data.error)
      setTitle(''); setReason(''); await load()
    } catch (e) { setError(e.message) }
    setCreating(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Incident Room</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Every incident is a real, persisted meeting with severity, detection, containment and recovery tracked.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
        <input placeholder="Incident title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', fontFamily: 'inherit' }} />
        <input placeholder="What happened" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', fontFamily: 'inherit' }} />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff' }}>
          {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
        </select>
        <button disabled={creating || !title.trim()} onClick={openIncident} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#f87171', border: 'none', borderRadius: 8, color: '#1a0000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><Plus style={{ width: 13, height: 13 }} /> Open incident</button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incidents.map((m) => (
          <Link key={m.id} to={`/dashboard/command/incidents/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textDecoration: 'none' }}>
            <ShieldAlert style={{ width: 16, height: 16, color: SEV_COLOR[m.incident_details?.severity] || SEV_COLOR.unknown }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{m.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{new Date(m.opened_at).toLocaleString()}</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: m.status === 'in_session' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>{m.status}</span>
          </Link>
        ))}
        {incidents.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No incidents recorded.</p>}
      </div>
    </div>
  )
}
