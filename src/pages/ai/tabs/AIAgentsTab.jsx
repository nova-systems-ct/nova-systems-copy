import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Bot, Phone, CalendarCheck } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

const STATUS_STYLE = {
  active:   { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  testing:  { bg: `${GOLD}14`,            color: GOLD,      border: `${GOLD}35` },
  inactive: { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' },
}

export default function AIAgentsTab() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nova-ai?action=agents').then(r => r.json()).then(data => {
      setAgents(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Agents</h1>
        </div>
        <button
          onClick={() => navigate('/ai/dashboard/create-agent')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Plus style={{ width: 14, height: 14 }} /> Create Agent
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
      ) : agents.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '60px 28px', textAlign: 'center' }}>
          <Bot style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No agents yet. Create your first Nova AI agent to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {agents.map(a => {
            const st = STATUS_STYLE[a.status] || STATUS_STYLE.testing
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/ai/agent/${a.id}`)}
                style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '24px 24px', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.045)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{a.agent_name}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{a.business_name}</p>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{a.status}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  <div>{a.phone_number || 'No number assigned'}</div>
                  <div>{a.voice_name || 'No voice selected'}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone style={{ width: 12, height: 12, color: GOLD }} />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{a.calls_this_month || 0}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>calls</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarCheck style={{ width: 12, height: 12, color: GOLD }} />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{a.bookings_this_month || 0}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>bookings</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
