import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LayoutDashboard, Bot, Phone, MessageSquare, Mic, BookOpen, Settings, LogOut, Menu, X, ArrowLeft } from 'lucide-react'

export const GOLD = '#D4A030'
export const GOLD_BRIGHT = '#C8921A'
export const GOLD_DARK = '#8a6200'
export const G = `linear-gradient(135deg,${GOLD_DARK} 0%,${GOLD} 35%,${GOLD_BRIGHT} 55%,${GOLD} 80%,${GOLD_DARK} 100%)`

const NAV = [
  { key: 'overview',        label: 'Overview',        icon: LayoutDashboard },
  { key: 'agents',          label: 'Agents',          icon: Bot },
  { key: 'call-logs',       label: 'Call Logs',       icon: Phone },
  { key: 'sms-logs',        label: 'SMS Logs',        icon: MessageSquare },
  { key: 'voices',          label: 'Voices',          icon: Mic },
  { key: 'knowledge-bases', label: 'Knowledge Bases', icon: BookOpen },
  { key: 'settings',        label: 'Settings',        icon: Settings },
]

export function useAdminGuard() {
  const navigate = useNavigate()
  useEffect(() => {
    if (localStorage.getItem('nova_crm_auth') !== 'true') navigate('/login')
  }, [])
}

export default function AIDashboardShell({ active, onNavigate, children }) {
  useAdminGuard()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const logout = () => { localStorage.removeItem('nova_crm_auth'); navigate('/login') }

  function Sidebar() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ padding: '28px 22px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Nova AI</div>
              <div style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em' }}>DASHBOARD</div>
            </div>
          </div>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 12, height: 12 }} /> Nova Systems CRM
          </Link>
        </div>

        <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const on = active === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                  padding: '9px 12px', borderRadius: 7, marginBottom: 1, border: 'none', cursor: 'pointer',
                  background: on ? `${GOLD}10` : 'transparent',
                  color: on ? '#fff' : 'rgba(255,255,255,0.35)',
                  fontSize: 13, fontWeight: on ? 500 : 400, fontFamily: 'inherit', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' } }}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' } }}
              >
                <Icon style={{ width: 14, height: 14, flexShrink: 0, color: on ? GOLD : 'inherit' }} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '14px 10px 22px', flexShrink: 0 }}>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.22)', fontSize: 12, transition: 'color 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
          >
            <LogOut style={{ width: 13, height: 13 }} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#030201', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff' }}>
      <aside style={{ width: 220, flexShrink: 0, background: 'rgba(255,255,255,0.012)', borderRight: '1px solid rgba(255,255,255,0.045)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="hidden md:flex">
        <Sidebar />
      </aside>

      <div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(3,2,1,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Nova AI</span>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)}>
          <aside style={{ width: 240, height: '100%', background: '#060504', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <Sidebar />
          </aside>
        </div>
      )}

      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }} className="pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
