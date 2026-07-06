import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

export default function AISmsLogsTab() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [openThread, setOpenThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)

  useEffect(() => {
    fetch('/api/nova-ai?action=sms-logs').then(r => r.json()).then(data => {
      setThreads(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const openConversation = async (t) => {
    setOpenThread(t)
    setLoadingThread(true)
    try {
      const r = await fetch(`/api/nova-ai?action=sms-logs&agent_id=${encodeURIComponent(t.agent_id)}&contact_phone=${encodeURIComponent(t.contact_phone)}`)
      const data = await r.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch { setMessages([]) }
    setLoadingThread(false)
  }

  const thStyle = { textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
  const tdStyle = { padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
      <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 28 }}>SMS Logs</h1>

      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 28, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
        ) : threads.length === 0 ? (
          <p style={{ padding: 28, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No SMS conversations yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Agent</th>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Sent</th>
                <th style={thStyle}>Received</th>
                <th style={thStyle}>Last Activity</th>
              </tr></thead>
              <tbody>
                {threads.map(t => (
                  <tr key={`${t.agent_id}-${t.contact_phone}`} onClick={() => openConversation(t)} style={{ cursor: 'pointer' }}>
                    <td style={tdStyle}>{t.business_name || '—'}</td>
                    <td style={tdStyle}>{t.contact_phone}</td>
                    <td style={tdStyle}>{t.sent}</td>
                    <td style={tdStyle}>{t.received}</td>
                    <td style={tdStyle}>{new Date(t.last_message_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openThread && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setOpenThread(null)}>
          <div style={{ background: '#0a0800', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, maxWidth: 480, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{openThread.contact_phone}</h3>
              <button onClick={() => setOpenThread(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingThread ? (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
              ) : messages.map(m => (
                <div key={m.id} style={{ alignSelf: m.direction === 'outbound' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.direction === 'outbound' ? `${GOLD}18` : 'rgba(255,255,255,0.05)', border: `1px solid ${m.direction === 'outbound' ? GOLD + '40' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '8px 12px' }}>
                  <p style={{ color: '#fff', fontSize: 13, lineHeight: 1.4 }}>{m.message}</p>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 4 }}>{new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
