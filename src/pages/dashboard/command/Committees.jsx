import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Users2, Loader2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'

export default function Committees() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await authedFetch('/api/client?resource=hierarchy&op=org-units')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load')
      setUnits((await r.json()).filter((u) => u.unit_type === 'committee'))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Committees</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Each committee is a real, editable org unit — not a fixed list. Open one to see its seats and meetings.</p>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {units.map((u) => (
          <Link key={u.id} to={`/dashboard/command/committees/${u.id}`} style={{ display: 'block', padding: '16px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textDecoration: 'none' }}>
            <Users2 style={{ width: 16, height: 16, color: GOLD, marginBottom: 8 }} />
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{u.name}</p>
            {u.mission && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>{u.mission}</p>}
          </Link>
        ))}
        {units.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No committees defined.</p>}
      </div>
    </div>
  )
}
