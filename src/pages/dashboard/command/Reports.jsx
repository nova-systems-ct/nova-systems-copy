import { useState, useEffect, useCallback } from 'react'
import { FileBarChart, Loader2 } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

async function call(op, body, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=workitems&op=${op}` : `/api/client?resource=workitems&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Every figure below comes straight from api/_hierarchy/workitems.js's generate-brief, which builds
// each number from a real database query at generation time — never a stored narrative that could
// drift from the data it once described. "No verified data" is a legitimate value, not an error.
export default function Reports() {
  const [briefs, setBriefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setBriefs(await call('briefs', {}, 'GET')) } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const generate = async (type) => {
    setBusy(true); setError('')
    try { await call('generate-brief', { brief_type: type }); await load() } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Owner Brief &amp; Executive Packet</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Real figures pulled from the database at generation time — every number carries its source and verification state.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={busy} onClick={() => generate('daily')} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Generate daily brief</button>
          <button disabled={busy} onClick={() => generate('weekly')} style={{ padding: '10px 16px', background: 'none', border: `1px solid ${GOLD}55`, borderRadius: 8, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Generate weekly packet</button>
        </div>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD }} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {briefs.map((b) => (
            <div key={b.id} style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{b.brief_type} brief — {new Date(b.generated_at).toLocaleString()}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginTop: 12 }}>
                {Object.entries(b.content).map(([k, v]) => (
                  <div key={k} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.replace(/_/g, ' ')}</p>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 4 }}>{typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)}</p>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, marginTop: 4 }}>source: {v.source} · {v.verification_state}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {briefs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <FileBarChart style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No briefs generated yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
