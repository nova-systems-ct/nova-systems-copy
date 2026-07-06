import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Phone, CalendarCheck, TrendingUp, Plus, MessageSquare } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '26px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Icon style={{ width: 14, height: 14, color: GOLD }} />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8 }}>{sub}</p>}
    </div>
  )
}

export default function AIOverviewTab({ onNavigate }) {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [calls, setCalls] = useState([])
  const [smsThreads, setSmsThreads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/nova-ai?action=agents').then(r => r.json()).catch(() => []),
      fetch('/api/nova-ai?action=call-logs').then(r => r.json()).catch(() => []),
      fetch('/api/nova-ai?action=sms-logs').then(r => r.json()).catch(() => []),
    ]).then(([a, c, s]) => {
      setAgents(Array.isArray(a) ? a : [])
      setCalls(Array.isArray(c) ? c : [])
      setSmsThreads(Array.isArray(s) ? s : [])
      setLoading(false)
    })
  }, [])

  const activeAgents = agents.filter(a => a.status === 'active').length
  const callsThisMonth = agents.reduce((sum, a) => sum + (a.calls_this_month || 0), 0)
  const bookingsThisMonth = agents.reduce((sum, a) => sum + (a.bookings_this_month || 0), 0)

  const recentActivity = [
    ...calls.slice(0, 6).map(c => ({ id: `call-${c.id}`, ts: c.created_at, text: `Call from ${c.caller_phone || 'unknown'} — ${c.outcome || 'unknown'} (${c.nova_ai_agents?.business_name || 'Agent'})`, icon: Phone })),
    ...smsThreads.slice(0, 6).map(s => ({ id: `sms-${s.agent_id}-${s.contact_phone}`, ts: s.last_message_at, text: `Text thread with ${s.contact_phone} (${s.business_name || 'Agent'})`, icon: MessageSquare })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8)

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Overview</h1>
        </div>
        <button
          onClick={() => navigate('/ai/dashboard/create-agent')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Plus style={{ width: 14, height: 14 }} /> Create Agent
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard icon={Bot} label="Total Agents" value={agents.length} sub={`${activeAgents} active`} />
        <StatCard icon={Phone} label="Calls This Month" value={callsThisMonth} />
        <StatCard icon={CalendarCheck} label="Bookings This Month" value={bookingsThisMonth} />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={callsThisMonth ? `${Math.round((bookingsThisMonth / callsThisMonth) * 100)}%` : '—'} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 28px' }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Recent</p>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Activity</h3>
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
        ) : recentActivity.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No calls or texts yet. Create an agent to get started.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((a, i) => {
              const Icon = a.icon
              return (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${GOLD}10`, border: `1px solid ${GOLD}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon style={{ width: 12, height: 12, color: GOLD }} />
                  </div>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.4 }}>{a.text}</p>
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 2 }}>{a.ts ? new Date(a.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
