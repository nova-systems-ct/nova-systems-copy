import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { OrgProvider, useOrg } from '../../lib/OrgContext'
import { api } from '../../lib/salesApi'
import { GOLD, BG, LINE, MUTED, Modal, Muted, Loading, Btn } from './kit'

// The representative workspace. Candidates (training stage) see only Onboarding / Training / Documents; activated representatives also get
// Home, Leads, Toolkit and Earnings. Hiding a link is UX only — every API call re-checks the role, activation status and ownership.
function Inner() {
  const navigate = useNavigate()
  const checking = useAuthGuard()
  const { loading, noAccess, hasPermission, currentMembership, user } = useOrg()
  const [unread, setUnread] = useState(0)
  const [inbox, setInbox] = useState(null)

  const refresh = async () => { const r = await api('notifications', 'list', { method: 'GET' }); if (r.ok) setUnread(r.data.unread) }
  useEffect(() => { if (!checking && !loading && !noAccess) { refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t) } }, [checking, loading, noAccess])
  const openInbox = async () => { const r = await api('notifications', 'list', { method: 'GET' }); if (r.ok) setInbox(r.data.notifications) }
  const closeInbox = async () => { setInbox(null); await api('notifications', 'mark-read', { body: {} }); refresh() }
  const logout = async () => { try { await supabase.auth.signOut() } catch { /* ignore */ } navigate('/login') }

  if (checking || loading) return <div style={{ minHeight: '100vh', background: BG }}><Loading text="Loading your workspace…" /></div>
  if (noAccess || !hasPermission('sales.onboarding')) return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 40, textAlign: 'center' }}>
      <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>No access</p>
      <Muted style={{ maxWidth: 420, margin: '12px auto 20px' }}>This account is not part of the Nova sales team. If you applied to join, check your application status instead.</Muted>
      <Btn onClick={() => navigate('/apply/status')}>Application status</Btn> <Btn kind="quiet" onClick={logout}>Sign out</Btn>
    </div>
  )
  const isRep = hasPermission('sales.rep')
  const role = currentMembership?.role
  const nav = [
    ...(isRep ? [['/rep', 'Home', true], ['/rep/leads', 'Leads'], ['/rep/toolkit', 'Toolkit'], ['/rep/earnings', 'My Earnings']] : [['/rep', 'Onboarding', true]]),
    ['/rep/training', 'Training'], ['/rep/documents', 'Documents'],
  ]
  const link = ({ isActive }) => ({ color: isActive ? GOLD : MUTED, textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 4px', borderBottom: `2px solid ${isActive ? GOLD : 'transparent'}`, whiteSpace: 'nowrap' })
  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
      <header style={{ borderBottom: `1px solid ${LINE}`, padding: '12px clamp(14px,3vw,32px)', display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, letterSpacing: '0.14em', fontSize: 14 }}>NOVA <span style={{ color: GOLD }}>SALES</span></span>
          <nav aria-label="Sales workspace" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {nav.map(([to, label, end]) => <NavLink key={to} to={to} end={!!end} style={link}>{label}</NavLink>)}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={openInbox} aria-label={`Notifications, ${unread} unread`} style={{ background: 'none', border: `1px solid ${LINE}`, borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Inbox{unread > 0 && <span style={{ marginLeft: 6, background: GOLD, color: '#0A0A0A', borderRadius: 999, padding: '1px 7px', fontWeight: 800 }}>{unread}</span>}</button>
          <span style={{ color: MUTED, fontSize: 12 }}>{user?.email}{role ? ` · ${role === 'nova_sales_candidate' ? 'Candidate' : role === 'nova_sales' ? 'Representative' : role.replace('nova_', '').replace(/_/g, ' ')}` : ''}</span>
          <Btn small kind="quiet" onClick={logout}>Sign out</Btn>
        </div>
      </header>
      <Outlet />
      {inbox && (
        <Modal title="Inbox" onClose={closeInbox}>
          {inbox.length === 0 ? <Muted>No notifications yet.</Muted> : inbox.map((n) => (
            <div key={n.id} style={{ padding: '10px 0', borderBottom: `1px solid ${LINE}`, opacity: n.read_at ? 0.6 : 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{n.subject}</div>
              <div style={{ color: MUTED, fontSize: 12.5, marginTop: 2, whiteSpace: 'pre-wrap' }}>{n.body}</div>
              {n.link && <a href={n.link} style={{ color: GOLD, fontSize: 12 }}>Open</a>}
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}

export default function RepLayout() { return <OrgProvider><Inner /></OrgProvider> }
