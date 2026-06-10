import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, X, ExternalLink } from 'lucide-react'
import { getClients, addClient } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const INDUSTRIES = ['All', 'Religious / Ministry', 'Barbershop', 'Restaurant', 'Education', 'Retail', 'Healthcare', 'Tech', 'Other']

const STATUS_CFG = {
  active:   { label: 'Active',   bg: 'rgba(34,197,94,0.1)',  color: '#4ade80',  border: 'rgba(34,197,94,0.3)' },
  inactive: { label: 'Inactive', bg: 'rgba(239,68,68,0.08)', color: '#f87171', border: 'rgba(239,68,68,0.25)' },
  prospect: { label: 'Prospect', bg: `${GOLD}14`,             color: GOLD,       border: `${GOLD}35` },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.active
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
}

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('All')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', owner_name: '', industry: '', email: '', phone: '', website: '', domain: '', services: '', monthly_rate: '', contract_start: '', notes: '', status: 'active' })

  useEffect(() => { setClients(getClients()) }, [])

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !c.owner_name?.toLowerCase().includes(q)) return false
    if (industry !== 'All' && c.industry !== industry) return false
    return true
  })

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = e => {
    e.preventDefault()
    const svc = form.services ? form.services.split(',').map(s => s.trim()).filter(Boolean) : []
    addClient({ ...form, services: svc, monthly_rate: parseFloat(form.monthly_rate) || 0 })
    setClients(getClients())
    setModal(false)
    setForm({ name: '', owner_name: '', industry: '', email: '', phone: '', website: '', domain: '', services: '', monthly_rate: '', contract_start: '', notes: '', status: 'active' })
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Clients</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>All Clients</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{clients.length} account{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          <Plus style={{ width: 14, height: 14 }} /> Add Client
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
          <input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <select value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 180, appearance: 'none', cursor: 'pointer' }}>
          {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: '#111' }}>{i}</option>)}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Building2 style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No clients found</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Add your first client to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(c => <ClientCard key={c.id} client={c} onClick={() => navigate(`/dashboard/clients/${c.id}`)} />)}
        </div>
      )}

      {/* Add Modal */}
      {modal && (
        <Modal title="Add Client" onClose={() => setModal(false)}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row2>
              <Field label="Business Name *"><input required value={form.name} onChange={set('name')} style={inp} placeholder="Mars Hill Apologetics" /></Field>
              <Field label="Owner Name"><input value={form.owner_name} onChange={set('owner_name')} style={inp} placeholder="John Leonetti" /></Field>
            </Row2>
            <Row2>
              <Field label="Industry"><select value={form.industry} onChange={set('industry')} style={{ ...inp, appearance: 'none' }}><option value="">Select…</option>{INDUSTRIES.slice(1).map(i => <option key={i} value={i} style={{ background: '#111' }}>{i}</option>)}</select></Field>
              <Field label="Status"><select value={form.status} onChange={set('status')} style={{ ...inp, appearance: 'none' }}><option value="active">Active</option><option value="inactive">Inactive</option><option value="prospect">Prospect</option></select></Field>
            </Row2>
            <Row2>
              <Field label="Email"><input type="email" value={form.email} onChange={set('email')} style={inp} placeholder="owner@example.com" /></Field>
              <Field label="Phone"><input value={form.phone} onChange={set('phone')} style={inp} placeholder="+1 (860) 000-0000" /></Field>
            </Row2>
            <Row2>
              <Field label="Website"><input value={form.website} onChange={set('website')} style={inp} placeholder="https://example.com" /></Field>
              <Field label="Domain"><input value={form.domain} onChange={set('domain')} style={inp} placeholder="example.com" /></Field>
            </Row2>
            <Field label="Services (comma-separated)"><input value={form.services} onChange={set('services')} style={inp} placeholder="Custom Website, Supabase CMS, Admin Dashboard" /></Field>
            <Row2>
              <Field label="Monthly Rate ($)"><input type="number" value={form.monthly_rate} onChange={set('monthly_rate')} style={inp} placeholder="0" /></Field>
              <Field label="Contract Start"><input type="date" value={form.contract_start} onChange={set('contract_start')} style={inp} /></Field>
            </Row2>
            <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} placeholder="Any notes about this client…" /></Field>
            <button type="submit" style={{ marginTop: 6, padding: '13px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Add Client</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ClientCard({ client: c, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hov ? 'rgba(212,160,48,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '24px', cursor: 'pointer', transition: 'all 0.16s', transform: hov ? 'translateY(-2px)' : 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${GOLD}14`, border: `1px solid ${GOLD}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: GOLD }}>
          {c.name[0]}
        </div>
        <StatusBadge status={c.status || 'active'} />
      </div>
      <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{c.name}</h3>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 14 }}>{c.industry || 'No industry'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {c.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
          <ExternalLink style={{ width: 11, height: 11, flexShrink: 0 }} />
          {c.website.replace(/^https?:\/\//, '')}
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ color: GOLD, fontSize: 14, fontWeight: 700 }}>{c.monthly_rate === 0 ? 'Pro bono' : `$${c.monthly_rate}/mo`}</span>
          {c.owner_name && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{c.owner_name}</span>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#0d0c09', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
