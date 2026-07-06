import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

export default function AIKnowledgeBasesTab() {
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
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
      <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 28 }}>Knowledge Bases</h1>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
      ) : agents.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No agents yet — create an agent to build its knowledge base.</p>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, overflow: 'hidden' }}>
          {agents.map((a, i) => (
            <div
              key={a.id}
              onClick={() => navigate(`/ai/agent/${a.id}?tab=knowledge`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', cursor: 'pointer', borderBottom: i < agents.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${GOLD}12`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen style={{ width: 15, height: 15, color: GOLD }} />
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{a.business_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{a.agent_name} · {a.knowledge_base_id ? 'Configured' : 'Not set up yet'}</p>
                </div>
              </div>
              <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.25)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
