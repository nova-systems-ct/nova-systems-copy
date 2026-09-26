import { useState } from 'react'
import { api, useLoad, dt, money, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Check, Loading, useNotice } from '../../../components/sales/kit'

// The owner's queue: sales reported closed (verify or reject), discount requests, proposals that need an owner price, manual payments.
export default function Verification() {
  const [tab, setTab] = useState('verify')
  const q = useLoad(() => api('proposals', 'queue', { method: 'GET' }), [])
  const pays = useLoad(() => api('salespay', 'list', { method: 'GET' }), [])
  const [decide, setDecide] = useState(null)
  const [manual, setManual] = useState(null)
  const { notice, show } = useNotice()
  const reload = () => { q.reload(); pays.reload() }
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); return r }
  const d = q.data
  return (
    <Page eyebrow="Sales Team" title="Verification & approvals" subtitle="A rep reporting a close is a claim. You verify it against the signature and payment record before it becomes a sale, a fulfillment order and, if a plan is approved, a commission." wide>
      {notice}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'verify', label: 'Sales to verify', count: d?.verifications?.length }, { key: 'discount', label: 'Discount requests', count: d?.discount_requests?.length }, { key: 'price', label: 'Needs owner price', count: d?.needs_price?.length }, { key: 'payments', label: 'Payments' }]} />
      {q.loading && !d && <Loading />}
      {tab === 'verify' && d && (d.verifications.length === 0 ? <Muted>No sales waiting for verification.</Muted> : d.verifications.map((v) => (
        <Card key={v.id} title={`${v.business || 'Sale'} — reported by ${v.rep}`} right={<Badge tone={v.evidence_kind === 'system_signature' ? 'good' : 'warn'}>{v.evidence_kind === 'system_signature' ? 'Client signed through Nova' : 'Rep-supplied evidence — check it yourself'}</Badge>}>
          <p style={{ margin: '0 0 6px' }}><strong>Rep says:</strong> {v.rep_evidence}</p>
          <Muted>Proposal v{v.proposal?.version}: {money(v.proposal?.total_cents)} · {label(v.proposal?.status)}{v.proposal?.signed_at ? ` · signed by ${v.proposal.signer_name} ${dt(v.proposal.signed_at)}` : ' · NOT signed through Nova'} · Payments: {v.payments.length ? v.payments.map((p) => `${label(p.status)} (${label(p.method)})`).join(', ') : 'none'}</Muted>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><Btn kind="primary" onClick={() => setDecide({ v, decision: 'approve', notes: '', confirm_offline_evidence: false, accept_unpaid_terms: false, unpaid_reason: '' })}>Verify…</Btn><Btn kind="danger" onClick={() => setDecide({ v, decision: 'reject', notes: '' })}>Reject…</Btn>{v.proposal && !v.payments.some((p) => p.status === 'paid') && <Btn kind="quiet" onClick={() => { setTab('payments'); setManual({ proposal_id: v.proposal.id, amount: ((v.proposal.payment_due_cents ?? v.proposal.total_cents) / 100).toFixed(2), method: 'check', evidence: '' }) }}>Record payment…</Btn>}</div>
        </Card>
      )))}
      {tab === 'discount' && d && (d.discount_requests.length === 0 ? <Muted>No discount requests.</Muted> : d.discount_requests.map((p) => (
        <Card key={p.id} title={`${p.business || 'Deal'} — ${p.rep}`}>
          <p style={{ margin: '0 0 6px' }}>Discount <strong>{money(p.discount_cents)}</strong> on {money(p.subtotal_cents)} → total {money(p.total_cents)}</p><Muted>Reason: {p.discount_reason}</Muted>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>{['approve', 'deny'].map((x) => <Btn key={x} kind={x === 'approve' ? 'primary' : 'danger'} onClick={() => { const note = window.prompt(`${label(x)} — record your reason:`); if (note) act(() => api('proposals', 'decide-discount', { body: { proposal_id: p.id, decision: x, note } }), `Discount ${x === 'approve' ? 'approved' : 'denied'}.`) }}>{label(x)}</Btn>)}</div>
        </Card>
      )))}
      {tab === 'price' && d && (d.needs_price.length === 0 ? <Muted>No proposals need an owner price.</Muted> : d.needs_price.map((p) => (
        <Card key={p.id} title={`${p.business || 'Deal'} — ${p.rep}`}>
          {p.line_items.filter((l) => l.unit_price_cents == null).map((l) => (
            <div key={l.product_id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
              <span style={{ flex: '1 1 200px' }}>{l.name} {l.label && <Badge tone="warn">{l.label}</Badge>}</span>
              <Btn small onClick={() => { const v = window.prompt('Price per unit in dollars for this deal:'); if (!v) return; const why = window.prompt('Why does this custom price apply? (10+ characters)'); if (why) act(() => api('proposals', 'owner-set-price', { body: { proposal_id: p.id, product_id: l.product_id, unit_price_cents: Math.round(Number(v) * 100), reason: why } }), 'Price set.') }}>Set price…</Btn>
            </div>))}
        </Card>
      )))}
      {tab === 'payments' && (
        <>
          <Card title="Record a payment received outside the payment provider"><Muted style={{ marginBottom: 10 }}>Only you can do this, only with evidence, and it is labelled "recorded by owner — NOT provider-confirmed". It cannot be used for a sale you are credited on.</Muted><Btn onClick={() => setManual({ proposal_id: '', amount: '', method: 'check', evidence: '' })}>Record payment…</Btn></Card>
          <Card title="Payments"><Table rows={pays.data || []} empty="No payments yet." columns={[{ key: 'a', label: 'Amount', right: true, render: (p) => money(p.amount_cents, p.currency) }, { key: 's', label: 'Status', render: (p) => <Badge tone={p.status === 'paid' ? 'good' : p.status === 'pending' ? 'warn' : 'bad'}>{label(p.status)}</Badge> }, { key: 'c', label: 'Confirmation', render: (p) => p.confirmation }, { key: 'at', label: 'Paid', render: (p) => dt(p.paid_at) }, { key: 'r', label: '', render: (p) => p.status === 'paid' && <Btn small kind="danger" onClick={() => { const ev = window.prompt('Evidence for the refund (15+ characters):'); if (ev) act(() => api('salespay', 'mark-refunded', { body: { payment_id: p.id, evidence: ev } }), 'Marked refunded.') }}>Mark refunded</Btn> }]} /></Card>
        </>
      )}
      {decide && <DecideModal s={decide} setS={setDecide} onClose={() => setDecide(null)} onDone={(msg) => { setDecide(null); show({ ok: true }, msg); reload() }} />}
      {manual && <ManualModal s={manual} setS={setManual} onClose={() => setManual(null)} onDone={() => { setManual(null); show({ ok: true }, 'Recorded. This is not a provider confirmation.'); reload() }} />}
    </Page>
  )
}

