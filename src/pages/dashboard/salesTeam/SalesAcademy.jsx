import { useState } from 'react'
import { useOrg } from '../../../lib/OrgContext'
import { academy, useLoad, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Loading, GOLD, useNotice } from '../../../components/sales/kit'
import { PolicyBanner } from '../../../components/sales/Training'

export default function SalesAcademy() {
  const { hasPermission } = useOrg()
  const owner = hasPermission('sales.owner')
  const [tab, setTab] = useState('queue')
  const queue = useLoad(() => academy('practical-queue'), [])
  const overview = useLoad(() => academy('admin-overview'), [])
  const certs = useLoad(() => academy('certificates'), [])
  const policy = useLoad(() => academy('policy'), [])
  const programs = useLoad(() => academy('programs-admin'), [])
  const { notice, show } = useNotice()
  const [review, setReview] = useState(null)
  const reloadAll = () => { queue.reload(); overview.reload(); certs.reload(); policy.reload(); programs.reload() }
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reloadAll(); return r }
  const critical = (overview.data || []).filter((e) => e.locked_reason === 'critical_question_review')
  return (
    <Page eyebrow="Sales Team" title="Academy administration" subtitle="Reviewers approve practicals against a rubric and give written feedback. Missed critical questions always get a person's decision. The passing rule is versioned and only the owner can approve it." wide>
      {notice}
      {policy.data && <PolicyBanner policy={policy.data.current} />}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'queue', label: 'Practical reviews', count: queue.data?.length }, { key: 'critical', label: 'Critical-question reviews', count: critical.length }, { key: 'enroll', label: 'All enrollments' }, { key: 'certs', label: 'Certificates' }, ...(owner ? [{ key: 'policy', label: 'Passing policy' }, { key: 'content', label: 'Content approval' }] : [])]} />
      {tab === 'queue' && (queue.loading && !queue.data ? <Loading /> : (queue.data || []).length === 0 ? <Muted>Nothing waiting for review.</Muted> : queue.data.map((s) => (
        <Card key={s.id} title={`${s.learner.name} — ${s.program}`} right={<Badge tone="warn">Attempt {s.attempt_no}</Badge>}>
          <Muted style={{ fontSize: 12, marginBottom: 8 }}>Submitted {dt(s.submitted_at)}</Muted>
          <details><summary style={{ cursor: 'pointer', color: GOLD, fontSize: 12 }}>The brief</summary><p style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{s.prompt}</p></details>
          <p style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, lineHeight: 1.65 }}>{s.response}</p>
          <Btn kind="primary" onClick={() => setReview({ ...s, scores: {}, decision: 'approve', feedback: '' })}>Review</Btn>
        </Card>
      )))}
      {tab === 'critical' && (critical.length === 0 ? <Muted>No critical-question reviews waiting.</Muted> : critical.map((e) => (
        <Card key={e.id} title={`${e.staff.name} — ${e.academy_programs?.title}`}>
          <Muted>A critical question was missed. Talk with the learner, document the conversation, then decide.</Muted>
          {owner ? <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => { const n = window.prompt('Document the conversation and reasoning (required):'); if (n) act(() => academy('critical-review', { body: { enrollment_id: e.id, decision: 'allow_retake', notes: n } }), 'Retake allowed.') }}>Allow retake</Btn>
            <Btn kind="primary" onClick={() => { const n = window.prompt('Document why this learner may proceed (required):'); if (n) act(() => academy('critical-review', { body: { enrollment_id: e.id, decision: 'approve', notes: n } }), 'Approved.') }}>Approve (documented)</Btn>
          </div> : <Muted style={{ marginTop: 8 }}>Only the owner can resolve this.</Muted>}
        </Card>
      )))}
      {tab === 'enroll' && <Card><Table rows={overview.data || []} empty="No enrollments." columns={[{ key: 'n', label: 'Learner', render: (e) => e.staff.name }, { key: 'p', label: 'Program', render: (e) => e.academy_programs?.title }, { key: 's', label: 'Status', render: (e) => <Badge tone={e.status === 'completed' ? 'good' : e.status === 'failed' ? 'bad' : 'muted'}>{label(e.status)}</Badge> }, { key: 'sc', label: 'Best', render: (e) => (e.best_score != null ? `${e.best_score}%` : '—') }, { key: 'l', label: 'Lessons', render: (e) => e.lessons_completed }, { key: 'a', label: '', render: (e) => owner && ['failed', 'in_progress'].includes(e.status) ? <Btn small kind="quiet" onClick={() => { const r = window.prompt('Reason for resetting attempts:'); if (r) act(() => academy('reset-attempts', { body: { enrollment_id: e.id, reason: r } }), 'Attempts reset (history kept).') }}>Reset attempts</Btn> : null }]} /></Card>}
      {tab === 'certs' && <Card><Table rows={certs.data || []} empty="No certificates issued." columns={[{ key: 'h', label: 'Holder' }, { key: 'n', label: 'Number', render: (c) => c.certificate_number }, { key: 'p', label: 'Program', render: (c) => `${c.academy_programs?.title} v${c.program_version}` }, { key: 'at', label: 'Issued', render: (c) => dt(c.issued_at) }, { key: 's', label: 'Status', render: (c) => <Badge tone={c.status === 'valid' ? 'good' : 'bad'}>{c.status}{c.policy_provisional ? ' · provisional' : ''}</Badge> }, { key: 'r', label: '', render: (c) => owner && c.status === 'valid' ? <Btn small kind="danger" onClick={() => { const r = window.prompt('Reason for revoking:'); if (r) act(() => academy('revoke-certificate', { body: { certificate_id: c.id, reason: r } }), 'Revoked.') }}>Revoke</Btn> : null }]} /></Card>}
      {tab === 'policy' && owner && <PolicyEditor data={policy.data} act={act} />}
      {tab === 'content' && owner && (
        <Card title="Program content review">
          <Muted style={{ marginBottom: 10 }}>All program content was authored for Nova and is loaded as <strong>pending owner review</strong>. Read each program in the training screen, then approve it here. Approved content is never overwritten by re-running the content migration.</Muted>
          <Table rows={programs.data || []} columns={[{ key: 'o', label: '#', render: (p) => p.order_index }, { key: 't', label: 'Program', render: (p) => p.title }, { key: 'v', label: 'Version', render: (p) => `v${p.version}` }, { key: 's', label: 'Review', render: (p) => <Badge tone={p.content_review_status === 'approved' ? 'good' : 'warn'}>{p.content_review_status === 'approved' ? `Approved ${dt(p.content_reviewed_at)}` : 'Pending your review'}</Badge> }, { key: 'a', label: '', render: (p) => p.content_review_status !== 'approved' && <Btn small onClick={() => { if (window.confirm(`Approve "${p.title}" content? Confirm you have read it.`)) act(() => academy('approve-content', { body: { program_id: p.id } }), 'Content approved.') }}>Approve content</Btn> }]} />
        </Card>
      )}
      {review && <ReviewModal r={review} onClose={() => setReview(null)} onDone={() => { setReview(null); reloadAll() }} />}
    </Page>
  )
}

