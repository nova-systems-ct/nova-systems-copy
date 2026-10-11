import { useState } from 'react'
import { useOrg } from '../../../lib/OrgContext'
import { api, downloadApi, useLoad, money, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Select, Modal, Table, Tabs, Check, Stats, Stat, Loading, useNotice } from '../../../components/sales/kit'

const TONE = { estimated: 'muted', pending_conditions: 'warn', eligible: 'gold', owner_approved: 'gold', scheduled: 'gold', paid: 'good', failed: 'bad', reversed: 'bad', cancelled: 'muted' }

export default function Commissions() {
  const { hasPermission } = useOrg()
  const owner = hasPermission('sales.owner')
  const [tab, setTab] = useState('ledger')
  const [status, setStatus] = useState('')
  const [pick, setPick] = useState([])
  const [detail, setDetail] = useState(null)
  const ledger = useLoad(() => api('commissions', 'ledger', { method: 'GET', query: { status } }), [status])
  const batches = useLoad(() => api('commissions', 'batches', { method: 'GET' }), [])
  const plan = useLoad(() => api('commissions', 'plan', { method: 'GET' }), [])
  const report = useLoad(() => api('commissions', 'report', { method: 'GET' }), [])
  const { notice, show } = useNotice()
  const reload = () => { ledger.reload(); batches.reload(); plan.reload(); report.reload() }
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); return r }
  const entries = ledger.data?.entries || []
  const toggle = (id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const adjustments = entries.filter((e) => e.kind === 'adjustment' && e.status === 'pending_conditions')
  const openEntry = async (e) => { const r = await api('commissions', 'ledger', { method: 'GET', query: { entry_id: e.id } }); setDetail({ entry: e, events: r.data?.events || [] }) }
  return (
    <Page eyebrow="Sales Team" title="Commissions & payouts" subtitle="No commission exists until you approve a plan. Estimated is not earned. Nothing becomes Paid unless the payment provider confirms it or you record an external payment with evidence." wide>
      {notice}
      {plan.data && !plan.data.approved && <Banner tone="warn">{plan.data.note}</Banner>}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'ledger', label: 'Ledger' }, { key: 'batches', label: 'Payout batches', count: batches.data?.length }, { key: 'adj', label: 'Clawbacks', count: adjustments.length }, ...(owner ? [{ key: 'plan', label: 'Plan' }] : []), { key: 'report', label: 'Report' }]} />

      {tab === 'ledger' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }} aria-label="Status">{[['', 'All states'], ...['estimated', 'pending_conditions', 'eligible', 'owner_approved', 'scheduled', 'paid', 'failed', 'reversed', 'cancelled'].map((s) => [s, label(s)])].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <Btn disabled={!pick.length} onClick={() => act(() => api('commissions', 'approve-entries', { body: { entry_ids: pick } }).then((r) => { if (r.ok) setPick([]); return r }), 'Approval attempted — see each result in the ledger.')}>Approve selected ({pick.length})</Btn>
            <Btn kind="quiet" onClick={() => downloadApi('commissions', 'export-csv', {}, 'commission-ledger.csv')}>Export CSV</Btn>
            {owner && <Btn kind="quiet" onClick={() => act(() => api('commissions', 'sweep', { body: {} }), 'Sweep complete.')}>Re-check conditions</Btn>}
          </div>
          {ledger.data?.summary && <Stats><Stat label="Estimated (not earned)" value={money(ledger.data.summary.estimated_not_earned_cents)} /><Stat label="Pending" value={money(ledger.data.summary.pending_cents)} /><Stat label="Eligible → scheduled" value={money(ledger.data.summary.eligible_cents)} /><Stat label="Paid" value={money(ledger.data.summary.paid_cents)} tone="good" /></Stats>}
          {ledger.loading && !ledger.data ? <Loading /> : <Card><Table rows={entries} onRow={openEntry} empty="No entries." columns={[
            { key: 'p', label: '', render: (e) => e.status === 'eligible' && e.kind === 'sale' && <input type="checkbox" aria-label="Select" checked={pick.includes(e.id)} onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(e.id)} /> },
            { key: 'r', label: 'Rep', render: (e) => e.rep_name }, { key: 'b', label: 'Sale', render: (e) => e.business || '—' }, { key: 'k', label: 'Kind', render: (e) => label(e.kind) },
            { key: 's', label: 'State', render: (e) => <Badge tone={TONE[e.status]}>{e.status_label}</Badge> }, { key: 'a', label: 'Amount', right: true, render: (e) => money(e.amount_cents, e.currency) },
            { key: 'v', label: 'Plan', render: (e) => (e.plan_version ? `v${e.plan_version}` : '') }, { key: 'w', label: 'Waiting for / note', render: (e) => e.status_reason || (e.status === 'pending_conditions' && e.eligible_after ? `hold-back to ${dt(e.eligible_after)}` : '') },
          ]} /></Card>}
        </>
      )}

      {tab === 'batches' && <Batches owner={owner} data={batches.data} ledgerEntries={entries.filter((e) => e.status === 'owner_approved')} act={act} />}

      {tab === 'adj' && (adjustments.length === 0 ? <Muted>No open clawback adjustments.</Muted> : adjustments.map((a) => <Card key={a.id} title={`${a.rep_name} — ${money(a.amount_cents)}`}><Muted>{a.status_reason}</Muted>{owner ? <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>{[['waive', 'Waive'], ['recovered', 'Recovered']].map(([r, l]) => <Btn key={r} kind="quiet" onClick={() => { const n = window.prompt(`${l} — record the decision and evidence (15+ characters):`); if (n) act(() => api('commissions', 'resolve-adjustment', { body: { entry_id: a.id, resolution: r, note: n } }), 'Resolved.') }}>{l}</Btn>)}</div> : <Muted>Only the owner can resolve this.</Muted>}</Card>))}

      {tab === 'plan' && owner && <Plan data={plan.data} act={act} />}

      {tab === 'report' && report.data && (
        <>
          <Stats><Stat label="Payout failures" value={report.data.payout_failures} tone={report.data.payout_failures ? 'bad' : undefined} /><Stat label="Needs reconciliation" value={report.data.needs_reconciliation} /><Stat label="Open clawbacks" value={report.data.open_adjustments} /><Stat label="Batches" value={report.data.batches} /></Stats>
          <Card title="Per representative"><Table rows={report.data.per_rep} empty="No data." columns={[{ key: 'rep_name', label: 'Rep' }, { key: 'e', label: 'Estimated', right: true, render: (r) => money(r.estimated_not_earned_cents) }, { key: 'p', label: 'Pending', right: true, render: (r) => money(r.pending_cents) }, { key: 'el', label: 'Eligible+', right: true, render: (r) => money(r.eligible_cents) }, { key: 'pd', label: 'Paid', right: true, render: (r) => money(r.paid_cents) }]} /></Card>
        </>
      )}

      {detail && <Modal title={`Ledger entry — ${detail.entry.rep_name}`} onClose={() => setDetail(null)}>
        <p>{detail.entry.business} · {money(detail.entry.amount_cents)} · <Badge tone={TONE[detail.entry.status]}>{detail.entry.status_label}</Badge></p>
        <Muted>Basis {money(detail.entry.basis_cents)} · plan v{detail.entry.plan_version} · conditions: {detail.entry.conditions ? `${detail.entry.conditions.require_payment_received ? 'payment required' : 'no payment condition'}, hold-back ${detail.entry.conditions.holdback_days}d` : '—'}</Muted>
        <Card title="Immutable event history" style={{ marginTop: 12 }}>{detail.events.map((ev) => <p key={ev.id} style={{ margin: '0 0 6px', fontSize: 13 }}>{dt(ev.created_at)} — {ev.from_status ? `${label(ev.from_status)} → ` : ''}<strong>{label(ev.to_status)}</strong> ({label(ev.actor_kind)}){ev.detail?.reason ? `: ${ev.detail.reason}` : ''}</p>)}</Card>
      </Modal>}
    </Page>
  )
}

