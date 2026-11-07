import { useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { api, useLoad, useAction, C, Card, Loading, ErrorBox, Badge, PageHeader, Notice, when } from './ui'
import ChannelCenter from '../ChannelCenter'

const STAGE = { 2: 'Business inputs', 3: 'Connections', 4: 'Agents and monitoring', 5: 'Modules', 6: 'Controlled test' }
const MOD_STATUS = { selected: ['pending', 'Chosen, not installed yet'], installing: ['pending', 'Installing'], installed: ['ready', 'Installed'], blocked: ['blocked', 'Blocked'], failed: ['failed', 'Failed'], disabled: ['cancelled', 'Turned off'] }
// Module catalog: recommendations from the audit, owner choice, state, and turn off / on (records are kept when off).
function ModulesCard({ orgId, onChanged }) {
  const d = useLoad(() => api('install', { org: orgId, query: { action: 'modules' } }), [orgId])
  const act = useAction(); const [offFor, setOffFor] = useState(null); const [why, setWhy] = useState('')
  const post = (body, ok) => act.run(() => api('install', { org: orgId, method: 'POST', body }), ok).then((r) => { if (r) { d.reload(); onChanged?.() } return r })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />
  const mods = d.data?.modules || []
  return (
    <Card title="Modules" style={{ marginBottom: 16 }}>
      <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>Choose what Nova installs. Recommendations come from {d.data?.audit ? <>this business's own audit ({d.data.audit.business}, <Link to={`/dashboard/audit/${d.data.audit.case_id}`} style={{ color: C.gold }}>open</Link>)</> : 'the core operating needs (no audit of this business with findings yet)'}; audits of other businesses in this workspace are never used here. Choosing a module changes nothing until you press Install Systems.</p>
      {(d.data?.business_choices || []).length > 1 && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.dim, marginBottom: 10 }}>This installation is for
          <select className="ops-select" style={{ width: 'auto' }} value={d.data.self_business_id || ''} onChange={(e) => e.target.value && post({ action: 'set-self-business', business_id: e.target.value }, 'Saved. Recommendations now use that business\'s audit.')}>
            <option value="">{`(automatic: ${d.data.audit_basis})`}</option>
            {d.data.business_choices.map((b) => <option key={b.business_id} value={b.business_id}>{b.name}</option>)}
          </select>
        </label>
      )}
      {d.data?.fix_tasks?.total > 0 && <p style={{ fontSize: 13, color: C.dim, margin: '0 0 10px' }}>Fix tasks from the audit: {d.data.fix_tasks.open} open, {d.data.fix_tasks.completed} completed. A task being created is not the fix itself.</p>}
      {act.view}
      <div style={{ display: 'grid', gap: 10 }}>
        {mods.map((m) => {
          const st = m.state?.status; const [tone, label] = MOD_STATUS[st] || ['unknown', 'Not chosen']
          return (
            <div key={m.key}>
            <details style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
              <summary style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', listStyle: 'none' }}>
                <strong style={{ fontSize: 14 }}>{m.name}</strong>
                {m.recommended && <Badge value="ready" label={m.core ? 'core' : 'recommended'} />}
                <Badge value={tone} label={label} />
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }} onClick={(e) => e.preventDefault()}>
                  {!st && <button className="ops-btn primary" aria-label={`Choose ${m.name}`} disabled={act.busy} onClick={() => post({ action: 'select-module', module_key: m.key }, `${m.name} chosen. Press Install Systems to install it.`)}>Choose</button>}
                  {st === 'selected' && <button className="ops-btn" aria-label={`Remove ${m.name}`} disabled={act.busy} onClick={() => post({ action: 'select-module', module_key: m.key, selected: false }, `${m.name} removed from the plan.`)}>Remove</button>}
                  {['installed', 'blocked', 'failed'].includes(st) && <button className="ops-btn danger" aria-label={`Turn off ${m.name}`} disabled={act.busy} onClick={() => { setOffFor(m.key); setWhy('') }}>Turn off</button>}
                  {st === 'disabled' && <button className="ops-btn primary" aria-label={`Turn on ${m.name}`} disabled={act.busy} onClick={() => post({ action: 'enable-module', module_key: m.key }, `${m.name} turned back on.`)}>Turn on</button>}
                </span>
              </summary>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 8, display: 'grid', gap: 6 }}>
                <div>{m.purpose}</div>
                {m.reasons?.length > 0 && <div><strong style={{ color: C.text }}>Why:</strong> {m.reasons.join('; ')}</div>}
                <div><strong style={{ color: C.text }}>Needs:</strong> {m.inputs.join('; ')}</div>
                <div><strong style={{ color: C.text }}>Can touch:</strong> {m.permissions.join('; ')}</div>
                <div><strong style={{ color: C.text }}>Costs:</strong> {m.costs.join('; ')}</div>
                {m.dependencies.length > 0 && <div><strong style={{ color: C.text }}>Requires:</strong> {m.dependencies.map((k) => mods.find((x) => x.key === k)?.name || k).join(', ')}</div>}
                {st === 'disabled' && m.state.disabled_reason && <div style={{ color: C.amber }}>Turned off {when(m.state.disabled_at)}: {m.state.disabled_reason}. Its records are kept.</div>}
              </div>
            </details>
              {/* outside the collapsible panel so it is visible after pressing Turn off */}
              {offFor === m.key && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 2px 4px' }}>
                  <label htmlFor={`off-${m.key}`} style={{ fontSize: 13, color: C.dim }}>Why turn it off?</label>
                  <input id={`off-${m.key}`} className="ops-input" style={{ flex: '1 1 220px', width: 'auto' }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={m.key === 'agents_booking' ? 'e.g. answering inquiries myself this week' : ''} />
                  <button className="ops-btn danger" disabled={why.trim().length < 5 || act.busy} onClick={() => post({ action: 'disable-module', module_key: m.key, reason: why.trim() }, `${m.name} turned off.${m.key === 'agents_booking' ? ' New inquiries now go to a person.' : ''}`).then(() => setOffFor(null))}>Turn off now</button>
                  <button className="ops-btn" onClick={() => setOffFor(null)}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}


// Install Systems: one place to see what will be installed (from the audit and current configuration), run it, see each
// component's real result with the exact next action, and activate when every required component is done.
export default function OpsInstall() {
  const { orgId, business } = useOutletContext()
  const d = useLoad(() => api('install', { org: orgId, query: { action: 'view' } }), [orgId])
  const act = useAction()
  const cur = d.data?.current
  const comps = (cur?.manifest || d.data?.preview)?.components || []
  const steps = Object.fromEntries((cur?.steps || []).map((s) => [s.step_key, s]))
  const audit = (cur?.manifest || {}).audit
  const run = async () => {
    let plan = cur
    if (!plan || d.data?.changed_since || ['superseded', 'activated'].includes(plan.status)) plan = await act.run(() => api('install', { org: orgId, method: 'POST', body: { action: 'prepare' } }), null)
    if (!plan) return
    await act.run(() => api('install', { org: orgId, method: 'POST', body: { action: 'run', manifest_id: plan.id } }), (x) => (x.status === 'installed' ? 'Installed. Every required component is done — you can activate.' : x.status === 'partial' ? 'Installed what was possible. The blocked items below need an owner action.' : 'Some steps failed; see the details below.'))
    d.reload()
  }
  const activate = async () => { await act.run(() => api('install', { org: orgId, method: 'POST', body: { action: 'activate', manifest_id: cur.id } }), 'Activation recorded after fresh checks. Messaging and live payments keep their separate controls.'); d.reload() }
  const counts = comps.reduce((a, c) => { const st = steps[c.key]?.status || 'pending'; a[st] = (a[st] || 0) + 1; return a }, {})
  const needsAttention = comps.filter(c => c.required && ['blocked', 'failed'].includes(steps[c.key]?.status))
  const required = comps.filter(c => c.required)
  const readyRequired = required.filter(c => ['done', 'skipped'].includes(steps[c.key]?.status)).length
  return (
    <>
      <PageHeader title="Install Systems" sub="Connect the business, test the customer journey, then activate. Every run rechecks the current setup." />
      <style>{`.ops-install-step { display: grid; grid-template-columns: minmax(0, .9fr) auto minmax(0, 1.5fr); gap: 12px; align-items: start; padding: 14px 0; border-bottom: 1px solid ${C.line}; font-size: 13px; overflow-wrap: anywhere; } @media (max-width: 680px) { .ops-install-step { grid-template-columns: minmax(0, 1fr); gap: 7px; } }`}</style>
      <ErrorBox error={d.error} onRetry={d.reload} />
      {act.view}
      {business?.can_configure&&<details style={{margin:'16px 0',border:`1px solid ${C.line}`,padding:18,borderRadius:10}}><summary style={{cursor:'pointer',fontSize:17}}>Connect business accounts</summary><ChannelCenter /></details>}
      {d.loading ? <Loading /> : !d.error && (
        <>
          {needsAttention.length > 0 && <Card title="Finish the required setup" style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: C.dim }}>{needsAttention.length} required {needsAttention.length === 1 ? 'step needs' : 'steps need'} attention before activation. Start here.</p>
            {needsAttention.slice(0, 3).map(c => <p key={c.key} style={{ fontSize: 13, margin: '6px 0' }}><strong>{c.label}.</strong> <span style={{ color: C.dim }}>{steps[c.key]?.detail}</span></p>)}
            <Link to="/dashboard/ops/settings" className="ops-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>Open business settings</Link>
          </Card>}
          <Card title={cur ? `Installation plan v${cur.version} · ${cur.status}` : 'Installation plan (not prepared yet)'} actions={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="ops-btn primary" disabled={act.busy || cur?.status === 'installing'} onClick={run}>{act.busy ? 'Installing…' : 'Install Systems'}</button>{cur?.status === 'installed' && <button className="ops-btn" disabled={act.busy || d.data?.changed_since} onClick={activate}>Activate</button>}</div>}>
            <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>{readyRequired} of {required.length} required checks passed{counts.failed ? ` · ${counts.failed} failed` : ''}{cur?.activated_at ? ` · activated ${when(cur.activated_at)}` : ''}</p>
            {d.data?.changed_since && <Notice tone="warn">The configuration or audit changed since this plan was prepared. Install Systems will prepare a new version first.</Notice>}
            {(cur?.steps || []).some((s) => s.stage === 5) && (
              <details style={{ marginTop: 14 }} open={cur.steps.some(s => s.stage === 5 && ['blocked', 'failed'].includes(s.status))}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.gold, padding: '10px 0' }}>Module verification · {cur.steps.filter(s => s.stage === 5 && ['done', 'skipped'].includes(s.status)).length} of {cur.steps.filter(s => s.stage === 5).length} passed</summary>
                <div>
                  {cur.steps.filter((s) => s.stage === 5).map((s) => (
                    <div key={s.step_key} className="ops-install-step">
                      <strong>{s.label}</strong>
                      <div><Badge value={s.status === 'done' || s.status === 'skipped' ? 'ready' : s.status} label={s.evidence?.outcome || (s.status === 'skipped' ? 'not needed' : s.status)} /></div>
                      <div><div style={{ color: C.dim }}>{s.detail}</div>{s.owner_action && <div style={{ marginTop: 4, color: C.amber }}>Next: {s.owner_action}</div>}</div>
                    </div>))}
                </div>
              </details>
            )}
            {[2, 3, 4, 6].map((stage) => (
              <details key={stage} style={{ marginTop: 8, borderTop: `1px solid ${C.line}` }} open={comps.some(c => c.stage === stage && c.required && !['done', 'skipped'].includes(steps[c.key]?.status))}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.gold, padding: '14px 0' }}>{STAGE[stage]} · {comps.filter(c => c.stage === stage && ['done', 'skipped'].includes(steps[c.key]?.status)).length} of {comps.filter(c => c.stage === stage).length} passed</summary>
                <div>
                  {comps.filter((c) => c.stage === stage).map((c) => { const s = steps[c.key]; return (
                    <div key={c.key} className="ops-install-step">
                      <div><strong>{c.label}</strong>{!c.required && <div style={{ color: C.faint, fontSize: 11 }}>optional</div>}</div>
                      <div><Badge value={s?.status === 'done' || s?.status === 'skipped' ? 'ready' : s?.status || 'pending'} label={s?.status === 'skipped' ? 'not needed' : s?.status || 'pending'} /></div>
                      <div><div style={{ color: C.dim }}>{s?.detail || c.action}</div>{s?.owner_action && <div style={{ marginTop: 4, color: C.amber }}>Next: {s.owner_action}</div>}</div>
                    </div>) })}
                </div>
              </details>
            ))}
          </Card>
          <div style={{ marginTop: 16 }}><ModulesCard orgId={orgId} onChanged={d.reload} /></div>
          {audit && (
            <Card title="From the audit" style={{ marginTop: 16 }}>
              <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>This plan was prepared from the latest audit{audit.business ? ` of ${audit.business}` : ''}. <Link to={`/dashboard/audit/${audit.case_id}`} style={{ color: C.gold }}>Open the audit</Link></p>
              {(audit.newer_without_findings || []).map((n) => <Notice key={n.case_id} tone="warn">A newer audit{n.business ? ` of ${n.business}` : ''} was started {when(n.created_at)} and has no findings yet, so this plan still uses the earlier one. <Link to={`/dashboard/audit/${n.case_id}`} style={{ color: C.gold }}>Open the newer audit</Link></Notice>)}
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{audit.findings.map((f) => <li key={f.id} style={{ marginBottom: 6 }}><strong>{f.title}</strong>{f.fix && <div style={{ color: C.dim }}>Fix: {f.fix}</div>}</li>)}</ol>
            </Card>
          )}
        </>
      )}
    </>
  )
}
