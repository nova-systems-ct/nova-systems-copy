import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Plus, X, Loader2, Clock, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const BUCKET_CFG = {
  waiting_for_client: { label: 'Waiting on Client', color: 'rgba(255,255,255,0.4)', icon: Clock },
  queue:               { label: 'Queued',            color: 'rgba(255,255,255,0.4)', icon: Clock },
  active:              { label: 'Active',            color: '#4ade80',               icon: Clock },
  at_risk:             { label: 'At Risk',            color: GOLD,                    icon: AlertTriangle },
  overdue:             { label: 'Overdue',            color: '#f87171',               icon: AlertTriangle },
  reviewer_wait:       { label: 'Reviewer Wait',      color: '#a78bfa',               icon: Clock },
  paused:              { label: 'Paused',             color: '#a78bfa',               icon: PauseCircle },
  completed:           { label: 'Completed',          color: '#4ade80',               icon: CheckCircle2 },
}

// Nova Audit case queue (master prompt §8/§9). The 24-72h clock and all its status buckets are
// computed server-side (api/_auditClock.js), never re-derived client-side — this page only
// renders what the server already calculated, so the deadline math has exactly one
// implementation, covered by scripts/unit_audit_clock_test.mjs.
export default function AuditCases() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [cases, setCases] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ business_id: '', scope: 'digital', target_hours: 72 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setError('')
    try {
      const [caseRes, bizRes] = await Promise.all([
        authedFetch(`/api/client?resource=audit&op=cases&organization_id=${encodeURIComponent(currentOrg.id)}`),
        authedFetch(`/api/client?resource=crm&op=businesses&organization_id=${encodeURIComponent(currentOrg.id)}`),
      ])
      if (!caseRes.ok) throw new Error((await caseRes.json().catch(() => ({}))).error || 'Failed to load cases')
      setCases(await caseRes.json())
      setBusinesses(bizRes.ok ? await bizRes.json() : [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { load() }, [load])

  const createCase = async () => {
    if (!form.business_id || !currentOrg) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=audit&op=cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, ...form, target_hours: Number(form.target_hours) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create case')
      setCreateOpen(false)
      setForm({ business_id: '', scope: 'digital', target_hours: 72 })
      navigate(`/dashboard/audit/${data.case.id}`)
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  if (!currentOrg) return null

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Intelligence</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Audit Cases</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{cases.length} case{cases.length !== 1 ? 's' : ''} in {currentOrg.name}</p>
        </div>
        <button onClick={() => setCreateOpen(true)} disabled={businesses.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: businesses.length ? G : '#161410', border: 'none', borderRadius: 8, color: businesses.length ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: businesses.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          <Plus style={{ width: 14, height: 14 }} /> New Case
        </button>
      </div>
      {businesses.length === 0 && !loading && (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 20 }}>Add a business in CRM before starting an audit case.</p>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : cases.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ClipboardCheck style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No audit cases yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cases.map((c) => {
            const biz = businesses.find((b) => b.id === c.business_id)
            const cfg = BUCKET_CFG[c.clock?.bucket] || BUCKET_CFG.queue
            const Icon = cfg.icon
            return (
              <button key={c.id} onClick={() => navigate(`/dashboard/audit/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{biz?.name || 'Unknown business'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{c.scope === '360' ? '360 Audit' : 'Digital Audit'} · {c.status.replace(/_/g, ' ')}</p>
                </div>
                {c.clock?.dueAt && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    Due {new Date(c.clock.dueAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 20, background: `${cfg.color}18`, color: cfg.color, whiteSpace: 'nowrap' }}>
                  <Icon style={{ width: 12, height: 12 }} /> {cfg.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div style={{ width: '100%', maxWidth: 440, background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>New Audit Case</h3>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Business *</label>
                <select value={form.business_id} onChange={(e) => setForm((f) => ({ ...f, business_id: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111' }}>Select…</option>
                  {businesses.map((b) => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Scope</label>
                <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value, target_hours: e.target.value === '360' ? 240 : 72 }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="digital" style={{ background: '#111' }}>Digital (remote)</option>
                  <option value="360" style={{ background: '#111' }}>360 (digital + on-site)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Target Hours (from intake/access completion, not from creation)</label>
                <input type="number" value={form.target_hours} onChange={(e) => setForm((f) => ({ ...f, target_hours: e.target.value }))} style={inp} />
              </div>
              <button onClick={createCase} disabled={!form.business_id || saving} style={{ padding: 13, background: form.business_id ? G : '#161410', border: 'none', borderRadius: 9, color: form.business_id ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: form.business_id ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
