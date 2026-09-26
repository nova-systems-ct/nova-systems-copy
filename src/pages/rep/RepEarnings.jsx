import { api, useLoad, money, dt, label } from '../../lib/salesApi'
import { Page, Card, Muted, Badge, Banner, Stat, Stats, Table, Loading, Btn, useNotice } from '../../components/sales/kit'

const TONE = { estimated: 'muted', pending_conditions: 'warn', eligible: 'gold', owner_approved: 'gold', scheduled: 'gold', paid: 'good', failed: 'bad', reversed: 'bad', cancelled: 'muted' }

// Five separate numbers on purpose: Estimated is never earnings, and nothing is shown as Paid unless the provider confirmed it or
// Nova's owner recorded it with evidence.
export default function RepEarnings() {
  const { data, loading, error } = useLoad(() => api('commissions', 'earnings', { method: 'GET' }), [])
  const { notice, show } = useNotice()
  if (loading && !data) return <Loading />
  if (error && !data) return <Page title="My earnings"><Banner tone="bad">{error}</Banner></Page>
  const s = data.summary
  const onboard = async () => { const r = await api('commissions', 'payout-onboarding-link', { body: {} }); show(r); if (r.ok && r.data.url) window.location.href = r.data.url }
  return (
    <Page eyebrow="Earnings" title="My earnings" subtitle="Each number below is a different state. They are not added together, because most of them are not money you have earned yet." wide>
      {notice}
      {data.plan_note && <Banner tone="warn">{data.plan_note}</Banner>}
      {data.plan && <Muted style={{ marginBottom: 12 }}>Commission plan version {data.plan.version} is in force. Conditions: {data.plan.conditions.require_payment_received ? 'client payment must be received' : 'no payment condition'}{data.plan.conditions.holdback_days ? `; ${data.plan.conditions.holdback_days}-day hold-back` : ''}.</Muted>}
      <Stats>
        <Stat label="Estimated" value={money(s.estimated_not_earned_cents)} note="Not earned — may change or be cancelled" />
        <Stat label="Pending conditions" value={money(s.pending_cents)} note="Sale verified; conditions not yet met" tone="warn" />
        <Stat label="Eligible / approved" value={money(s.eligible_cents)} note="Meets conditions; awaiting approval or payment" />
        <Stat label="Paid" value={money(s.paid_cents)} note="Confirmed or recorded by Nova" tone="good" />
      </Stats>
      <Card title="Commission entries">
        <Table rows={data.entries} empty="No commission entries yet." columns={[
          { key: 'business', label: 'Sale', render: (e) => e.business || '—' }, { key: 'status', label: 'State', render: (e) => <Badge tone={TONE[e.status]}>{e.status_label}</Badge> },
          { key: 'amount', label: 'Amount', right: true, render: (e) => money(e.amount_cents, e.currency) }, { key: 'why', label: 'Why / waiting for', render: (e) => e.status_reason || (e.status === 'pending_conditions' && e.eligible_after ? `Hold-back until ${dt(e.eligible_after)}` : '') },
          { key: 'v', label: 'Plan', render: (e) => (e.plan_version ? `v${e.plan_version}` : '') }, { key: 'at', label: 'Updated', render: (e) => dt(e.updated_at) },
        ]} />
        <Muted style={{ marginTop: 10, fontSize: 12 }}>{data.labels.estimated}</Muted>
      </Card>
      <Card title="Payouts"><Table rows={data.payouts} empty="No payouts yet." columns={[{ key: 'amount', label: 'Amount', right: true, render: (p) => money(p.amount_cents, p.currency) }, { key: 'status', label: 'Status', render: (p) => <Badge tone={p.status === 'paid' ? 'good' : p.status === 'failed' ? 'bad' : 'warn'}>{label(p.status)}</Badge> }, { key: 'c', label: 'Confirmation', render: (p) => p.confirmation }, { key: 'at', label: 'Paid', render: (p) => dt(p.paid_at) }]} /></Card>
      <Card title="Payout account">
        <p style={{ margin: '0 0 8px' }}>Status: <Badge tone={data.payout_account.status === 'verified' ? 'good' : 'muted'}>{label(data.payout_account.status)}</Badge></p>
        {data.payout_account.provider_enabled ? <><Muted style={{ marginBottom: 10 }}>You set up payouts on the payment provider's own secure page. Nova never sees your bank details, ID or tax information.</Muted><Btn onClick={onboard}>{data.payout_account.status === 'verified' ? 'Manage payout account' : 'Set up payouts'}</Btn></> : <Muted>Provider payouts are not enabled yet. Nova will tell you how payments will be made and will record each one with evidence.</Muted>}
      </Card>
    </Page>
  )
}
