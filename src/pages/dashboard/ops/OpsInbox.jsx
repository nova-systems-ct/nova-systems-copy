import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, useLoad, C, Card, Loading, ErrorBox, Empty, Badge, TestBadge, PageHeader, when, useAction } from './ui'

export default function OpsInbox() {
  const { orgId, business } = useOutletContext()
  const list = useLoad(() => api('conversations', { org: orgId }), [orgId])
  const [sel, setSel] = useState(null)
  const thread = useLoad(() => (sel ? api('conversation', { org: orgId, query: { id: sel } }) : Promise.resolve(null)), [orgId, sel])
  const [text, setText] = useState(''); const act = useAction()
  const send = async (e) => {
    e.preventDefault()
    const r = await act.run(() => api('conversation-reply', { org: orgId, method: 'POST', body: { conversation_id: sel, body: text, client_id: `${Date.now()}` } }), (x) => `Reply ${x.status.replace(/_/g, ' ')}${x.reason ? `: ${x.reason.replace(/_/g, ' ')}` : ''}. The assistant is paused for this customer.`)
    if (r) { setText(''); thread.reload(); list.reload() }
  }
  return (
    <>
      <PageHeader title="Inbox" sub="Texts and calls, with what the assistant said and whether each message was actually sent." />
      <ErrorBox error={list.error} onRetry={list.reload} />
      <div className="ops-side">
        <Card title="Conversations">
          {list.loading ? <Loading /> : !list.data?.length ? <Empty>No conversations yet.</Empty> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {list.data.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSel(c.id)} aria-current={sel === c.id} style={{ width: '100%', textAlign: 'left', background: sel === c.id ? 'rgba(201,168,76,0.10)' : 'transparent', border: 'none', borderBottom: `1px solid ${C.line}`, color: C.text, padding: '10px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.crm_contacts?.name || 'Customer'} {c.is_test && <TestBadge />} {c.crm_contacts?.suppressed && <Badge value="stopped" label="opted out" />}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{c.channel} · {c.staff_takeover ? 'staff' : c.engine_state ? `assistant: ${c.engine_state.replace(/_/g, ' ')}` : 'assistant'} · {when(c.last_inbound_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={thread.data ? `${thread.data.conversation.crm_contacts?.name || 'Customer'} · ${thread.data.conversation.crm_contacts?.phone_e164 || ''}` : 'Conversation'} actions={thread.data?.job && <Link to={`/dashboard/ops/requests/${thread.data.job.id}`} className="ops-btn" style={{ textDecoration: 'none' }}>Open request</Link>}>
          {!sel ? <Empty>Choose a conversation.</Empty> : thread.error ? <ErrorBox error={thread.error} /> : (thread.loading || !thread.data) ? <Loading /> : (
            <>
              <div style={{ display: 'grid', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                {thread.data.messages.map((m) => (
                  <div key={m.id} style={{ justifySelf: m.direction === 'inbound' ? 'start' : 'end', maxWidth: '85%', background: m.direction === 'inbound' ? '#1A1A1A' : 'rgba(201,168,76,0.10)', border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px', fontSize: 13 }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body || <em style={{ color: C.faint }}>(no text)</em>}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{when(m.created_at)} · {m.direction === 'inbound' ? 'customer' : m.automated ? 'assistant' : 'staff'} · {m.status === 'blocked' ? <Badge value={m.blocked_reason === 'send_disabled_dry_run' ? 'dry_run' : 'blocked'} label={m.blocked_reason === 'send_disabled_dry_run' ? 'dry run — not sent' : `not sent: ${String(m.blocked_reason).replace(/_/g, ' ')}`} /> : <Badge value={m.status} label={m.status === 'provider_accepted' ? 'accepted by provider' : null} />}</div>
                  </div>
                ))}
              </div>
              {business.can_manage && !thread.data.conversation.crm_contacts?.suppressed && (
                <form onSubmit={send} style={{ marginTop: 12 }}>
                  <label htmlFor="ib-reply" style={{ fontSize: 12, color: C.dim }}>Reply as staff (pauses the assistant for this customer)</label>
                  <textarea id="ib-reply" className="ops-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={640} required />
                  <button className="ops-btn primary" style={{ marginTop: 8 }} disabled={act.busy}>Send</button>
                  {act.view}
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  )
}
