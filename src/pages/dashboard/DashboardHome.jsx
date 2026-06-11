import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Target, DollarSign, FileText, Plus, Zap, Mail, ArrowRight, CalendarCheck } from 'lucide-react'
import { getClients, getLeads, getActivity, getInvoices } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

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
        background: hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${hov ? 'rgba(212,160,48,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12, padding: '22px 24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${GOLD}12`, border: `1px solid ${GOLD}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 14, height: 14, color: GOLD }} />
        </div>
      </div>
      <p style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

export default function DashboardHome() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [leads, setLeads] = useState([])
  const [activity, setActivity] = useState([])
  const [demoRequests, setDemoRequests] = useState([])

  useEffect(() => {
    setClients(getClients())
    setLeads(getLeads())
    setActivity(getActivity())
    try { setDemoRequests(JSON.parse(localStorage.getItem('nova_demo_requests') || '[]')) } catch {}
  }, [])

  const pipeline = ['New Contact', 'Proposal Sent', 'Demo Shown', 'Negotiating', 'Closed Won', 'Closed Lost']
    .map(s => ({ stage: s, count: leads.filter(l => l.stage === s).length }))

  const openInvoices = getInvoices().filter(i => !i.paid).length
  const revenue = getInvoices().filter(i => i.paid && new Date(i.created_at) > new Date(new Date().setDate(1))).reduce((sum, i) => sum + (i.amount || 0), 0)

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 6 }}>Nova Systems CRM</p>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {greeting()}, Isaac.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>{fmtDate()}</p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 40 }}>
        <MetricCard icon={Building2}    label="Total Clients"     value={clients.length}    sub="Active accounts"  onClick={() => navigate('/dashboard/clients')} />
        <MetricCard icon={Target}       label="Active Leads"      value={leads.filter(l => !['Closed Won','Closed Lost'].includes(l.stage)).length} sub="In pipeline" onClick={() => navigate('/dashboard/leads')} />
        <MetricCard icon={CalendarCheck} label="Demo Requests"    value={demoRequests.length} sub={demoRequests.filter(d => d.status === 'pending').length + ' pending'} onClick={() => navigate('/dashboard/leads')} />
        <MetricCard icon={DollarSign}   label="Revenue This Month" value={`$${revenue.toLocaleString()}`} sub="Paid invoices" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginBottom: 40 }} className="grid-dashboard">

        {/* Pipeline */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '28px 28px' }}>
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
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '28px 24px' }}>
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

      {/* Quick Actions */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Quick Actions</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Add Client',         icon: Building2, path: '/dashboard/clients' },
            { label: 'Add Lead',           icon: Target,    path: '/dashboard/leads' },
            { label: 'Generate Document',  icon: FileText,  path: '/dashboard/documents' },
            { label: 'Send Newsletter',    icon: Mail,      path: '/dashboard/newsletter' },
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
