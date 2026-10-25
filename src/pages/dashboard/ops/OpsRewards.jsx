import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, useLoad, useAction, C, Card, Field, Loading, ErrorBox, Empty, Badge, PageHeader, Notice, when } from './ui'

// crypto.randomUUID needs a secure context (missing on plain-http Wi-Fi testing); the fallback is unique enough per tap.
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

// Rewards (loyalty ledger behind Apple Wallet passes). The owner sets the economics; nothing has a default value.
export default function OpsRewards() {
  const { orgId, business } = useOutletContext()
  const d = useLoad(() => api('loyalty', { org: orgId }), [orgId])
  const act = useAction()
  const [open, setOpen] = useState(null)
  const go = (body, ok) => act.run(() => api('loyalty', { org: orgId, method: 'POST', body }), ok).then((r) => { d.reload(); return r })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />
  const { programs, accounts, wallet } = d.data
  const live = programs.find((p) => ['approved', 'paused'].includes(p.status))
  const drafts = programs.filter((p) => p.status === 'draft')
  return (
    <>
      <PageHeader title="Rewards" sub="A points program the business approves. Customers earn on completed jobs; refunds reverse points; rewards are redeemed at the counter." />
      {act.view}
      <Notice tone="warn">Apple Wallet passes: not available yet. {wallet.reason}.</Notice>
      <div className="ops-two">
        <Card title={live ? `${live.name} · ${live.status} (v${live.version})` : 'No approved program'}>
          {live ? <Rules r={live.rules} /> : <Empty>Points are not being earned. Create and approve a program to start.</Empty>}
          {live && business.can_configure && <div style={{ display: 'flex', gap: 8 }}>
            {live.status === 'approved' && <button className="ops-btn" onClick={() => go({ action: 'pause', program_id: live.id }, 'Paused: no new points or redemptions.')}>Pause</button>}
            {live.status === 'paused' && <button className="ops-btn" onClick={() => go({ action: 'resume', program_id: live.id }, 'Resumed.')}>Resume</button>}
            <button className="ops-btn danger" onClick={() => go({ action: 'retire', program_id: live.id }, 'Retired.')}>Retire</button>
          </div>}
          {drafts.map((p) => <div key={p.id} style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10 }}><strong>Draft v{p.version}: {p.name}</strong><Rules r={p.rules} />
            {business.can_configure ? <button className="ops-btn primary" disabled={act.busy || !!live} onClick={() => go({ action: 'approve-program', program_id: p.id }, 'Approved. Completed jobs now earn points.')}>Approve these exact rules</button> : <Notice tone="warn">Waiting for the business owner's approval.</Notice>}
            {live && <p style={{ fontSize: 12, color: C.faint }}>Retire the current program before approving this one.</p>}
          </div>)}
        </Card>
        {business.can_configure && <NewProgram onCreate={(body) => go({ action: 'create-program', ...body }, 'Draft saved. Approve it to start earning.')} busy={act.busy} />}
      </div>
      <Card title="Customer accounts" style={{ marginTop: 16 }}>
        {!accounts.length ? <Empty>No customer has earned points yet.</Empty> : (
          <table className="ops-table"><thead><tr><th>Customer</th><th>Points</th><th>Last change</th><th /></tr></thead><tbody>
            {accounts.map((a) => <tr key={a.id}><td>{a.crm_contacts?.name || '—'}</td><td><strong>{a.balance}</strong></td><td style={{ color: C.dim }}>{when(a.updated_at)}</td><td><button className="ops-btn" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? 'Close' : 'Open'}</button></td></tr>)}
          </tbody></table>
        )}
      </Card>
      {open && <Account orgId={orgId} id={open} live={live} go={go} busy={act.busy} canConfigure={business.can_configure} />}
    </>
  )
}

function Rules({ r }) {
  return <p style={{ fontSize: 13, color: C.dim }}>{r.earn_points} point(s) {r.earn_type === 'per_dollar' ? 'per whole dollar of each completed job' : 'per completed job'} · {r.reward_threshold} points = {r.reward_description} · {r.expiry_days ? `points expire after ${r.expiry_days} days` : 'points do not expire'} · at most {r.max_earns_per_day} earn(s) per customer per day<br /><span style={{ color: C.faint }}>Terms: {r.terms_text}</span></p>
}

