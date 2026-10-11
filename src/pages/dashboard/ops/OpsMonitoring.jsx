import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useOrg } from '../../../lib/OrgContext'
import { api, useLoad, C, Card, Loading, ErrorBox, Empty, Badge, PageHeader, when, useAction } from './ui'

export default function OpsMonitoring() {
  const { orgId, business } = useOutletContext()
  const { organizations } = useOrg()
  const novaStaff = organizations.some((o) => o.kind === 'nova_internal' && ['nova_super_admin', 'nova_admin'].includes(o.role))
  const health = useLoad(() => (novaStaff ? api('health') : Promise.resolve(null)), [novaStaff])
  const platform = useLoad(() => (novaStaff ? api('incidents') : Promise.resolve([])), [novaStaff])
  const mine = useLoad(() => api('incidents', { org: orgId }), [orgId])
  const act = useAction()
  const run = () => act.run(() => api('health', { method: 'POST' }), (r) => `Checked ${r.summary.checks} items: ${r.summary.opened} new incident(s), ${r.summary.resolved} recovered.`).then(() => { health.reload(); platform.reload() })
  return (
    <>
      <PageHeader title="Monitoring" sub="Measured health of the worker, queue, messaging, payments and providers. An alert is not a fix: incidents stay open until someone acknowledges and resolves them." right={novaStaff && <button className="ops-btn" onClick={run} disabled={act.busy}>Run checks now</button>} />
      {act.view}
      {novaStaff && (
        <div className="ops-two" style={{ marginBottom: 16 }}>
          <Card title="Health checks">
            {health.loading ? <Loading /> : health.error ? <ErrorBox error={health.error} /> : !health.data?.checks?.length ? <Empty>No checks have run yet. Checks run every 5 minutes once the worker is installed.</Empty> : (
              <div className="ops-scroll"><table className="ops-table"><tbody>
                {health.data.checks.map((c) => <tr key={c.check_key}><td>{c.check_key.replace(/_/g, ' ')}</td><td><Badge value={c.status} /></td><td style={{ color: C.faint, fontSize: 12 }}>{when(c.checked_at)}</td></tr>)}
              </tbody></table></div>
            )}
            {health.data && <p style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>Messaging mode: <strong>{health.data.send_mode === 'live' ? 'LIVE' : 'dry run (nothing is sent)'}</strong>{health.data.allowlist_active ? ' · test-recipient allowlist active' : ''}</p>}
          </Card>
          <Card title="Workers">
            {!health.data?.heartbeats?.length ? <Empty>No worker has ever reported in.</Empty> : health.data.heartbeats.map((h) => (
              <div key={h.worker_id} style={{ fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>{h.worker_id} · <Badge value={h.stopped_at ? 'failing' : Date.now() - new Date(h.last_seen_at) < 120000 ? 'healthy' : 'failing'} label={h.stopped_at ? 'stopped' : Date.now() - new Date(h.last_seen_at) < 120000 ? 'running' : 'silent'} /><div style={{ color: C.faint, fontSize: 12 }}>last seen {when(h.last_seen_at)} · {h.jobs_processed} jobs · last {h.last_job_type || '—'}</div></div>
            ))}
          </Card>
        </div>
      )}
      {novaStaff && <Incidents title="Platform incidents" list={platform} />}
      <Incidents title={`Incidents for ${business.name}`} list={mine} />
    </>
  )
}

function Incidents({ title, list }) {
  const act = useAction(); const [note, setNote] = useState({})
  const go = (id, action) => act.run(() => api('incidents', { method: 'POST', body: { incident_id: id, action, note: note[id], resolution: note[id] } }), action === 'acknowledge' ? 'Acknowledged.' : 'Resolved.').then(() => list.reload())
  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      {act.view}
      {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !list.data?.length ? <Empty>No incidents.</Empty> : (
        <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Incident</th><th>Status</th><th>Seen</th><th>Alerts</th><th>Action</th></tr></thead><tbody>
          {list.data.map((i) => (
            <tr key={i.id}>
              <td>{i.title}<div style={{ color: C.faint, fontSize: 11 }}>{i.check_key} · {i.severity}</div>{i.resolution && <div style={{ color: C.dim, fontSize: 12 }}>{i.resolution}</div>}</td>
              <td><Badge value={i.status} /></td>
              <td style={{ fontSize: 12, color: C.dim }}>{when(i.first_seen_at)} → {when(i.last_seen_at)}<div>{i.occurrences}×</div></td>
              <td style={{ fontSize: 12 }}>{i.alerts_sent}{i.detail?.last_alert && <div style={{ color: C.faint }}>email: {i.detail.last_alert.email}</div>}</td>
              <td style={{ minWidth: 220 }}>{i.status !== 'resolved' && (
                <>
                  <input aria-label="Note" className="ops-input" placeholder={i.status === 'open' ? 'Note (optional)' : 'What was done (required)'} value={note[i.id] || ''} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {i.status === 'open' && <button className="ops-btn" disabled={act.busy} onClick={() => go(i.id, 'acknowledge')}>Acknowledge</button>}
                    <button className="ops-btn primary" disabled={act.busy} onClick={() => go(i.id, 'resolve')}>Resolve</button>
                  </div>
                </>
              )}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </Card>
  )
}
