import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, useLoad, C, Card, Loading, ErrorBox, Empty, Badge, PageHeader, money, when, useAction, Notice } from './ui'

export default function OpsReports() {
  const { orgId, business } = useOutletContext()
  const list = useLoad(() => api('reports', { org: orgId }), [orgId])
  const nav = useNavigate(); const act = useAction()
  const gen = async () => { const r = await act.run(() => api('reports', { org: orgId, method: 'POST', body: {} }), (x) => (x.unchanged ? 'No changes since the last version.' : 'Report generated from recorded events.')); list.reload(); if (r?.report?.id) nav(`/dashboard/ops/reports/${r.report.id}`) }
  return (
    <>
      <PageHeader title="Weekly reports" sub="Sunday 6:00 PM in the business's time zone. Every figure comes from recorded events; anything that cannot be measured says so." right={business.can_manage && <button className="ops-btn" onClick={gen} disabled={act.busy}>Generate last week now</button>} />
      {act.view}
      <ErrorBox error={list.error} onRetry={list.reload} />
      <Card>
        {list.loading ? <Loading /> : !list.data?.length ? <Empty>No reports yet. The first one is generated the first Sunday evening after setup.</Empty> : (
          <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Week</th><th>Inquiries</th><th>Appointments</th><th>Deposits</th><th>Text to owner</th><th>Version</th></tr></thead><tbody>
            {list.data.map((r) => <tr key={r.id} className="clickable" onClick={() => nav(`/dashboard/ops/reports/${r.id}`)}><td><Link to={`/dashboard/ops/reports/${r.id}`} style={{ color: C.text }}>{when(r.week_start, r.timezone)} – {when(r.week_end, r.timezone)}</Link>{r.metrics?.label && <div style={{ color: C.amber, fontSize: 11 }}>TEST</div>}</td><td>{r.metrics?.inquiries_handled}</td><td>{r.metrics?.appointments_confirmed}</td><td>{money(r.metrics?.deposits_collected_cents)}</td><td><Badge value={r.notification_status} label={r.notification_status === 'dry_run' ? 'dry run' : null} /></td><td>v{r.version}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
    </>
  )
}

const LABELS = [
  ['inquiries_handled', 'Inquiries handled'], ['missed_calls_detected', 'Missed calls detected'], ['followups_submitted_to_provider', 'Missed-call follow-ups accepted by the provider'], ['followups_delivered', 'Follow-ups confirmed delivered'], ['followups_blocked_or_dry_run', 'Follow-ups not sent (blocked or dry run)'],
  ['appointments_confirmed', 'Appointments confirmed'], ['agreements_signed', 'Agreements signed'], ['deposits_collected_count', 'Deposits collected'], ['failed_actions', 'Failed actions'], ['owner_decisions_required', 'Decisions waiting on you'],
]
export function OpsReportDetail() {
  const { orgId } = useOutletContext()
  const { id } = useParams()
  const d = useLoad(() => api('report', { org: orgId, query: { id } }), [orgId, id])
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} />
  const r = d.data; const m = r.metrics
  const explain = (v) => (typeof v === 'string' && v.startsWith('not_calculable') ? <span style={{ color: C.faint }}>Not calculable — {v.split(': ')[1]}</span> : null)
  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link to="/dashboard/ops/reports" style={{ color: C.gold, fontSize: 13 }}>← Weekly reports</Link></p>
      <PageHeader title={`Week of ${when(r.week_start, r.timezone)}`} sub={`${when(r.week_start, r.timezone)} to ${when(r.week_end, r.timezone)} (${r.timezone}) · version ${r.version} · generated ${when(r.generated_at)}`} />
      {m.label && <Notice tone="warn">{m.label}</Notice>}
      <div className="ops-two">
        <Card title="Activity">
          <table className="ops-table"><tbody>{LABELS.map(([k, l]) => <tr key={k}><td>{l}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{m[k]}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Money (kept separate on purpose)">
          <table className="ops-table"><tbody>
            <tr><td>Booked contract value<div style={{ color: C.faint, fontSize: 11 }}>agreed totals for jobs confirmed this week — not collected money</div></td><td style={{ textAlign: 'right' }}>{money(m.booked_contract_value_cents)}</td></tr>
            <tr><td>Provider-confirmed collections<div style={{ color: C.faint, fontSize: 11 }}>deposits Stripe confirmed {m.deposits_livemode === 'test_mode_only' ? '(TEST mode — no real money)' : ''}</div></td><td style={{ textAlign: 'right' }}>{money(m.provider_confirmed_collections_cents)}</td></tr>
            <tr><td>Refunds</td><td style={{ textAlign: 'right' }}>{money(m.refunds_cents)}</td></tr>
            <tr><td>Attributed to Nova</td><td style={{ textAlign: 'right' }}>{explain(m.attributed_collections) || <>{money(m.attributed_collections.cents)}<div style={{ color: C.faint, fontSize: 11 }}>method: {m.attributed_collections.method}</div></>}</td></tr>
            <tr><td>Estimated time avoided</td><td style={{ textAlign: 'right' }}>{explain(m.estimated_labor_minutes_avoided) || <>{Math.round(m.estimated_labor_minutes_avoided.minutes / 6) / 10} h<div style={{ color: C.faint, fontSize: 11 }}>{m.estimated_labor_minutes_avoided.basis}</div></>}</td></tr>
            <tr><td>Return after Nova's fee</td><td style={{ textAlign: 'right' }}>{explain(m.roi) || <>{money(m.roi.net_cents)}<div style={{ color: C.faint, fontSize: 11 }}>excludes: {m.roi.excludes.join(', ')}</div></>}</td></tr>
          </tbody></table>
        </Card>
      </div>
      <Card title="Traceability" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, color: C.dim, wordBreak: 'break-all' }}>Content SHA-256: {r.content_sha256}</p>
        <p style={{ fontSize: 12, color: C.dim }}>Built from {Object.entries(r.sources).map(([k, v]) => `${v.length} ${k}`).join(', ')}. This version never changes; new data creates a new version.</p>
        <p style={{ fontSize: 12, color: C.dim }}>Owner text: <Badge value={r.notification_status} />{r.notification_detail && ` — ${r.notification_detail}`}</p>
      </Card>
    </>
  )
}
