import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { api, useLoad, C, Card, Field, Loading, ErrorBox, Empty, Badge, TestBadge, PageHeader, money, when, useAction } from './ui'

const TABS = { all: ['All', {}], needs: ['Needs a person', { state: 'escalated' }], quote: ['Owner quote', { state: 'owner_quote_required' }], work: ['Ready for work', { fulfillment: 'ready' }], progress: ['In progress', { fulfillment: 'in_progress' }], done: ['Completed', { fulfillment: 'completed' }] }

export default function OpsRequests() {
  const { orgId, business } = useOutletContext()
  const [sp, setSp] = useSearchParams(); const tab = TABS[sp.get('tab')] ? sp.get('tab') : 'all'
  const list = useLoad(() => api('jobs', { org: orgId, query: TABS[tab][1] }), [orgId, tab])
  const nav = useNavigate()
  const [phone, setPhone] = useState(''); const [name, setName] = useState('')
  const act = useAction()
  const create = async (e) => {
    e.preventDefault()
    const r = await act.run(() => api('job-action', { org: orgId, method: 'POST', body: { action: 'create', phone, name, is_test: !!business.settings?.is_test } }), 'Request created.')
    if (r?.job) nav(`/dashboard/ops/requests/${r.job.id}`)
  }
  return (
    <>
      <PageHeader title="Requests & jobs" sub="Every customer request from text, calls, forms and staff — from first message to completed work." />
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(TABS).map(([k, [label]]) => <button key={k} role="tab" aria-selected={tab === k} className={`ops-btn${tab === k ? ' primary' : ''}`} onClick={() => setSp({ tab: k })}>{label}</button>)}
      </div>
      <ErrorBox error={list.error} onRetry={list.reload} />
      <Card>
        {list.loading ? <Loading /> : !list.data?.length ? <Empty>No requests here yet.</Empty> : (
          <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Customer</th><th>Service</th><th>Request</th><th>Work</th><th>Total</th><th>Updated</th></tr></thead><tbody>
            {list.data.map((j) => (
              <tr key={j.id} className="clickable" onClick={() => nav(`/dashboard/ops/requests/${j.id}`)}>
                <td><Link to={`/dashboard/ops/requests/${j.id}`} style={{ color: C.text, textDecoration: 'none' }}>{j.crm_contacts?.name || 'Customer'}</Link> {j.is_test && <TestBadge />}<div style={{ color: C.faint, fontSize: 12 }}>{j.source_channel}</div></td>
                <td>{j.price_snapshot?.service_name || '—'}</td><td><Badge value={j.state} /></td><td><Badge value={j.fulfillment_status} /></td>
                <td>{money(j.total_cents, j.currency)}</td><td style={{ color: C.dim }}>{when(j.updated_at)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Card>
      <Card title="Add a request by hand" style={{ marginTop: 16 }}>
        <form onSubmit={create} className="ops-two">
          <Field label="Customer phone" id="nr-phone"><input id="nr-phone" className="ops-input" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" /></Field>
          <Field label="Customer name" id="nr-name"><input id="nr-name" className="ops-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div><button className="ops-btn primary" disabled={act.busy}>Create request</button>{act.view}</div>
        </form>
        <p style={{ color: C.faint, fontSize: 12 }}>Creating a request does not text anyone and does not record marketing consent.</p>
      </Card>
    </>
  )
}
