import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, CheckCircle2, Clock, Lock, ShieldAlert, Award } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

const STATUS_CFG = {
  not_started:              { label: 'Not Started',   color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)', icon: Clock },
  in_progress:              { label: 'In Progress',   color: GOLD,                     bg: `${GOLD}12`,               icon: Clock },
  quiz_passed:              { label: 'Quiz Passed',   color: '#60a5fa',                bg: 'rgba(96,165,250,0.1)',    icon: CheckCircle2 },
  awaiting_practical_review:{ label: 'Awaiting Review', color: '#a78bfa',              bg: 'rgba(167,139,250,0.1)',   icon: ShieldAlert },
  completed:                { label: 'Completed',     color: '#4ade80',                bg: 'rgba(34,197,94,0.1)',     icon: CheckCircle2 },
  failed:                   { label: 'Needs Retake',  color: '#f87171',                bg: 'rgba(239,68,68,0.08)',    icon: Lock },
}

// Nova Sales Academy — self-service program list. Built against the canonical Supabase Auth /
// organization_members identity (api/academy.js's requireStaff()), not the separate,
// already-flagged applicant-portal localStorage scheme. Any authenticated staff member with the
// academy.view permission can reach this page and self-enroll; enrollment/progress/quiz
// grading/certificate eligibility all live server-side, verified fresh on every load — nothing
// here is trusted from a local cache.
export default function Academy() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [enrolling, setEnrolling] = useState(null)

  const load = () => {
    setLoading(true)
    authedFetch('/api/academy?action=programs')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setPrograms(Array.isArray(data) ? data : []); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const startProgram = async (program) => {
    if (!program.enrollment) {
      setEnrolling(program.id)
      try {
        await authedFetch('/api/academy?action=enroll', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: program.id }),
        })
      } catch {}
      setEnrolling(null)
    }
    navigate(`/dashboard/academy/${program.id}`)
  }

  const completedCount = programs.filter((p) => p.enrollment?.status === 'completed').length

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Nova Sales Academy</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
            Ten programs covering how Nova actually sells — from fundamentals through ethics and commission rules.
            {programs.length > 0 && ` ${completedCount} of ${programs.length} completed.`}
          </p>
        </div>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${GOLD}12`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap style={{ width: 24, height: 24, color: GOLD }} />
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>Couldn't load the Academy — the academy_* tables migration may not be applied to the database yet.</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : programs.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No programs found yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {programs.map((p) => {
            const status = p.enrollment?.status || 'not_started'
            const cfg = STATUS_CFG[status] || STATUS_CFG.not_started
            const Icon = cfg.icon
            return (
              <button
                key={p.id}
                onClick={() => startProgram(p)}
                disabled={enrolling === p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', textAlign: 'left',
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
                  cursor: enrolling === p.id ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${GOLD}12`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: GOLD, fontSize: 13, fontWeight: 800 }}>
                  {p.order_index}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{p.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{p.description}</p>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 6 }}>
                    {p.lesson_count} lesson{p.lesson_count !== 1 ? 's' : ''} · {p.quiz_question_count} quiz questions
                    {p.requires_practical && ' · practical review required'}
                    {p.critical_compliance && ' · critical compliance'}
                  </p>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Icon style={{ width: 12, height: 12 }} /> {enrolling === p.id ? 'Enrolling…' : cfg.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 28, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6 }}>
          A passing quiz score is currently set at 80% — a proposed default, not yet formally approved as final. Certificates are Nova-issued internal credentials, not independent third-party accreditation, and completing training does not by itself guarantee work, classification, or a commission rate.
        </p>
      </div>
    </div>
  )
}