function NewProgram({ onCreate, busy }) {
  const [f, setF] = useState({ name: '', earn_type: 'per_completed_job', earn_points: '', reward_threshold: '', reward_description: '', expiry_days: '', max_earns_per_day: '', terms_text: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const n = (v) => (v === '' ? undefined : Number(v))
  return (
    <Card title="New program (draft)">
      <p style={{ fontSize: 12, color: C.faint }}>Every value here is the business's decision. Cash, gift-card and store-credit rewards are not supported: they create a stored-value liability.</p>
      <Field label="Program name" id="lp-name"><input id="lp-name" className="ops-input" value={f.name} onChange={set('name')} /></Field>
      <Field label="How points are earned" id="lp-type"><select id="lp-type" className="ops-select" value={f.earn_type} onChange={set('earn_type')}><option value="per_completed_job">Per completed job</option><option value="per_dollar">Per whole dollar of the job</option></select></Field>
      <div className="ops-two">
        <Field label="Points earned" id="lp-pts"><input id="lp-pts" type="number" className="ops-input" value={f.earn_points} onChange={set('earn_points')} /></Field>
        <Field label="Points for one reward" id="lp-thr"><input id="lp-thr" type="number" className="ops-input" value={f.reward_threshold} onChange={set('reward_threshold')} /></Field>
        <Field label="Points expire after (days, blank = never)" id="lp-exp"><input id="lp-exp" type="number" className="ops-input" value={f.expiry_days} onChange={set('expiry_days')} /></Field>
        <Field label="Earns per customer per day, at most" id="lp-max"><input id="lp-max" type="number" className="ops-input" value={f.max_earns_per_day} onChange={set('max_earns_per_day')} /></Field>
      </div>
      <Field label="The reward" id="lp-rew"><input id="lp-rew" className="ops-input" value={f.reward_description} onChange={set('reward_description')} placeholder="e.g. one free interior wipe-down" /></Field>
      <Field label="Terms customers will see" id="lp-terms"><textarea id="lp-terms" className="ops-textarea" rows={3} value={f.terms_text} onChange={set('terms_text')} /></Field>
      <button className="ops-btn primary" disabled={busy} onClick={() => onCreate({ name: f.name, rules: { earn_type: f.earn_type, earn_points: n(f.earn_points), reward_threshold: n(f.reward_threshold), reward_description: f.reward_description, expiry_days: f.expiry_days === '' ? null : n(f.expiry_days), max_earns_per_day: n(f.max_earns_per_day), terms_text: f.terms_text } })}>Save draft</button>
    </Card>
  )
}

function Account({ orgId, id, live, go, busy, canConfigure }) {
  const d = useLoad(() => api('loyalty', { org: orgId, query: { account_id: id } }), [orgId, id])
  const [adj, setAdj] = useState({ points: '', reason: '' })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} />
  const { account, ledger } = d.data
  const enough = live?.status === 'approved' && account.balance >= (live?.rules?.reward_threshold || Infinity)
  const reload = (p) => p.then((r) => { d.reload(); return r })
  return (
    <Card title={`${account.crm_contacts?.name || 'Customer'} · ${account.balance} points`} style={{ marginTop: 16 }}>
      <button className="ops-btn primary" disabled={busy || !enough} onClick={() => reload(go({ action: 'redeem', account_id: account.id, request_id: `ui-${newId()}` }, (x) => `Redeemed: ${x.reward}.`))}>Redeem {live?.rules?.reward_description || 'reward'}</button>
      {!enough && <span style={{ fontSize: 12, color: C.faint, marginLeft: 8 }}>{live?.status === 'approved' ? `Needs ${live.rules.reward_threshold} points.` : 'No approved program.'}</span>}
      <table className="ops-table" style={{ marginTop: 10 }}><thead><tr><th>When</th><th>What</th><th>Points</th><th>Balance</th></tr></thead><tbody>
        {ledger.map((e) => <tr key={e.id}><td style={{ color: C.dim }}>{when(e.created_at)}</td><td><Badge value={e.kind === 'earn' ? 'ready' : e.kind === 'redeem' ? 'approved' : 'partial'} label={e.kind} /> {e.reason}</td><td>{e.points > 0 ? `+${e.points}` : e.points}</td><td>{e.balance_after}</td></tr>)}
      </tbody></table>
      {canConfigure && <div className="ops-two" style={{ marginTop: 10 }}>
        <Field label="Adjust points (+/−)" id="adj-p"><input id="adj-p" type="number" className="ops-input" value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} /></Field>
        <Field label="Reason (recorded)" id="adj-r"><input id="adj-r" className="ops-input" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></Field>
        <button className="ops-btn" disabled={busy} onClick={() => reload(go({ action: 'adjust', account_id: account.id, points: Number(adj.points), reason: adj.reason }, 'Adjustment recorded.'))}>Record adjustment</button>
      </div>}
    </Card>
  )
}
