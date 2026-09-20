import { useState, useEffect } from 'react'
import { Plug, CheckCircle2, XCircle, AlertTriangle, Circle, Loader2, RefreshCw } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'

// Status meanings (matches api/integrations.js exactly):
//   not_connected — required env var(s) missing entirely
//   connected     — env var(s) present, but not verified live since this page loaded
//   tested        — a real, on-demand check against the provider's own API just succeeded
//   degraded      — configured, but the last live check failed (e.g. an invalid/expired key)
// "Tested" only ever comes from an explicit click — this page never calls a provider
// automatically, so opening it can't burn quota or trigger rate limits on its own.
const STATUS_META = {
  not_connected: { label: 'Not Connected', color: '#f87171', Icon: XCircle },
  connected: { label: 'Connected', color: '#60a5fa', Icon: Circle },
  tested: { label: 'Tested', color: '#4ade80', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: '#fb923c', Icon: AlertTriangle },
}

export default function Integrations() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState({})
  const [results, setResults] = useState({})
  const [loadError, setLoadError] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const r = await authedFetch('/api/integrations?op=status')
      if (!r.ok) { setLoadError(true); setLoading(false); return }
      const data = await r.json()
      setProviders(Array.isArray(data.providers) ? data.providers : [])
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const testProvider = async (key) => {
    setTesting((t) => ({ ...t, [key]: true }))
    try {
      const r = await authedFetch(`/api/integrations?op=test&provider=${encodeURIComponent(key)}`, { method: 'POST' })
      const data = await r.json()
      setResults((res) => ({ ...res, [key]: data }))
    } catch (e) {
      setResults((res) => ({ ...res, [key]: { status: 'degraded', detail: 'Request failed: ' + e.message, tested_at: new Date().toISOString() } }))
    }
    setTesting((t) => ({ ...t, [key]: false }))
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Integration Center</h1>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
        </button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, maxWidth: 640, marginBottom: 32, lineHeight: 1.5 }}>
        Live status for every external provider this platform actually connects to. "Connected" means the credential
        is present — click "Test Connection" for a real, on-demand check against that provider's own API. No
        credential value is ever shown here. Nothing on this page runs automatically against a provider.
      </p>

      {loadError && (
        <div style={{ padding: '18px 22px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 28 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Could not load integration status.</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map((p) => {
            const live = results[p.key]
            const effectiveStatus = live?.status || p.status
            const meta = STATUS_META[effectiveStatus] || STATUS_META.not_connected
            const StatusIcon = meta.Icon
            return (
              <div key={p.key} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Plug style={{ width: 16, height: 16, color: GOLD, flexShrink: 0 }} />
                    <div>
                      <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{p.label}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{p.purpose}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: `${meta.color}18`, border: `1px solid ${meta.color}45` }}>
                      <StatusIcon style={{ width: 12, height: 12, color: meta.color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</span>
                    </span>
                    <button
                      onClick={() => testProvider(p.key)}
                      disabled={testing[p.key]}
                      style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${GOLD}55`, borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: testing[p.key] ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {testing[p.key] ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} /> : null}
                      Test Connection
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
                  {p.envVars.map((v) => (
                    <span key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.set ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                      {v.name}
                    </span>
                  ))}
                </div>

                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10 }}>
                  If disconnected: {p.breaksIfMissing}
                </p>

                {live && (
                  <p style={{ color: meta.color, fontSize: 11, marginTop: 8, fontWeight: 600 }}>
                    {live.detail} — tested {new Date(live.tested_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
