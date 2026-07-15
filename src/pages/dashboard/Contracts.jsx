import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Loader2, FileSignature, Send, Download, Link2, Check } from 'lucide-react'
import { CONTRACT_TYPES } from '../../data/contractTemplates'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const inp = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const STATUS_COLORS = {
  signed: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  pending: { bg: `${GOLD}15`, color: GOLD },
}

const emptyForm = { client_name: '', client_email: '', contract_type: '', custom_notes: '' }

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [statusFilter, setStatusFilter] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/contracts?action=list')
      const data = await r.json()
      setContracts(Array.isArray(data) ? data : [])
    } catch { setContracts([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => (
    statusFilter ? contracts.filter(c => c.status === statusFilter) : contracts
  ), [contracts, statusFilter])

  const stats = useMemo(() => ({
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending').length,
    signed: contracts.filter(c => c.status === 'signed').length,
  }), [contracts])

  const sendContract = async () => {
    if (!form.client_name || !form.client_email || !form.contract_type) return
    setSending(true)
    try {
      const r = await fetch('/api/contracts?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to send contract')
      setCreating(false)
      setForm(emptyForm)
      load()
    } catch (e) {
      alert('Failed to send contract: ' + e.message)
    }
    setSending(false)
  }

  const copyLink = (id) => {
    const link = `${window.location.origin}/sign/${id}`
    navigator.clipboard?.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Document Signing</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Contracts</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: 14, height: 14 }} /> New Contract
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard label="Total Contracts" value={stats.total} />
        <StatCard label="Pending Signature" value={stats.pending} />
        <StatCard label="Signed" value={stats.signed} />
      </div>

      {creating ? (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>New Contract</p>
            <button onClick={() => { setCreating(false); setForm(emptyForm) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Client Name</label>
                <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={inp} placeholder="Full name" />
              </div>
              <div>
                <label style={lbl}>Client Email</label>
                <input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} style={inp} placeholder="client@email.com" />
              </div>
            </div>

            <div>
              <label style={lbl}>Contract Type</label>
              <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="" style={{ background: '#111' }}>Select a contract type…</option>
                {CONTRACT_TYPES.map(t => (
                  <option key={t} value={t} style={{ background: '#111' }}>
                    {t === 'Digital Foundation' ? 'Digital Foundation — $320' : t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={lbl}>Custom Notes {form.contract_type === 'Digital Foundation' ? '(optional)' : '(defines the scope and terms shown on the contract)'}</label>
              <textarea rows={4} value={form.custom_notes} onChange={e => setForm(f => ({ ...f, custom_notes: e.target.value }))} style={{ ...inp, resize: 'vertical' }} placeholder={form.contract_type === 'Digital Foundation' ? 'Any notes for this client (not shown on the standard agreement)...' : 'Describe the scope, pricing, and terms for this agreement...'} />
            </div>

            <button
              onClick={sendContract}
              disabled={sending || !form.client_name || !form.client_email || !form.contract_type}
              style={{ padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              {sending ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <><Send style={{ width: 14, height: 14 }} /> Send Contract</>}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : contracts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <FileSignature style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No contracts yet. Click "New Contract" to send your first agreement.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto', appearance: 'none', cursor: 'pointer' }}>
              <option value="" style={{ background: '#111' }}>All Statuses</option>
              <option value="pending" style={{ background: '#111' }}>Pending</option>
              <option value="signed" style={{ background: '#111' }}>Signed</option>
            </select>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr 1fr 100px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Client', 'Type', 'Status', 'Sent', 'Signed', ''].map(h => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {filtered.map(c => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.pending
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr 1fr 100px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.client_name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{c.client_email}</p>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{c.contract_type}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.color, width: 'fit-content', textTransform: 'uppercase' }}>{c.status}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{fmtDate(c.sent_at)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{fmtDate(c.signed_at)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyLink(c.id)} title="Copy signing link" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copiedId === c.id ? '#4ade80' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                      {copiedId === c.id ? <Check style={{ width: 12, height: 12 }} /> : <Link2 style={{ width: 12, height: 12 }} />}
                    </button>
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer" title="Download signed PDF" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                        <Download style={{ width: 12, height: 12 }} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: '20px 22px' }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  )
}
