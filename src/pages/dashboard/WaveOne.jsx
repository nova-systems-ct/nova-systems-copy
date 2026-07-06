import { useEffect, useState } from 'react'
import { Loader2, Zap, Download } from 'lucide-react'

const GOLD = '#D4A030'
const STATUSES = ['new', 'reviewing', 'approved', 'rejected', 'waitlisted']
const STATUS_STYLE = {
  new:        { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' },
  reviewing:  { bg: `${GOLD}15`,              color: GOLD },
  approved:   { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80' },
  rejected:   { bg: 'rgba(239,68,68,0.1)',    color: '#f87171' },
  waitlisted: { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
}

function toCsvValue(v) {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function exportCsv(apps) {
  const headers = ['First Name', 'Last Name', 'Phone', 'Email', 'Company', 'Website', 'City', 'Industry', 'Biggest Problem', 'Revenue Range', 'Priority Engines', 'Notes', 'Status', 'Submitted']
  const rows = apps.map(a => [
    a.first_name, a.last_name, a.phone, a.email, a.company_name, a.website || '', a.city || '',
    a.industry || '', a.biggest_problem || '', a.revenue_range || '', a.priority_engines || [], a.notes || '', a.status, a.created_at,
  ])
  const csv = [headers.map(toCsvValue).join(','), ...rows.map(r => r.map(toCsvValue).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wave-one-applications-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function WaveOne() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [spots, setSpots] = useState('')
  const [savingSpots, setSavingSpots] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/waves-intake?action=list').then(r => r.json()).then(data => setApps(Array.isArray(data) ? data : [])).catch(() => setApps([])).finally(() => setLoading(false))
    fetch('/api/waves-intake?action=spots').then(r => r.json()).then(d => setSpots(String(d?.spots_remaining ?? ''))).catch(() => {})
  }
  useEffect(load, [])

  const updateStatus = async (id, status) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    try {
      await fetch('/api/waves-intake?action=update-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
      })
    } catch {}
  }

  const saveSpots = async () => {
    const n = parseInt(spots, 10)
    if (!Number.isFinite(n) || n < 0) return
    setSavingSpots(true)
    try {
      await fetch('/api/waves-intake?action=set-spots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spots_remaining: n }),
      })
    } catch {}
    setSavingSpots(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1300 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Limited Enrollment</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Wave One</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{apps.length} application{apps.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
            <Zap style={{ width: 14, height: 14, color: GOLD }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Spots Remaining</span>
            <input type="number" min="0" value={spots} onChange={e => setSpots(e.target.value)}
              style={{ width: 50, background: 'transparent', border: 'none', borderBottom: `1px solid ${GOLD}50`, color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
            <button onClick={saveSpots} disabled={savingSpots} style={{ padding: '6px 12px', background: GOLD, border: 'none', borderRadius: 6, color: '#0a0800', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {savingSpots ? '...' : 'Save'}
            </button>
          </div>
          <button onClick={() => exportCsv(apps)} disabled={apps.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 8, cursor: apps.length ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}40`, color: GOLD, opacity: apps.length ? 1 : 0.4 }}>
            <Download style={{ width: 13, height: 13 }} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Zap style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No Wave One applications yet. Share the /waves link to get started.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'auto' }}>
          <div style={{ minWidth: 1100, display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.1fr 1fr 1fr 1.4fr 140px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Name', 'Business', 'Contact', 'Problem', 'Revenue', 'Priority Engines', 'Status'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {apps.map(a => (
            <div key={a.id} style={{ minWidth: 1100, display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.1fr 1fr 1fr 1.4fr 140px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{a.first_name} {a.last_name}</p>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{a.company_name}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{a.industry} · {a.city}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{a.phone}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{a.email}</p>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{a.biggest_problem || '—'}</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{a.revenue_range || '—'}</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.5 }}>{(a.priority_engines || []).join(', ') || '—'}</p>
              <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)}
                style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: '#151515', color: (STATUS_STYLE[a.status] || STATUS_STYLE.new).color, border: `1px solid ${GOLD}40`, cursor: 'pointer', textTransform: 'capitalize' }}>
                {STATUSES.map(s => <option key={s} value={s} style={{ background: '#151515' }}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
