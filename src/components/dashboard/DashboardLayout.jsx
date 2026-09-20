import { useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, BrainCircuit, TrendingUp, PlayCircle, Building2, ShieldCheck,
  LogOut, Menu, X, ChevronsUpDown, Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useOrg } from '../../lib/OrgContext'

const NAVY = '#04112B'
const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#e0c476 55%,${GOLD} 80%,#8a6b2a 100%)`

const ROLE_LABELS = {
  nova_super_admin: 'Platform Owner', nova_admin: 'Nova Admin', nova_auditor: 'Nova Auditor',
  nova_marketing: 'Nova Marketing', nova_sales: 'Nova Sales', nova_developer: 'Nova Developer',
  client_owner: 'Owner', client_admin: 'Admin', client_marketing: 'Marketing',
  client_employee: 'Employee', client_viewer: 'Viewer',
}

// Stage 3 (2026-09-12): six-area Nova HQ shell, replacing the old flat 11-item module list.
// Every existing tool below is preserved at its original route — nothing was deleted, they're
// just reached through their new parent area's hub page instead of a flat sidebar. `match`
// lists the route prefixes that should highlight this area as active, since legacy routes
// (e.g. /dashboard/jobs) live under Admin conceptually without being renamed to /dashboard/admin/jobs.
// Stage 4 (2026-09-12): each area now carries the permission key that gates it — a nav item only
// renders if the caller's current-organization role grants that permission (real RLS-backed data,
// not a hardcoded role check). Hiding the link is UX only; the route itself is also wrapped in
// <RequirePermission> so direct navigation can't bypass this.
const NAV = [
  { to: '/dashboard',              label: 'Overview',     icon: LayoutDashboard, exact: true, permission: 'overview.view' },
  { to: '/dashboard/intelligence', label: 'Intelligence', icon: BrainCircuit,    match: ['/dashboard/intelligence', '/dashboard/intake-forms'], permission: 'intelligence.view' },
  { to: '/dashboard/growth',       label: 'Growth',        icon: TrendingUp,      match: ['/dashboard/growth', '/dashboard/referrals', '/dashboard/wave-one', '/dashboard/blog', '/dashboard/portfolio', '/dashboard/newsletter'], permission: 'growth.view' },
  { to: '/dashboard/execution',    label: 'Execution',     icon: PlayCircle,      match: ['/dashboard/execution'], permission: 'execution.view' },
  { to: '/dashboard/companies',    label: 'Companies',     icon: Building2,       match: ['/dashboard/companies'], permission: 'companies.view' },
  { to: '/dashboard/admin',        label: 'Admin',         icon: ShieldCheck,     match: ['/dashboard/admin', '/dashboard/jobs', '/dashboard/invoices', '/dashboard/contracts', '/dashboard/nova-vault', '/dashboard/documents'], permission: 'admin.view' },
]

function OrgSwitcher() {
  const { organizations, currentOrgId, currentOrg, setCurrentOrg } = useOrg()
  const [open, setOpen] = useState(false)

  if (organizations.length <= 1) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Building2 style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {currentOrg?.name || 'Nova Systems'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
      >
        <Building2 style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', flex: 1, textAlign: 'left' }}>
          {currentOrg?.name || 'Select organization'}
        </span>
        <ChevronsUpDown style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.35)' }} />
      </button>
      {open && (
        <div
          role="listbox"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: '#0a1d3f', border: `1px solid ${GOLD}35`, borderRadius: 10, padding: 6, zIndex: 60, boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              role="option"
              aria-selected={org.id === currentOrgId}
              onClick={() => { setCurrentOrg(org.id); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 7, background: org.id === currentOrgId ? `${GOLD}12` : 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12.5, fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span>{org.name}</span>
              {org.id === currentOrgId && <Check style={{ width: 13, height: 13, color: GOLD }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout() {
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const checkingSession = useAuthGuard()
  const { loading: orgLoading, noAccess, hasPermission, currentMembership, currentOrg, user } = useOrg()

  const logout = async () => {
    if (supabase) { try { await supabase.auth.signOut() } catch {} }
    navigate('/login')
  }

  if (checkingSession || orgLoading) {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading Nova HQ…</p>
      </div>
    )
  }

  if (noAccess) {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>No Organization Access</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 380, marginBottom: 24 }}>
          No organization access has been assigned to this account yet. Contact hello@nova-systems.app if you believe this is a mistake.
        </p>
        <button
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'transparent', border: `1px solid ${GOLD}50`, cursor: 'pointer', color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit' }}
        >
          <LogOut style={{ width: 13, height: 13 }} /> Sign Out
        </button>
      </div>
    )
  }

  const active = (item) =>
    item.exact ? loc.pathname === item.to : (item.match || [item.to]).some((p) => loc.pathname.startsWith(p))
  const visibleNav = NAV.filter((item) => hasPermission(item.permission))
  const orgName = currentOrg?.name || 'Nova Systems'

  function Sidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* Logo + org switcher */}
        <div style={{ padding: '28px 22px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Nova HQ</span>
          </div>
          <OrgSwitcher />
        </div>

        {/* Nav */}
        <nav aria-label="Nova HQ" style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {visibleNav.map(item => {
            const on = active(item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                aria-current={on ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', borderRadius: 7,
                  marginBottom: 1, textDecoration: 'none',
                  background: on ? `${GOLD}10` : 'transparent',
                  color: on ? '#fff' : 'rgba(255,255,255,0.35)',
                  fontSize: 13, fontWeight: on ? 500 : 400,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' } }}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' } }}
              >
                <Icon style={{ width: 14, height: 14, flexShrink: 0, color: on ? GOLD : 'inherit' }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User / Logout */}
        <div style={{ padding: '14px 10px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 2 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>
              {(ROLE_LABELS[currentMembership?.role] || '?')[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{user?.email || 'Signed in'}</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{ROLE_LABELS[currentMembership?.role] || 'Member'}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.22)', fontSize: 12, transition: 'color 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
          >
            <LogOut style={{ width: 13, height: 13 }} />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: NAVY, fontFamily: "'Inter',system-ui,sans-serif", color: '#fff' }}>

      {/* Desktop sidebar */}
      <aside style={{ width: 210, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(4,17,43,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{orgName}</span>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 4 }}
        >
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)}>
          <aside style={{ width: 240, height: '100%', background: NAVY, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }} className="pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
