import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Target, Users,
  FileText, Mail, Settings, LogOut, Menu, X,
} from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const NAV = [
  { to: '/dashboard',            label: 'Home',       icon: LayoutDashboard, exact: true },
  { to: '/dashboard/clients',    label: 'Clients',    icon: Building2 },
  { to: '/dashboard/leads',      label: 'Leads',      icon: Target },
  { to: '/dashboard/jobs',       label: 'Jobs',       icon: Users },
  { to: '/dashboard/documents',  label: 'Documents',  icon: FileText },
  { to: '/dashboard/newsletter', label: 'Newsletter', icon: Mail },
  { to: '/dashboard/settings',   label: 'Settings',   icon: Settings },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('nova_crm_auth') !== 'true') navigate('/login')
  }, [])

  const logout = () => {
    localStorage.removeItem('nova_crm_auth')
    navigate('/login')
  }

  const active = (item) =>
    item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to)

  function Sidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Logo */}
        <div style={{ padding: '26px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <div>
              <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1.2 }}>Nova Systems</div>
              <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase' }}>Command Center</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const on = active(item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 7,
                  marginBottom: 2, textDecoration: 'none',
                  background: on ? `${GOLD}12` : 'transparent',
                  border: `1px solid ${on ? GOLD + '28' : 'transparent'}`,
                  color: on ? GOLD : 'rgba(255,255,255,0.38)',
                  fontSize: 13, fontWeight: on ? 600 : 400,
                  transition: 'all 0.14s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' } }}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.38)' } }}
              >
                {on && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: GOLD, borderRadius: '0 2px 2px 0' }} />}
                <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User / Logout */}
        <div style={{ padding: '14px 10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>I</div>
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Isaac Nova</div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10 }}>Admin</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 12, transition: 'color 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#030201', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff' }}>
      {/* Desktop sidebar */}
      <aside style={{ width: 218, flexShrink: 0, background: 'rgba(255,255,255,0.013)', borderRight: '1px solid rgba(255,255,255,0.055)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(3,2,1,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Nova Systems</span>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} onClick={() => setOpen(false)}>
          <aside style={{ width: 256, height: '100%', background: '#060504', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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
