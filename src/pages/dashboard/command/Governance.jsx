import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Loader2, Power, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

async function call(resource, op, body, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=${resource}&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=${resource}&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Escalation chain (Worker -> Manager -> Executive -> CEO Twin -> Owner) and kill switches — the
// server-enforced governance controls. Every action here calls the real, tested api/_hierarchy/governance.js.
export default function Governance() {
  const [escalations, setEscalations] = useState([])
  const [switches, setSwitches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolveNotes, setResolveNotes] = useState({})
  const [ksScope, setKsScope] = useState('worker'); const [ksId, setKsId] = useState(''); const [ksReason, setKsReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [e, s] = await Promise.all([call('governance', 'escalations', {}, 'GET'), call('governance', 'kill-switches', {}, 'GET')])
      setEscalations(e); setSwitches(s)
    } catch (err) { setError(err.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await load() } catch (e) { setError(e.message) } setBusy(false) }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Governance</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Escalations and kill switches. Every escalation routes through a real chain; every kill switch genuinely blocks assignment/heartbeat calls once engaged.</p>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Escalations</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {escalations.map((e) => (
            <div key={e.id} style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{e.subject_type} — {e.reason}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>Level: {e.level} · Status: {e.status}</p>
                </div>
                {(e.status === 'open' || e.status === 'routed') && (
                  <button disabled={busy} onClick={() => act(() => call('governance', 'route-escalation', { id: e.id }))} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: `1px solid ${GOLD}55`, borderRadius: 6, color: GOLD, fontSize: 11, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <ArrowUpRight style={{ width: 12, height: 12 }} /> Route up
                  </button>
                )}
              </div>
              {(e.status === 'open' || e.status === 'routed') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input style={inp} placeholder="Resolution…" value={resolveNotes[e.id] || ''} onChange={(ev) => setResolveNotes((s) => ({ ...s, [e.id]: ev.target.value }))} />
                  <button disabled={busy || !(resolveNotes[e.id] || '').trim()} onClick={() => act(() => call('governance', 'resolve-escalation', { id: e.id, resolution: resolveNotes[e.id] }))} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Resolve</button>
                </div>
              )}
            </div>
          ))}
          {escalations.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No escalations.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Kill switches</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          <select value={ksScope} onChange={(e) => setKsScope(e.target.value)} style={{ ...inp, width: 160, appearance: 'none', cursor: 'pointer' }}>
            <option value="global" style={{ background: '#111' }}>Global</option>
            <option value="portfolio_entity" style={{ background: '#111' }}>Portfolio entity</option>
            <option value="org_unit" style={{ background: '#111' }}>Org unit</option>
            <option value="worker" style={{ background: '#111' }}>Worker</option>
            <option value="model_provider" style={{ background: '#111' }}>Model provider</option>
          </select>
          {ksScope !== 'global' && <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Scope id (worker id, provider key, …)" value={ksId} onChange={(e) => setKsId(e.target.value)} />}
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Reason (required)" value={ksReason} onChange={(e) => setKsReason(e.target.value)} />
          <button disabled={busy || !ksReason.trim() || (ksScope !== 'global' && !ksId.trim())} onClick={() => act(async () => { await call('governance', 'engage-kill-switch', { scope_type: ksScope, scope_id: ksScope === 'global' ? undefined : ksId, reason: ksReason }); setKsId(''); setKsReason('') })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#f87171', border: 'none', borderRadius: 7, color: '#1a0000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Power style={{ width: 13, height: 13 }} /> Engage
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {switches.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: s.engaged ? '#f87171' : 'rgba(255,255,255,0.2)' }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{s.scope_type}{s.scope_id ? ` — ${s.scope_id}` : ''}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{s.reason}</p>
              </div>
              {s.engaged ? (
                <button disabled={busy} onClick={() => act(() => call('governance', 'disengage-kill-switch', { id: s.id, reason: 'Restored from Governance screen.' }))} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 6, color: '#4ade80', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>
                  <CheckCircle2 style={{ width: 12, height: 12 }} /> Disengage
                </button>
              ) : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Disengaged</span>}
            </div>
          ))}
          {switches.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No kill switches have ever been engaged.</p>}
        </div>
      </section>
    </div>
  )
}
