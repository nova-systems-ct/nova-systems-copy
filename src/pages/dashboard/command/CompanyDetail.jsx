import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const VENTURE_STAGES = ['idea', 'research', 'zero_cost_validation', 'demand_signal', 'pre_sale', 'sandbox_mvp', 'pilot', 'scale', 'paused', 'killed', 'archived']

async function call(resource, op, body = {}, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=${resource}&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=${resource}&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

export default function CompanyDetail() {
  const { id } = useParams()
  const [portfolio, setPortfolio] = useState([])
  const [units, setUnits] = useState([])
  const [positions, setPositions] = useState([])
  const [workers, setWorkers] = useState([])
  const [ventureData, setVentureData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stage, setStage] = useState(''); const [reason, setReason] = useState(''); const [override, setOverride] = useState(false); const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pf, u, p, w] = await Promise.all([
        authedFetch('/api/client?resource=hierarchy&op=portfolio').then((r) => r.json()),
        authedFetch('/api/client?resource=hierarchy&op=org-units').then((r) => r.json()),
        authedFetch('/api/client?resource=hierarchy&op=positions').then((r) => r.json()),
        authedFetch('/api/client?resource=hierarchy&op=workers').then((r) => r.json()),
      ])
      setPortfolio(pf); setUnits(u); setPositions(p); setWorkers(w)
      const entity = pf.find((e) => e.id === id)
      if (entity?.entity_type === 'experimental_venture') {
        const vd = await call('workitems', 'venture-data', { id }, 'GET')
        setVentureData(vd.venture_data || {})
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const entity = portfolio.find((e) => e.id === id)
  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  if (!entity) return <div style={{ padding: 48 }}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Not found.</p></div>

  const changeStage = async () => {
    setBusy(true); setError('')
    try { await call('workitems', 'set-venture-stage', { id, stage, reason, override, evidence: override ? evidence : undefined }); setStage(''); setReason(''); setOverride(false); setEvidence(''); await load() }
    catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <Link to="/dashboard/command/companies" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none', marginBottom: 16 }}><ArrowLeft style={{ width: 13, height: 13 }} /> Companies</Link>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{entity.name}</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{entity.entity_type.replace(/_/g, ' ')} · {entity.status}{entity.venture_stage ? ` · stage: ${entity.venture_stage}` : ''}</p>
      {entity.purpose && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12 }}>{entity.purpose}</p>}
      {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 16 }}>{error}</p>}

      {entity.entity_type === 'experimental_venture' && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Venture Lab</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
            {['hypothesis', 'customer', 'offer', 'budget', 'worker_hours', 'revenue_collected', 'costs', 'success_criteria', 'kill_criteria', 'lessons'].map((k) => (
              <div key={k} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</p>
                <p style={{ color: ventureData[k] ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4 }}>{ventureData[k] || 'Not recorded'}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ ...inp, width: 160, appearance: 'none' }}>
              <option value="" style={{ background: '#111' }}>New stage…</option>
              {VENTURE_STAGES.map((s) => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
            </select>
            <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override (skip normal lifecycle)</label>
            {override && <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Supporting evidence (required for override)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />}
            <button disabled={busy || !stage || !reason.trim()} onClick={changeStage} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Change stage</button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Org units</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {units.filter((u) => u.portfolio_entity_id === id).map((u) => <div key={u.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{u.name} <span style={{ color: 'rgba(255,255,255,0.3)' }}>({u.unit_type})</span></div>)}
          {units.filter((u) => u.portfolio_entity_id === id).length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No company-specific units — this company uses only portfolio-wide seats.</p>}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Positions &amp; workers</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {positions.filter((p) => p.portfolio_entity_id === id).map((p) => <div key={p.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{p.title}</div>)}
          {workers.filter((w) => w.portfolio_entity_id === id).map((w) => (
            <Link key={w.id} to={`/dashboard/command/workers/${w.id}`} style={{ fontSize: 13, color: GOLD, textDecoration: 'none' }}>{w.display_name} →</Link>
          ))}
          {positions.filter((p) => p.portfolio_entity_id === id).length === 0 && workers.filter((w) => w.portfolio_entity_id === id).length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No company-specific positions or workers yet.</p>}
        </div>
      </section>
    </div>
  )
}
