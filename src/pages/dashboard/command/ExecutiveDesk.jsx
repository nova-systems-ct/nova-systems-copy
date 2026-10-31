import { useState, useEffect, useCallback } from 'react'
import { authedFetch } from '../../../lib/apiAuth'
import { C, Card, Badge, Notice, when } from '../ops/ui'

// The executive roles at work (owner brief 2026-10-30 §11): each role's latest task and result, spending decisions that
// need the owner, the owner's playbook settings, and the balance the CFO may use. Everything shown comes from saved
// records (work items, expense requests, balance snapshots); nothing here is animated or assumed.
async function call(op, { method = 'GET', body, org } = {}) {
  const qs = new URLSearchParams({ resource: 'roles', op, ...(method === 'GET' ? { organization_id: org } : {}) })
  const r = await authedFetch(`/api/client?${qs}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify({ organization_id: org, ...body }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `The server answered ${r.status}.`)
  return j
}
const NAMES = { executive_assistant: "Owner's executive assistant", coo: 'COO', cfo: 'CFO', cmo: 'CMO' }
const TASK = { assigned: ['pending', 'Received'], in_progress: ['running', 'Working'], in_review: ['approved', 'Result ready'], blocked: ['paused', 'Blocked'], failed: ['failed', 'Failed'], completed: ['approved', 'Completed'], draft: ['draft', 'Proposal'] }
const EXP = { proposed: ['pending', 'With the CFO'], needs_owner: ['paused', 'Needs you'], approved: ['approved', 'Approved'], denied: ['cancelled', 'Denied'], recorded: ['approved', 'Recorded'], cancelled: ['cancelled', 'Cancelled'] }
const money = (c) => (c == null ? 'unknown' : `$${(Number(c) / 100).toFixed(2)}`)

export default function ExecutiveDesk({ orgId }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState('')
  const [bal, setBal] = useState({ amount: '', label: 'Operating account', as_of: '' })
  const [prefs, setPrefs] = useState({})
  const load = useCallback(async () => {
    if (!orgId) return
    try { const r = await call('overview', { org: orgId }); setD(r); setPrefs(r.preferences || {}); setErr('') } catch (e) { setErr(e.message) }
  }, [orgId])
  useEffect(() => { load() }, [load])
  const act = async (key, op, body, ok) => { setBusy(key); setMsg(null); try { await call(op, { method: 'POST', body, org: orgId }); setMsg({ tone: 'ok', text: ok }); await load() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } setBusy('') }
  if (err) return <Notice tone="bad">The executive desk could not be loaded: {err} <button className="ops-btn" onClick={load}>Try again</button></Notice>
  if (!d) return <p role="status" style={{ color: C.faint }}>Loading the executive desk…</p>
  const latest = (role) => d.tasks.find((t) => t.role_key === role && !String(t.title).startsWith('Revive'))
  const waiting = d.expenses.filter((e) => e.status === 'needs_owner' || e.status === 'approved')
  return (
    <Card title="Executive desk" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: C.dim, marginTop: 0 }}>Each role works only while its worker is registered and active below. Results wait for your review; anything that needs your authority comes to you. No role sends messages, moves money or connects to a bank.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        {d.roles.map((r) => { const t = latest(r.key); return (
          <div key={r.key} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }} aria-label={`${NAMES[r.key]} role`}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>{NAMES[r.key]}</strong>
              {r.worker ? <Badge value={r.worker.status === 'active' ? 'running' : 'paused'} label={r.worker.status === 'active' ? 'Active' : r.worker.status} /> : <Badge value="unknown" label="Not registered" />}
            </div>
            {t ? <>
              <p style={{ fontSize: 13, margin: '8px 0 4px' }}><Badge value={(TASK[t.status] || TASK.assigned)[0]} label={(TASK[t.status] || TASK.assigned)[1]} /> <span style={{ color: C.faint, fontSize: 12 }}>{when(t.updated_at)}</span></p>
              <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>{t.result?.summary || t.last_error || t.title}</p>
            </> : <p style={{ fontSize: 13, color: C.faint, margin: '8px 0 0' }}>No task has run yet.</p>}
            {t?.status === 'in_review' && <button className="ops-btn" style={{ marginTop: 8, marginRight: 8 }} disabled={!!busy} onClick={() => act(t.id, 'mark-reviewed', { id: t.id }, `${NAMES[r.key]}: result marked reviewed.`)}>Mark reviewed</button>}
            <button className="ops-btn" style={{ marginTop: 8 }} disabled={!r.worker || busy === r.key} onClick={() => act(r.key, 'run-now', { role: r.key }, `${NAMES[r.key]}: task queued for the background worker.`)}>{busy === r.key ? 'Queuing…' : 'Run now'}</button>
          </div>
        ) })}
      </div>

      <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>Spending decisions</h3>
      {!waiting.length ? <p style={{ fontSize: 13, color: C.faint, margin: 0 }}>Nothing waits for you.</p> : waiting.map((e) => (
        <div key={e.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ fontSize: 14 }}>{money(e.amount_cents)} · {e.purpose}</strong><Badge value={(EXP[e.status] || EXP.proposed)[0]} label={(EXP[e.status] || EXP.proposed)[1]} /><span style={{ fontSize: 12, color: C.faint }}>asked by {String(e.requested_by_role).toUpperCase()}</span></div>
          {e.cfo_check && <p style={{ fontSize: 13, color: C.dim, margin: '4px 0' }}>CFO {e.cfo_check.recommendation === 'approve' ? 'recommends approving' : e.cfo_check.recommendation === 'deny' ? 'recommends against' : 'cannot check funds'}: {(e.cfo_check.reasons || []).join(' ')}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {e.status === 'needs_owner' && <><button className="ops-btn primary" disabled={!!busy} onClick={() => act(e.id, 'decide-expense', { id: e.id, decision: 'approve' }, 'Approved. Record it once it is paid.')}>Approve</button><button className="ops-btn danger" disabled={!!busy} onClick={() => act(e.id, 'decide-expense', { id: e.id, decision: 'deny' }, 'Denied.')}>Deny</button></>}
            {e.status === 'approved' && <button className="ops-btn" disabled={!!busy} onClick={() => act(e.id, 'record-expense', { id: e.id }, 'Recorded as spent.')}>Record as paid</button>}
          </div>
        </div>
      ))}

      <div className="ops-two" style={{ marginTop: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Balance the CFO may use</h3>
          <p style={{ fontSize: 13, color: C.dim, margin: '0 0 8px' }}>{d.balance ? `${money(d.balance.balance_cents)} in ${d.balance.account_label}, as of ${String(d.balance.as_of).slice(0, 10)} (entered by you)` : 'None entered. No bank is connected, so available funds are unknown.'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="ops-input" aria-label="Balance in dollars" inputMode="decimal" style={{ flex: '1 1 120px', width: 'auto' }} placeholder="Balance ($)" value={bal.amount} onChange={(e) => setBal({ ...bal, amount: e.target.value })} />
            <input className="ops-input" aria-label="Balance as of" type="date" style={{ flex: '1 1 140px', width: 'auto' }} value={bal.as_of} onChange={(e) => setBal({ ...bal, as_of: e.target.value })} />
            <button className="ops-btn" disabled={!bal.amount || !!busy} onClick={() => act('bal', 'add-balance', { balance_dollars: bal.amount, as_of: bal.as_of || undefined, account_label: bal.label }, 'Balance saved for the CFO.')}>Save balance</button>
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Your playbook</h3>
          {[['escalate_after_hours', 'Escalate items waiting longer than (hours)', 24], ['auto_approve_cents', 'CFO may approve automatically up to (cents)', 0], ['monthly_budget_cents', 'Monthly spending budget (cents)', null], ['cmo_test_budget_cents', 'CMO test budget per month (cents)', null]].map(([k, label, dflt]) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <label htmlFor={`pref-${k}`} style={{ fontSize: 13, color: C.dim, flex: '1 1 200px' }}>{label}</label>
              <input id={`pref-${k}`} className="ops-input" inputMode="numeric" style={{ width: 110 }} value={prefs[k] ?? ''} placeholder={dflt == null ? 'not set' : String(dflt)} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.value })} />
              <button className="ops-btn" disabled={prefs[k] === '' || prefs[k] == null || !!busy} onClick={() => act(k, 'set-preference', { key: k, value: prefs[k] }, 'Saved.')}>Save</button>
            </div>
          ))}
          <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>Nothing here authorizes spending until you set it; 0 means every expense comes to you.</p>
        </div>
      </div>
    </Card>
  )
}
