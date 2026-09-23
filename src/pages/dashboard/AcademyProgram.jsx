import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Download, ShieldAlert, AlertTriangle } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { generateCertificatePDF } from '../../utils/generatePdf'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 28 }

// One program's lesson viewer + quiz + certificate flow. All grading and eligibility checks
// happen server-side (api/academy.js) — this page never computes a score or decides pass/fail
// itself, it only renders what the server returns.
export default function AcademyProgram() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [view, setView] = useState('lessons') // 'lessons' | 'quiz' | 'result'
  const [lessonIdx, setLessonIdx] = useState(0)
  const [savingLesson, setSavingLesson] = useState(false)
  const [answers, setAnswers] = useState({}) // { [question_order]: choice_index }
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [quizResult, setQuizResult] = useState(null)
  const [issuingCert, setIssuingCert] = useState(false)
  const [certError, setCertError] = useState('')

  const load = () => {
    authedFetch(`/api/academy?action=program-detail&id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setData(d); setError(false) })
      .catch(() => setError(true))
  }
  useEffect(load, [id])

  if (error) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <p style={{ color: '#f87171', fontSize: 14 }}>Couldn't load this program.</p>
        <button onClick={() => navigate('/dashboard/academy')} style={{ marginTop: 16, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← Back to Academy</button>
      </div>
    )
  }
  if (!data) return null

  const { program, lessons, quiz_questions, enrollment } = data
  const status = enrollment?.status || 'not_started'
  const currentLesson = lessons[lessonIdx];
  const allLessonsSeen = (enrollment?.lessons_completed || 0) >= lessons.length;

  const markLessonComplete = async () => {
    setSavingLesson(true)
    try {
      const r = await authedFetch('/api/academy?action=complete-lesson', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id, lesson_order: lessonIdx + 1 }),
      })
      if (r.ok) {
        const d = await r.json()
        setData((prev) => ({ ...prev, enrollment: d.enrollment }))
      }
    } catch {}
    setSavingLesson(false)
    if (lessonIdx < lessons.length - 1) setLessonIdx(lessonIdx + 1)
    else setView('quiz')
  }

  const submitQuiz = async () => {
    const answerList = quiz_questions.map((q) => ({ question_order: q.order_index, choice_index: answers[q.order_index] }))
    if (answerList.some((a) => a.choice_index === undefined)) return
    setSubmittingQuiz(true)
    try {
      const r = await authedFetch('/api/academy?action=submit-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id, answers: answerList }),
      })
      const d = await r.json()
      if (r.ok) {
        setQuizResult(d)
        setData((prev) => ({ ...prev, enrollment: d.enrollment }))
        setView('result')
      }
    } catch {}
    setSubmittingQuiz(false)
  }

  const getCertificate = async () => {
    setIssuingCert(true)
    setCertError('')
    try {
      const r = await authedFetch('/api/academy?action=issue-certificate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id }),
      })
      const d = await r.json()
      if (!r.ok) { setCertError(d.error || 'Could not issue certificate.'); setIssuingCert(false); return }
      const doc = generateCertificatePDF({
        holderName: d.holder_name, programTitle: program.title,
        certificateNumber: d.certificate.certificate_number,
        verificationCode: d.certificate.verification_code,
        issuedAt: d.certificate.issued_at,
      })
      doc.save(`Nova-Academy-${program.slug}-Certificate.pdf`)
    } catch (e) {
      setCertError('Could not issue certificate: ' + e.message)
    }
    setIssuingCert(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 820 }}>
      <button onClick={() => navigate('/dashboard/academy')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> All Programs
      </button>

      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Program {program.order_index}</p>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24 }}>{program.title}</h1>

      {status === 'completed' && (
        <div style={{ ...CARD, marginBottom: 20, borderColor: 'rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 style={{ width: 20, height: 20, color: '#4ade80' }} />
            <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>Program completed{enrollment?.best_score != null ? ` — best score ${enrollment.best_score}%` : ''}</p>
          </div>
          <button onClick={getCertificate} disabled={issuingCert} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: issuingCert ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            <Download style={{ width: 13, height: 13 }} /> {issuingCert ? 'Generating…' : 'Download Certificate'}
          </button>
        </div>
      )}
      {certError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>{certError}</p>}

      {status === 'awaiting_practical_review' && (
        <div style={{ ...CARD, marginBottom: 20, borderColor: 'rgba(167,139,250,0.3)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ShieldAlert style={{ width: 18, height: 18, color: '#a78bfa', flexShrink: 0, marginTop: 2 }} />
          <p style={{ color: '#a78bfa', fontSize: 13, lineHeight: 1.6 }}>
            {program.requires_practical
              ? "You've passed the quiz. This program also requires a practical assessment — a manager will review and approve it before the program is marked complete."
              : 'A critical compliance question was missed on your last attempt. A manager will review this before the program can be marked complete.'}
          </p>
        </div>
      )}

      {view === 'lessons' && currentLesson && (
        <div style={CARD}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Lesson {lessonIdx + 1} of {lessons.length}
          </p>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{currentLesson.title}</h2>

          {currentLesson.objectives?.length > 0 && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 8 }}>
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Learning Objectives</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {currentLesson.objectives.map((o, i) => (
                  <li key={i} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.7 }}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{currentLesson.body}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setLessonIdx(Math.max(0, lessonIdx - 1))}
              disabled={lessonIdx === 0}
              style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: lessonIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: lessonIdx === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              Previous
            </button>
            <button
              onClick={markLessonComplete}
              disabled={savingLesson}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: savingLesson ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              {lessonIdx < lessons.length - 1 ? 'Mark Complete & Continue' : 'Finish Lessons — Go to Quiz'} <ArrowRight style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>
      )}

      {view === 'lessons' && allLessonsSeen && lessonIdx === lessons.length - 1 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => setView('quiz')} style={{ color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            Already reviewed the lessons? Jump to the quiz →
          </button>
        </div>
      )}

      {view === 'quiz' && (
        <div style={CARD}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 18 }}>
            Program Quiz — {quiz_questions.length} Questions
          </p>
          {program.critical_compliance && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              <AlertTriangle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: '#f87171', fontSize: 12, lineHeight: 1.6 }}>This program includes critical compliance questions. Missing one sends this attempt to manual review regardless of your overall score.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {quiz_questions.map((q, qi) => (
              <div key={q.id}>
                <p style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, marginBottom: 12, lineHeight: 1.6 }}>{qi + 1}. {q.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {q.choices.map((choice, ci) => (
                    <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: answers[q.order_index] === ci ? `${GOLD}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${answers[q.order_index] === ci ? GOLD + '50' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer' }}>
                      <input
                        type="radio" name={`q-${q.order_index}`} checked={answers[q.order_index] === ci}
                        onChange={() => setAnswers((a) => ({ ...a, [q.order_index]: ci }))}
                        style={{ accentColor: GOLD }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{choice}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={submitQuiz}
            disabled={submittingQuiz || quiz_questions.some((q) => answers[q.order_index] === undefined)}
            style={{ marginTop: 28, width: '100%', padding: 14, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: quiz_questions.some((q) => answers[q.order_index] === undefined) ? 0.5 : 1 }}
          >
            {submittingQuiz ? 'Grading…' : 'Submit Quiz'}
          </button>
        </div>
      )}

      {view === 'result' && quizResult && (
        <div style={CARD}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <p style={{ color: quizResult.passed && !quizResult.critical_failed ? '#4ade80' : '#f87171', fontSize: 32, fontWeight: 900 }}>{quizResult.score}%</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{quizResult.correct_count} of {quizResult.total_questions} correct — threshold {quizResult.threshold}%</p>
          </div>
          {quizResult.critical_failed ? (
            <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>A critical compliance question was missed. This attempt has been sent for manual review.</p>
          ) : quizResult.passed ? (
            <p style={{ color: '#4ade80', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
              {program.requires_practical ? 'Quiz passed! This program also requires a practical assessment before it can be marked complete.' : 'Quiz passed — this program is now complete.'}
            </p>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>Below the passing threshold. You can review the lessons and try again.</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
            {!quizResult.passed && !quizResult.critical_failed && (
              <button onClick={() => { setView('lessons'); setLessonIdx(0); setAnswers({}); setQuizResult(null) }} style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${GOLD}50`, borderRadius: 8, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Review Lessons & Retake
              </button>
            )}
            <button onClick={() => navigate('/dashboard/academy')} style={{ padding: '10px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Back to Academy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
