import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Target, Users,
  FileText, Mail, Settings, LogOut, Menu, X, LayoutGrid, Globe,
  Lock, Newspaper, ClipboardList, Receipt, HandCoins,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const NAV = [
  { to: '/dashboard',             label: 'Home',          icon: LayoutDashboard, exact: true },
  { to: '/dashboard/clients',     label: 'Clients',       icon: Building2 },
  { to: '/dashboard/leads',       label: 'Leads',         icon: Target },
  { to: '/dashboard/jobs',        label: 'Candidates',    icon: Users },
  { to: '/dashboard/intake-forms',label: 'Intake Forms',  icon: ClipboardList },
  { to: '/dashboard/invoices',    label: 'Invoices',      icon: Receipt },
  { to: '/dashboard/referrals',   label: 'Referrals',     icon: HandCoins },
  { to: '/dashboard/nova-vault',  label: 'Nova Vault',    icon: Lock },
  { to: '/dashboard/blog',        label: 'Blog',          icon: Newspaper },
  { to: '/dashboard/portfolio',   label: 'Portfolio',     icon: LayoutGrid },
  { to: '/dashboard/documents',   label: 'Documents',     icon: FileText },
  { to: '/dashboard/newsletter',  label: 'Newsletter',    icon: Mail },
  { to: '/dashboard/site-editor', label: 'Website Editor',icon: Globe },
  { to: '/dashboard/settings',    label: 'Settings',      icon: Settings },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const check = async () => {
      if (localStorage.getItem('nova_crm_auth') === 'true') return
      // Also accept a Supabase OAuth session
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            localStorage.setItem('nova_crm_auth', 'true')
            return
          }
        } catch {}
      }
      navigate('/login')
    }
    check()

    // Listen for OAuth redirect completing
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          localStorage.setItem('nova_crm_auth', 'true')
        }
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('nova_crm_auth')
          navigate('/login')
        }
      })
      return () => subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    localStorage.removeItem('nova_crm_auth')
    if (supabase) { try { await supabase.auth.signOut() } catch {} }
    navigate('/login')
  }

  const active = (item) =>
    item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to)

  function Sidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* Logo */}
        <div style={{ padding: '28px 22px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>Nova Systems</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const on = active(item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
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
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>I</div>
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Isaac Nova</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>Admin</div>
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#030201', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff' }}>

      {/* Desktop sidebar */}
      <aside style={{ width: 210, flexShrink: 0, background: 'rgba(255,255,255,0.012)', borderRight: '1px solid rgba(255,255,255,0.045)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(3,2,1,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Nova Systems</span>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)}>
          <aside style={{ width: 240, height: '100%', background: '#060504', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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
