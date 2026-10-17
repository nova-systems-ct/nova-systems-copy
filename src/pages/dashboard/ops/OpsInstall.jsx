import { useOutletContext, Link } from 'react-router-dom'
import { api, useLoad, useAction, C, Card, Loading, Badge, PageHeader, Notice, when } from './ui'

const STAGE = { 2: 'Business inputs', 3: 'Connections', 4: 'Agents and monitoring', 6: 'Controlled test' }

// Install Systems: one place to see what will be installed (from the audit and current configuration), run it, see each
// component's real result with the exact next action, and activate when every required component is done.
export default function OpsInstall() {
  const { orgId } = useOutletContext()
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
  const activate = async () => { await act.run(() => api('install', { org: orgId, method: 'POST', body: { action: 'activate', manifest_id: cur.id } }), 'Activated. Approved capabilities are live for this business; outreach and live payments still need their own approval.'); d.reload() }
  const counts = comps.reduce((a, c) => { const st = steps[c.key]?.status || 'pending'; a[st] = (a[st] || 0) + 1; return a }, {})
  return (
    <>
      <PageHeader title="Install Systems" sub="What this business's installation consists of, installed in stages. Running it again only repeats what is not finished." />
      {act.view}
      {d.loading ? <Loading /> : (
        <>
          <Card title={cur ? `Installation plan v${cur.version} · ${cur.status}` : 'Installation plan (not prepared yet)'} actions={<div style={{ display: 'flex', gap: 8 }}><button className="ops-btn primary" disabled={act.busy || cur?.status === 'installing'} onClick={run}>{act.busy ? 'Installing…' : 'Install Systems'}</button>{cur?.status === 'installed' && <button className="ops-btn" disabled={act.busy} onClick={activate}>Activate</button>}</div>}>
            <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>{comps.length} components · done {counts.done || 0} · blocked {counts.blocked || 0} · failed {counts.failed || 0}{counts.skipped ? ` · not needed ${counts.skipped}` : ''}{cur?.activated_at ? ` · activated ${when(cur.activated_at)}` : ''}</p>
            {d.data?.changed_since && <Notice tone="warn">The configuration or audit changed since this plan was prepared. Install Systems will prepare a new version first.</Notice>}
            {[2, 3, 4, 6].map((stage) => (
              <div key={stage} style={{ marginTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.gold, margin: '0 0 6px' }}>{STAGE[stage]}</p>
                <table className="ops-table"><tbody>
                  {comps.filter((c) => c.stage === stage).map((c) => { const s = steps[c.key]; return (
                    <tr key={c.key}>
                      <td style={{ width: '30%' }}><strong>{c.label}</strong>{!c.required && <div style={{ color: C.faint, fontSize: 11 }}>optional</div>}</td>
                      <td style={{ width: 110 }}><Badge value={s?.status === 'done' ? 'ready' : s?.status === 'skipped' ? 'ready' : s?.status || 'pending'} label={s?.status === 'skipped' ? 'not needed' : s?.status || 'pending'} /></td>
                      <td style={{ fontSize: 13 }}><div style={{ color: C.dim }}>{s?.detail || c.action}</div>{s?.owner_action && <div style={{ marginTop: 4, color: '#E9B44C' }}>Next: {s.owner_action}</div>}</td>
                    </tr>) })}
                </tbody></table>
              </div>
            ))}
          </Card>
          {audit && (
            <Card title="From the audit" style={{ marginTop: 16 }}>
              <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>This plan was prepared from the latest audit{audit.business ? ` of ${audit.business}` : ''}. <Link to={`/dashboard/audit/${audit.case_id}`} style={{ color: C.gold }}>Open the audit</Link></p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{audit.findings.map((f) => <li key={f.id} style={{ marginBottom: 6 }}><strong>{f.title}</strong>{f.fix && <div style={{ color: C.dim }}>Fix: {f.fix}</div>}</li>)}</ol>
            </Card>
          )}
        </>
      )}
    </>
  )
}
