import { useState, useEffect } from 'react'
import { ClipboardList, Loader2, ExternalLink, Download, Calendar } from 'lucide-react'

const GOLD = '#D4A030'
const STATUS_COLORS = {
  Active: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  'Pending Payment': { bg: `${GOLD}15`, color: GOLD },
}

const MEETING_STATUSES = ['pending', 'confirmed', 'completed', 'no_show', 'rescheduled']
const MEETING_STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', no_show: 'No Show', rescheduled: 'Rescheduled' }

function toCsvValue(v) {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function exportMeetingsCsv(meetings) {
  const headers = ['Name', 'Business', 'Phone', 'Email', 'Business Type', 'Meeting Date', 'Meeting Time', 'Services Needed', 'Referral Source', 'Notes', 'Status', 'Submitted']
  const rows = meetings.map(m => [
    m.name, m.business_name, m.phone, m.email, m.business_type || '',
    m.meeting_date, m.meeting_time, m.needs || [], m.referral_source || '', m.notes || '',
    MEETING_STATUS_LABELS[m.status] || m.status, m.created_at,
  ])
  const csv = [headers.map(toCsvValue).join(','), ...rows.map(r => r.map(toCsvValue).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nova-strategy-meetings-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function IntakeForms() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [meetings, setMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/intake?action=clients')
      .then(r => r.json())
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))

    fetch('/api/client?resource=intake-requests')
      .then(r => r.json())
      .then(data => setMeetings(Array.isArray(data) ? data : []))
      .catch(() => setMeetings([]))
      .finally(() => setMeetingsLoading(false))
  }, [])

  const updateMeetingStatus = async (id, status) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    try {
      await fetch('/api/client?resource=intake-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', id, status }),
      })
    } catch {}
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>

      {/* Strategy meeting requests (from public /welcome form) */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Public Intake</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Strategy Meeting Requests</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
            Submissions from the /welcome form. {meetings.length} total.
          </p>
        </div>
        <button onClick={() => exportMeetingsCsv(meetings)} disabled={meetings.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 8, cursor: meetings.length ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}40`, color: GOLD, opacity: meetings.length ? 1 : 0.4 }}>
          <Download style={{ width: 13, height: 13 }} /> Export CSV
        </button>
      </div>

      {meetingsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><Loader2 style={{ width: 26, height: 26, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : meetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 48 }}>
          <Calendar style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.1)', margin: '0 auto 14px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No strategy meeting requests yet. Share the /welcome link to get started.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'auto', marginBottom: 48 }}>
          <div style={{ minWidth: 980, display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1fr 1.3fr 1.4fr 150px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Name', 'Business', 'Contact', 'Meeting', 'Services Needed', 'Status'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {meetings.map(m => (
            <div key={m.id} style={{ minWidth: 980, display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1fr 1.3fr 1.4fr 150px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{m.name}</p>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{m.business_name}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{m.business_type}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{m.phone}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{m.email}</p>
              </div>
              <div>
                <p style={{ color: GOLD, fontSize: 12, fontWeight: 600 }}>{m.meeting_date}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{m.meeting_time}</p>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.5 }}>{(m.needs || []).join(', ') || '—'}</p>
              <select value={m.status} onChange={(e) => updateMeetingStatus(m.id, e.target.value)}
                style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: '#151515', color: GOLD, border: `1px solid ${GOLD}40`, cursor: 'pointer' }}>
                {MEETING_STATUSES.map(s => <option key={s} value={s} style={{ background: '#151515' }}>{MEETING_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Onboard wizard submissions (signed clients) */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>New Business</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Intake Forms</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
          Submissions from the /onboard contract & payment wizard. {clients.length} total.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ClipboardList style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No intake submissions yet. Share the /onboard link with a new client to get started.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 90px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Business', 'Contact', 'Plan', 'Price', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {clients.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Pending Payment']
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 90px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.business_name || c.full_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{c.business_type}</p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{c.full_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{c.email}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.tier_name || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.tier_price ? `$${c.tier_price}/mo` : '—'}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.color, width: 'fit-content', textTransform: 'uppercase' }}>{c.status}</span>
                {c.contract_url ? (
                  <a href={c.contract_url} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}><ExternalLink style={{ width: 12, height: 12 }} /></a>
                ) : <span />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
