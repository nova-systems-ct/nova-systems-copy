import { useState } from 'react'
import { useOrg } from '../../../lib/OrgContext'
import { api, useLoad, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Loading, GOLD, FAINT, useNotice } from '../../../components/sales/kit'

const TONE = { submitted: 'gold', under_review: 'gold', interview_requested: 'warn', changes_requested: 'warn', accepted: 'good', rejected: 'bad', withdrawn: 'muted' }
const INV_TONE = { sent: 'gold', delivered: 'good', accepted: 'good', queued: 'warn', failed: 'bad', bounced: 'bad', expired: 'bad', revoked: 'muted', none: 'muted' }

export default function Hiring() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const { data, loading, error, reload } = useLoad(() => api('hiring', 'list', { method: 'GET', query: { status, q } }), [status, q])
  return (
    <Page eyebrow="Sales Team" title="Hiring" subtitle="Applications are private. Reviewer notes and scores are never shown to applicants. Only the owner can accept or reject, and only the owner can send an invitation." wide>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 240px', maxWidth: 340 }}><Input placeholder="Search name, email or reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search applications" /></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }} aria-label="Filter by status"><option value="">All submitted</option>{['submitted', 'under_review', 'interview_requested', 'changes_requested', 'accepted', 'rejected', 'withdrawn'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
      </div>
      {error && <Banner tone="bad">{error}</Banner>}
      {loading && !data ? <Loading /> : (
        <Card><Table rows={data || []} onRow={(r) => setOpenId(r.id)} empty="No applications match." columns={[
          { key: 'name', label: 'Applicant', render: (r) => <><strong>{r.name || r.email}</strong><div style={{ color: FAINT, fontSize: 12 }}>{r.email}</div></> }, { key: 'ref', label: 'Reference', render: (r) => r.reference_code },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.stage_label}</Badge> }, { key: 'rev', label: 'Reviewer', render: (r) => r.reviewer_name || <span style={{ color: FAINT }}>Unassigned</span> },
          { key: 'ev', label: 'Assessments', render: (r) => `${r.evaluation_count}${r.latest_recommendation ? ` · ${r.latest_recommendation}` : ''}` }, { key: 'inv', label: 'Invitation', render: (r) => <Badge tone={INV_TONE[r.invitation_state]}>{label(r.invitation_state)}</Badge> },
          { key: 'at', label: 'Submitted', render: (r) => dt(r.submitted_at) },
        ]} /></Card>
      )}
      {openId && <Detail id={openId} onClose={() => { setOpenId(null); reload() }} />}
    </Page>
  )
}

