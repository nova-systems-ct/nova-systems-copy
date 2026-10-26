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
  // 2026-10-26: test requests (is_test) hidden by default, 25 at a time, plain column names; a total that was never set
  // reads "not quoted" instead of $0.00.
  const [showTest, setShowTest] = useState(false); const [limit, setLimit] = useState(25)
  const all = list.data || []
  // Test = flagged is_test, or a contact named with the test convention (the automated walkthrough books through Nova's real form).
  const isTest = (j) => j.is_test || /^(LOCAL TEST|TEST|DEMO)(\W|$)/.test(j.crm_contacts?.name || '')
  const testCount = all.filter(isTest).length
  const rows = all.filter((j) => showTest || !isTest(j))
  const total = (j) => (j.total_cents == null || (j.total_cents === 0 && !j.price_snapshot?.service_name) ? <span style={{ color: C.faint }}>not quoted</span> : money(j.total_cents, j.currency))
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
      <style>{`@media (max-width: 900px) { .req-table thead { display: none } .req-table tr { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid ${C.line} } .req-table td { border: 0; padding: 2px 0 } }`}</style>
      <Card title={`${rows.length} request${rows.length === 1 ? '' : 's'}${!showTest && testCount ? ` · ${testCount} test hidden` : ''}`} actions={testCount ? <button className="ops-btn" aria-pressed={showTest} onClick={() => setShowTest((v) => !v)}>{showTest ? 'Hide' : 'Show'} test requests ({testCount})</button> : null}>
        {list.loading ? <Loading /> : !rows.length ? <Empty>{testCount ? 'No real customer requests here yet. Test requests are hidden.' : 'No requests here yet.'}</Empty> : (
          <div className="ops-scroll"><table className="ops-table req-table"><thead><tr><th>Customer</th><th>Service</th><th>Request status</th><th>Work</th><th>Quoted total</th><th>Updated</th></tr></thead><tbody>
            {rows.slice(0, limit).map((j) => (
              <tr key={j.id} className="clickable" onClick={() => nav(`/dashboard/ops/requests/${j.id}`)}>
                <td><Link to={`/dashboard/ops/requests/${j.id}`} style={{ color: C.text, textDecoration: 'none' }}>{j.crm_contacts?.name || 'Customer'}</Link> {isTest(j) && <TestBadge />}<div style={{ color: C.faint, fontSize: 12 }}>{j.source_channel}</div></td>
                <td>{j.price_snapshot?.service_name || '—'}</td><td><Badge value={j.state} /></td><td><Badge value={j.fulfillment_status} /></td>
                <td>{total(j)}</td><td style={{ color: C.dim }}>{when(j.updated_at)}</td>
              </tr>
            ))}
          </tbody></table>{rows.length > limit && <button className="ops-btn" style={{ marginTop: 10 }} onClick={() => setLimit((n) => n + 25)}>Show 25 more ({rows.length - limit} left)</button>}</div>
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
