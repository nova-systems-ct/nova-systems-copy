import { useState, useEffect, useCallback } from 'react'
import { Users, FileText, ClipboardList, Receipt, Plus, X, Loader2, CheckCircle2, UserPlus, Camera } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }
const TABS = [
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'quotes', label: 'Quotes & Estimates', icon: FileText },
  { key: 'jobs', label: 'Jobs', icon: ClipboardList },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
]

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Crystal / Company 002 operational workspace (master prompt §14, restored scope 2026-09-24).
// Provisional internal name — no public site work. Workflow: request -> scope -> estimate ->
// required approval -> customer acceptance -> booking -> assignment -> work recorded -> completion
// approved -> billing -> feedback/recurring. See api/client.js's `crystal` resource for the
// server-enforced state machine (this page only renders it).
export default function Crystal() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState('customers')
  const [customers, setCustomers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customerModal, setCustomerModal] = useState(false)
  const [quoteModal, setQuoteModal] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '' })
  const [quoteForm, setQuoteForm] = useState({ customer_id: '', scope_details: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setError('')
    try {
      const q = `organization_id=${encodeURIComponent(currentOrg.id)}`
      const [custRes, quoteRes, jobRes, invRes] = await Promise.all([
        authedFetch(`/api/client?resource=crystal&op=customers&${q}`),
        authedFetch(`/api/client?resource=crystal&op=quotes&${q}`),
        authedFetch(`/api/client?resource=crystal&op=jobs&${q}`),
        authedFetch(`/api/client?resource=crystal&op=invoices&${q}`),
      ])
      if (!custRes.ok) throw new Error((await custRes.json().catch(() => ({}))).error || 'Failed to load Crystal data')
      setCustomers(await custRes.json())
      setQuotes(quoteRes.ok ? await quoteRes.json() : [])
      setJobs(jobRes.ok ? await jobRes.json() : [])
      setInvoices(invRes.ok ? await invRes.json() : [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { load() }, [load])

  const createCustomer = async () => {
    if (!custForm.name.trim()) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=crystal&op=customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, ...custForm }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to create customer')
      setCustomerModal(false)
      setCustForm({ name: '', email: '', phone: '' })
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const createQuote = async () => {
    if (!quoteForm.customer_id) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=crystal&op=quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, ...quoteForm }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to create quote request')
      setQuoteModal(false)
      setQuoteForm({ customer_id: '', scope_details: '' })
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const customerName = (id) => customers.find((c) => c.id === id)?.name || 'Unknown'

  if (!currentOrg) return null

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Companies</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Crystal</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Provisional internal name — physical-service operations for {currentOrg.name}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === t.key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon style={{ width: 14, height: 14 }} /> {t.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : (
        <>
          {tab === 'customers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={() => setCustomerModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus style={{ width: 13, height: 13 }} /> New Customer
                </button>
              </div>
              {customers.length === 0 ? <EmptyRow text="No customers yet." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customers.map((c) => (
                    <div key={c.id} style={CARD}>
                      <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{c.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info on file'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'quotes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={() => setQuoteModal(true)} disabled={customers.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: customers.length ? G : '#161410', border: 'none', borderRadius: 8, color: customers.length ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: customers.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  <Plus style={{ width: 13, height: 13 }} /> New Quote Request
                </button>
              </div>
              {quotes.length === 0 ? <EmptyRow text="No quote requests yet. Add a customer first." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quotes.map((q) => (
                    <div key={q.id} style={CARD}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{customerName(q.customer_id)}</p>
                        <StatusBadge status={q.status} />
                      </div>
                      {q.scope_details && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6 }}>{q.scope_details}</p>}
                    </div>
                  ))}
                </div>
              )}
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>Estimate drafting, sending, and acceptance happen via the API today (versioned like Audit reports); a dedicated estimate-builder UI is the next increment.</p>
            </div>
          )}

          {tab === 'jobs' && (
            <div>
              {jobs.length === 0 ? <EmptyRow text="No jobs yet. Accept an estimate to create one." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jobs.map((j) => (
                    <div key={j.id} style={CARD}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{customerName(j.customer_id)}</p>
                        <StatusBadge status={j.status} />
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6 }}>
                        {j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : 'Not yet scheduled'}
                        {j.duration_minutes ? ` · ${j.duration_minutes} min` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus style={{ width: 12, height: 12 }} /> Worker assignment, checklists, and before/after photos (<Camera style={{ width: 11, height: 11, display: 'inline' }} /> required evidence before a job can be marked complete) are managed via the API; a dedicated job-detail UI is the next increment.
              </p>
            </div>
          )}

          {tab === 'invoices' && (
            invoices.length === 0 ? <EmptyRow text="No invoices yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoices.map((inv) => (
                  <div key={inv.id} style={CARD}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>${(inv.amount_cents / 100).toFixed(2)}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {customerModal && (
        <Modal title="New Customer" onClose={() => setCustomerModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={lbl}>Name *</label><input value={custForm.name} onChange={(e) => setCustForm((f) => ({ ...f, name: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Email</label><input value={custForm.email} onChange={(e) => setCustForm((f) => ({ ...f, email: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Phone</label><input value={custForm.phone} onChange={(e) => setCustForm((f) => ({ ...f, phone: e.target.value }))} style={inp} /></div>
            <button onClick={createCustomer} disabled={!custForm.name.trim() || saving} style={{ padding: 13, background: custForm.name.trim() ? G : '#161410', border: 'none', borderRadius: 9, color: custForm.name.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: custForm.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create Customer'}
            </button>
          </div>
        </Modal>
      )}

      {quoteModal && (
        <Modal title="New Quote Request" onClose={() => setQuoteModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Customer *</label>
              <select value={quoteForm.customer_id} onChange={(e) => setQuoteForm((f) => ({ ...f, customer_id: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="" style={{ background: '#111' }}>Select…</option>
                {customers.map((c) => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Scope details</label><textarea rows={4} value={quoteForm.scope_details} onChange={(e) => setQuoteForm((f) => ({ ...f, scope_details: e.target.value }))} style={{ ...inp, resize: 'vertical' }} /></div>
            <button onClick={createQuote} disabled={!quoteForm.customer_id || saving} style={{ padding: 13, background: quoteForm.customer_id ? G : '#161410', border: 'none', borderRadius: 9, color: quoteForm.customer_id ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: quoteForm.customer_id ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create Quote Request'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function EmptyRow({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{text}</p>
    </div>
  )
}

const STATUS_COLORS = {
  new: 'rgba(255,255,255,0.4)', scoped: GOLD, estimated: GOLD, accepted: '#4ade80', declined: '#f87171', expired: 'rgba(255,255,255,0.3)',
  scheduled: 'rgba(255,255,255,0.4)', assigned: GOLD, in_progress: GOLD, completed: '#4ade80', approved: '#4ade80', invoiced: '#a78bfa', paid: '#4ade80', cancelled: '#f87171',
  draft: 'rgba(255,255,255,0.4)', sent: GOLD, overdue: '#f87171', disputed: '#f87171',
}
function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'rgba(255,255,255,0.4)'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
      {status === 'paid' || status === 'approved' ? <CheckCircle2 style={{ width: 10, height: 10 }} /> : null}
      {String(status).replace(/_/g, ' ')}
    </span>
  )
}
