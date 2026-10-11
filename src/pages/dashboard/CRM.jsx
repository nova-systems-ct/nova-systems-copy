import { useState, useEffect, useCallback } from 'react'
import { Building2, HandCoins, Plus, Search, X, Loader2 } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const STAGE_LABELS = {
  new: 'New', assigned: 'Assigned', attempted: 'Attempted', connected: 'Connected', qualified: 'Qualified',
  discovery: 'Discovery', proposal: 'Proposal', accepted: 'Accepted', payment_condition_satisfied: 'Payment Confirmed',
  onboarding: 'Onboarding', lost: 'Lost', disqualified: 'Disqualified', nurture: 'Nurture', paused: 'Paused',
}
const STAGE_ORDER = ['new', 'assigned', 'attempted', 'connected', 'qualified', 'discovery', 'proposal', 'accepted', 'payment_condition_satisfied', 'onboarding']
const CLOSED_STAGES = ['lost', 'disqualified', 'nurture', 'paused']

// Shared CRM foundation (master prompt §12) — businesses (identity resolution), deals (pipeline).
// Every request is scoped to the real current organization; every write goes through
// api/client.js's crm resource, which itself re-verifies the caller's real permission on THAT
// specific org server-side (not just trusting this page's own org-switcher state).
export default function CRM() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState('businesses')
  const [businesses, setBusinesses] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [bizModalOpen, setBizModalOpen] = useState(false)
  const [bizForm, setBizForm] = useState({ name: '', website: '', city: '', state: '', industry: '' })
  const [bizSaving, setBizSaving] = useState(false)
  const [bizCandidates, setBizCandidates] = useState(null) // null = not searched yet, [] = confirmed no match

  const loadBusinesses = useCallback(async (q = '') => {
    if (!currentOrg) return
    const url = `/api/client?resource=crm&op=businesses&organization_id=${encodeURIComponent(currentOrg.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    const r = await authedFetch(url)
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load businesses')
    return r.json()
  }, [currentOrg])

  const loadDeals = useCallback(async () => {
    if (!currentOrg) return
    const r = await authedFetch(`/api/client?resource=crm&op=deals&organization_id=${encodeURIComponent(currentOrg.id)}`)
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load deals')
    return r.json()
  }, [currentOrg])

  const loadAll = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setError('')
    try {
      const [b, d] = await Promise.all([loadBusinesses(), loadDeals()])
      setBusinesses(Array.isArray(b) ? b : [])
      setDeals(Array.isArray(d) ? d : [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [currentOrg, loadBusinesses, loadDeals])

  useEffect(() => { loadAll() }, [loadAll])

  // Business-identity resolution: search before creating, show ambiguous matches, never silently merge.
  const searchForDuplicates = async (name) => {
    if (!name.trim()) { setBizCandidates(null); return }
    try {
      const matches = await loadBusinesses(name.trim())
      setBizCandidates(matches || [])
    } catch {
      setBizCandidates([])
    }
  }

  const saveBusiness = async () => {
    if (!bizForm.name.trim() || !currentOrg) return
    setBizSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=crm&op=businesses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, ...bizForm }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to save')
      setBizModalOpen(false)
      setBizForm({ name: '', website: '', city: '', state: '', industry: '' })
      setBizCandidates(null)
      loadAll()
    } catch (e) {
      alert(e.message)
    }
    setBizSaving(false)
  }

  const filteredBusinesses = businesses.filter((b) => !search.trim() || b.name.toLowerCase().includes(search.toLowerCase()) || (b.website || '').toLowerCase().includes(search.toLowerCase()))

  if (!currentOrg) return null

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1300 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>CRM</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{businesses.length} businesses · {deals.length} deals in {currentOrg.name}</p>
        </div>
        {tab === 'businesses' && (
          <button onClick={() => setBizModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: 14, height: 14 }} /> Add Business
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[['businesses', 'Businesses', Building2], ['deals', 'Deals', HandCoins]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? GOLD : 'transparent'}`, color: tab === key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon style={{ width: 14, height: 14 }} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={loadAll} style={{ background: 'none', border: `1px solid #f87171`, borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : tab === 'businesses' ? (
        <>
          <div style={{ position: 'relative', maxWidth: 340, marginBottom: 20 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or website…" style={{ ...inp, paddingLeft: 34 }} />
          </div>
          {filteredBusinesses.length === 0 ? (
            <EmptyState icon={Building2} text={businesses.length === 0 ? 'No businesses yet. Add one to get started.' : 'No businesses match your search.'} />
          ) : (
            <Table
              headers={['Name', 'Website', 'Location', 'Industry', 'Confidence']}
              rows={filteredBusinesses.map((b) => [
                b.name,
                b.website ? <a href={b.website.startsWith('http') ? b.website : `https://${b.website}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{b.website}</a> : '—',
                [b.city, b.state].filter(Boolean).join(', ') || '—',
                b.industry || '—',
                <ConfidenceBadge key="c" value={b.confidence} />,
              ])}
            />
          )}
        </>
      ) : (
        deals.length === 0 ? (
          <EmptyState icon={HandCoins} text="No deals yet. Deals are created from a qualified business — add a business first." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deals.map((d) => {
              const biz = businesses.find((b) => b.id === d.business_id)
              const closed = CLOSED_STAGES.includes(d.stage)
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{biz?.name || 'Unlinked business'}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{d.pipeline} · {d.value_cents ? `$${(d.value_cents / 100).toLocaleString()}` : 'value not set'}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: closed ? 'rgba(239,68,68,0.1)' : `${GOLD}14`, color: closed ? '#f87171' : GOLD, textTransform: 'uppercase' }}>
                    {STAGE_LABELS[d.stage] || d.stage}
                  </span>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              )
            })}
          </div>
        )
      )}

      {bizModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && setBizModalOpen(false)}>
          <div style={{ width: '100%', maxWidth: 460, background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Add Business</h3>
              <button onClick={() => setBizModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Business Name *</label>
                <input value={bizForm.name} onChange={(e) => { setBizForm((f) => ({ ...f, name: e.target.value })); searchForDuplicates(e.target.value) }} style={inp} placeholder="Angelina's Pizza" />
              </div>
              {bizCandidates && bizCandidates.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                  <p style={{ color: '#f87171', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Possible existing match — do not create a duplicate:</p>
                  {bizCandidates.map((c) => (
                    <p key={c.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 0' }}>{c.name} {c.website ? `— ${c.website}` : ''}</p>
                  ))}
                </div>
              )}
              <div>
                <label style={lbl}>Website</label>
                <input value={bizForm.website} onChange={(e) => setBizForm((f) => ({ ...f, website: e.target.value }))} style={inp} placeholder="example.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>City</label>
                  <input value={bizForm.city} onChange={(e) => setBizForm((f) => ({ ...f, city: e.target.value }))} style={inp} placeholder="Waterbury" />
                </div>
                <div>
                  <label style={lbl}>State</label>
                  <input value={bizForm.state} onChange={(e) => setBizForm((f) => ({ ...f, state: e.target.value }))} style={inp} placeholder="CT" />
                </div>
              </div>
              <div>
                <label style={lbl}>Industry</label>
                <input value={bizForm.industry} onChange={(e) => setBizForm((f) => ({ ...f, industry: e.target.value }))} style={inp} placeholder="Restaurant" />
              </div>
              <button onClick={saveBusiness} disabled={!bizForm.name.trim() || bizSaving} style={{ padding: 13, background: bizForm.name.trim() ? G : '#161410', border: 'none', borderRadius: 9, color: bizForm.name.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: bizForm.name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {bizSaving ? 'Saving…' : 'Save Business'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ value }) {
  const colors = { confirmed: '#4ade80', likely: GOLD, unconfirmed: 'rgba(255,255,255,0.35)' }
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors[value] || colors.unconfirmed }}>{value}</span>
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <Icon style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{text}</p>
    </div>
  )
}

function Table({ headers, rows }) {
  const cols = `repeat(${headers.length}, 1fr)`
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'auto' }}>
      <div style={{ minWidth: 700, display: 'grid', gridTemplateColumns: cols, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {headers.map((h) => <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ minWidth: 700, display: 'grid', gridTemplateColumns: cols, padding: '13px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {row.map((cell, j) => <span key={j} style={{ color: j === 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: j === 0 ? 600 : 400 }}>{cell}</span>)}
        </div>
      ))}
    </div>
  )
}
