import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, X, Save, Check } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const STATUSES = ['new', 'reviewing', 'interview_scheduled', 'hired', 'declined']
const STATUS_CFG = {
  new:                 { label: 'New',               color: GOLD,      bg: `${GOLD}14`,             border: `${GOLD}35` },
  reviewing:           { label: 'Reviewing',         color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  interview_scheduled: { label: 'Interview Scheduled', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  hired:               { label: 'Hired',             color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)' },
  declined:            { label: 'Declined',          color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status || 'new']
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState(null)
  const [status, setStatus] = useState('new')
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [showInterview, setShowInterview] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const all = JSON.parse(localStorage.getItem('nova_applications') || '[]')
    const c = all.find(a => a.id === id)
    if (!c) { navigate('/dashboard/jobs'); return }
    setCandidate(c)
    setStatus(c.status || 'new')
    setNotes(c.adminNotes || '')
  }, [id])

  if (!candidate) return null

  const persist = (patch) => {
    const all = JSON.parse(localStorage.getItem('nova_applications') || '[]')
    const updated = all.map(a => a.id === id ? { ...a, ...patch } : a)
    localStorage.setItem('nova_applications', JSON.stringify(updated))
    setCandidate(c => ({ ...c, ...patch }))
  }

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'interview_scheduled') { setShowInterview(true); return }
    setUpdating(true)
    setStatus(newStatus)
    persist({ status: newStatus })
    try {
      if (newStatus === 'hired') {
        const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
        const accounts = JSON.parse(localStorage.getItem('nova_employee_accounts') || '[]')
        if (!accounts.find(a => a.applicationId === id)) {
          accounts.push({ id: crypto.randomUUID(), applicationId: id, email: candidate.email, name: candidate.name, password: null, token, isEmployee: true })
          localStorage.setItem('nova_employee_accounts', JSON.stringify(accounts))
        }
        await fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Nova Systems HR', email: 'isaac_0427@icloud.com',
            subject: `Offer Letter: ${candidate.name} — ${candidate.position}`,
            message: `Congratulations ${candidate.name}! You have been hired for ${candidate.position} at Nova Systems. Please set up your employee account at nova-systems.app/set-password?token=${token}`,
          }),
        })
      } else if (newStatus === 'declined') {
        await fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Nova Systems HR', email: 'isaac_0427@icloud.com',
            subject: `Application Update — ${candidate.name}`,
            message: `Hi ${candidate.name}, thank you for applying for ${candidate.position} at Nova Systems. After careful review, we have decided to move forward with other candidates. We wish you the best.`,
          }),
        })
      }
    } catch {}
    setUpdating(false)
  }

  const confirmInterview = async () => {
    if (!interviewDate || !interviewTime) return
    setUpdating(true)
    const dateFormatted = new Date(`${interviewDate}T${interviewTime}`).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    setStatus('interview_scheduled')
    persist({ status: 'interview_scheduled', interviewDate, interviewTime })
    setShowInterview(false)
    try {
      await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nova Systems HR', email: 'isaac_0427@icloud.com',
          subject: `Interview Scheduled — ${candidate.name}`,
          message: `Hi ${candidate.name},\n\nYour interview for ${candidate.position} at Nova Systems has been scheduled.\n\n📍 Bread of Heaven\n141 Grand St, Waterbury, CT\n\n📅 ${dateFormatted}\n\nPlease arrive 5 minutes early. Bring any portfolio or work samples you'd like to share.\n\n— Isaac Nova, Nova Systems`,
        }),
      })
    } catch {}
    setUpdating(false)
  }

  const saveNotes = () => {
    persist({ adminNotes: notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const c = candidate
  const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
  const cfg = STATUS_CFG[status]

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard/jobs')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> All Applicants
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>
            {(c.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>{c.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{c.position}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Left — applicant info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Contact</p>
            <Detail label="Email" value={c.email && <a href={`mailto:${c.email}`} style={{ color: '#60a5fa' }}>{c.email}</a>} />
            <Detail label="Phone" value={c.phone} />
            <Detail label="Applied" value={date} />
            {(c.portfolioUrl || c.portfolio_url) && <Detail label="Portfolio" value={<a href={c.portfolioUrl || c.portfolio_url} target="_blank" rel="noreferrer" style={{ color: GOLD, display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink style={{ width: 12, height: 12 }} /> View Portfolio</a>} />}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Equipment & Skills</p>
            <Detail label="Can Record Video" value={c.canRecord === 'yes' || c.can_record_video ? 'Yes' : 'No'} />
            <Detail label="Owns Camera" value={c.ownsCamera === 'yes' || c.has_camera ? 'Yes' : 'No'} />
            <Detail label="Drone Experience" value={c.hasDrone === 'yes' ? 'Yes' : c.hasDrone === 'no' ? 'No' : null} />
            <Detail label="Video Editing" value={c.hasEditingExp === 'yes' ? `Yes — ${c.editingSoftware || 'unspecified'}` : c.editing_experience ? `Yes — ${c.editing_software || 'unspecified'}` : 'No'} />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Application</p>
            <Detail label="Experience" value={c.experience} />
            <Detail label="Why Nova Systems" value={c.whyNova || c.why_nova_systems} />
            <Detail label="Availability" value={c.availability} />
            <Detail label="Expected Pay" value={c.expectedPay || c.expected_pay} />
          </div>

          {/* Notes */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Admin Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} placeholder="Internal notes about this candidate…" />
            <button onClick={saveNotes} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: notesSaved ? 'rgba(34,197,94,0.12)' : G, border: notesSaved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 7, color: notesSaved ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {notesSaved ? <><Check style={{ width: 12, height: 12 }} /> Saved</> : <><Save style={{ width: 12, height: 12 }} /> Save Notes</>}
            </button>
          </div>
        </div>

        {/* Right — status */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, position: 'sticky', top: 24 }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Status</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STATUSES.map(s => {
              const cfg2 = STATUS_CFG[s]
              const on = status === s
              return (
                <button key={s} onClick={() => handleStatusChange(s)} disabled={updating} style={{ padding: '11px 14px', background: on ? cfg2.bg : 'transparent', border: `1px solid ${on ? cfg2.border : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: on ? cfg2.color : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: on ? 700 : 400, cursor: updating ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {on && <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg2.color }} />}
                  {cfg2.label}
                  {s === 'interview_scheduled' && on && c.status === 'interview_scheduled' && ' ✓'}
                </button>
              )
            })}
          </div>

          {showInterview && (
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>Set interview date & time. Email will be sent automatically with <strong style={{ color: GOLD }}>Bread of Heaven</strong> location.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Date</label>
                  <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Time</label>
                  <input type="time" value={interviewTime} onChange={e => setInterviewTime(e.target.value)} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowInterview(false)} style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={confirmInterview} disabled={!interviewDate || !interviewTime || updating} style={{ flex: 2, padding: 10, background: interviewDate && interviewTime ? G : '#222', border: 'none', borderRadius: 6, color: interviewDate && interviewTime ? '#0a0800' : '#555', fontSize: 12, fontWeight: 700, cursor: interviewDate && interviewTime ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                    Send Interview Email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