function ReviewModal({ r, onClose, onDone }) {
  const [f, setF] = useState({ decision: 'approve', feedback: '', scores: {} })
  const [err, setErr] = useState(null)
  const submit = async () => { const res = await academy('review-practical', { body: { submission_id: r.id, decision: f.decision, feedback: f.feedback, rubric_scores: f.scores } }); if (res.ok) onDone(); else setErr(res.data?.error || 'Could not save.') }
  return (
    <Modal title={`Review — ${r.learner.name}`} onClose={onClose} wide>
      <p style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, maxHeight: '28vh', overflowY: 'auto' }}>{r.response}</p>
      {r.rubric.length === 0 && <Banner tone="warn">This program has no rubric configured, so it cannot be approved.</Banner>}
      {r.rubric.map((c) => <Field key={c.key} label={`${c.label} (1–5)`} hint={c.description}><Select value={f.scores[c.key] || ''} onChange={(e) => setF({ ...f, scores: { ...f.scores, [c.key]: e.target.value ? Number(e.target.value) : undefined } })}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select></Field>)}
      <Field label="Decision"><Select value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })}><option value="approve">Approve (every criterion must be 3+)</option><option value="changes">Request changes</option><option value="reject">Reject</option></Select></Field>
      <Field label="Feedback the learner will see" hint="Be specific and constructive."><Textarea rows={4} value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} /></Field>
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind="primary" onClick={submit}>Save review</Btn>
    </Modal>
  )
}

function PolicyEditor({ data, act }) {
  const cur = data?.current
  const [f, setF] = useState({ pass_threshold_pct: cur?.pass_threshold_pct ?? 80, max_attempts: cur?.max_attempts ?? 3, cooldown_hours: cur?.cooldown_hours ?? 0, practical_max_attempts: cur?.practical_max_attempts ?? 3, change_note: '' })
  return (
    <>
      <Card title="Propose a new passing policy">
        <Muted style={{ marginBottom: 10 }}>The 80% figure carried over from the original brief was a <strong>proposal, never approved</strong>. Set what you want, save it as a new version, then approve that version. Attempts already taken keep the policy that graded them.</Muted>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <Field label="Pass mark (%)"><Input type="number" min="50" max="100" value={f.pass_threshold_pct} onChange={(e) => setF({ ...f, pass_threshold_pct: e.target.value })} /></Field>
          <Field label="Quiz attempts"><Input type="number" min="1" max="20" value={f.max_attempts} onChange={(e) => setF({ ...f, max_attempts: e.target.value })} /></Field>
          <Field label="Hours between attempts"><Input type="number" min="0" max="168" value={f.cooldown_hours} onChange={(e) => setF({ ...f, cooldown_hours: e.target.value })} /></Field>
          <Field label="Practical attempts"><Input type="number" min="1" max="10" value={f.practical_max_attempts} onChange={(e) => setF({ ...f, practical_max_attempts: e.target.value })} /></Field>
        </div>
        <Field label="Note"><Input value={f.change_note} onChange={(e) => setF({ ...f, change_note: e.target.value })} /></Field>
        <Btn kind="primary" onClick={() => act(() => academy('save-policy', { body: f }), 'Saved as a pending version.')}>Save as new version</Btn>
      </Card>
      <Card title="Versions"><Table rows={(data?.versions || []).map((v) => ({ ...v, id: v.id }))} columns={[{ key: 'v', label: 'Version', render: (v) => `v${v.version}` }, { key: 's', label: 'Status', render: (v) => <Badge tone={v.status === 'approved' ? 'good' : v.status === 'pending_approval' ? 'warn' : 'muted'}>{label(v.status)}</Badge> }, { key: 'val', label: 'Rule', render: (v) => `${v.value.pass_threshold_pct}% · ${v.value.max_attempts} attempts · ${v.value.cooldown_hours}h wait` }, { key: 'n', label: 'Note', render: (v) => v.change_note || '' }, { key: 'a', label: '', render: (v) => v.status !== 'approved' && v.status !== 'retired' && <Btn small onClick={() => { if (window.confirm(`Approve v${v.version} as the passing policy?`)) act(() => academy('approve-policy', { body: { config_id: v.id } }), 'Approved.') }}>Approve</Btn> }]} /></Card>
    </>
  )
}
