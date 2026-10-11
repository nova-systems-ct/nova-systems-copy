import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useOrg } from '../../../lib/OrgContext'
import { GOLD, LINE, MUTED } from '../../../components/sales/kit'

// Nova HQ → Sales Team. Each tab is visible only if the caller's role grants the permission that tab's API requires; the API re-checks
// every request, so hiding a tab is convenience, not security.
export const TABS = [
  { to: 'overview', label: 'Overview', perm: 'sales.manage' },
  { to: 'hiring', label: 'Hiring', perm: 'sales.hiring' },
  { to: 'reps', label: 'Representatives', perm: 'sales.manage' },
  { to: 'leads', label: 'Leads & pipeline', perm: 'sales.manage' },
  { to: 'academy', label: 'Academy', perm: 'sales.manage' },
  { to: 'documents', label: 'Agreements', perm: 'sales.owner' },
  { to: 'catalog', label: 'Catalog & toolkit', perm: 'sales.owner' },
  { to: 'verification', label: 'Verification', perm: 'sales.owner' },
  { to: 'commissions', label: 'Commissions', perm: 'sales.finance' },
  { to: 'settings', label: 'Settings', perm: 'sales.owner' },
]

export default function SalesTeamLayout() {
  const { hasPermission, loading } = useOrg()
  const loc = useLocation()
  if (loading) return null
  const tabs = TABS.filter((t) => hasPermission(t.perm))
  if (!tabs.length) return <div style={{ padding: '80px 24px', textAlign: 'center', color: MUTED }}>You don't have access to the Sales Team area.</div>
  if (loc.pathname.replace(/\/$/, '') === '/dashboard/sales-team') return <Navigate to={tabs[0].to} replace />
  return (
    <div>
      <nav aria-label="Sales Team" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '10px clamp(16px,4vw,40px) 0', borderBottom: `1px solid ${LINE}`, position: 'sticky', top: 0, background: '#0A0A0A', zIndex: 20 }}>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} style={({ isActive }) => ({ color: isActive ? GOLD : MUTED, textDecoration: 'none', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 12px', borderBottom: `2px solid ${isActive ? GOLD : 'transparent'}`, whiteSpace: 'nowrap' })}>{t.label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
