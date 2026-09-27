import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Save, Check, Mail, FileSignature, FileText, Info } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
// Roles this page's "Invite to Create Account" can grant. Sales roles are excluded on purpose —
// sales hiring/invitation lives entirely in the Sales Team workspace (api/_sales), never here.
const INVITE_ROLES = [
  { value: 'nova_marketing', label: 'Marketing / Content' },
  { value: 'nova_developer', label: 'Developer / IT' },
  { value: 'nova_auditor', label: 'Diagnostics / Audit' },
  { value: 'nova_admin', label: 'Admin (owner approval required)' },
]
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const STATUSES = ['new', 'reviewing', 'interview_scheduled', 'hired', 'declined']
const STATUS_CFG = {
  new:                 { label: 'New',               color: GOLD,      bg: `${GOLD}14`,             border: `${GOLD}35` },
  reviewing:           { label: 'Reviewing',         color: '#C9A84C', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
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
  const [notFound, setNotFound] = useState(false)

  // Hiring workflow for NON-SALES roles: Careers -> application -> administrator review (this
  // page) -> secure account invitation (real Supabase invite email via api/team.js, the same
  // mechanism used to bring on any Nova staff member) -> working agreement. Sales applications no
  // longer reach this page's invite step at all (see api/_sales/hiring.js and /apply/sales) — a
  // general invite here grants full, active access immediately; there is no separate
  // "activation" step for non-sales staff the way there is for sales representatives.
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')
  const [inviteRole, setInviteRole] = useState(INVITE_ROLES[0].value)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [creatingAgreement, setCreatingAgreement] = useState(false)
  const [agreement, setAgreement] = useState(null)

  // Repair task (2026-09-21): this page used to read purely from localStorage('nova_applications')
  // — a cache Jobs.jsx populated on its own mount — so a direct link or a page refresh landing
  // here first (cache empty) always bounced to /dashboard/jobs even for a real applicant. Now
  // fetches its own copy from the same real endpoint Jobs.jsx uses, so this page works standalone.
  useEffect(() => {
    let active = true
    authedFetch('/api/intake?action=applications')
      .then(r => r.ok ? r.json() : [])
      .then(all => {
        if (!active) return
        const c = Array.isArray(all) ? all.find(a => a.id === id) : null
        if (!c) { setNotFound(true); return }
        setCandidate(c)
        setStatus(c.status || 'new')
        setNotes(c.adminNotes || '')
      })
      .catch(() => { if (active) setNotFound(true) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!candidate?.id) return
    authedFetch('/api/contracts?action=list')
      .then(r => r.ok ? r.json() : [])
      .then(rows => setAgreement(Array.isArray(rows) ? rows.find(c => c.application_id === candidate.id) || null : null))
      .catch(() => {})
  }, [candidate?.id])

  if (notFound) { navigate('/dashboard/jobs'); return null }
  if (!candidate) return null

  const handleInvite = async () => {
    setInviting(true)
    setInviteResult('')
    try {
      const r = await authedFetch('/api/team?op=invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: candidate.email, role: inviteRole, application_id: id }),
      })
      const data = await r.json()
      if (!r.ok) { setInviteResult(data.error || 'Failed to invite.'); setInviting(false); return }
      setCandidate(c => ({ ...c, auth_user_id: data.staff_user_id, invited_at: new Date().toISOString() }))
      setInviteResult(`Invitation email sent — they will have real Nova Systems access as soon as they accept and set a password.`)
    } catch (e) {
      setInviteResult('Failed to invite: ' + e.message)
    }
    setInviting(false)
  }

  const handleViewResume = async () => {
    setResumeLoading(true)
    try {
      const r = await authedFetch(`/api/intake?action=resume-signed-url&id=${encodeURIComponent(id)}`)
      const data = await r.json()
      if (r.ok && data.url) window.open(data.url, '_blank', 'noreferrer')
      else alert(data.error || 'No file on record.')
    } catch (e) {
      alert('Could not open file: ' + e.message)
    }
    setResumeLoading(false)
  }

  const handleCreateAgreement = async () => {
    setCreatingAgreement(true)
    try {
      const r = await authedFetch('/api/contracts?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: candidate.name, client_email: candidate.email, contract_type: `${candidate.position} Agreement`, application_id: id }),
      })
      const data = await r.json()
      if (r.ok && data.contract) setAgreement(data.contract)
      else alert(data.error || 'Failed to create agreement.')
    } catch (e) {
      alert('Failed to create agreement: ' + e.message)
    }
    setCreatingAgreement(false)
  }

  // Persists status/notes/interview changes to the real `applications` row via
  // api/intake.js's update-application action — this used to only ever write to localStorage,
  // invisible cross-device/to other staff and lost on cleared storage. Errors are surfaced, not
  // swallowed, so a failed save doesn't silently look successful in the UI.
  const persist = async (patch) => {
    setCandidate(c => ({ ...c, ...patch }))
    // Local candidate state uses the camelCase shape handleListApplications() normalizes to
    // (interviewDate/interviewTime/adminNotes) — the server's update-application action expects
    // the real snake_case applications-table columns, so translate rather than send the patch as-is.
    const serverPatch = { id }
    if ('status' in patch) serverPatch.status = patch.status
    if ('interviewDate' in patch) serverPatch.interview_date = patch.interviewDate
    if ('interviewTime' in patch) serverPatch.interview_time = patch.interviewTime
    if ('adminNotes' in patch) serverPatch.admin_notes = patch.adminNotes
    try {
      const r = await authedFetch('/api/intake?action=update-application', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverPatch),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }
      return true
    } catch (e) {
      alert('Could not save this change: ' + e.message + '. Please try again.')
      return false
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'interview_scheduled') { setShowInterview(true); return }
    setUpdating(true)
    setStatus(newStatus)
    const ok = await persist({ status: newStatus })
    if (!ok) { setStatus(candidate.status || 'new'); setUpdating(false); return }
    try {
      if (newStatus === 'hired') {
        // Repair task (2026-09-23): this used to mint a token into localStorage('nova_employee_
        // accounts') — a per-browser, non-Supabase, itself-insecure scheme that only ever worked
        // on whichever browser happened to run this code, and emailed a link pointing at it. That
        // whole mechanism is removed, not extended. Real account creation is now the separate,
        // deliberate "Invite to Create Account" action below — marking someone "Hired" here is
        // just a status change; it does not by itself grant any account or access.
        await fetch('/api/notify?action=contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Nova Systems HR', email: 'isaac_0427@icloud.com',
            subject: `${candidate.name} marked Hired — ${candidate.position}`,
            message: `${candidate.name} (${candidate.email}) was marked Hired for ${candidate.position}. Use "Invite to Create Account" on their record in the dashboard to send them real Nova Systems sign-in access.`,
          }),
        })
      } else if (newStatus === 'declined') {
        await fetch('/api/notify?action=contact', {
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
    const ok = await persist({ status: 'interview_scheduled', interviewDate, interviewTime })
    if (!ok) { setUpdating(false); return }
    setShowInterview(false)
    try {
      await fetch('/api/notify?action=contact', {
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

  const saveNotes = async () => {
    const ok = await persist({ adminNotes: notes })
    if (!ok) return
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const c = candidate
  const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

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
            <Detail label="Email" value={c.email && <a href={`mailto:${c.email}`} style={{ color: '#C9A84C' }}>{c.email}</a>} />
            <Detail label="Phone" value={c.phone} />
            <Detail label="Applied" value={date} />
            {(c.portfolioUrl || c.portfolio_url) && <Detail label="Portfolio Link" value={<a href={c.portfolioUrl || c.portfolio_url} target="_blank" rel="noreferrer" style={{ color: GOLD, display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink style={{ width: 12, height: 12 }} /> View Portfolio</a>} />}
            {c.portfolio_file_path && (
              <Detail label="Uploaded File" value={
                <button onClick={handleViewResume} disabled={resumeLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 13 }}>
                  <FileText style={{ width: 12, height: 12 }} /> {resumeLoading ? 'Generating link…' : 'View File (private, opens a 5-minute link)'}
                </button>
              } />
            )}
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

        {/* Hiring workflow: invite -> working agreement. Not for sales positions — those hire through the Sales Team workspace. */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, marginTop: 16 }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Hiring Workflow</p>

          {/* Step: invite */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Mail style={{ width: 13, height: 13, color: candidate.auth_user_id ? '#4ade80' : 'rgba(255,255,255,0.3)' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: candidate.auth_user_id ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                {candidate.auth_user_id ? 'Account Invited — active as soon as they accept' : 'No Account Yet'}
              </p>
            </div>
            {!candidate.auth_user_id && (
              <>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
                  {INVITE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button onClick={handleInvite} disabled={inviting} style={{ width: '100%', padding: '9px 14px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 11, fontWeight: 700, cursor: inviting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {inviting ? 'Sending Invitation…' : 'Invite to Create Account'}
                </button>
                <p style={{ display: 'flex', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 10.5, lineHeight: 1.5, marginTop: 8 }}>
                  <Info style={{ width: 11, height: 11, flexShrink: 0, marginTop: 2 }} />
                  Sends a real Supabase account-invitation email. There is no separate activation step for this role — they gain the access above the moment they accept and set a password.
                </p>
              </>
            )}
            {inviteResult && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{inviteResult}</p>}
          </div>

          {/* Step: working agreement */}
          {candidate.auth_user_id && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileSignature style={{ width: 13, height: 13, color: agreement?.status === 'signed' ? '#4ade80' : 'rgba(255,255,255,0.3)' }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: agreement?.status === 'signed' ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                  {agreement ? (agreement.status === 'signed' ? 'Agreement Signed' : 'Agreement Sent — Awaiting Signature') : 'No Working Agreement'}
                </p>
              </div>
              {!agreement && (
                <button onClick={handleCreateAgreement} disabled={creatingAgreement} style={{ width: '100%', padding: '9px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}40`, borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: creatingAgreement ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {creatingAgreement ? 'Sending…' : 'Send Working Agreement'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
