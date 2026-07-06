import { useEffect, useState } from 'react'
import { X, FileText } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

function fmtDuration(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function AICallLogsTab() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [transcriptModal, setTranscriptModal] = useState(null)

  useEffect(() => {
    fetch('/api/nova-ai?action=call-logs').then(r => r.json()).then(data => {
      setCalls(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = outcomeFilter ? calls.filter(c => c.outcome === outcomeFilter) : calls
  const outcomes = [...new Set(calls.map(c => c.outcome).filter(Boolean))]

  const inputStyle = { padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, fontFamily: 'inherit' }
  const thStyle = { textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
  const tdStyle = { padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
      <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 28 }}>Call Logs</h1>

      <div style={{ marginBottom: 20 }}>
        <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)} style={inputStyle}>
          <option value="">All outcomes</option>
          {outcomes.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 28, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 28, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No calls yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Agent</th>
                <th style={thStyle}>Caller</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Outcome</th>
                <th style={thStyle}>Recording</th>
                <th style={thStyle}>Transcript</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={tdStyle}>{c.nova_ai_agents?.business_name || '—'}</td>
                    <td style={tdStyle}>{c.caller_phone}</td>
                    <td style={tdStyle}>{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td style={tdStyle}>{fmtDuration(c.duration)}</td>
                    <td style={tdStyle}>{c.outcome}{c.booked && <span style={{ marginLeft: 6, color: '#4ade80', fontWeight: 700 }}>· Booked</span>}</td>
                    <td style={tdStyle}>{c.recording_url ? <a href={c.recording_url} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Listen</a> : '—'}</td>
                    <td style={tdStyle}>
                      {c.transcript ? (
                        <button onClick={() => setTranscriptModal(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}>
                          <FileText style={{ width: 12, height: 12 }} /> View
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {transcriptModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setTranscriptModal(null)}>
          <div style={{ background: '#0a0800', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Call Transcript</h3>
              <button onClick={() => setTranscriptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcriptModal.transcript}</p>
          </div>
        </div>
      )}
    </div>
  )
}
