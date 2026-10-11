import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useLoad, dt, money, label } from '../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Loading, Tabs, GOLD, FAINT, GOOD, useNotice } from '../../components/sales/kit'
import { StageBadge } from './RepLeads'

const KINDS = [['call', 'Call'], ['email', 'Email'], ['sms', 'Text'], ['message', 'Message / DM'], ['in_person', 'In person'], ['note', 'Note'], ['task', 'Task'], ['reminder', 'Reminder']]
const MILESTONES = [['rep_reported_close_at', 'Rep reported close'], ['signed_agreement_at', 'Client signed'], ['invoice_issued_at', 'Payment requested'], ['payment_received_at', 'Payment received'], ['owner_verified_at', 'Owner verified sale'], ['fulfillment_started_at', 'Fulfillment started']]

export default function RepLeadDetail() {
  const { id } = useParams()
  const lead = useLoad(() => api('leads', 'get', { method: 'GET', query: { id } }), [id])
  const meta = useLoad(() => api('leads', 'meta', { method: 'GET' }), [])
  const prop = useLoad(() => api('proposals', 'for-deal', { method: 'GET', query: { deal_id: id } }), [id])
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const { notice, show } = useNotice()
  if (lead.loading && !lead.data) return <Loading />
  if (lead.error && !lead.data) return <Page title="Lead"><Banner tone="bad">{lead.error}</Banner><Link to="/rep/leads" style={{ color: GOLD }}>← Back to leads</Link></Page>
  const { deal, business, contact, activities, stage_history: history } = lead.data
  const reload = () => { lead.reload(); prop.reload() }
  const closed = ['won', 'lost'].includes(deal.stage)
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); return r }
  return (
    <Page eyebrow={<Link to="/rep/leads" style={{ color: GOLD, textDecoration: 'none' }}>← My leads</Link>} title={business?.name || 'Lead'} wide
      subtitle={<>{contact?.name}{contact?.title ? `, ${contact.title}` : ''} · {contact?.phone || contact?.email || 'no contact details'} {contact?.do_not_contact && <Badge tone="bad">Do not contact</Badge>}</>}
      actions={<><StageBadge stage={deal.stage} />{!closed && <Btn onClick={() => setModal('move')}>Move stage</Btn>}{!closed && <Btn kind="quiet" onClick={() => setModal('log')} disabled={contact?.do_not_contact}>Log activity</Btn>}</>}>
      {notice}
      {contact?.do_not_contact && <Banner tone="bad">This contact asked not to be contacted. Do not reach out again. Only the owner can clear this flag.</Banner>}
      <Card title="How this deal stands">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {MILESTONES.map(([k, l]) => <div key={k}><div style={{ color: FAINT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div><div style={{ color: deal[k] ? GOOD : FAINT, fontWeight: 700, fontSize: 13, marginTop: 3 }}>{deal[k] ? dt(deal[k]) : 'Not yet'}</div></div>)}
        </div>
        <Muted style={{ marginTop: 10, fontSize: 12 }}>These are five different facts, each recorded by its own step. A rep-reported close is not a verified sale; a signature is not a payment; a payment is not fulfillment.</Muted>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'proposal', label: 'Proposal & closing' }, { key: 'history', label: 'History', count: activities.length }]} />

      {tab === 'overview' && (
        <>
          <Card title="Next action" right={!closed && <Btn small onClick={() => setModal('next')}>Set</Btn>}>
            {deal.next_action ? <p style={{ margin: 0 }}>{deal.next_action} <span style={{ color: FAINT }}>— {dt(deal.next_action_at)}</span></p> : <Muted>{closed ? 'This lead is closed.' : 'No next action. Every open lead needs one, with a date.'}</Muted>}
          </Card>
          {deal.qualification?.summary && <Card title="Qualification"><p style={{ margin: 0 }}>{deal.qualification.summary}</p><Muted style={{ marginTop: 6 }}>Spoke with decision maker: {deal.qualification.decision_maker}</Muted></Card>}
          {deal.discovery_at && <Card title="Discovery conversation"><p style={{ margin: 0 }}>{dt(deal.discovery_at)}</p></Card>}
          {deal.discovery?.findings && <Card title="Discovery notes">{Object.entries(deal.discovery).filter(([, v]) => v).map(([k, v]) => <p key={k} style={{ margin: '0 0 8px' }}><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label(k)}</strong><br />{v}</p>)}</Card>}
          {deal.stage === 'lost' && <Card title="Lost"><p style={{ margin: 0 }}>{label(deal.lost_reason_code)} — {deal.lost_reason}</p></Card>}
          <Card title="Contact & business" right={<div style={{ display: 'flex', gap: 8 }}><Btn small kind="quiet" onClick={() => setModal('contact')}>Edit contact</Btn>{!contact?.do_not_contact && <Btn small kind="danger" onClick={() => setModal('dnc')}>Mark do-not-contact</Btn>}</div>}>
            <p style={{ margin: 0 }}>{business?.name} {business?.website && <a href={business.website} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{business.website}</a>}</p>
            <Muted>{[business?.city, business?.state, business?.phone].filter(Boolean).join(' · ')}</Muted>
            <Muted style={{ marginTop: 8 }}>Consent: text {contact?.sms_consent ? 'recorded' : 'not recorded'} · email {contact?.email_consent ? 'recorded' : 'not recorded'}. Consent can only come from the contact — you cannot change it.</Muted>
          </Card>
        </>
      )}

      {tab === 'proposal' && <ProposalPanel dealId={id} deal={deal} data={prop.data} error={prop.error} reload={reload} act={act} />}

      {tab === 'history' && (
        <>
          <Card title="Activity">
            <Table rows={activities} empty="Nothing logged yet." columns={[
              { key: 'when', label: 'When', render: (a) => dt(a.occurred_at || a.created_at) }, { key: 'kind', label: 'Type', render: (a) => label(a.kind) },
              { key: 'body', label: 'What happened', render: (a) => <>{a.body}{a.outcome && <div style={{ color: FAINT, fontSize: 12 }}>Outcome: {label(a.outcome)}</div>}</> },
              { key: 'done', label: '', render: (a) => ['task', 'reminder'].includes(a.kind) && !a.done_at ? <Btn small kind="quiet" onClick={() => act(() => api('leads', 'complete-task', { body: { id: a.id } }), 'Marked done.')}>Done</Btn> : a.done_at ? <Badge tone="good">Done</Badge> : null },
            ]} />
          </Card>
          <Card title="Stage history"><Table rows={history} empty="—" columns={[{ key: 'at', label: 'When', render: (h) => dt(h.created_at) }, { key: 'to', label: 'Moved', render: (h) => <>{h.from_stage ? `${label(h.from_stage)} → ` : ''}<strong>{label(h.to_stage)}</strong></> }, { key: 'by', label: 'By', render: (h) => label(h.actor_kind) }, { key: 'why', label: 'Note', render: (h) => h.reason || '' }]} /></Card>
        </>
      )}

      {modal === 'move' && <MoveModal deal={deal} meta={meta.data} onClose={() => setModal(null)} onDone={() => { setModal(null); reload() }} />}
      {modal === 'log' && <LogModal dealId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); reload() }} />}
      {modal === 'next' && <NextModal dealId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); reload() }} />}
      {modal === 'contact' && <ContactModal dealId={id} contact={contact} onClose={() => setModal(null)} onDone={() => { setModal(null); reload() }} />}
      {modal === 'dnc' && (
        <Modal title="Mark do-not-contact" onClose={() => setModal(null)}>
          <Muted style={{ marginBottom: 12 }}>This stops all outreach immediately and closes the lead. Only the owner can undo it, with the contact's written permission.</Muted>
          <DncForm onSubmit={async (note) => { const r = await api('leads', 'mark-dnc', { body: { deal_id: id, note } }); show(r, 'Marked. The lead is closed.'); if (r.ok) { setModal(null); reload() } }} />
        </Modal>
      )}
    </Page>
  )
}