function Detail({ id, onClose }) {
  const { hasPermission } = useOrg()
  const owner = hasPermission('sales.owner')
  const { data, loading, error, reload } = useLoad(() => api('hiring', 'get', { method: 'GET', query: { id } }), [id])
  const people = useLoad(() => api('salesteam', 'people', { method: 'GET' }), [])
  const [tab, setTab] = useState('application')
  const [form, setForm] = useState(null)
  const [devLink, setDevLink] = useState(null)
  const { notice, show } = useNotice()
  if (loading && !data) return <Modal title="Application" onClose={onClose} wide><Loading /></Modal>
  if (error && !data) return <Modal title="Application" onClose={onClose}><Banner tone="bad">{error}</Banner></Modal>
  const { application: app, evaluations, events, change_requests: crs, invitations, criteria, versions } = data
  const p = app.sales_profile || {}
  const run = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) { reload(); setForm(null); if (r.data?.dev_link) setDevLink(r.data.dev_link) } return r }
  const resume = async () => { const r = await api('hiring', 'resume-url', { method: 'POST', body: { id } }); if (r.ok) window.open(r.data.url, '_blank', 'noopener'); else show(r) }
  const invite = invitations[0]
  const canInvite = owner && app.status === 'accepted' && (!invite || ['expired', 'failed', 'bounced', 'revoked'].includes(invite.status))
  return (
    <Modal title={`${app.name || app.email} — ${app.reference_code}`} onClose={onClose} wide>
      {notice}
      {devLink && <Banner tone="warn" onClose={() => setDevLink(null)}><strong>Email is not live, so nothing was emailed.</strong> Only you can see this one-time link: <code style={{ wordBreak: 'break-all' }}>{devLink}</code></Banner>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}><Badge tone={TONE[app.status]}>{app.stage_label}</Badge><Muted>Reviewer: {data.assigned_reviewer_name || 'unassigned'}</Muted></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'application', label: 'Application' }, { key: 'assess', label: 'Assessments', count: evaluations.length }, { key: 'history', label: 'History' }, { key: 'invite', label: 'Decision & invitation' }]} />
      {tab === 'application' && (
        <>
          <Card title="Contact"><p style={{ margin: 0 }}>{p.name || app.name} · {p.phone || app.phone} · {app.email} · {p.city} · {p.timezone}</p></Card>
          <Card title="Availability"><p style={{ margin: 0 }}>{p.hours_per_week} h/week · {(p.availability_days || []).join(', ')} · {p.preferred_hours} {p.availability_notes}</p></Card>
          <Card title="Experience"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.experience}</p><Muted style={{ marginTop: 8 }}>Channels: {(p.channels || []).map(label).join(', ')}</Muted></Card>
          <Card title="Motivation"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.motivation}</p></Card>
          <Card title="Scenario answers"><p style={{ whiteSpace: 'pre-wrap' }}><strong style={{ color: GOLD }}>No data yet:</strong> {p.scenario_no_data}</p><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}><strong style={{ color: GOLD }}>Existing website:</strong> {p.scenario_objection}</p></Card>
          <Card title="Acknowledgements"><Muted>Privacy notice {app.privacy_notice_version || '—'} acknowledged {dt(app.privacy_ack_at)} · resubmissions {app.resubmission_count || 0}</Muted></Card>
          {app.portfolio_file_path && <Btn onClick={resume}>Open résumé (audited, 5-minute link)</Btn>}
          {versions?.length > 1 && <Muted style={{ marginTop: 10, fontSize: 12 }}>{versions.length} versions are kept; the original submission is preserved.</Muted>}
        </>
      )}
      {tab === 'assess' && (
        <>
          <Card title="Assign reviewer"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Select defaultValue={app.assigned_reviewer_id || ''} onChange={(e) => run(() => api('hiring', 'assign', { body: { id, reviewer_id: e.target.value } }), 'Reviewer assigned.')} style={{ maxWidth: 320 }}><option value="">Unassigned</option>{(people.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></div></Card>
          {evaluations.map((e) => <Card key={e.id} title={`${label(e.kind)} — ${e.reviewer_name}`} right={<Muted style={{ fontSize: 12 }}>{dt(e.created_at)}</Muted>}><p style={{ margin: '0 0 6px' }}>{Object.entries(e.scores || {}).map(([k, v]) => `${label(k)} ${v}/5`).join(' · ')}{e.recommendation && <> · <Badge tone={e.recommendation === 'advance' ? 'good' : e.recommendation === 'reject' ? 'bad' : 'warn'}>{e.recommendation}</Badge></>}</p><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{e.notes}</p></Card>)}
          {['submitted', 'under_review', 'interview_requested'].includes(app.status) && <Btn kind="primary" onClick={() => setForm({ type: 'evaluate', kind: 'review', scores: {}, recommendation: 'advance', notes: '' })}>Record an assessment</Btn>}
          {['submitted', 'under_review', 'interview_requested'].includes(app.status) && <> <Btn onClick={() => setForm({ type: 'changes', message: '', fields: '' })}>Request changes</Btn> <Btn onClick={() => setForm({ type: 'interview', message: '' })}>Request interview / practical</Btn></>}
          {form?.type === 'evaluate' && (
            <Card title="New assessment" style={{ marginTop: 14 }}>
              <Field label="Type"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="review">Application review</option><option value="interview">Interview</option><option value="practical">Practical</option></Select></Field>
              {criteria.map((c) => <Field key={c} label={`${label(c)} (1–5)`}><Select value={form.scores[c] || ''} onChange={(e) => setForm({ ...form, scores: { ...form.scores, [c]: e.target.value ? Number(e.target.value) : undefined } })}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select></Field>)}
              <Field label="Recommendation"><Select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })}><option value="advance">Advance</option><option value="hold">Hold</option><option value="reject">Reject</option></Select></Field>
              <Field label="Private notes"><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Btn kind="primary" onClick={() => run(() => api('hiring', 'evaluate', { body: { id, kind: form.kind, scores: form.scores, recommendation: form.recommendation, notes: form.notes } }), 'Assessment saved.')}>Save assessment</Btn>
            </Card>
          )}
          {(form?.type === 'changes' || form?.type === 'interview') && (
            <Card title={form.type === 'changes' ? 'Request changes' : 'Request interview / practical'} style={{ marginTop: 14 }}>
              <Field label="Message the applicant will see" hint="Reviewer notes are never shown — only this message."><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
              {form.type === 'changes' && <Field label="Fields to update (optional, comma separated)"><Input value={form.fields} onChange={(e) => setForm({ ...form, fields: e.target.value })} /></Field>}
              <Btn kind="primary" onClick={() => run(() => api('hiring', form.type === 'changes' ? 'request-changes' : 'request-interview', { body: { id, message: form.message, fields: form.type === 'changes' ? form.fields.split(',').map((x) => x.trim()).filter(Boolean) : undefined } }), 'Sent to the applicant.')}>Send</Btn>
            </Card>
          )}
          {crs.length > 0 && <Card title="Change requests" style={{ marginTop: 14 }}>{crs.map((c) => <p key={c.id} style={{ margin: '0 0 6px' }}><Badge tone={c.status === 'open' ? 'warn' : 'good'}>{c.status}</Badge> {c.message}</p>)}</Card>}
        </>
      )}
      {tab === 'history' && <Card><Table rows={events} columns={[{ key: 'at', label: 'When', render: (e) => dt(e.at) }, { key: 'actor', label: 'By', render: (e) => label(e.actor_kind) }, { key: 'ev', label: 'Event', render: (e) => label(e.event_type) }, { key: 'to', label: 'Status', render: (e) => (e.to_status ? label(e.to_status) : '') }]} /></Card>}
      {tab === 'invite' && (
        <>
          <Card title="Decision">
            {app.decided_at ? <Banner tone={app.status === 'accepted' ? 'good' : 'warn'}>{label(app.status)} on {dt(app.decided_at)}. Reason: {app.decision_reason}</Banner> : <Muted>{owner ? 'Only you can accept or reject. A written reason is required.' : 'Only the owner can accept or reject.'}</Muted>}
            {owner && !['accepted', 'rejected', 'withdrawn', 'draft'].includes(app.status) && <div style={{ marginTop: 10 }}><Btn kind="primary" onClick={() => setForm({ type: 'decide', decision: 'accept', reason: '', applicant_message: '' })}>Decide…</Btn></div>}
            {form?.type === 'decide' && (
              <div style={{ marginTop: 12 }}>
                <Field label="Decision"><Select value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}><option value="accept">Accept</option><option value="reject">Reject</option></Select></Field>
                <Field label="Reason (recorded, not shown to the applicant)"><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
                <Field label="Message to the applicant (optional)"><Textarea rows={3} value={form.applicant_message} onChange={(e) => setForm({ ...form, applicant_message: e.target.value })} /></Field>
                <Btn kind={form.decision === 'accept' ? 'primary' : 'danger'} onClick={() => run(() => api('hiring', 'decide', { body: { id, decision: form.decision, reason: form.reason, applicant_message: form.applicant_message } }), 'Decision recorded.')}>Record {form.decision}</Btn>
              </div>
            )}
          </Card>
          <Card title="Secure invitation" right={invite && <Badge tone={INV_TONE[invite.status]}>{label(invite.status)}</Badge>}>
            {invite ? <Muted>Created {dt(invite.created_at)} · expires {dt(invite.expires_at)}{invite.accepted_at ? ` · accepted ${dt(invite.accepted_at)}` : ''}{invite.delivery_error ? ` · ${invite.delivery_error}` : ''}</Muted> : <Muted>No invitation yet.</Muted>}
            {invite && ['failed', 'bounced'].includes(invite.status) && <Banner tone="bad">Email delivery failed. You can resend, or share a fresh link through another route.</Banner>}
            {owner && app.status === 'accepted' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {canInvite && <Btn kind="primary" onClick={() => run(() => api('hiring', 'invite', { body: { id } }), 'Invitation created.')}>Create invitation</Btn>}
                {invite && !['accepted', 'revoked'].includes(invite.status) && <Btn onClick={() => run(() => api('hiring', 'resend-invite', { body: { id } }), 'New invitation created; the old one no longer works.')}>Resend (replaces old link)</Btn>}
                {invite && ['queued', 'sent', 'delivered'].includes(invite.status) && <Btn kind="danger" onClick={() => run(() => api('hiring', 'revoke-invite', { body: { id } }), 'Revoked.')}>Revoke</Btn>}
              </div>
            )}
            <Muted style={{ marginTop: 10, fontSize: 12 }}>The link itself is never stored — only a hash. Accepting it creates a candidate account (training only), never a representative account.</Muted>
          </Card>
        </>
      )}
    </Modal>
  )
}
