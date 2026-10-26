import { useState, useEffect, useCallback } from 'react'
import { authedFetch } from '../../../lib/apiAuth'
import { useOrg } from '../../../lib/OrgContext'
import { C, css, Card, Badge, Notice, when } from '../ops/ui'

// Workers (repair 2026-10-26, brief §7). Only capabilities with real, tested code can be registered (api/_workerCapabilities.js).
// Status comes from the registry; activity comes from the job queue (completed / failed / waiting in the last 7 days),
// never from animation. Pausing holds that worker's queued jobs; resuming lets them run. The hierarchy shows who each worker
// reports to; roles without an implementation (CTO, CFO, committees) are not shown as active.
async function call(op, { method = 'GET', body } = {}) {
  const r = await authedFetch(`/api/client?resource=hierarchy&op=${op}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `The server answered ${r.status}.`)
  return j
}
const STATUS = { active: ['running', 'Active'], restricted: ['pending', 'Restricted'], suspended: ['paused', 'Paused'], inactive: ['cancelled', 'Retired'], draft: ['draft', 'Draft'], onboarding: ['draft', 'Onboarding'], training: ['draft', 'Training'] }

export default function Workforce() {
  const { user, currentMembership } = useOrg()
  const isOwner = currentMembership?.role === 'nova_super_admin'
  const [data, setData] = useState(null); const [people, setPeople] = useState([]); const [err, setErr] = useState('')
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(null); const [pauseFor, setPauseFor] = useState(null); const [reason, setReason] = useState('')
  const load = useCallback(async () => {
    try { const [c, w] = await Promise.all([call('capabilities'), call('workers')]); setData(c); setPeople(w.filter((x) => !x.capability_key)); setErr('') } catch (e) { setErr(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const register = async (cap) => { setBusy(cap.key); setMsg(null); try { const r = await call('register-capability', { method: 'POST', body: { capability_key: cap.key } }); setMsg({ tone: 'ok', text: r.already_registered ? `${cap.name} was already registered.` : `${cap.name} registered and active.` }); await load() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } setBusy('') }
  const setStatus = async (cap, status, why) => { setBusy(cap.key); setMsg(null); try { await call('set-worker-status', { method: 'POST', body: { id: cap.worker.id, status, reason: why } }); setMsg({ tone: 'ok', text: status === 'suspended' ? `${cap.name} paused. Its queued work waits until you resume it.` : `${cap.name} resumed.` }); setPauseFor(null); setReason(''); await load() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } setBusy('') }

  const caps = data?.capabilities || []
  const registered = caps.filter((c) => c.worker)
  const roles = [...new Set(caps.map((c) => c.role))]
  const ownerName = (user?.user_metadata?.full_name && !/^(local test|test)\b/i.test(user.user_metadata.full_name)) ? user.user_metadata.full_name : (user?.email || 'Owner')
  return (
    <div className="ops-wrap" style={{ maxWidth: 1080 }}>
      <style>{css}</style>
      <header style={{ marginBottom: 16 }}>
        <p style={{ color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', margin: 0 }}>Workers</p>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: '6px 0 4px', color: C.text }}>Who does the work</h1>
        <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>{registered.length} of {caps.length} workers registered · background worker {data?.heartbeat_at ? `last seen ${when(data.heartbeat_at)}` : 'not seen yet'}</p>
      </header>
      {err && <Notice tone="bad">Workers could not be loaded: {err} <button className="ops-btn" onClick={load}>Try again</button></Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!data && !err && <p role="status" style={{ color: C.faint }}>Loading workers…</p>}

      {data && (
        <>
          <Card title="Hierarchy" style={{ marginBottom: 16 }}>
            <div role="tree" aria-label="Reporting lines" style={{ fontSize: 14 }}>
              <div role="treeitem" aria-expanded="true" style={{ fontWeight: 600 }}>{ownerName} <span style={{ color: C.faint, fontWeight: 400 }}>· Owner, approves policy, campaigns and reports</span>
                <div role="group" style={{ borderLeft: `1px solid ${C.line}`, marginLeft: 8, paddingLeft: 16, marginTop: 8 }}>
                  <div role="treeitem" aria-expanded="true" style={{ fontWeight: 600, color: C.dim }}>Coordination <span style={{ color: C.faint, fontWeight: 400 }}>· handled by the owner today; no automated coordinator is built</span>
                    <div role="group" style={{ borderLeft: `1px solid ${C.line}`, marginLeft: 8, paddingLeft: 16, marginTop: 8, display: 'grid', gap: 10 }}>
                      {roles.map((role) => (
                        <div key={role} role="treeitem" aria-expanded="true">
                          <div style={{ fontSize: 12, color: C.gold, letterSpacing: '.08em', textTransform: 'uppercase' }}>{role}</div>
                          {caps.filter((c) => c.role === role).map((c) => (
                            <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
                              <span style={{ color: c.worker ? C.text : C.faint }}>{c.name}</span>
                              {c.worker ? <Badge value={(STATUS[c.worker.status] || STATUS.draft)[0]} label={(STATUS[c.worker.status] || STATUS.draft)[1]} /> : <span style={{ fontSize: 12, color: C.faint }}>not registered</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                      {people.map((p) => <div key={p.id} role="treeitem"><span>{p.display_name}</span> <span style={{ fontSize: 12, color: C.faint }}>· {p.worker_type}</span> <Badge value={(STATUS[p.status] || STATUS.draft)[0]} label={(STATUS[p.status] || STATUS.draft)[1]} /></div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gap: 12 }}>
            {caps.map((c) => {
              const blockers = c.readiness.filter((x) => !x.ok)
              return (
                <Card key={c.key} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{c.name} {c.worker ? <Badge value={(STATUS[c.worker.status] || STATUS.draft)[0]} label={(STATUS[c.worker.status] || STATUS.draft)[1]} /> : <Badge value="unknown" label="Not registered" />}</span>}
                  actions={isOwner && (!c.worker ? <button className="ops-btn primary" disabled={busy === c.key} onClick={() => register(c)}>{busy === c.key ? 'Registering…' : 'Register this worker'}</button>
                    : c.worker.status === 'suspended' ? <button className="ops-btn primary" disabled={busy === c.key} onClick={() => setStatus(c, 'active', 'Resumed by the owner from the Workers page')}>Resume</button>
                    : c.worker.status === 'active' ? <button className="ops-btn" disabled={busy === c.key} onClick={() => { setPauseFor(c.key); setReason('') }}>Pause</button> : null)}>
                  <p style={{ fontSize: 14, color: C.dim, marginTop: 0 }}>{c.does}</p>
                  {pauseFor === c.key && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      <label htmlFor={`why-${c.key}`} style={{ fontSize: 13, color: C.dim }}>Why pause?</label>
                      <input id={`why-${c.key}`} className="ops-input" style={{ flex: '1 1 220px', width: 'auto' }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. reviewing replies before more go out" />
                      <button className="ops-btn danger" disabled={reason.trim().length < 5 || busy === c.key} onClick={() => setStatus(c, 'suspended', reason.trim())}>Pause now</button>
                      <button className="ops-btn" onClick={() => setPauseFor(null)}>Cancel</button>
                    </div>
                  )}
                  <div className="ops-two">
                    <div>
                      <div style={{ fontSize: 12, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Readiness</div>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                        {c.readiness.map((x) => <li key={x.label} style={{ fontSize: 13 }}><span style={{ color: x.ok ? C.green : C.amber }}>{x.ok ? '✓' : '•'}</span> {x.label}: <span style={{ color: C.dim }}>{x.note}</span></li>)}
                      </ul>
                      {!blockers.length && <p style={{ fontSize: 12, color: C.faint }}>Nothing blocking.</p>}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Recorded activity · 7 days</div>
                      {c.job_types.length ? (
                        <p style={{ fontSize: 13, margin: 0 }}>{c.activity.completed_7d} completed · {c.activity.failed_7d} failed · {c.activity.waiting} waiting{c.paused && c.activity.waiting ? ' (held while paused)' : ''}<br /><span style={{ color: C.faint }}>{c.activity.last_completed_at ? `Last finished ${when(c.activity.last_completed_at)}` : 'No finished jobs yet'}</span></p>
                      ) : <p style={{ fontSize: 13, margin: 0, color: C.dim }}>Runs when you start it ({c.on_demand}).</p>}
                      <p style={{ fontSize: 12, color: C.faint, marginBottom: 0 }}>Code: {c.code}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          {!isOwner && <p style={{ fontSize: 12, color: C.faint }}>Only the owner can register, pause or resume workers.</p>}
        </>
      )}
    </div>
  )
}