function Batches({ owner, data, ledgerEntries, act }) {
  const [make, setMake] = useState(false)
  const [sel, setSel] = useState([]); const [mode, setMode] = useState('external_record')
  const toggle = (id) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <>
      <Card title="New batch">
        <Muted style={{ marginBottom: 8 }}>Only Owner-Approved entries can be batched. The owner then approves the exact batch (count and total) before anything is scheduled.</Muted>
        {!make ? <Btn onClick={() => setMake(true)} disabled={!ledgerEntries.length}>{ledgerEntries.length ? 'Choose entries…' : 'No owner-approved entries'}</Btn> : (
          <>
            {ledgerEntries.map((e) => <Check key={e.id} checked={sel.includes(e.id)} onChange={() => toggle(e.id)}>{e.rep_name} — {e.business} — {money(e.amount_cents)}</Check>)}
            <Field label="How will these be paid?"><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="external_record">Outside the platform — the owner records each payment with evidence</option><option value="provider">Through the payment provider (needs verified payout accounts)</option></Select></Field>
            <Btn kind="primary" disabled={!sel.length} onClick={async () => { const r = await act(() => api('commissions', 'create-batch', { body: { mode, entry_ids: sel } }), 'Draft batch created. The owner must approve it.'); if (r.ok) { setMake(false); setSel([]) } }}>Create draft batch</Btn> <Btn kind="quiet" onClick={() => setMake(false)}>Cancel</Btn>
          </>
        )}
      </Card>
      {(data || []).map((b) => (
        <Card key={b.id} title={`Batch ${b.id.slice(0, 8)} — ${money(b.total_cents)} (${b.entry_ids.length})`} right={<Badge tone={b.status === 'completed' ? 'good' : b.status === 'partially_failed' ? 'bad' : b.status === 'draft' ? 'warn' : 'gold'}>{label(b.status)} · {b.mode === 'provider' ? 'provider' : 'external'}</Badge>}>
          <Table rows={b.payouts} empty="No payouts scheduled yet (draft)." columns={[{ key: 'r', label: 'Rep', render: (p) => p.rep_name }, { key: 'a', label: 'Amount', right: true, render: (p) => money(p.amount_cents) }, { key: 's', label: 'Status', render: (p) => <Badge tone={p.status === 'paid' ? 'good' : p.status === 'failed' ? 'bad' : 'warn'}>{label(p.status)}{p.needs_reconciliation ? ' · reconcile' : ''}</Badge> }, { key: 'c', label: 'Confirmation', render: (p) => p.confirmation || p.failure_reason || '' }, { key: 'x', label: '', render: (p) => owner && b.mode === 'external_record' && p.status === 'scheduled' && <Btn small onClick={() => { const method = window.prompt('Method: check, ach, cash, wire or other', 'ach'); const ref = window.prompt('Reference (optional)'); const ev = window.prompt('Evidence — what proves it was paid (15+ characters):'); if (method && ev) act(() => api('commissions', 'record-external', { body: { payout_id: p.id, method, reference: ref, evidence: ev } }), 'Recorded. Not provider-confirmed.') }}>Record payment</Btn> }]} />
          {owner && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {b.status === 'draft' && <Btn kind="primary" onClick={() => { if (window.confirm(`Approve this exact batch: ${b.entry_ids.length} payout(s) totalling ${money(b.total_cents)}?`)) act(() => api('commissions', 'approve-batch', { body: { batch_id: b.id, confirm_total_cents: b.total_cents, confirm_count: b.entry_ids.length } }), 'Approved and scheduled.') }}>Approve batch…</Btn>}
              {b.mode === 'provider' && ['approved', 'processing', 'partially_failed'].includes(b.status) && <Btn kind="primary" onClick={() => act(() => api('commissions', 'execute-batch', { body: { batch_id: b.id } }), 'Submitted. Payouts are marked Paid only when the provider confirms.')}>Send to provider</Btn>}
              {['draft', 'approved'].includes(b.status) && <Btn kind="danger" onClick={() => act(() => api('commissions', 'cancel-batch', { body: { batch_id: b.id } }), 'Cancelled.')}>Cancel batch</Btn>}
            </div>
          )}
        </Card>
      ))}
    </>
  )
}

