import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { academy, download, useLoad, dt, label } from '../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Textarea, Loading, Tabs, GOLD, FAINT, LINE, GOOD, BAD, useNotice } from './kit'

const TONE = { not_started: 'muted', in_progress: 'gold', quiz_passed: 'gold', awaiting_practical_review: 'warn', completed: 'good', failed: 'bad' }
const STATUS_TEXT = { not_started: 'Not started', in_progress: 'In progress', quiz_passed: 'Quiz passed — practical needed', awaiting_practical_review: 'With a reviewer', completed: 'Completed', failed: 'Locked — Nova will review' }

export function PolicyBanner({ policy }) {
  if (!policy) return null
  return (
    <Banner tone={policy.provisional ? 'warn' : 'good'}>
      {policy.provisional
        ? <><strong>Provisional passing rule:</strong> {policy.pass_threshold_pct}% to pass and {policy.max_attempts} attempts per program. Nova's owner has not approved this rule yet, so results and certificates are labelled provisional and the rule may change.</>
        : <>Passing rule (approved v{policy.version}): {policy.pass_threshold_pct}% to pass · {policy.max_attempts} attempts per program{policy.cooldown_hours ? ` · ${policy.cooldown_hours}h between attempts` : ''}. Any missed critical question is reviewed by a person.</>}
    </Banner>
  )
}

