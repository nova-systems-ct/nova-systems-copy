import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { api, useLoad, C, Card, Field, Loading, ErrorBox, Empty, Badge, TestBadge, PageHeader, money, when, useAction, Notice } from './ui'

export default function OpsJobDetail() {
  const { orgId, business } = useOutletContext()
  const { id } = useParams()
  const d = useLoad(() => api('job', { org: orgId, query: { id } }), [orgId, id])
  const act = useAction()
  const job = d.data?.job
  const doAct = (action, body = {}, ok) => act.run(() => api('job-action', { org: orgId, method: 'POST', body: { action, job_id: id, ...body } }), ok).then((r) => { d.reload(); return r })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />
  const { contact, conversation, messages, bookings, agreements, deposits, followups, transitions } = d.data
  const booking = bookings[0]; const agreement = agreements.find((a) => a.status !== 'void'); const deposit = deposits[0]
  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link to="/dashboard/ops/requests" style={{ color: C.gold, fontSize: 13 }}>← Requests</Link></p>
      <PageHeader title={<>{contact?.name || 'Customer'} {job.is_test && <TestBadge />}</>} sub={`${contact?.phone_e164 || 'no phone'} · via ${job.source_channel} · created ${when(job.created_at)}`} />
      {act.view}
      <div className="ops-grid" style={{ marginBottom: 16 }}>
        {[['Request', job.state], ['Appointment', booking?.status || 'none'], ['Agreement', agreement?.status || 'none'], ['Deposit', deposit?.status || (job.deposit_cents ? 'not started' : 'not required')], ['Work', job.fulfillment_status]].map(([k, v]) => (
          <Card key={k}><div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>{k}</div><Badge value={v} /></Card>
        ))}
      </div>
      <div className="ops-two">
        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="Terms on this request">
            {job.price_snapshot ? (
              <table className="ops-table"><tbody>
                <tr><td>Service</td><td>{job.price_snapshot.service_name}{job.price_snapshot.owner_quote ? ' (owner quote)' : ` (price v${job.price_snapshot.version})`}</td></tr>
                <tr><td>Total</td><td>{money(job.total_cents, job.currency)}</td></tr>
                <tr><td>Deposit</td><td>{money(job.deposit_cents, job.currency)}</td></tr>
                {booking && <tr><td>Time</td><td>{when(booking.start_at)} <Badge value={booking.status} />{booking.status === 'held' && <div style={{ color: C.faint, fontSize: 12 }}>held until {when(booking.hold_expires_at)}</div>}</td></tr>}
                {agreement && <tr><td>Agreement</td><td>v{agreement.template_version} · <Badge value={agreement.status} />{agreement.signed_at && <div style={{ color: C.faint, fontSize: 12 }}>signed by {agreement.signer_name}, {when(agreement.signed_at)}</div>}<div style={{ color: C.faint, fontSize: 11, wordBreak: 'break-all' }}>sha256 {agreement.content_sha256}</div></td></tr>}
                {deposit && <tr><td>Deposit status</td><td><Badge value={deposit.status} /> {deposit.livemode ? '' : '(test mode)'}{deposit.paid_at && <div style={{ color: C.faint, fontSize: 12 }}>confirmed by Stripe {when(deposit.paid_at)}</div>}</td></tr>}
              </tbody></table>
            ) : <Empty>Not quoted yet.</Empty>}
          </Card>
          <Actions job={job} booking={booking} agreement={agreement} deposit={deposit} conversation={conversation} doAct={doAct} busy={act.busy} orgId={orgId} canConfigure={business.can_configure} />
          <Card title="Follow-ups">
            {!followups.length ? <Empty>None scheduled. Feedback and referral invitations are scheduled when the work is completed.</Empty> : followups.map((f) => <div key={f.id} style={{ fontSize: 13, padding: '6px 0' }}>{f.kind.replace('_', ' ')} · <Badge value={f.status} />{f.blocked_reason && <span style={{ color: C.faint }}> — {f.blocked_reason.replace(/_/g, ' ')}</span>}</div>)}
          </Card>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Thread messages={messages} conversation={conversation} orgId={orgId} onSent={d.reload} canManage={business.can_manage} />
          <Card title="Timeline (every change, who made it, and why)">
            {!transitions.length ? <Empty>No changes yet.</Empty> : (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {transitions.map((t) => <li key={t.id} style={{ marginBottom: 6 }}><span style={{ color: C.dim }}>{when(t.at)}</span> · {t.entity}: {t.from_state || '—'} → <strong>{t.to_state}</strong> <span style={{ color: C.faint }}>({t.actor_type}{t.reason ? `: ${t.reason}` : ''})</span></li>)}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Actions({ job, booking, agreement, deposit, conversation, doAct, busy, orgId, canConfigure }) {
  const [service, setService] = useState(''); const [reason, setReason] = useState(''); const [notes, setNotes] = useState('')
  const [quote, setQuote] = useState({ total: '', deposit: '', reason: '' }); const [link, setLink] = useState(null)
  const prices = useLoad(() => api('prices', { org: orgId }), [orgId])
  const slots = useLoad(() => (job.price_snapshot?.service_key && !job.price_snapshot.owner_quote ? api('availability', { org: orgId, query: { service_key: job.price_snapshot.service_key, limit: 6 } }) : Promise.resolve(null)), [orgId, job.price_snapshot?.service_key])
  const approved = (prices.data || []).filter((p) => p.status === 'approved')
  const terminal = ['lost', 'cancelled'].includes(job.state)
  return (
    <Card title="Actions">
      {terminal && <Notice tone="warn">This request is {job.state}. No further actions.</Notice>}
      {!terminal && ['new', 'qualifying', 'escalated', 'quoted'].includes(job.state) && (
        <Field label="Quote an approved service" id="q-svc">
          <div style={{ display: 'flex', gap: 8 }}>
            <select id="q-svc" className="ops-select" value={service} onChange={(e) => setService(e.target.value)}><option value="">Choose…</option>{approved.map((p) => <option key={p.id} value={p.service_key}>{p.name} — {p.quote_required ? 'by quote' : `$${(p.price_cents / 100).toFixed(2)}`}</option>)}</select>
            <button className="ops-btn" disabled={busy || !service} onClick={() => doAct('quote', { service_key: service }, 'Quoted from the approved price.')}>Quote</button>
          </div>
        </Field>
      )}
      {!terminal && job.state === 'owner_quote_required' && canConfigure && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Owner quote (binding price — only owners can enter it)</div>
          <div className="ops-two">
            <input aria-label="Total in dollars" className="ops-input" placeholder="Total $" value={quote.total} onChange={(e) => setQuote({ ...quote, total: e.target.value })} inputMode="decimal" />
            <input aria-label="Deposit in dollars" className="ops-input" placeholder="Deposit $" value={quote.deposit} onChange={(e) => setQuote({ ...quote, deposit: e.target.value })} inputMode="decimal" />
          </div>
          <input aria-label="Basis for the quote" className="ops-input" style={{ marginTop: 8 }} placeholder="Basis (what was quoted and why)" value={quote.reason} onChange={(e) => setQuote({ ...quote, reason: e.target.value })} />
          <button className="ops-btn" style={{ marginTop: 8 }} disabled={busy} onClick={() => doAct('owner-quote', { total_cents: Math.round(Number(quote.total) * 100), deposit_cents: Math.round(Number(quote.deposit || 0) * 100), reason: quote.reason }, 'Owner quote recorded.')}>Save quote</button>
        </div>
      )}
      {!terminal && ['quoted', 'booking', 'escalated'].includes(job.state) && job.price_snapshot && (
        <Field label="Hold a time (checks live availability again before holding)" id="slots">
          {slots.loading ? <Loading what="Checking availability" /> : !slots.data?.slots?.length ? <Empty>{slots.data?.reason ? `No times: ${slots.data.reason.replace(/_/g, ' ')}` : 'No open times found.'}</Empty> : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{slots.data.slots.map((s) => <button key={s.start} className="ops-btn" disabled={busy} onClick={() => doAct('hold', { start: s.start }, 'Time held.')}>{new Date(s.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</button>)}</div>
          )}
        </Field>
      )}
      {!terminal && booking?.status === 'held' && (!agreement || agreement.status !== 'signed') && (
        <div style={{ marginBottom: 12 }}>
          <button className="ops-btn primary" disabled={busy} onClick={async () => { const r = await doAct('send-agreement', { text_link: !!conversation }, (x) => `Agreement created${x.delivery ? `; text: ${x.delivery.status.replace(/_/g, ' ')}${x.delivery.reason ? ` (${x.delivery.reason.replace(/_/g, ' ')})` : ''}` : ''}.`); if (r?.link) setLink(r.link) }}>Send agreement{job.deposit_cents ? ' & deposit link' : ''}</button>
          {link && <Notice>Customer link (share only with this customer): <span style={{ wordBreak: 'break-all' }}>{link}</span></Notice>}
        </div>
      )}
      {['ready', 'in_progress'].includes(job.fulfillment_status) && (
        <div style={{ marginBottom: 12 }}>
          {job.fulfillment_status === 'ready' && <button className="ops-btn" disabled={busy} onClick={() => doAct('start', {}, 'Work started.')} style={{ marginRight: 8 }}>Start work</button>}
          <input aria-label="Completion notes" className="ops-input" style={{ margin: '8px 0' }} placeholder="Completion notes (what was done)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="ops-btn primary" disabled={busy} onClick={() => doAct('complete', { notes }, 'Marked completed. Feedback and referral invitations are scheduled (consent permitting).')}>Mark completed</button>
          {job.fulfillment_status === 'ready' && <button className="ops-btn danger" style={{ marginLeft: 8 }} disabled={busy} onClick={() => doAct('no_show', { notes }, 'Recorded as no-show.')}>No-show</button>}
        </div>
      )}
      {!terminal && conversation && (
        <div style={{ marginBottom: 12 }}>
          {conversation.staff_takeover ? <button className="ops-btn" disabled={busy} onClick={() => doAct('resume', {}, 'Automation resumed.')}>Hand back to the assistant</button> : <button className="ops-btn" disabled={busy} onClick={() => doAct('escalate', {}, 'You have taken over; the assistant is paused for this customer.')}>Take over the conversation</button>}
        </div>
      )}
      {!terminal && job.state !== 'confirmed' && (
        <div>
          <input aria-label="Reason" className="ops-input" placeholder="Reason (required to cancel or mark lost)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ops-btn danger" disabled={busy || !reason} onClick={() => doAct('lost', { reason }, 'Marked lost.')}>Mark lost</button>
            <button className="ops-btn danger" disabled={busy || !reason} onClick={() => doAct('cancel', { reason }, (x) => x.note || 'Cancelled.')}>Cancel request</button>
          </div>
        </div>
      )}
      {deposit?.status === 'paid' && <p style={{ color: C.faint, fontSize: 12 }}>Refunds are issued in Stripe; the refund event updates this record automatically.</p>}
    </Card>
  )
}

function Thread({ messages, conversation, orgId, onSent, canManage }) {
  const [text, setText] = useState(''); const act = useAction()
  const send = async (e) => {
    e.preventDefault()
    const r = await act.run(() => api('conversation-reply', { org: orgId, method: 'POST', body: { conversation_id: conversation.id, body: text, client_id: `${Date.now()}` } }), (x) => `Reply ${x.status.replace(/_/g, ' ')}${x.reason ? `: ${x.reason.replace(/_/g, ' ')}` : ''}. The assistant is paused for this customer.`)
    if (r) { setText(''); onSent() }
  }
  return (
    <Card title={`Conversation${conversation?.staff_takeover ? ' — staff has taken over' : ''}`}>
      {!messages.length ? <Empty>No messages.</Empty> : (
        <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ justifySelf: m.direction === 'inbound' ? 'start' : 'end', maxWidth: '85%', background: m.direction === 'inbound' ? '#1A1A1A' : 'rgba(201,168,76,0.10)', border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px', fontSize: 13 }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.body || <em style={{ color: C.faint }}>(no text)</em>}</div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{when(m.created_at)} · {m.direction === 'inbound' ? 'customer' : m.automated ? 'assistant' : 'staff'} · <Badge value={m.status === 'blocked' && m.blocked_reason === 'send_disabled_dry_run' ? 'dry_run' : m.status} label={m.status === 'blocked' ? (m.blocked_reason === 'send_disabled_dry_run' ? 'dry run — not sent' : `not sent: ${String(m.blocked_reason || '').replace(/_/g, ' ')}`) : m.status === 'provider_accepted' ? 'accepted by provider' : null} /></div>
            </div>
          ))}
        </div>
      )}
      {conversation && canManage && (
        <form onSubmit={send} style={{ marginTop: 12 }}>
          <label htmlFor="reply" style={{ fontSize: 12, color: C.dim }}>Reply as staff</label>
          <textarea id="reply" className="ops-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={640} required />
          <button className="ops-btn primary" style={{ marginTop: 8 }} disabled={act.busy}>Send reply</button>
          {act.view}
        </form>
      )}
    </Card>
  )
}
