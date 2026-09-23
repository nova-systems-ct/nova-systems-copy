import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const STATUS_LABEL = {
  not_started: 'Not Started', in_progress: 'In Progress', quiz_passed: 'Quiz Passed',
  awaiting_practical_review: 'Awaiting Review', completed: 'Completed', failed: 'Needs Retake',
}

// Admin oversight for Nova Sales Academy — [admin.view] only. Shows every rep's real enrollment
// state and lets an admin approve/reject a practical assessment. No enrollment data is faked or
// cached locally; every load hits api/academy.js's admin-overview action fresh.
export default function AcademyAdmin() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notesById, setNotesById] = useState({})
  const [acting, setActing] = useState(null)

  const load = () => {
    setLoading(true)
    authedFetch('/api/academy?action=admin-overview')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setRows(Array.isArray(data) ? data : []); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const review = async (enrollment_id, approved) => {
    setActing(enrollment_id)
    try {
      await authedFetch('/api/academy?action=practical-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id, approved, notes: notesById[enrollment_id] || '' }),
      })
      load()
    } catch {}
    setActing(null)
  }

  const pending = rows.filter((r) => r.status === 'awaiting_practical_review')
  const others = rows.filter((r) => r.status !== 'awaiting_practical_review')

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <button onClick={() => navigate('/dashboard/academy')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Academy
      </button>

      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
      <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 28 }}>Sales Academy — All Enrollments</h1>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>Couldn't load Academy enrollment data.</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No one has enrolled in any Academy program yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Awaiting Practical Review ({pending.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map((r) => (
              <div key={r.id} style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{r.staff?.name || 'Unknown rep'}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{r.academy_programs?.title} · best score {r.best_score != null ? `${r.best_score}%` : '—'}</p>
                  </div>
                </div>
                <textarea
                  placeholder="Review notes (optional)…" value={notesById[r.id] || ''}
                  onChange={(e) => setNotesById((n) => ({ ...n, [r.id]: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => review(r.id, true)} disabled={acting === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 7, color: '#4ade80', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Check style={{ width: 13, height: 13 }} /> Approve
                  </button>
                  <button onClick={() => review(r.id, false)} disabled={acting === r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <X style={{ width: 13, height: 13 }} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'auto' }}>
          <div style={{ minWidth: 700, display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Rep', 'Program', 'Status', 'Best Score'].map((h) => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {others.map((r) => (
            <div key={r.id} style={{ minWidth: 700, display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr', padding: '13px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ color: '#fff', fontSize: 13 }}>{r.staff?.name || 'Unknown rep'}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.academy_programs?.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{STATUS_LABEL[r.status] || r.status}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{r.best_score != null ? `${r.best_score}%` : '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
