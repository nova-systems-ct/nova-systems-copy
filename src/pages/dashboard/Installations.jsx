import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Plus, X, Loader2, FlaskConical, CheckCircle2, PauseCircle, PowerOff } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const STATUS_CFG = {
  sandbox_setup:   { label: 'Sandbox Setup',  color: 'rgba(255,255,255,0.4)', icon: FlaskConical },
  sandbox_testing: { label: 'Sandbox Testing', color: GOLD,                   icon: FlaskConical },
  sandbox_passed:  { label: 'Sandbox Passed',  color: '#4ade80',              icon: CheckCircle2 },
  active:          { label: 'Active',          color: '#4ade80',              icon: CheckCircle2 },
  paused:          { label: 'Paused',          color: '#a78bfa',              icon: PauseCircle },
  offboarded:      { label: 'Offboarded',      color: 'rgba(255,255,255,0.3)', icon: PowerOff },
}

// Installation Center (master prompt §13) — the real provisioning workflow on top of the order
// lifecycle: sandbox testing with real recorded results, activation gated behind a distinct
// admin.view authority (not just the growth.view every other action here uses), pause/resume,
// offboard. See api/client.js's `installations` resource for the enforced state machine.
export default function Installations() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [installations, setInstallations] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setError('')
    try {
      const [instRes, orderRes] = await Promise.all([
        authedFetch(`/api/client?resource=installations&organization_id=${encodeURIComponent(currentOrg.id)}`),
        authedFetch(`/api/client?resource=orders&organization_id=${encodeURIComponent(currentOrg.id)}`),
      ])
      if (!instRes.ok) throw new Error((await instRes.json().catch(() => ({}))).error || 'Failed to load installations')
      setInstallations(await instRes.json())
      setOrders(orderRes.ok ? await orderRes.json() : [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { load() }, [load])

  const installedOrderIds = new Set(installations.map((i) => i.order_id))
  const availableOrders = orders.filter((o) => o.status === 'delivered' && !installedOrderIds.has(o.id))

  const createInstallation = async () => {
    if (!selectedOrderId || !currentOrg) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=installations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, order_id: selectedOrderId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create installation')
      setCreateOpen(false)
      setSelectedOrderId('')
      navigate(`/dashboard/installations/${data.installation.id}`)
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
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Installation Center</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{installations.length} installation{installations.length !== 1 ? 's' : ''} in {currentOrg.name}</p>
        </div>
        <button onClick={() => setCreateOpen(true)} disabled={availableOrders.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: availableOrders.length ? G : '#161410', border: 'none', borderRadius: 8, color: availableOrders.length ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: availableOrders.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          <Plus style={{ width: 14, height: 14 }} /> New Installation
        </button>
      </div>
      {availableOrders.length === 0 && !loading && (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 20 }}>No delivered orders are awaiting an installation right now.</p>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : installations.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Server style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No installations yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {installations.map((inst) => {
            const cfg = STATUS_CFG[inst.status] || STATUS_CFG.sandbox_setup
            const Icon = cfg.icon
            return (
              <button key={inst.id} onClick={() => navigate(`/dashboard/installations/${inst.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Order {String(inst.order_id).slice(0, 8)}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>Updated {new Date(inst.updated_at).toLocaleDateString()}</p>
                </div>
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
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>New Installation</h3>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Delivered order *</label>
                <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111' }}>Select…</option>
                  {availableOrders.map((o) => <option key={o.id} value={o.id} style={{ background: '#111' }}>Order {o.id.slice(0, 8)}</option>)}
                </select>
              </div>
              <button onClick={createInstallation} disabled={!selectedOrderId || saving} style={{ padding: 13, background: selectedOrderId ? G : '#161410', border: 'none', borderRadius: 9, color: selectedOrderId ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: selectedOrderId ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : 'Start Installation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
