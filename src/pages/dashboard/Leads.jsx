import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Target, X, Calendar } from 'lucide-react'
import { getLeads, addLead } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const STAGES = ['New Contact', 'Proposal Sent', 'Demo Shown', 'Negotiating', 'Closed Won', 'Closed Lost']
const INDUSTRIES = ['All', 'Barbershop', 'Restaurant', 'Education', 'Retail', 'Healthcare', 'Tech', 'Religious / Ministry', 'Other']

const STAGE_CFG = {
  'New Contact':   { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.12)' },
  'Proposal Sent': { color: GOLD,                    bg: `${GOLD}14`,               border: `${GOLD}35` },
  'Demo Shown':    { color: '#60a5fa',               bg: 'rgba(59,130,246,0.1)',    border: 'rgba(59,130,246,0.3)' },
  'Negotiating':   { color: '#a78bfa',               bg: 'rgba(167,139,250,0.1)',   border: 'rgba(167,139,250,0.3)' },
  'Closed Won':    { color: '#4ade80',               bg: 'rgba(34,197,94,0.1)',     border: 'rgba(34,197,94,0.3)' },
  'Closed Lost':   { color: '#f87171',               bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)' },
}

function StageBadge({ stage }) {
  const c = STAGE_CFG[stage] || STAGE_CFG['New Contact']
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{stage}</span>
}

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('All')
  const [stage, setStage] = useState('All')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', industry: '', email: '', phone: '', stage: 'New Contact', potential_value: '', what_they_want: '', what_they_need: '', next_steps: '', meeting_date: '', notes: '' })

  useEffect(() => { setLeads(getLeads()) }, [])

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    if (q && !l.name.toLowerCase().includes(q) && !l.contact_name?.toLowerCase().includes(q)) return false
    if (industry !== 'All' && l.industry !== industry) return false
    if (stage !== 'All' && l.stage !== stage) return false
    return true
  })

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = e => {
    e.preventDefault()
    addLead(form)
    setLeads(getLeads())
    setModal(false)
    setForm({ name: '', contact_name: '', industry: '', email: '', phone: '', stage: 'New Contact', potential_value: '', what_they_want: '', what_they_need: '', next_steps: '', meeting_date: '', notes: '' })
  }

  const pipelineCounts = STAGES.map(s => ({ stage: s, count: leads.filter(l => l.stage === s).length }))

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Leads</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Pipeline</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{leads.filter(l => !['Closed Won','Closed Lost'].includes(l.stage)).length} active leads</p>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          <Plus style={{ width: 14, height: 14 }} /> Add Lead
        </button>
      </div>

      {/* Pipeline strip */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
        {pipelineCounts.map(({ stage: s, count }) => {
          const cfg = STAGE_CFG[s]
          return (
            <button key={s} onClick={() => setStage(stage === s ? 'All' : s)} style={{ flex: '1 0 auto', minWidth: 110, padding: '12px 10px', background: stage === s ? cfg.bg : 'rgba(255,255,255,0.025)', border: `1px solid ${stage === s ? cfg.border : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              <p style={{ color: stage === s ? cfg.color : 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{count}</p>
              <p style={{ color: stage === s ? cfg.color : 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3 }}>{s}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
          <input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <select value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 160, appearance: 'none', cursor: 'pointer' }}>
          {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: '#111' }}>{i}</option>)}
        </select>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Target style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>No leads match the current filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(l => <LeadRow key={l.id} lead={l} onClick={() => navigate(`/dashboard/leads/${l.id}`)} />)}
        </div>
      )}

      {/* Add Modal */}
      {modal && (
        <Modal title="Add Lead" onClose={() => setModal(false)}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row2>
              <Field label="Business Name *"><input required value={form.name} onChange={set('name')} style={inp} placeholder="Flow Barbershop" /></Field>
              <Field label="Contact Name"><input value={form.contact_name} onChange={set('contact_name')} style={inp} placeholder="Owner / Contact" /></Field>
            </Row2>
            <Row2>
              <Field label="Industry"><select value={form.industry} onChange={set('industry')} style={{ ...inp, appearance: 'none' }}><option value="">Select…</option>{INDUSTRIES.slice(1).map(i => <option key={i} value={i} style={{ background: '#111' }}>{i}</option>)}</select></Field>
              <Field label="Stage"><select value={form.stage} onChange={set('stage')} style={{ ...inp, appearance: 'none' }}>{STAGES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}</select></Field>
            </Row2>
            <Row2>
              <Field label="Email"><input type="email" value={form.email} onChange={set('email')} style={inp} placeholder="owner@example.com" /></Field>
              <Field label="Phone"><input value={form.phone} onChange={set('phone')} style={inp} placeholder="+1 (860) 000-0000" /></Field>
            </Row2>
            <Field label="Potential Value"><input value={form.potential_value} onChange={set('potential_value')} style={inp} placeholder="$1,500 startup + $1,000/mo" /></Field>
            <Field label="What they want"><input value={form.what_they_want} onChange={set('what_they_want')} style={inp} placeholder="Website, booking system, social media…" /></Field>
            <Field label="What they need"><input value={form.what_they_need} onChange={set('what_they_need')} style={inp} placeholder="Full revenue infrastructure…" /></Field>
            <Field label="Next Steps"><input value={form.next_steps} onChange={set('next_steps')} style={inp} placeholder="Meeting Thursday 4pm…" /></Field>
            <Field label="Meeting Date"><input type="datetime-local" value={form.meeting_date} onChange={set('meeting_date')} style={inp} /></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={set('notes')} rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} placeholder="Additional context…" /></Field>
            <button type="submit" style={{ marginTop: 4, padding: 12, background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add Lead</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function LeadRow({ lead: l, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: hov ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.025)', border: `1px solid ${hov ? 'rgba(212,160,48,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', flexWrap: 'wrap', gap: 12 }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 9, background: `${GOLD}12`, border: `1px solid ${GOLD}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: GOLD, flexShrink: 0 }}>
        {l.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{l.name}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{l.contact_name} · {l.industry}</p>
      </div>
      <StageBadge stage={l.stage} />
      <span style={{ color: GOLD, fontSize: 13, fontWeight: 700, minWidth: 120, textAlign: 'right' }}>{l.potential_value || '—'}</span>
      {l.meeting_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
          <Calendar style={{ width: 11, height: 11 }} />
          {new Date(l.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return <div><label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>{label}</label>{children}</div>
}
function Row2({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div> }
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#0d0c09', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
