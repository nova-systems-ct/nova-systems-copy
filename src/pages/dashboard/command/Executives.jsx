import { useState, useEffect, useCallback } from 'react'
import { Loader2, Crown, Ban, ShieldQuestion, UserCircle2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'

export default function Executives() {
  const [positions, setPositions] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [p, pf] = await Promise.all([
        authedFetch('/api/client?resource=hierarchy&op=positions').then((r) => r.json()),
        authedFetch('/api/client?resource=hierarchy&op=portfolio').then((r) => r.json()),
      ])
      setPositions(p.filter((x) => ['owner', 'executive', 'ceo_twin', 'aura_control_seat', 'model_council_seat'].includes(x.position_type)))
      setPortfolio(pf)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  const companyName = (id) => portfolio.find((p) => p.id === id)?.name || 'Portfolio-wide'

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Executives</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Owner, executive and reserved seats across the portfolio — honest fill status, never decorative.</p>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {positions.sort((a, b) => a.authority_level - b.authority_level).map((p) => {
          const a = (p.executive_assignments || [])[0]
          const cfg = !a ? { icon: ShieldQuestion, color: 'rgba(255,255,255,0.3)', label: 'No record' }
            : a.fill_type === 'reserved' ? { icon: Ban, color: 'rgba(255,255,255,0.4)', label: p.reserved_reason || 'Reserved' }
            : a.fill_type === 'vacant' ? { icon: ShieldQuestion, color: 'rgba(255,255,255,0.4)', label: 'Vacant' }
            : { icon: UserCircle2, color: '#4ade80', label: `Filled — ${a.fill_type}` }
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <Crown style={{ width: 16, height: 16, color: GOLD }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{p.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Level {p.authority_level} · {companyName(p.portfolio_entity_id)}</p>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: cfg.color }}><cfg.icon style={{ width: 12, height: 12 }} /> {cfg.label}</span>
            </div>
          )
        })}
        {positions.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No executive seats defined.</p>}
      </div>
    </div>
  )
}
