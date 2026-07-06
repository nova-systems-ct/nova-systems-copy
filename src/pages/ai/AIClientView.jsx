import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Phone, CalendarCheck, TrendingUp, LogOut } from 'lucide-react'
import { useSEO } from '@/hooks/useSEO'

const GOLD = '#D4A030'
const GOLD_BRIGHT = '#C8921A'
const GOLD_DARK = '#8a6200'

function StatCard({ icon: Icon, label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '24px 26px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon style={{ width: 13, height: 13, color: GOLD }} />
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>{value}</p>
    </div>
  )
}

export default function AIClientView() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useSEO({ title: 'Your Nova AI Agent — Nova Connect', description: 'View how your Nova AI voice agent is performing.' })

  useEffect(() => {
    let session = null
    try { session = JSON.parse(localStorage.getItem('nova_client_session') || 'null') } catch {}
    if (!session || session.client_id !== clientId) {
      navigate('/client-login')
      return
    }
    setAuthorized(true)

    fetch('/api/nova-ai?action=agents').then(r => r.json()).then(async (data) => {
      const agents = Array.isArray(data) ? data : []
      const mine = agents.find(a => a.client_id === clientId)
      setAgent(mine || null)
      if (mine) {
        const callsRes = await fetch(`/api/nova-ai?action=call-logs&agent_id=${encodeURIComponent(mine.id)}`).then(r => r.json()).catch(() => [])
        setCalls(Array.isArray(callsRes) ? callsRes.slice(0, 10) : [])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clientId])

  const logout = () => { localStorage.removeItem('nova_client_session'); navigate('/client-login') }

  if (!authorized) return null

  return (
    <div style={{ minHeight: '100vh', background: '#080600', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff' }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>NOVA AI</span>
        </div>
        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'inherit' }}>
          <LogOut style={{ width: 13, height: 13 }} /> Sign Out
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 100px' }}>
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</p>
        ) : !agent ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 20 }}>You don't have a Nova AI agent set up yet.</p>
            <Link to="/welcome" style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>Schedule a strategy meeting →</Link>
          </div>
        ) : (
          <>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Your Agent</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>{agent.agent_name}</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 32 }}>{agent.phone_number || 'Number not yet assigned'} · {agent.status}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 36 }}>
              <StatCard icon={Phone} label="Calls This Month" value={agent.calls_this_month || 0} />
              <StatCard icon={CalendarCheck} label="Bookings This Month" value={agent.bookings_this_month || 0} />
              <StatCard icon={TrendingUp} label="Total Calls" value={agent.calls_total || 0} />
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Calls</h3>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
              {calls.length === 0 ? (
                <p style={{ padding: 24, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No calls yet.</p>
              ) : calls.map((c, i) => (
                <div key={c.id} style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: i < calls.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{c.caller_phone}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {c.outcome}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