function DncForm({ onSubmit }) { const [n, setN] = useState(''); return <><Field label="What did they say?"><Textarea rows={3} value={n} onChange={(e) => setN(e.target.value)} /></Field><Btn kind="danger" onClick={() => onSubmit(n)}>Mark do-not-contact</Btn></> }

function MoveModal({ deal, meta, onClose, onDone }) {
  const stages = (meta?.stages || []).map((s) => s.key)
  const fwd = { new: ['contacted'], contacted: ['qualified'], qualified: ['discovery_scheduled', 'contacted'], discovery_scheduled: ['discovery_completed', 'qualified'], discovery_completed: ['discovery_scheduled'], proposal: ['discovery_completed'], awaiting_signature_payment: ['proposal'], lost: ['contacted'] }[deal.stage] || []
  const options = [...fwd, ...(['submitted_for_verification', 'won', 'lost'].includes(deal.stage) ? [] : ['lost'])].filter((s) => stages.includes(s))
  const [to, setTo] = useState(options[0] || '')
  const [f, setF] = useState({ reason: '', summary: '', decision_maker: 'unknown', discovery_at: '', lost_reason_code: 'no_response', d: {} })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const submit = async () => {
    setBusy(true); setErr(null)
    const body = { deal_id: deal.id, to, reason: f.reason }
    if (to === 'qualified') body.qualification = { summary: f.summary, decision_maker: f.decision_maker }
    if (to === 'discovery_scheduled') body.discovery_at = f.discovery_at ? new Date(f.discovery_at).toISOString() : ''
    if (to === 'discovery_completed') body.discovery = f.d
    if (to === 'lost') body.lost_reason_code = f.lost_reason_code
    const r = await api('leads', 'move', { body }); setBusy(false)
    if (r.ok) onDone(); else setErr(r.data?.error || 'Could not move.')
  }
  const dk = meta?.discovery_fields || []
  return (
    <Modal title="Move stage" onClose={onClose} wide>
      {options.length === 0 ? <Muted>This lead cannot be moved by hand from "{label(deal.stage)}". Later stages are reached through their own steps (creating and sending a proposal, submitting for verification, or Nova's verification).</Muted> : (
        <>
          <Field label="Move to"><Select value={to} onChange={(e) => setTo(e.target.value)}>{options.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
          {to === 'contacted' && deal.stage === 'new' && <Muted style={{ marginBottom: 12 }}>You must have logged at least one real outreach attempt (call, email, text, message or visit).</Muted>}
          {to === 'qualified' && <><Field label="Qualification summary" hint="Who they are and why they may benefit from a look — in your own words."><Textarea rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field><Field label="Have you spoken with the decision maker?"><Select value={f.decision_maker} onChange={(e) => setF({ ...f, decision_maker: e.target.value })}><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></Select></Field></>}
          {to === 'discovery_scheduled' && deal.stage !== 'discovery_completed' && <Field label="Discovery conversation date and time"><Input type="datetime-local" value={f.discovery_at} onChange={(e) => setF({ ...f, discovery_at: e.target.value })} /></Field>}
          {to === 'discovery_completed' && <>{dk.map((k) => <Field key={k} label={label(k)}><Textarea rows={2} value={f.d[k] || ''} onChange={(e) => setF({ ...f, d: { ...f.d, [k]: e.target.value } })} /></Field>)}<Field label="Your findings" hint="What you learned, in your own words. Separate what they said from what you observed."><Textarea rows={3} value={f.d.findings || ''} onChange={(e) => setF({ ...f, d: { ...f.d, findings: e.target.value } })} /></Field></>}
          {to === 'lost' && <Field label="Reason"><Select value={f.lost_reason_code} onChange={(e) => setF({ ...f, lost_reason_code: e.target.value })}>{(meta?.lost_reasons || []).map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select></Field>}
          {(to === 'lost' || deal.stage === 'lost' || ['discovery_scheduled', 'qualified', 'contacted'].includes(to) && stages.indexOf(to) < stages.indexOf(deal.stage)) && <Field label="Note" hint="What happened (required)."><Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
          {err && <Banner tone="bad">{err}</Banner>}
          <Btn kind="primary" onClick={submit} disabled={busy || !to}>{busy ? 'Saving…' : 'Move'}</Btn>
        </>
      )}
    </Modal>
  )
}

function LogModal({ dealId, onClose, onDone }) {
  const [f, setF] = useState({ kind: 'call', body: '', outcome: '', due_at: '', next_action: '', next_action_at: '' })
  const meta = useLoad(() => api('leads', 'meta', { method: 'GET' }), [])
  const [err, setErr] = useState(null)
  const submit = async () => {
    const body = { deal_id: dealId, kind: f.kind, body: f.body, outcome: f.outcome || undefined }
    if (['task', 'reminder'].includes(f.kind)) body.due_at = f.due_at ? new Date(f.due_at).toISOString() : ''
    if (f.next_action) { body.next_action = f.next_action; body.next_action_at = f.next_action_at ? new Date(f.next_action_at).toISOString() : '' }
    const r = await api('leads', 'log-activity', { body }); if (r.ok) onDone(); else setErr(r.data?.error || 'Could not save.')
  }
  return (
    <Modal title="Log activity" onClose={onClose}>
      <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="What happened" hint="Facts only: what was said, what you observed."><Textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      {['call', 'email', 'sms', 'message', 'in_person'].includes(f.kind) && <Field label="Outcome"><Select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}><option value="">—</option>{(meta.data?.outcomes || []).map((o) => <option key={o} value={o}>{label(o)}</option>)}</Select></Field>}
      {['task', 'reminder'].includes(f.kind) && <Field label="Due"><Input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></Field>}
      <Field label="Next step (optional)"><Input value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} placeholder="e.g. Send confirmation email" /></Field>
      {f.next_action && <Field label="When"><Input type="datetime-local" value={f.next_action_at} onChange={(e) => setF({ ...f, next_action_at: e.target.value })} /></Field>}
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind="primary" onClick={submit}>Save</Btn>
    </Modal>
  )
}

function NextModal({ dealId, onClose, onDone }) {
  const [f, setF] = useState({ next_action: '', next_action_at: '' }); const [err, setErr] = useState(null)
  const submit = async () => { const r = await api('leads', 'set-next-action', { body: { deal_id: dealId, next_action: f.next_action, next_action_at: f.next_action_at ? new Date(f.next_action_at).toISOString() : '' } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return <Modal title="Next action" onClose={onClose}><Field label="What"><Input value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} /></Field><Field label="When"><Input type="datetime-local" value={f.next_action_at} onChange={(e) => setF({ ...f, next_action_at: e.target.value })} /></Field>{err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={submit}>Save</Btn></Modal>
}

function ContactModal({ dealId, contact, onClose, onDone }) {
  const [f, setF] = useState({ name: contact?.name || '', email: contact?.email || '', phone: contact?.phone || '', title: contact?.title || '' }); const [err, setErr] = useState(null)
  const submit = async () => { const r = await api('leads', 'update-contact', { body: { deal_id: dealId, ...f } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return <Modal title="Edit contact" onClose={onClose}>{['name', 'email', 'phone', 'title'].map((k) => <Field key={k} label={label(k)}><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}<Muted style={{ marginBottom: 10, fontSize: 12 }}>Consent flags cannot be changed here.</Muted>{err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={submit}>Save</Btn></Modal>
}

function ProposalPanel({ dealId, deal, data, error, reload, act }) {
  const products = useLoad(() => api('catalog', 'products', { method: 'GET' }), [])
  const [editing, setEditing] = useState(null)
  const [devLink, setDevLink] = useState(null)
  const [evidence, setEvidence] = useState('')
  if (!data) return error ? <Banner tone="bad">{error}</Banner> : <Loading />
  const { proposals, payments, verifications, payments_provider_ready: provider } = data
  const latest = proposals[0]
  const canDraft = ['discovery_completed', 'proposal'].includes(deal.stage) && (!latest || !['draft', 'sent', 'viewed', 'signed', 'accepted'].includes(latest.status) || latest.status === 'draft')
  const send = async (p) => { const r = await act(() => api('proposals', 'send', { body: { proposal_id: p.id } }), 'Proposal sent.'); if (r.ok && r.data.dev_link) setDevLink(r.data.dev_link) }
  return (
    <>
      {devLink && <Banner tone="warn" onClose={() => setDevLink(null)}><strong>Email is not live, so nothing was emailed.</strong> Only you can see this personal link: <code style={{ wordBreak: 'break-all' }}>{devLink}</code></Banner>}
      {!latest && !canDraft && <Card><Muted>Complete discovery before writing a proposal.</Muted></Card>}
      {canDraft && !editing && <Card><Btn kind="primary" onClick={() => setEditing({ items: [], scope_summary: '', title: '', discount_cents: '', discount_reason: '' })}>{latest?.status === 'draft' ? 'New version' : 'Write a proposal'}</Btn></Card>}
      {editing && <ProposalEditor dealId={dealId} draft={editing} products={products.data?.products || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      {proposals.map((p) => (
        <Card key={p.id} title={`Version ${p.version} — ${label(p.status)}`} right={<Badge tone={p.status === 'signed' || p.status === 'accepted' ? 'good' : p.status === 'draft' ? 'muted' : 'gold'}>{label(p.status)}</Badge>}>
          <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>{p.scope?.summary}</p>
          <Table rows={p.line_items} columns={[{ key: 'name', label: 'Offering', render: (l) => <>{l.name}{l.label && <> <Badge tone="warn">{l.label}</Badge></>}</> }, { key: 'quantity', label: 'Qty' }, { key: 'unit', label: 'Unit', right: true, render: (l) => l.unit_price_cents == null ? <Badge tone="warn">Needs owner price</Badge> : money(l.unit_price_cents) }]} />
          <p style={{ textAlign: 'right', margin: '10px 0 0' }}>{p.discount_cents > 0 && <span style={{ color: FAINT }}>Discount −{money(p.discount_cents)} ({label(p.discount_status)}) · </span>}<strong>Total {money(p.total_cents)}</strong></p>
          {p.blockers?.length > 0 && <Banner tone="warn">{p.blockers.join(' ')}</Banner>}
          <Muted style={{ fontSize: 12, marginTop: 6 }}>{p.sent_at ? `Sent ${dt(p.sent_at)}` : 'Not sent'}{p.viewed_at ? ` · viewed ${dt(p.viewed_at)}` : ''}{p.signed_at ? ` · signed by ${p.signer_name} ${dt(p.signed_at)}` : ''}{p.declined_at ? ` · declined ${dt(p.declined_at)}` : ''}</Muted>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {p.status === 'draft' && <Btn onClick={() => setEditing({ id: p.id, items: p.line_items.map((l) => ({ product_id: l.product_id, quantity: l.quantity })), scope_summary: p.scope?.summary || '', title: p.title || '', discount_cents: p.discount_cents || '', discount_reason: p.discount_reason || '' })}>Edit</Btn>}
            {p.status === 'draft' && <Btn kind="primary" disabled={p.blockers?.length > 0} onClick={() => send(p)}>Send to client</Btn>}
            {['sent', 'viewed'].includes(p.status) && <Btn kind="quiet" onClick={() => act(() => api('proposals', 'resend-link', { body: { proposal_id: p.id } }).then((r) => { if (r.ok && r.data.dev_link) setDevLink(r.data.dev_link); return r }), 'New link issued.')}>Re-send link</Btn>}
            {['sent', 'viewed'].includes(p.status) && <Btn kind="danger" onClick={() => { const reason = window.prompt('Why are you recalling this proposal?'); if (reason) act(() => api('proposals', 'recall', { body: { proposal_id: p.id, reason } }), 'Recalled.') }}>Recall</Btn>}
          </div>
        </Card>
      ))}
      <Card title="Payment">
        {payments.length === 0 ? <Muted>No payment has been requested yet. The client can pay after signing{provider ? '' : ' — online payment is not enabled, so Nova will arrange payment with them'}.</Muted> : <Table rows={payments} columns={[{ key: 'amount', label: 'Amount', render: (p) => money(p.amount_cents, p.currency) }, { key: 'status', label: 'Status', render: (p) => <Badge tone={p.status === 'paid' ? 'good' : 'muted'}>{label(p.status)}</Badge> }, { key: 'c', label: 'Confirmation', render: (p) => p.confirmation }, { key: 'at', label: 'Paid', render: (p) => dt(p.paid_at) }]} />}
        <Muted style={{ marginTop: 8, fontSize: 12 }}>You cannot mark a payment as received. It becomes "paid" only when the payment provider confirms it, or when Nova's owner records evidence.</Muted>
      </Card>
      {deal.stage === 'awaiting_signature_payment' && (
        <Card title="Report the sale closed">
          <Muted style={{ marginBottom: 10 }}>This is your <strong>report</strong> of a close. Nova verifies it before it counts as a sale.{latest?.status === 'signed' ? '' : ' The client has not signed through Nova, so describe exactly what evidence you have (how they agreed, when, where the signed document is).'}</Muted>
          <Textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="What happened, and what evidence exists" />
          <div style={{ marginTop: 10 }}><Btn kind="primary" disabled={evidence.length < 10} onClick={() => act(() => api('proposals', 'submit-for-verification', { body: { deal_id: dealId, evidence } }), 'Submitted for verification.')}>Submit for verification</Btn></div>
        </Card>
      )}
      {verifications.length > 0 && <Card title="Verification"><Table rows={verifications} columns={[{ key: 'at', label: 'Submitted', render: (v) => dt(v.submitted_at) }, { key: 's', label: 'Status', render: (v) => <Badge tone={v.status === 'approved' ? 'good' : v.status === 'rejected' ? 'bad' : 'warn'}>{label(v.status)}</Badge> }, { key: 'k', label: 'Evidence', render: (v) => label(v.evidence_kind) }, { key: 'n', label: 'Owner notes', render: (v) => v.review_notes || '' }]} /></Card>}
    </>
  )
}

function ProposalEditor({ dealId, draft, products, onClose, onSaved }) {
  const [f, setF] = useState({ ...draft, discount_cents: draft.discount_cents ? String(draft.discount_cents / 100) : '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const sellable = products.filter((p) => p.can_propose)
  const blocked = products.filter((p) => !p.can_propose)
  const toggle = (id) => setF((x) => ({ ...x, items: x.items.some((i) => i.product_id === id) ? x.items.filter((i) => i.product_id !== id) : [...x.items, { product_id: id, quantity: 1 }] }))
  const qty = (id, v) => setF((x) => ({ ...x, items: x.items.map((i) => (i.product_id === id ? { ...i, quantity: Math.max(1, Math.min(100, Number(v) || 1)) } : i)) }))
  const save = async () => {
    setBusy(true); setErr(null)
    const body = { deal_id: dealId, items: f.items, scope_summary: f.scope_summary, title: f.title, discount_cents: f.discount_cents ? Math.round(Number(f.discount_cents) * 100) : 0, discount_reason: f.discount_reason }
    if (f.id) body.proposal_id = f.id
    const r = await api('proposals', f.id ? 'update-draft' : 'create', { body }); setBusy(false)
    if (r.ok) onSaved(); else setErr(r.data?.error || 'Could not save.')
  }
  return (
    <Card title={f.id ? 'Edit proposal' : 'New proposal'}>
      <Field label="Title (optional)"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Offerings" hint="Only offerings that are Available for Sale (or an approved pilot) can be proposed. Prices come from the approved catalog — you cannot change them.">
        {sellable.length === 0 && <Muted>No offering is currently available to propose.</Muted>}
        {sellable.map((p) => { const it = f.items.find((i) => i.product_id === p.id); return (
          <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', flexWrap: 'wrap' }}>
            <input type="checkbox" checked={!!it} onChange={() => toggle(p.id)} aria-label={`Include ${p.name}`} style={{ accentColor: GOLD }} />
            <span style={{ flex: '1 1 200px' }}>{p.name} <span style={{ color: FAINT }}>— {p.price ? `${money(p.price.unit_price_cents)} ${p.price.billing === 'monthly' ? '/ month' : ''}` : 'needs owner price'}</span> {p.readiness === 'pilot_approved' && <Badge tone="warn">Pilot</Badge>}</span>
            {it && <Input type="number" min="1" max="100" value={it.quantity} onChange={(e) => qty(p.id, e.target.value)} style={{ width: 80 }} aria-label={`Quantity for ${p.name}`} />}
          </div>) })}
        {blocked.length > 0 && <Muted style={{ fontSize: 12, marginTop: 6 }}>Not available to propose: {blocked.map((p) => `${p.name} (${p.readiness_label})`).join(', ')}. Ask your manager if a client needs one — the owner can approve a custom scope for a single deal.</Muted>}
      </Field>
      <Field label="Scope, in your own words" hint="What will be done, based on what you learned in discovery. Do not promise results or state figures — the system rejects them."><Textarea rows={5} value={f.scope_summary} onChange={(e) => setF({ ...f, scope_summary: e.target.value })} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
        <Field label="Discount request ($)" hint="Owner approval needed"><Input type="number" min="0" step="0.01" value={f.discount_cents} onChange={(e) => setF({ ...f, discount_cents: e.target.value })} /></Field>
        <Field label="Reason for the discount"><Input value={f.discount_reason} onChange={(e) => setF({ ...f, discount_reason: e.target.value })} disabled={!f.discount_cents} /></Field>
      </div>
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind="primary" onClick={save} disabled={busy || !f.items.length}>{busy ? 'Saving…' : 'Save draft'}</Btn> <Btn kind="quiet" onClick={onClose}>Cancel</Btn>
    </Card>
  )
}