export function TrainingList({ basePath }) {
  const { data, loading, error } = useLoad(() => academy('programs'), [])
  if (loading && !data) return <Loading />
  const programs = data?.programs || []
  const done = programs.filter((p) => p.enrollment?.status === 'completed').length
  return (
    <Page eyebrow="Training" title="Nova Sales Academy" subtitle={`Ten programs on how Nova sells: diagnosis first, honest claims, respect for people's "no". ${programs.length ? `${done} of ${programs.length} completed.` : ''} Completing training never activates your account — Nova does that separately.`}>
      {error && <Banner tone="bad">{error}</Banner>}
      <PolicyBanner policy={data?.policy} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {programs.map((p) => {
          const e = p.enrollment; const st = e?.status || 'not_started'
          return (
            <Link key={p.id} to={`${basePath}/${p.id}`} style={{ textDecoration: 'none', color: '#fff' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>PROGRAM {p.order_index}</span><Badge tone={TONE[st]}>{STATUS_TEXT[st]}</Badge></div>
                <h3 style={{ margin: '8px 0 6px', fontSize: 17 }}>{p.title}</h3>
                <p style={{ color: FAINT, fontSize: 13, lineHeight: 1.55, margin: '0 0 10px' }}>{p.description}</p>
                <p style={{ color: FAINT, fontSize: 12, margin: 0 }}>{p.lesson_count} lessons · {p.quiz_question_count} quiz questions · {p.exercise_count} exercises{p.requires_practical ? ' · reviewed practical' : ''}{p.critical_compliance ? ' · critical questions' : ''}</p>
                {e && <p style={{ color: FAINT, fontSize: 12, margin: '6px 0 0' }}>Lessons {e.lessons_completed}/{p.lesson_count}{e.best_score != null ? ` · best score ${e.best_score}%` : ''}</p>}
                {p.content_review_status !== 'approved' && <p style={{ color: '#fbbf24', fontSize: 11.5, margin: '8px 0 0' }}>Content awaiting Nova's owner review</p>}
              </div>
            </Link>
          )
        })}
      </div>
    </Page>
  )
}

export function TrainingProgram({ backPath }) {
  const { id } = useParams()
  const { data, loading, error, reload } = useLoad(() => academy('program-detail', { query: { id } }), [id])
  const [tab, setTab] = useState('lessons')
  const [openLesson, setOpenLesson] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const { notice, show } = useNotice()
  const [practical, setPractical] = useState('')
  const [exText, setExText] = useState({})
  if (loading && !data) return <Loading />
  if (error && !data) return <Page title="Program"><Banner tone="bad">{error}</Banner><Link to={backPath} style={{ color: GOLD }}>← Back</Link></Page>
  const { program: pg, lessons, quiz_questions: qs, exercises, enrollment: en, quiz, practicals, policy } = data
  const current = openLesson ?? data.resume_lesson ?? 1
  const lesson = lessons.find((l) => l.order_index === current) || lessons[0]
  const completeLesson = async (l) => { const r = await academy('complete-lesson', { body: { program_id: id, lesson_order: l.order_index } }); show(r); if (r.ok) { reload(); const next = lessons.find((x) => x.order_index === l.order_index + 1); if (next) setOpenLesson(next.order_index); else setTab('quiz') } }
  const submitExercise = async (ex) => { const r = await academy('submit-exercise', { body: { exercise_id: ex.id, response: exText[ex.id] || '' } }); show(r, 'Saved. Compare your answer with the model answer below.'); if (r.ok) reload() }
  const submitQuiz = async () => {
    setBusy(true); const r = await academy('submit-quiz', { body: { program_id: id, answers: qs.map((q) => ({ question_order: q.order_index, choice_index: answers[q.order_index] })) } }); setBusy(false)
    show(r.ok ? null : r); if (r.ok) { setResult(r.data); setAnswers({}); reload() }
  }
  const submitPractical = async () => { const r = await academy('submit-practical', { body: { program_id: id, response: practical } }); show(r, 'Submitted for review.'); if (r.ok) { setPractical(''); reload() } }
  const getCert = async () => { const r = await academy('issue-certificate', { body: { program_id: id } }); show(r, 'Certificate issued.'); if (r.ok) reload(); return r }
  const cert = data.certificate
  const allAnswered = qs.length > 0 && qs.every((q) => Number.isInteger(answers[q.order_index]))
  const needsLessons = quiz.gate && !quiz.gate.allowed && quiz.gate.reason === 'lessons_incomplete'
  return (
    <Page eyebrow={<Link to={backPath} style={{ color: GOLD, textDecoration: 'none' }}>← All programs</Link>} title={pg.title} subtitle={pg.description}
      actions={<Badge tone={TONE[en.status]}>{STATUS_TEXT[en.status]}</Badge>}>
      {notice}
      {pg.content_review_status !== 'approved' && <Banner tone="warn">This program's content is awaiting review by Nova's owner. You can complete it, but it may be revised.</Banner>}
      <PolicyBanner policy={policy} />
      {pg.learning_objectives?.length > 0 && <Card title="What you will be able to do"><ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{pg.learning_objectives.map((o) => <li key={o}>{o}</li>)}</ul></Card>}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'lessons', label: 'Lessons', count: `${en.lessons_completed}/${lessons.length}` }, { key: 'exercises', label: 'Exercises' }, { key: 'quiz', label: 'Quiz' }, ...(pg.requires_practical ? [{ key: 'practical', label: 'Practical' }] : []), { key: 'certificate', label: 'Certificate' }]} />

      {tab === 'lessons' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 250px) 1fr', gap: 18 }} className="lesson-grid">
          <div>{lessons.map((l) => <button key={l.id} disabled={l.locked} onClick={() => setOpenLesson(l.order_index)} style={{ display: 'block', width: '100%', textAlign: 'left', background: lesson.id === l.id ? `${GOLD}18` : 'transparent', border: `1px solid ${lesson.id === l.id ? GOLD + '55' : LINE}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, color: l.locked ? FAINT : '#fff', cursor: l.locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>{l.completed ? '✓ ' : l.locked ? '🔒 ' : ''}{l.order_index}. {l.title}</button>)}</div>
          <Card title={`Lesson ${lesson.order_index}: ${lesson.title}`}>
            {lesson.objectives?.length > 0 && <div style={{ marginBottom: 14 }}><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Objectives</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>}
            {lesson.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ lineHeight: 1.75, fontSize: 14.5, whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>{para}</p>)}
            {!lesson.completed ? <Btn kind="primary" onClick={() => completeLesson(lesson)}>Mark lesson complete</Btn> : <Badge tone="good">Completed</Badge>}
          </Card>
        </div>
      )}

      {tab === 'exercises' && (exercises.length === 0 ? <Muted>No exercises for this program.</Muted> : exercises.map((ex) => (
        <Card key={ex.id} title={ex.title} right={ex.lesson_order && <Muted style={{ fontSize: 12 }}>Lesson {ex.lesson_order}</Muted>}>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{ex.prompt}</p>
          {ex.submitted ? (
            <>
              <Field label="Your answer"><div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{ex.response}</div></Field>
              {ex.self_check?.length > 0 && <div style={{ marginBottom: 10 }}><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Self-check</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{ex.self_check.map((s) => <li key={s}>{s}</li>)}</ul></div>}
              {ex.model_answer && <div><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>One good answer</strong><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{ex.model_answer}</p></div>}
            </>
          ) : (
            <><Field label="Your answer" hint="Write your own attempt first — a model answer and a self-check appear after you submit."><Textarea rows={5} value={exText[ex.id] || ''} onChange={(e) => setExText({ ...exText, [ex.id]: e.target.value })} /></Field><Btn kind="primary" onClick={() => submitExercise(ex)} disabled={(exText[ex.id] || '').length < 20}>Submit my answer</Btn></>
          )}
        </Card>
      )))}

      {tab === 'quiz' && (
        <>
          <Card title="Quiz status">
            <p style={{ margin: 0 }}>Attempts used {quiz.attempts_used} · left {quiz.attempts_left}{quiz.best_score != null ? ` · best score ${quiz.best_score}%` : ''}</p>
            {quiz.gate && !quiz.gate.allowed && <Banner tone="warn">{quiz.gate.message}</Banner>}
            {en.locked_reason === 'critical_question_review' && <Banner tone="warn">You missed a critical question. A reviewer will look at it and talk with you. This is not a punishment — it makes sure the essentials are understood.</Banner>}
          </Card>
          {result && (
            <Card title="Your result" tone={result.passed ? undefined : 'warn'}>
              <p style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: result.passed ? GOOD : BAD }}>{result.score}% — {result.passed ? 'Passed' : 'Not passed'}</p>
              <Muted>{result.correct_count} of {result.total_questions} correct · pass mark {result.threshold}%{result.policy_provisional ? ' (provisional rule)' : ''}. {result.next_step}</Muted>
              {result.critical_failed && <Banner tone="warn">A critical question was missed — a person must review this result.</Banner>}
              <div style={{ marginTop: 12 }}>{result.questions.map((q) => <div key={q.order} style={{ padding: '8px 0', borderBottom: `1px solid ${LINE}` }}><span style={{ color: q.correct ? GOOD : BAD }}>{q.correct ? '✓' : '✗'}</span> Question {q.order}{q.critical ? ' (critical)' : ''}{!q.correct && q.explanation && <div style={{ color: FAINT, fontSize: 13, marginTop: 3 }}>{q.explanation}</div>}</div>)}</div>
            </Card>
          )}
          {needsLessons ? <Banner tone="warn">Finish every lesson to unlock the quiz.</Banner> : quiz.gate?.allowed && (
            <Card title={`Quiz — ${qs.length} questions`}>
              {qs.map((q) => (
                <fieldset key={q.id} style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
                  <legend style={{ fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>{q.order_index}. {q.question}</legend>
                  {q.choices.map((c, i) => <label key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', cursor: 'pointer', lineHeight: 1.5 }}><input type="radio" name={`q${q.order_index}`} checked={answers[q.order_index] === i} onChange={() => setAnswers({ ...answers, [q.order_index]: i })} style={{ accentColor: GOLD, marginTop: 4 }} /><span>{c}</span></label>)}
                </fieldset>
              ))}
              <Btn kind="primary" onClick={submitQuiz} disabled={!allAnswered || busy}>{busy ? 'Grading…' : 'Submit quiz'}</Btn>
              <Muted style={{ marginTop: 8, fontSize: 12 }}>Answer every question. Your score is decided by Nova's server — it cannot be changed from your browser.</Muted>
            </Card>
          )}
        </>
      )}

      {tab === 'practical' && pg.requires_practical && (
        <>
          <Card title="Practical assessment"><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{pg.practical_prompt}</p>
            {pg.practical_rubric?.length > 0 && <><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>How it is reviewed</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{pg.practical_rubric.map((r) => <li key={r.key}><strong>{r.label}</strong> — {r.description}</li>)}</ul></>}
          </Card>
          {en.status === 'quiz_passed' ? <Card title="Submit your practical"><Textarea rows={10} value={practical} onChange={(e) => setPractical(e.target.value)} placeholder="Write your report here (at least 200 characters)" /><div style={{ marginTop: 10 }}><Btn kind="primary" onClick={submitPractical} disabled={practical.length < 200}>Submit for review</Btn></div></Card>
            : en.status === 'awaiting_practical_review' ? <Banner tone="warn">Your practical is with a reviewer.</Banner> : en.status !== 'completed' && <Banner tone="warn">Pass the quiz first, then submit your practical.</Banner>}
          {practicals.map((p) => <Card key={p.id} title={`Attempt ${p.attempt_no} — ${label(p.status)}`}><Muted style={{ fontSize: 12 }}>Submitted {dt(p.submitted_at)}{p.reviewed_at ? ` · reviewed ${dt(p.reviewed_at)}` : ''}</Muted>{p.feedback && <Banner tone={p.status === 'approved' ? 'good' : 'warn'}><strong>Reviewer feedback:</strong> {p.feedback}</Banner>}</Card>)}
        </>
      )}

      {tab === 'certificate' && (
        <Card title="Certificate">
          {cert ? <><p>Certificate <strong>{cert.certificate_number}</strong> — {cert.status}{cert.policy_provisional ? ' (issued under a provisional passing rule)' : ''}.</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Btn onClick={() => download(`/api/academy?action=certificate-pdf&id=${cert.id}`, `${cert.certificate_number}.pdf`)}>Download PDF</Btn><a href={`/verify-certificate?code=${cert.verification_code}`} style={{ color: GOLD, alignSelf: 'center' }}>Public verification page</a></div></>
            : en.status === 'completed' ? <><Muted style={{ marginBottom: 10 }}>You have completed everything this program requires.</Muted><Btn kind="primary" onClick={getCert}>Get my certificate</Btn></> : <Muted>A certificate is available only after every requirement is complete: all lessons, a passing quiz{pg.requires_practical ? ', and an approved practical' : ''}. It is a Nova-issued internal training certificate, not an accredited credential.</Muted>}
        </Card>
      )}
    </Page>
  )
}
