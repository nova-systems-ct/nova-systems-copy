import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Loader2, HandCoins, CheckCircle2 } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const inp = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const emptyForm = { rep_name: '', rep_email: '', client_name: '', deal_value: '', commission_rate: 15 }

export default function Referrals() {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/client?resource=referrals')
      const data = await r.json()
      setReferrals(Array.isArray(data) ? data : [])
    } catch { setReferrals([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => ({
    owed: referrals.filter(r => r.status !== 'Paid').reduce((s, r) => s + (Number(r.commission_amount) || 0), 0),
    paid: referrals.filter(r => r.status === 'Paid').reduce((s, r) => s + (Number(r.commission_amount) || 0), 0),
    activeReps: new Set(referrals.map(r => r.rep_email)).size,
  }), [referrals])

  const save = async () => {
    if (!form.rep_name || !form.client_name || !form.deal_value) return
    setSaving(true)
    await fetch('/api/client?resource=referrals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...form }),
    })
    setSaving(false)
    setCreating(false)
    setForm(emptyForm)
    load()
  }

  const markPaid = async (r) => {
    await fetch('/api/client?resource=referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: r.id, ...r, status: 'Paid' }) })
    load()
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Sales</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Referrals & Commissions</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: 14, height: 14 }} /> Log Deal
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard label="Commissions Owed" value={`$${stats.owed.toLocaleString()}`} />
        <StatCard label="Commissions Paid" value={`$${stats.paid.toLocaleString()}`} />
        <StatCard label="Active Reps" value={stats.activeReps} />
      </div>

      {creating && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Log a Closed Deal</p>
            <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={lbl}>Rep Name</label><input value={form.rep_name} onChange={e => setForm(f => ({ ...f, rep_name: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Rep Email</label><input value={form.rep_email} onChange={e => setForm(f => ({ ...f, rep_email: e.target.value }))} style={inp} /></div>
            </div>
            <div><label style={lbl}>Client Name</label><input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={lbl}>Deal Value ($/mo)</label><input type="number" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))} style={inp} /></div>
              <div>
                <label style={lbl}>Commission Rate</label>
                <select value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value={15} style={{ background: '#111' }}>15% — under $2,000/mo</option>
                  <option value={20} style={{ background: '#111' }}>20% — $2,000/mo and above</option>
                </select>
              </div>
            </div>
            {form.deal_value && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                Commission: <strong style={{ color: GOLD }}>${((Number(form.deal_value) || 0) * (Number(form.commission_rate) || 0) / 100).toFixed(2)}</strong>
              </p>
            )}
            <button onClick={save} disabled={saving} style={{ padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', margin: '0 auto' }} /> : 'Save Deal'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <HandCoins style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No deals logged yet.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 1fr 90px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Rep', 'Client', 'Deal Value', 'Rate', 'Commission', ''].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {referrals.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 1fr 90px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{r.rep_name}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.client_name}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${Number(r.deal_value).toLocaleString()}/mo</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.commission_rate}%</span>
              <span style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>${Number(r.commission_amount).toLocaleString()}</span>
              {r.status === 'Paid' ? (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', color: '#4ade80', width: 'fit-content', textTransform: 'uppercase' }}>Paid</span>
              ) : (
                <button onClick={() => markPaid(r)} title="Mark Paid" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', cursor: 'pointer' }}><CheckCircle2 style={{ width: 12, height: 12 }} /></button>
              )}
            </div>
          ))}
        </div>
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
