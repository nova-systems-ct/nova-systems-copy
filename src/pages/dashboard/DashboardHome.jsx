import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Target, DollarSign, FileText, Mail, ArrowRight, CalendarCheck, Receipt, HandCoins, Search, Newspaper, LayoutGrid } from 'lucide-react'
import { getClients, getLeads, getActivity } from '../../lib/crmStore'

const GOLD = '#D4A030'

const STAGE_COLORS = {
  'New Contact':   { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' },
  'Proposal Sent': { bg: `${GOLD}14`,              color: GOLD,                   border: `${GOLD}35` },
  'Demo Shown':    { bg: 'rgba(59,130,246,0.1)',   color: '#60a5fa',              border: 'rgba(59,130,246,0.3)' },
  'Negotiating':   { bg: 'rgba(167,139,250,0.1)',  color: '#a78bfa',              border: 'rgba(167,139,250,0.3)' },
  'Closed Won':    { bg: 'rgba(34,197,94,0.1)',    color: '#4ade80',              border: 'rgba(34,197,94,0.3)' },
  'Closed Lost':   { bg: 'rgba(239,68,68,0.08)',   color: '#f87171',              border: 'rgba(239,68,68,0.25)' },
}

const ACTIVITY_ICONS = { client: Building2, lead: Target, document: FileText, newsletter: Mail }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function MetricCard({ icon: Icon, label, value, sub, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
        borderRadius: 14, padding: '26px 28px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Icon style={{ width: 14, height: 14, color: GOLD }} />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8 }}>{sub}</p>}
    </div>
  )
}

export default function DashboardHome() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [leads, setLeads] = useState([])
  const [activity, setActivity] = useState([])
  const [demoRequests, setDemoRequests] = useState([])
  const [invoicesOutstanding, setInvoicesOutstanding] = useState(0)
  const [commissionsOwed, setCommissionsOwed] = useState(0)

  useEffect(() => {
    setClients(getClients())
    setLeads(getLeads())
    setActivity(getActivity())
    try { setDemoRequests(JSON.parse(localStorage.getItem('nova_demo_requests') || '[]')) } catch {}

    fetch('/api/invoices').then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return
      setInvoicesOutstanding(data.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + (Number(i.total) || 0), 0))
    }).catch(() => {})

    fetch('/api/referrals').then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return
      setCommissionsOwed(data.filter(r => r.status !== 'Paid').reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0))
    }).catch(() => {})
  }, [])

  const pipeline = ['New Contact', 'Proposal Sent', 'Demo Shown', 'Negotiating', 'Closed Won', 'Closed Lost']
    .map(s => ({ stage: s, count: leads.filter(l => l.stage === s).length }))

  const activeClients = clients.filter(c => c.status === 'active')
  const mrr = activeClients.reduce((sum, c) => sum + (Number(c.monthly_rate) || 0), 0)

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>
          {greeting()}, Isaac.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14 }}>{fmtDate()}</p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard icon={DollarSign}   label="Monthly Recurring Revenue" value={`$${mrr.toLocaleString()}`} sub={`${activeClients.length} active client${activeClients.length !== 1 ? 's' : ''}`} onClick={() => navigate('/dashboard/clients')} />
        <MetricCard icon={Building2}    label="Total Clients"     value={clients.length}    sub="Active accounts"  onClick={() => navigate('/dashboard/clients')} />
        <MetricCard icon={Receipt}      label="Invoices Outstanding" value={`$${invoicesOutstanding.toLocaleString()}`} sub="Unpaid" onClick={() => navigate('/dashboard/invoices')} />
        <MetricCard icon={HandCoins}    label="Commissions Owed"  value={`$${commissionsOwed.toLocaleString()}`} sub="Pending payout" onClick={() => navigate('/dashboard/referrals')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 48 }}>
        <MetricCard icon={Target}       label="Active Leads"      value={leads.filter(l => !['Closed Won','Closed Lost'].includes(l.stage)).length} sub="In pipeline" onClick={() => navigate('/dashboard/leads')} />
        <MetricCard icon={CalendarCheck} label="Demo Requests"    value={demoRequests.length} sub={demoRequests.filter(d => d.status === 'pending').length + ' pending'} onClick={() => navigate('/dashboard/leads')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 32 }} className="grid-dashboard">

        {/* Pipeline */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Pipeline</p>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Leads by Stage</h3>
            </div>
            <button onClick={() => navigate('/dashboard/leads')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
              View all <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pipeline.map(({ stage, count }) => {
              const cfg = STAGE_COLORS[stage] || STAGE_COLORS['New Contact']
              const pct = leads.length ? (count / leads.length) * 100 : 0
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: cfg.color, fontWeight: 500 }}>{stage}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 24px' }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Recent</p>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Activity</h3>
          {activity.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.slice(0, 10).map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.type] || FileText
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < Math.min(activity.length, 10) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${GOLD}10`, border: `1px solid ${GOLD}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon style={{ width: 12, height: 12, color: GOLD }} />
                    </div>
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.4 }}>{a.text}</p>
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 2 }}>
                        {new Date(a.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Google Search Console placeholder */}
      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '28px 32px', marginBottom: 48, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: `${GOLD}12`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Search style={{ width: 18, height: 18, color: GOLD }} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Google Search Console</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Connect Google Search Console to see your website traffic and keyword rankings.</p>
        </div>
        <button style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }} title="Coming soon">
          Connect
        </button>
      </div>

      {/* Quick Actions */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Quick Actions</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Add Client',         icon: Building2,   path: '/dashboard/clients' },
            { label: 'Create Invoice',     icon: Receipt,     path: '/dashboard/invoices' },
            { label: 'Write Blog Post',    icon: Newspaper,   path: '/dashboard/blog' },
            { label: 'Upload Portfolio Item', icon: LayoutGrid, path: '/dashboard/portfolio' },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500, transition: 'all 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${GOLD}40`; e.currentTarget.style.color = GOLD; e.currentTarget.style.background = `${GOLD}08` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
