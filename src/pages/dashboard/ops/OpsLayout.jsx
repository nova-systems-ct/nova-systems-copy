import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useOrg } from '../../../lib/OrgContext'
import { api, useLoad, C, css, Card, Field, Loading, ErrorBox, Empty, Badge, TestBadge, PageHeader, useAction } from './ui'

const TABS = [
  ['', 'Overview'], ['inbox', 'Inbox'], ['requests', 'Requests & jobs'], ['campaigns', 'Campaigns'],
  ['install', 'Install Systems'], ['test', 'Test center'], ['reports', 'Weekly reports'], ['monitoring', 'Monitoring'], ['settings', 'Settings'],
]

export function useBusiness() {
  const { currentOrg, currentOrgId, setCurrentOrg, organizations, reload } = useOrg()
  return { orgId: currentOrgId, org: currentOrg, setOrg: setCurrentOrg, organizations, reloadOrgs: reload }
}

export default function OpsLayout() {
  const { org, orgId } = useBusiness()
  const biz = useLoad(() => api('businesses'), [])
  const mine = biz.data?.businesses?.find((b) => b.id === orgId)
  const isNova = org?.kind === 'nova_internal'
  const { pathname } = useLocation()
  // Nova runs on Nova: once Nova's own organization is set up as a business (operations settings exist), it gets the same
  // tabs as any business; the list of client businesses moves to its own tab.
  const novaInstalled = isNova && !!mine?.settings
  const showList = isNova && (!novaInstalled || pathname.startsWith('/dashboard/ops/businesses'))
  return (
    <div className="ops-wrap">
      <style>{css}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: C.gold }}>Nova Operations</span>
        {mine?.settings?.is_test && <TestBadge />}
      </div>
      {isNova && biz.loading ? <Loading /> : showList ? <>{novaInstalled && <Tabs isNova />}<Businesses list={biz} /></> : (
        <>
          <Tabs isNova={isNova} />
          {biz.loading ? <Loading /> : !mine ? <ErrorBox error={{ status: 403, message: 'You do not have Operations access for this organization. Choose another business from the organization menu.' }} /> : <Outlet context={{ orgId, business: mine }} />}
        </>
      )}
    </div>
  )
}

function Tabs({ isNova }) {
  return (
    <nav className="ops-tabs" aria-label="Operations sections">
      {[...TABS, ...(isNova ? [['businesses', 'Client businesses']] : [])].map(([to, label]) => <NavLink key={to} end={to === ''} to={`/dashboard/ops${to ? `/${to}` : ''}`} className={({ isActive }) => `ops-tab${isActive ? ' active' : ''}`}>{label}</NavLink>)}
    </nav>
  )
}

// The businesses Nova operates for clients, and adding new ones.
function Businesses({ list }) {
  const { reloadOrgs } = useBusiness()
  const [name, setName] = useState(''); const [industry, setIndustry] = useState(''); const [isTest, setIsTest] = useState(true)
  const act = useAction()
  const create = async (e) => {
    e.preventDefault()
    const r = await act.run(() => api('businesses', { method: 'POST', body: { name, industry, is_test: isTest } }), (x) => `Created ${x.business.name}. Switch to it below.`)
    if (r) { setName(''); setIndustry(''); list.reload() }
  }
  const rows = (list.data?.businesses || []).filter((b) => b.kind !== 'nova_internal')
  return (
    <>
      <PageHeader title="Businesses" sub="Client businesses Nova operates. Choose one to see its inbox, requests, campaigns and reports." />
      <ErrorBox error={list.error} onRetry={list.reload} />
      <div className="ops-two">
        <Card title="Your businesses">
          {list.loading ? <Loading /> : !rows.length ? <Empty>No client businesses yet.</Empty> : (
            <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Business</th><th>Status</th><th /></tr></thead><tbody>
              {rows.map((b) => <tr key={b.id}><td>{b.name} {b.settings?.is_test && <TestBadge />}<div style={{ color: C.faint, fontSize: 12 }}>{b.settings?.industry || ''}</div></td>
                <td><Badge value={b.settings?.go_live_approved_at ? 'approved' : 'draft'} label={b.settings?.go_live_approved_at ? 'live' : 'setup'} /></td>
                <td><button className="ops-btn" onClick={() => reloadOrgs(b.id)}>Open</button></td></tr>)}
            </tbody></table></div>
          )}
        </Card>
        {list.data?.nova_owner && (
          <Card title="Add a business">
            <form onSubmit={create}>
              <Field label="Business name" id="biz-name"><input id="biz-name" className="ops-input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
              <Field label="Industry" id="biz-ind" hint="Start with low-regulation, scheduled services. Healthcare is not supported in this version."><input id="biz-ind" className="ops-input" value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: C.dim, marginBottom: 12 }}>
                <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} /> Nova-owned TEST business (excluded from client results)
              </label>
              <button className="ops-btn primary" disabled={act.busy}>Create business</button>
              {act.view}
            </form>
          </Card>
        )}
      </div>
      <p style={{ color: C.faint, fontSize: 12, marginTop: 16 }}>Tip: the organization menu in the sidebar switches between businesses. <Link to="/dashboard" style={{ color: C.gold }}>Back to Nova HQ</Link></p>
    </>
  )
}