function Plan({ data, act }) {
  const [rules, setRules] = useState([{ product_slug: '*', type: 'percent', value: '' }])
  const [hold, setHold] = useState(0); const [needPay, setNeedPay] = useState(true)
  const save = () => act(() => api('commissions', 'save-plan', { body: { plan: { rules: rules.map((r) => ({ product_slug: r.product_slug || '*', type: r.type, ...(r.type === 'percent' ? { percent_bp: Math.round(Number(r.value) * 100) } : { flat_cents: Math.round(Number(r.value) * 100) }) })), conditions: { require_payment_received: needPay, holdback_days: Number(hold) } } } }), 'Saved as a pending plan version.')
  return (
    <>
      <Card title="Approved plan">{data?.approved ? <><p style={{ margin: '0 0 8px' }}>Version {data.approved.version}</p><Table rows={data.approved.value.rules.map((r, i) => ({ id: i, ...r }))} columns={[{ key: 'product_slug', label: 'Offering' }, { key: 'type', label: 'Type' }, { key: 'v', label: 'Rate', render: (r) => (r.type === 'percent' ? `${r.percent_bp / 100}%` : `${money(r.flat_cents)} per unit`) }]} /><Muted style={{ marginTop: 8 }}>Conditions: {data.approved.value.conditions.require_payment_received ? 'client payment must be received' : 'no payment condition'}; hold-back {data.approved.value.conditions.holdback_days} days. Existing deals stay on the plan they were created under.</Muted></> : <Muted>No plan is approved. No commission can be calculated.</Muted>}</Card>
      <Card title="Write a new plan version">
        <Muted style={{ marginBottom: 10 }}>These are your numbers — the platform has no default rate. "*" applies to every offering without its own rule.</Muted>
        {rules.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: 8, marginBottom: 8 }}><Input placeholder="offering slug or *" value={r.product_slug} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, product_slug: e.target.value } : x)))} /><Select value={r.type} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}><option value="percent">Percent</option><option value="flat">Flat $ / unit</option></Select><Input type="number" step="0.01" placeholder={r.type === 'percent' ? '%' : '$'} value={r.value} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} /></div>)}
        <Btn small kind="quiet" onClick={() => setRules([...rules, { product_slug: '', type: 'percent', value: '' }])}>Add rule</Btn>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}><Field label="Hold-back after payment (days)"><Input type="number" min="0" max="365" value={hold} onChange={(e) => setHold(e.target.value)} /></Field><div style={{ paddingTop: 22 }}><Check checked={needPay} onChange={setNeedPay}>Require client payment received</Check></div></div>
        <Btn kind="primary" onClick={save}>Save as pending version</Btn>
      </Card>
      <Card title="Versions"><Table rows={data?.versions || []} columns={[{ key: 'v', label: 'Version', render: (v) => `v${v.version}` }, { key: 's', label: 'Status', render: (v) => <Badge tone={v.status === 'approved' ? 'good' : v.status === 'pending_approval' ? 'warn' : 'muted'}>{label(v.status)}</Badge> }, { key: 'r', label: 'Rules', render: (v) => v.value.rules.map((r) => `${r.product_slug}: ${r.type === 'percent' ? `${r.percent_bp / 100}%` : money(r.flat_cents)}`).join(' · ') }, { key: 'a', label: '', render: (v) => v.status === 'pending_approval' && <Btn small onClick={() => { if (window.confirm('These are the rates Nova will pay. Existing deals stay on their plan. Approve?')) act(() => api('commissions', 'approve-plan', { body: { config_id: v.id, confirm: true } }), 'Plan approved.') }}>Approve</Btn> }]} /></Card>
    </>
  )
}
