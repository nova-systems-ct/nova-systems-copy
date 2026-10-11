import { Link, useOutletContext } from 'react-router-dom'
import { api, useLoad, C, Card, Loading, ErrorBox, Empty, Badge, PageHeader, when } from './ui'

export default function OpsOverview() {
  const { orgId, business } = useOutletContext()
  const r = useLoad(() => api('readiness', { org: orgId }), [orgId])
  const needs = useLoad(() => api('jobs', { org: orgId, query: { state: 'escalated' } }), [orgId])
  const quotes = useLoad(() => api('jobs', { org: orgId, query: { state: 'owner_quote_required' } }), [orgId])
  const d = r.data
  const blocked = d?.items.filter((i) => i.status !== 'ready') || []
  return (
    <>
      <PageHeader title={business.settings?.display_name || business.name} sub="What is ready, what needs a person, and what is happening — measured, not assumed." />
      <ErrorBox error={r.error} onRetry={r.reload} />
      {r.loading ? <Loading /> : d && (
        <>
          <div className="ops-grid" style={{ marginBottom: 16 }}>
            {[['Open requests', d.counts.open_requests, 'requests'], ['Needs a person', d.counts.needs_person, 'requests?tab=needs'], ['Ready for work', d.counts.ready_for_work, 'requests?tab=work'], ['Completed', d.counts.completed, 'requests?tab=done'], ['Open incidents', d.open_incidents, 'monitoring']].map(([k, v, to]) => (
              <Link key={k} to={`/dashboard/ops/${to}`} style={{ textDecoration: 'none' }}>
                <Card><div style={{ fontSize: 12, color: C.dim }}>{k}</div><div style={{ fontSize: 28, fontWeight: 700, color: v && (k === 'Needs a person' || k === 'Open incidents') ? C.amber : C.text }}>{v}</div></Card>
              </Link>
            ))}
          </div>
          <div className="ops-two">
            <Card title="Readiness" actions={<span style={{ fontSize: 12, color: C.faint }}>{blocked.length ? `${blocked.length} item(s) not ready` : 'All items ready'}</span>}>
              <div className="ops-scroll"><table className="ops-table"><tbody>
                {d.items.map((i) => <tr key={i.key}><td>{i.label}</td><td><Badge value={i.status === 'ready' ? 'healthy' : i.status === 'partial' ? 'partial' : 'blocked'} label={i.status} /></td><td style={{ color: C.dim, fontSize: 12 }}>{i.detail}</td></tr>)}
              </tbody></table></div>
              <p style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>"Ready" means configured and verified here. Real messages, calls and payments also need the provider steps in Settings and Nova's installation checklist.</p>
            </Card>
            <Card title="Needs a person">
              {needs.loading || quotes.loading ? <Loading /> : (!(needs.data?.length || quotes.data?.length) ? <Empty>Nothing is waiting on a person.</Empty> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {[...(quotes.data || []), ...(needs.data || [])].map((j) => (
                    <li key={j.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                      <Link to={`/dashboard/ops/requests/${j.id}`} style={{ color: C.text, textDecoration: 'none' }}>{j.crm_contacts?.name || 'Customer'} — <Badge value={j.state} /></Link>
                      <div style={{ color: C.faint, fontSize: 12 }}>{j.escalation_reason ? `Reason: ${j.escalation_reason.replace(/_/g, ' ')}` : 'Owner quote required'} · {when(j.updated_at)}</div>
                    </li>
                  ))}
                </ul>
              ))}
              {d.latest_report && <p style={{ fontSize: 13, marginTop: 14 }}>Latest weekly report: <Link to={`/dashboard/ops/reports/${d.latest_report.id}`} style={{ color: C.gold }}>week of {when(d.latest_report.week_start)}</Link></p>}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
