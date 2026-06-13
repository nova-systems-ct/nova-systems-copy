import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, UserPlus, X, Send, ExternalLink, Calendar } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const STATUS_CFG = {
  new:                 { label: 'New',       color: GOLD,       bg: `${GOLD}14`,              border: `${GOLD}35` },
  reviewing:           { label: 'Reviewing', color: '#60a5fa',  bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)' },
  interview_scheduled: { label: 'Interview', color: '#a78bfa',  bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)' },
  hired:               { label: 'Hired',     color: '#4ade80',  bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.3)' },
  declined:            { label: 'Declined',  color: '#f87171',  bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)' },
}

const FILTERS = ['All', 'New', 'Reviewing', 'Interview', 'Hired', 'Declined']

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status || 'new']
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

export default function Jobs() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '' })
  const [addLoading, setAddLoading] = useState(false)

  const load = async () => {
    const local = JSON.parse(localStorage.getItem('nova_applications') || '[]')
    setCandidates(local) // show local immediately
    try {
      const res = await fetch('/api/get-applications')
      if (!res.ok) return
      const sbApps = await res.json()
      if (!Array.isArray(sbApps) || sbApps.length === 0) return
      // Merge: local overrides Supabase for mutable fields (status, notes, interviewDate)
      const localMap = Object.fromEntries(local.map(a => [a.id, a]))
      const merged = sbApps.map(sb => {
        const loc = localMap[sb.id]
        // If local has a more recent status update, keep local; otherwise use Supabase
        return loc ? { ...sb, ...loc } : sb
      })
      const sbIds = new Set(sbApps.map(a => a.id))
      const localOnly = local.filter(a => !sbIds.has(a.id))
      const all = [...merged, ...localOnly]
      all.sort((a, b) => new Date(b.submittedAt || b.submitted_at || 0) - new Date(a.submittedAt || a.submitted_at || 0))
      localStorage.setItem('nova_applications', JSON.stringify(all))
      setCandidates(all)
    } catch {}
  }
  useEffect(() => { load() }, [])

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.name?.toLowerCase().includes(q) && !c.position?.toLowerCase().includes(q)) return false
    if (filter !== 'All') {
      const s = c.status || 'new'
      if (filter === 'New' && s !== 'new') return false
      if (filter === 'Reviewing' && s !== 'reviewing') return false
      if (filter === 'Interview' && s !== 'interview_scheduled') return false
      if (filter === 'Hired' && s !== 'hired') return false
      if (filter === 'Declined' && s !== 'declined') return false
    }
    return true
  })

  const sendInvite = async () => {
    if (!addForm.email) return
    setAddLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name || 'Prospective Candidate',
          email: 'isaac_0427@icloud.com',
          subject: `Invite Sent: ${addForm.name || addForm.email}`,
          message: `You sent an invitation to ${addForm.name || 'a prospect'} (${addForm.email}) to apply at nova-systems.app/careers.`,
        }),
      })
    } catch {}
    setAddLoading(false)
    setAddModal(false)
    setAddForm({ name: '', email: '', phone: '' })
  }

  const counts = {
    new: candidates.filter(c => !c.status || c.status === 'new').length,
    reviewing: candidates.filter(c => c.status === 'reviewing').length,
    interview_scheduled: candidates.filter(c => c.status === 'interview_scheduled').length,
    hired: candidates.filter(c => c.status === 'hired').length,
    declined: candidates.filter(c => c.status === 'declined').length,
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Jobs</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Applicants</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{candidates.length} total application{candidates.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          <UserPlus style={{ width: 14, height: 14 }} /> Add Candidate
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <div key={key} style={{ padding: '12px 18px', background: `${cfg.bg}`, border: `1px solid ${cfg.border}`, borderRadius: 8, minWidth: 90 }}>
            <p style={{ color: cfg.color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{counts[key] || 0}</p>
            <p style={{ color: cfg.color, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4, opacity: 0.8 }}>{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
          <input placeholder="Search by name or position…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', background: filter === f ? `${GOLD}14` : 'transparent', border: `1px solid ${filter === f ? GOLD + '35' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, color: filter === f ? GOLD : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {candidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Users style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 8 }}>No applications yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Applications from <a href="/careers" style={{ color: GOLD }}>/careers</a> appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No applicants match the current filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <ApplicantRow key={c.id} candidate={c} onClick={() => navigate(`/dashboard/jobs/${c.id}`)} />
          ))}
        </div>
      )}

      {/* Add Candidate Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div style={{ width: '100%', maxWidth: 440, background: '#0d0c09', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Send Invite to Apply</h3>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>Send an invitation email with a link to apply at nova-systems.app/careers.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Name', 'text', 'Jane Smith', 'name'], ['Email *', 'email', 'jane@email.com', 'email'], ['Phone', 'tel', '+1 (860) 000-0000', 'phone']].map(([label, type, ph, key]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>{label}</label>
                  <input type={type} placeholder={ph} value={addForm[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
            </div>
            <button onClick={sendInvite} disabled={addLoading || !addForm.email} style={{ width: '100%', marginTop: 18, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: !addForm.email || addLoading ? 'not-allowed' : 'pointer', opacity: !addForm.email || addLoading ? 0.5 : 1, fontFamily: 'inherit' }}>
              {addLoading ? <div style={{ width: 14, height: 14, border: '2px solid rgba(10,8,0,0.3)', borderTopColor: '#0a0800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><Send style={{ width: 13, height: 13 }} /> Send Invite</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ApplicantRow({ candidate: c, onClick }) {
  const [hov, setHov] = useState(false)
  const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: hov ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.025)', border: `1px solid ${hov ? 'rgba(212,160,48,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', flexWrap: 'wrap' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>
        {(c.name || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.name || 'Unknown'}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 1 }}>{c.position}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: c.ownsCamera === 'yes' || c.equipment_owned ? '#4ade80' : 'rgba(255,255,255,0.25)', background: c.ownsCamera === 'yes' || c.equipment_owned ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${c.ownsCamera === 'yes' || c.equipment_owned ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
          {c.ownsCamera === 'yes' || c.equipment_owned ? '📷 Camera' : 'No camera'}
        </span>
        {(c.portfolioUrl || c.portfolio_url) && <a href={c.portfolioUrl || c.portfolio_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#60a5fa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><ExternalLink style={{ width: 10, height: 10 }} />Portfolio</a>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
          <Calendar style={{ width: 10, height: 10 }} />{date}
        </div>
      </div>
      <StatusBadge status={c.status} />
    </div>
  )
}