function DecideModal({ s, setS, onClose, onDone }) {
  const [err, setErr] = useState(null); const [needPay, setNeedPay] = useState(false)
  const v = s.v
  const submit = async () => {
    const r = await api('proposals', 'verify', { body: { verification_id: v.id, decision: s.decision, notes: s.notes, confirm_offline_evidence: s.confirm_offline_evidence, accept_unpaid_terms: s.accept_unpaid_terms, unpaid_reason: s.unpaid_reason } })
    if (r.ok) onDone(s.decision === 'approve' ? `Verified. Handoff: ${r.data.handoff?.failed ? 'FAILED — use retry' : `${r.data.handoff?.orders_created ?? 0} order(s) created`}.` : 'Rejected; the rep was told.'); else { setErr(r.data?.error); if (r.data?.payment_received === false) setNeedPay(true) }
  }
  return (
    <Modal title={`${s.decision === 'approve' ? 'Verify' : 'Reject'} — ${v.business || 'sale'}`} onClose={onClose}>
      <Field label="What did you check?" hint="Recorded with your decision."><Textarea rows={3} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
      {s.decision === 'approve' && v.evidence_kind === 'rep_supplied' && <Check checked={s.confirm_offline_evidence} onChange={(x) => setS({ ...s, confirm_offline_evidence: x })}>I personally checked the rep's evidence: the signed document exists and the signer is genuine.</Check>}
      {s.decision === 'approve' && (needPay || s.accept_unpaid_terms) && <><Check checked={s.accept_unpaid_terms} onChange={(x) => setS({ ...s, accept_unpaid_terms: x })}>No payment has been received. I accept unpaid terms for this sale (commission stays pending until payment).</Check>{s.accept_unpaid_terms && <Field label="Why (15+ characters)"><Input value={s.unpaid_reason} onChange={(e) => setS({ ...s, unpaid_reason: e.target.value })} /></Field>}</>}
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind={s.decision === 'approve' ? 'primary' : 'danger'} onClick={submit}>{s.decision === 'approve' ? 'Verify sale' : 'Reject'}</Btn>
    </Modal>
  )
}

function ManualModal({ s, setS, onClose, onDone }) {
  const [err, setErr] = useState(null)
  const submit = async () => { const r = await api('salespay', 'record-manual', { body: { proposal_id: s.proposal_id, amount_cents: Math.round(Number(s.amount) * 100), method: s.method, evidence: s.evidence } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return (
    <Modal title="Record an external payment" onClose={onClose}>
      <Field label="Proposal id"><Input value={s.proposal_id} onChange={(e) => setS({ ...s, proposal_id: e.target.value })} /></Field>
      <Field label="Amount ($) — must equal the amount due"><Input type="number" step="0.01" value={s.amount} onChange={(e) => setS({ ...s, amount: e.target.value })} /></Field>
      <Field label="Method"><Select value={s.method} onChange={(e) => setS({ ...s, method: e.target.value })}>{['check', 'ach', 'cash', 'wire', 'other'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
      <Field label="Evidence" hint="Reference number, deposit date, who confirmed it (15+ characters)"><Textarea rows={3} value={s.evidence} onChange={(e) => setS({ ...s, evidence: e.target.value })} /></Field>
      {err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={submit}>Record</Btn>
    </Modal>
  )
}
