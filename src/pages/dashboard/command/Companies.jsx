import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const STATUS_COLOR = { active: '#4ade80', paused: GOLD, closed: '#f87171', planned: 'rgba(255,255,255,0.4)' }

export default function Companies() {
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await authedFetch('/api/client?resource=hierarchy&op=portfolio')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load')
      setPortfolio(await r.json())
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Companies</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Every portfolio entity Nova operates or is evaluating — real status, no invented facts.</p>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {portfolio.map((e) => (
          <Link key={e.id} to={`/dashboard/command/companies/${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textDecoration: 'none' }}>
            <Building2 style={{ width: 18, height: 18, color: GOLD }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{e.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{e.entity_type.replace(/_/g, ' ')}{e.purpose ? ` · ${e.purpose}` : ''}</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: `${STATUS_COLOR[e.status]}18`, color: STATUS_COLOR[e.status] }}>{e.status}</span>
          </Link>
        ))}
        {portfolio.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No portfolio entities.</p>}
      </div>
    </div>
  )
}
