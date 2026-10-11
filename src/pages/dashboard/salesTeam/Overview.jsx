import { Link } from 'react-router-dom'
import { api, useLoad, money, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Stat, Stats, Table, Banner, Loading, Badge } from '../../../components/sales/kit'

const n = (v) => (v == null ? '—' : v)

export default function Overview() {
  const { data: d, loading, error } = useLoad(() => api('salesteam', 'dashboard', { method: 'GET' }), [])
  if (loading && !d) return <Loading />
  if (error && !d) return <Page title="Sales Team"><Banner tone="bad">{error}</Banner></Page>
  const ex = d.exceptions
  return (
    <Page eyebrow="Sales Team" title="Overview" subtitle={`Scope: ${d.scope}. Every number is counted from stored records. Pipeline value is proposals still in play — it is not revenue.`} wide>
      {d.applicants && (
        <Stats>
          <Stat label="Applications" value={d.applicants.total} note={Object.entries(d.applicants.by_status).map(([k, v]) => `${label(k)} ${v}`).join(' · ')} />
          <Stat label="Invitations" value={Object.values(d.applicants.invitations).reduce((a, b) => a + b, 0)} note={Object.entries(d.applicants.invitations).map(([k, v]) => `${label(k)} ${v}`).join(' · ') || 'none'} />
          <Stat label="Practical reviews waiting" value={n(d.training.practical_reviews_waiting)} tone={d.training.practical_reviews_waiting ? 'warn' : undefined} />
          <Stat label="Documents awaiting countersign" value={d.documents.awaiting_countersign} tone={d.documents.awaiting_countersign ? 'warn' : undefined} />
        </Stats>
      )}
      <Card title="Exceptions — needs attention">
        <Stats>
          <Stat label="Overdue follow-ups" value={ex.overdue_followups} tone={ex.overdue_followups ? 'bad' : undefined} />
          <Stat label="Stale leads (14d+)" value={ex.stale_leads_14d} tone={ex.stale_leads_14d ? 'warn' : undefined} />
          <Stat label="Unassigned leads" value={n(ex.unassigned_leads)} />
          <Stat label="Sales awaiting verification" value={n(ex.sales_awaiting_verification)} tone={ex.sales_awaiting_verification ? 'warn' : undefined} />
          <Stat label="Discount requests" value={n(ex.discount_requests)} />
          <Stat label="Payout failures" value={n(ex.payout_failures)} tone={ex.payout_failures ? 'bad' : undefined} />
          <Stat label="Payouts to reconcile" value={n(ex.payouts_needing_reconciliation)} tone={ex.payouts_needing_reconciliation ? 'warn' : undefined} />
          <Stat label="Clawbacks to decide" value={n(ex.open_clawback_adjustments)} />
          <Stat label="Email delivery problems" value={n(ex.email_delivery_problems)} tone={ex.email_delivery_problems ? 'warn' : undefined} />
        </Stats>
      </Card>
      {d.money && (
        <Card title="Revenue vs pipeline">
          <Stats>
            <Stat label="Pipeline (proposals in play)" value={money(d.money.pipeline_proposed_cents)} note={d.money.pipeline_note} />
            <Stat label="Verified sales" value={money(d.money.verified_sales_cents)} tone="good" note="Owner-verified" />
            <Stat label="Collected — provider confirmed" value={money(d.money.collected_provider_confirmed_cents)} tone="good" />
            <Stat label="Collected — owner recorded" value={money(d.money.collected_owner_recorded_cents)} note="Evidence-backed, not provider-confirmed" />
            <Stat label="Refunded / disputed" value={money(d.money.refunded_or_disputed_cents)} tone={d.money.refunded_or_disputed_cents ? 'bad' : undefined} />
          </Stats>
        </Card>
      )}
      {d.commissions && (
        <Card title="Commissions (ledger)" right={<Link to="../commissions" style={{ color: '#C9A84C', fontSize: 12 }}>Open ledger →</Link>}>
          <Stats>
            <Stat label="Estimated (not earned)" value={money(d.commissions.estimated_not_earned_cents)} />
            <Stat label="Pending conditions" value={money(d.commissions.pending_cents)} />
            <Stat label="Eligible / approved / scheduled" value={money(d.commissions.eligible_cents)} />
            <Stat label="Paid" value={money(d.commissions.paid_cents)} tone="good" />
          </Stats>
        </Card>
      )}
      <Card title="Pipeline by stage"><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{Object.entries(d.pipeline.by_stage).map(([s, c]) => <Badge key={s} tone={c ? 'gold' : 'muted'}>{label(s)} {c}</Badge>)}</div></Card>
      <Card title="Representatives" right={<Link to="../reps" style={{ color: '#C9A84C', fontSize: 12 }}>Manage →</Link>}>
        <Muted style={{ marginBottom: 8 }}>{Object.entries(d.reps.by_status).map(([k, v]) => `${label(k)} ${v}`).join(' · ') || 'No representatives yet.'}</Muted>
        <Table rows={d.reps.per_rep} empty="No representatives in scope." columns={[
          { key: 'name', label: 'Name', render: (r) => <Link to={`../reps?id=${r.rep_id}`} style={{ color: '#fff' }}>{r.name || 'Unnamed'}</Link> }, { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'good' : r.status === 'suspended' ? 'bad' : 'muted'}>{label(r.status)}</Badge> },
          { key: 'open_leads', label: 'Open leads' }, { key: 'overdue_followups', label: 'Overdue', render: (r) => <span style={{ color: r.overdue_followups ? '#f87171' : '#fff' }}>{r.overdue_followups}</span> },
          { key: 'verified_sales', label: 'Verified sales' }, { key: 'lost', label: 'Lost' }, { key: 'training_completed', label: 'Training done' },
        ]} />
      </Card>
      <Card title="Training & documents"><Muted>Enrollments: {Object.entries(d.training.enrollments_by_status).map(([k, v]) => `${label(k)} ${v}`).join(' · ') || 'none'} · Documents: {Object.entries(d.documents.by_status).map(([k, v]) => `${label(k)} ${v}`).join(' · ') || 'none'}</Muted></Card>
    </Page>
  )
}
