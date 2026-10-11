import { Link } from 'react-router-dom'
import { useOrg } from '../../lib/OrgContext'
import { api, useLoad, dt, label } from '../../lib/salesApi'
import { Page, Card, Muted, Stat, Stats, Badge, Banner, Loading, Table, GOLD, GOOD, FAINT, LINE } from '../../components/sales/kit'

export default function RepHome() {
  const { hasPermission } = useOrg()
  return hasPermission('sales.rep') ? <Home /> : <Onboarding />
}

function Onboarding() {
  const { data, loading, error } = useLoad(() => api('salesteam', 'my-checklist', { method: 'GET' }), [])
  const docs = useLoad(() => api('documents', 'my-documents', { method: 'GET' }), [])
  if (loading && !data) return <Loading />
  return (
    <Page eyebrow="Onboarding" title="Your path to activation" subtitle="Finish each item below. Completing training does not activate your account — Nova activates you separately, once everything is complete and verified.">
      {error && <Banner tone="bad">{error}</Banner>}
      {data && (
        <>
          <Card title="Checklist" right={<Badge tone={data.status === 'active' ? 'good' : 'gold'}>{label(data.status)}</Badge>}>
            {data.items.map((i) => (
              <div key={i.key} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
                <span aria-hidden style={{ color: i.done ? GOOD : FAINT, fontSize: 18, lineHeight: '20px' }}>{i.done ? '✓' : '○'}</span>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>{i.label}</div><div style={{ color: FAINT, fontSize: 12.5, marginTop: 2 }}>{i.detail}</div></div>
              </div>
            ))}
            <Muted style={{ marginTop: 12 }}>{data.note}</Muted>
          </Card>
          <Card title="Next steps">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link to="/rep/training" style={{ color: GOLD }}>Continue training →</Link>
              <Link to="/rep/documents" style={{ color: GOLD }}>{docs.data && Object.values(docs.data.states || {}).some((s) => ['sent', 'viewed', 'needs_resign'].includes(s.state)) ? 'You have documents to sign →' : 'Your documents →'}</Link>
            </div>
          </Card>
        </>
      )}
    </Page>
  )
}

function Home() {
  const { data: d, loading, error, reload } = useLoad(() => api('leads', 'home', { method: 'GET' }), [])
  if (loading && !d) return <Loading />
  if (error && !d) return <Page title="Home"><Banner tone="bad">{error}</Banner></Page>
  const item = (x) => <Link key={`${x.deal_id}${x.next_action_at}`} to={`/rep/leads/${x.deal_id}`} style={{ color: '#fff', textDecoration: 'none' }}>{x.business} <span style={{ color: FAINT }}>— {x.next_action || label(x.stage)} {x.next_action_at ? `(${dt(x.next_action_at)})` : ''}</span></Link>
  return (
    <Page eyebrow="Home" title="Today" subtitle="Everything on this page is counted from your own leads and records — nothing is estimated." actions={<Link to="/rep/leads"><span style={{ color: GOLD, fontSize: 12, fontWeight: 700 }}>ALL LEADS →</span></Link>}>
      <Stats>
        <Stat label="Open leads" value={d.counts.open} />
        <Stat label="Overdue follow-ups" value={d.follow_ups_overdue.length} tone={d.follow_ups_overdue.length ? 'bad' : undefined} />
        <Stat label="Due today" value={d.follow_ups_due_today.length} />
        <Stat label="Not yet contacted" value={d.new_uncontacted.length} />
        <Stat label="Verified sales" value={d.counts.won} tone="good" />
      </Stats>
      {d.documents_outstanding.length > 0 && <Banner tone="warn">You have documents that need attention: {d.documents_outstanding.map((x) => x.title).join(', ')}. <Link to="/rep/documents" style={{ color: GOLD }}>Open</Link></Banner>}
      <Card title="Overdue follow-ups" tone={d.follow_ups_overdue.length ? 'bad' : undefined}>{d.follow_ups_overdue.length ? d.follow_ups_overdue.map((x) => <div key={x.deal_id} style={{ padding: '6px 0' }}>{item(x)}</div>) : <Muted>Nothing overdue.</Muted>}</Card>
      <Card title="Due today">{d.follow_ups_due_today.length ? d.follow_ups_due_today.map((x) => <div key={x.deal_id} style={{ padding: '6px 0' }}>{item(x)}</div>) : <Muted>Nothing due today.</Muted>}</Card>
      <Card title="Upcoming discovery (next 7 days)">{d.upcoming_discovery.length ? d.upcoming_discovery.map((x) => <div key={x.deal_id} style={{ padding: '6px 0' }}><Link to={`/rep/leads/${x.deal_id}`} style={{ color: '#fff' }}>{x.business}</Link> <span style={{ color: FAINT }}>— {dt(x.discovery_at)}</span></div>) : <Muted>No discovery conversations scheduled this week.</Muted>}</Card>
      <Card title="New leads waiting for first contact">{d.new_uncontacted.length ? d.new_uncontacted.map((x) => <div key={x.deal_id} style={{ padding: '6px 0' }}><Link to={`/rep/leads/${x.deal_id}`} style={{ color: '#fff' }}>{x.business}</Link></div>) : <Muted>No new leads.</Muted>}</Card>
      <Card title="My tasks">
        <Table columns={[{ key: 'body', label: 'Task' }, { key: 'due_at', label: 'Due', render: (r) => dt(r.due_at) }, { key: 'lead', label: '', render: (r) => <Link to={`/rep/leads/${r.deal_id}`} style={{ color: GOLD }}>Open lead</Link> }]} rows={d.open_tasks} empty="No open tasks." />
      </Card>
      <Card title="Training"><Muted>{d.training.programs_completed} of {d.training.programs_total} programs completed. <Link to="/rep/training" style={{ color: GOLD }}>Open training</Link></Muted></Card>
      <Muted style={{ fontSize: 11.5 }}>Pipeline by stage: {Object.entries(d.counts.by_stage).filter(([, n]) => n).map(([s, n]) => `${label(s)} ${n}`).join(' · ') || 'no leads yet'}. <button onClick={reload} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Refresh</button></Muted>
    </Page>
  )
}
