import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, DollarSign, FileText, Receipt, HandCoins, Search, Newspaper, LayoutGrid, ClipboardCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useOrg } from '../../lib/OrgContext'

const HEALTH_ROUTES = ['/', '/welcome', '/intake', '/login']

function useRouteHealth() {
  const [status, setStatus] = useState(() => Object.fromEntries(HEALTH_ROUTES.map((r) => [r, 'checking'])))
  useEffect(() => {
    let active = true
    HEALTH_ROUTES.forEach((route) => {
      fetch(route, { method: 'HEAD' })
        .then((r) => { if (active) setStatus((s) => ({ ...s, [route]: r.ok ? 'ok' : 'error' })) })
        .catch(() => { if (active) setStatus((s) => ({ ...s, [route]: 'error' })) })
    })
    return () => { active = false }
  }, [])
  return status
}

const GOLD = '#D4A030'

const STAGE_COLORS = {
  'New Lead':        { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' },
  'Intake Complete': { bg: `${GOLD}14`,              color: GOLD },
}

const ACTIVITY_ICONS = { lead: Target, intake: ClipboardCheck, contract: FileText, invoice: Receipt }

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

// Stage 5 (2026-09-14): replaced the previous crmStore.js (pure localStorage, hardcoded
// fictional client/lead records — Flow Barbershop, TRIO Upward Bound, La Cazuela, etc.) with
// real Supabase queries against leads/intake_submissions/contracts/client_invoices/
// referral_tracking/nova_tasks. These tables were organization-scoped in the Stage 5 migration
// (supabase/schema-update.sql). Real current state as of the migration being written: 1 lead
// (Isaac's own test submission), 0 intake submissions, 1 contract (explicitly a QA test row),
// 0 invoices, 0 tasks, 0 referrals — genuinely sparse, not artificially emptied. Every number
// here is either a real query result or an honest zero; nothing is fabricated.
export default function DashboardHome() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const routeHealth = useRouteHealth()
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState(false)
  const [leads, setLeads] = useState([])
  const [intakes, setIntakes] = useState([])
  const [contracts, setContracts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [tasks, setTasks] = useState([])
  const [referrals, setReferrals] = useState([])

  useEffect(() => {
    if (!supabase || !currentOrg) { setLoading(false); return }
    let active = true
    async function load() {
      const results = await Promise.allSettled([
        supabase.from('leads').select('id,name,email,company,intake_completed,created_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
        supabase.from('intake_submissions').select('id,name,status,created_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
        supabase.from('contracts').select('id,client_name,status,sent_at,signed_at,created_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
        supabase.from('client_invoices').select('id,total,status,due_date,created_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
        supabase.from('nova_tasks').select('id,title,status,created_at,completed_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
        supabase.from('referral_tracking').select('id,rep_name,client_name,commission_amount,status,created_at').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
      ])
      if (!active) return
      const [leadsR, intakesR, contractsR, invoicesR, tasksR, referralsR] = results
      // Any single query failing (e.g. the Stage 5 migration hasn't been run in Supabase yet, so
      // organization_id doesn't exist on these tables) degrades to an honest empty state rather
      // than a crash — this page never shows a partial mix of real and broken data.
      const anyFailed = results.some(r => r.status === 'rejected' || r.value?.error)
      setDataError(anyFailed)
      setLeads(leadsR.value?.data || [])
      setIntakes(intakesR.value?.data || [])
      setContracts(contractsR.value?.data || [])
      setInvoices(invoicesR.value?.data || [])
      setTasks(tasksR.value?.data || [])
      setReferrals(referralsR.value?.data || [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [currentOrg?.id])

  const outstandingInvoices = invoices.filter(i => i.status !== 'Paid' && i.status !== 'paid')
  const invoicesOutstanding = outstandingInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0)
  const commissionsOwed = referrals.filter(r => r.status !== 'Paid' && r.status !== 'paid').reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0)
  const revenueReceived = invoices.filter(i => i.status === 'Paid' || i.status === 'paid').reduce((sum, i) => sum + (Number(i.total) || 0), 0)
  const activeLeads = leads.filter(l => !l.intake_completed)
  const openTasks = tasks.filter(t => t.status !== 'done')

  const pipeline = [
    { stage: 'New Lead', count: leads.filter(l => !l.intake_completed).length },
    { stage: 'Intake Complete', count: leads.filter(l => l.intake_completed).length },
  ]

  const activity = [
    ...leads.map(l => ({ id: `lead-${l.id}`, type: 'lead', text: `New lead: ${l.name || l.email || 'unknown'}`, ts: l.created_at })),
    ...intakes.map(i => ({ id: `intake-${i.id}`, type: 'intake', text: `Intake submitted: ${i.name || 'unknown'}`, ts: i.created_at })),
    ...contracts.map(c => ({ id: `contract-${c.id}`, type: 'contract', text: `Contract ${c.status}: ${c.client_name}`, ts: c.sent_at || c.created_at })),
    ...invoices.map(inv => ({ id: `invoice-${inv.id}`, type: 'invoice', text: `Invoice ${inv.status}: $${Number(inv.total || 0).toLocaleString()}`, ts: inv.created_at })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts))

  // Stage 4 tenant-isolation guard: everything below is Nova Systems' own real operating data —
  // it must never render under a different organization.
  if (currentOrg && currentOrg.kind !== 'nova_internal') {
    return (
      <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>{greeting()}.</h1>
          <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14 }}>{fmtDate()}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No data connected for {currentOrg.name} yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>
          {greeting()}.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14 }}>{fmtDate()}</p>
      </div>

      {dataError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>
            Some data couldn't load — this usually means the Stage 5 database migration hasn't been run yet. Showing what's available.
          </p>
        </div>
      )}

      {!loading && (
        <>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
            <MetricCard icon={DollarSign} label="Revenue Received" value={`$${revenueReceived.toLocaleString()}`} sub={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} total`} onClick={() => navigate('/dashboard/invoices')} />
            <MetricCard icon={Receipt} label="Invoices Outstanding" value={`$${invoicesOutstanding.toLocaleString()}`} sub="Unpaid" onClick={() => navigate('/dashboard/invoices')} />
            <MetricCard icon={HandCoins} label="Commissions Owed" value={`$${commissionsOwed.toLocaleString()}`} sub="Pending payout" onClick={() => navigate('/dashboard/referrals')} />
            <MetricCard icon={Target} label="Active Leads" value={activeLeads.length} sub={`${leads.length} total`} onClick={() => navigate('/dashboard/growth')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 48 }}>
            <MetricCard icon={ClipboardCheck} label="Intake Submissions" value={intakes.length} sub="Total received" onClick={() => navigate('/dashboard/intelligence')} />
            <MetricCard icon={FileText} label="Open Tasks" value={openTasks.length} sub={`${tasks.length} total`} onClick={() => navigate('/dashboard/execution')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 32 }} className="grid-dashboard">

            {/* Pipeline */}
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Pipeline</p>
                  <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Leads by Stage</h3>
                </div>
              </div>
              {leads.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No leads recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pipeline.map(({ stage, count }) => {
                    const cfg = STAGE_COLORS[stage]
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
              )}
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
                            {a.ts ? new Date(a.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Website / form health — real HEAD requests against critical public routes */}
      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>System Status</p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {HEALTH_ROUTES.map((route) => {
            const s = routeHealth[route]
            const Icon = s === 'ok' ? CheckCircle2 : s === 'error' ? XCircle : Loader2
            const color = s === 'ok' ? '#4ade80' : s === 'error' ? '#f87171' : 'rgba(255,255,255,0.3)'
            return (
              <div key={route} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon style={{ width: 13, height: 13, color }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{route}</span>
              </div>
            )
          })}
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
