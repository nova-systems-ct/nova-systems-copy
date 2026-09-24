import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, CheckCircle2, XCircle, MinusCircle, Rocket, PauseCircle, PlayCircle, PowerOff } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, marginBottom: 20 }
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }
const btn = (bg, color) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: bg, border: 'none', borderRadius: 8, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

const RESULT_ICON = { pass: CheckCircle2, fail: XCircle, blocked: MinusCircle }
const RESULT_COLOR = { pass: '#4ade80', fail: '#f87171', blocked: 'rgba(255,255,255,0.4)' }

export default function InstallationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [testForm, setTestForm] = useState({ test_name: '', result: 'pass', environment: 'sandbox', notes: '' })

  const load = useCallback(async () => {
    if (!currentOrg) return
    setError('')
    try {
      const r = await authedFetch(`/api/client?resource=installations&organization_id=${encodeURIComponent(currentOrg.id)}&id=${encodeURIComponent(id)}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load installation')
      setData(await r.json())
    } catch (e) {
      setError(e.message)
    }
  }, [currentOrg, id])

  useEffect(() => { load() }, [load])

  const doAction = async (action, extra = {}) => {
    setBusy(true)
    try {
      const r = await authedFetch('/api/client?resource=installations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organization_id: currentOrg.id, id, ...extra }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Action failed')
      await load()
    } catch (e) {
      alert(e.message)
    }
    setBusy(false)
  }

  const recordTest = async () => {
    if (!testForm.test_name) return
    await doAction('record-test', testForm)
    setTestForm({ test_name: '', result: 'pass', environment: 'sandbox', notes: '' })
  }

  const pauseOrOffboard = async (action) => {
    const reason = window.prompt(`Reason to ${action} this installation:`)
    if (!reason) return
    await doAction(action, { reason })
  }

  if (error) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>
        <button onClick={() => navigate('/dashboard/installations')} style={{ marginTop: 16, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← Back to Installations</button>
      </div>
    )
  }
  if (!data) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  const latestTest = data.tests?.[0]

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <button onClick={() => navigate('/dashboard/installations')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', marginBottom: 18, fontFamily: 'inherit' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Installations
      </button>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Order {String(data.order_id).slice(0, 8)}</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 24 }}>Status: {data.status.replace(/_/g, ' ')}</p>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['sandbox_setup', 'sandbox_testing'].includes(data.status) && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, alignSelf: 'center' }}>Record sandbox tests below, then mark sandbox passed once the latest one is a pass.</span>
          )}
          {data.status === 'sandbox_testing' && (
            <button disabled={busy || latestTest?.result !== 'pass'} onClick={() => doAction('mark-sandbox-passed')} style={btn(latestTest?.result === 'pass' ? G : '#161410', latestTest?.result === 'pass' ? '#0a0800' : 'rgba(255,255,255,0.25)')}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Mark Sandbox Passed
            </button>
          )}
          {data.status === 'sandbox_passed' && (
            <button disabled={busy} onClick={() => doAction('activate')} style={btn(G, '#0a0800')} title="Requires admin.view — activation authority">
              <Rocket style={{ width: 14, height: 14 }} /> Activate (requires admin authority)
            </button>
          )}
          {data.status === 'active' && (
            <button disabled={busy} onClick={() => pauseOrOffboard('pause')} style={btn('rgba(167,139,250,0.12)', '#a78bfa')}>
              <PauseCircle style={{ width: 14, height: 14 }} /> Pause
            </button>
          )}
          {data.status === 'paused' && (
            <button disabled={busy} onClick={() => doAction('resume')} style={btn('rgba(74,222,128,0.12)', '#4ade80')}>
              <PlayCircle style={{ width: 14, height: 14 }} /> Resume
            </button>
          )}
          {['active', 'paused', 'sandbox_passed'].includes(data.status) && (
            <button disabled={busy} onClick={() => pauseOrOffboard('offboard')} style={btn('rgba(248,113,113,0.1)', '#f87171')}>
              <PowerOff style={{ width: 14, height: 14 }} /> Offboard
            </button>
          )}
        </div>
      </div>

      {['sandbox_setup', 'sandbox_testing'].includes(data.status) && (
        <div style={CARD}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Record a Test</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Test name *</label>
              <input value={testForm.test_name} onChange={(e) => setTestForm((f) => ({ ...f, test_name: e.target.value }))} style={inp} placeholder="e.g. DNS resolves, webhook receives test event" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Result</label>
                <select value={testForm.result} onChange={(e) => setTestForm((f) => ({ ...f, result: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="pass" style={{ background: '#111' }}>Pass</option>
                  <option value="fail" style={{ background: '#111' }}>Fail</option>
                  <option value="blocked" style={{ background: '#111' }}>Blocked</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Environment</label>
                <select value={testForm.environment} onChange={(e) => setTestForm((f) => ({ ...f, environment: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="sandbox" style={{ background: '#111' }}>Sandbox</option>
                  <option value="production" style={{ background: '#111' }}>Production</option>
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <textarea value={testForm.notes} onChange={(e) => setTestForm((f) => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <button disabled={busy || !testForm.test_name} onClick={recordTest} style={{ ...btn(testForm.test_name ? G : '#161410', testForm.test_name ? '#0a0800' : 'rgba(255,255,255,0.25)'), justifyContent: 'center' }}>
              <Plus style={{ width: 14, height: 14 }} /> Record Test
            </button>
          </div>
        </div>
      )}

      <div style={CARD}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Test History</h3>
        {!data.tests?.length ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No tests recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.tests.map((t) => {
              const Icon = RESULT_ICON[t.result]
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Icon style={{ width: 15, height: 15, color: RESULT_COLOR[t.result], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: 13 }}>{t.test_name} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>({t.environment})</span></p>
                    {t.notes && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{t.notes}</p>}
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={CARD}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Event Log</h3>
        {!data.events?.length ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No events yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.events.map((e) => (
              <p key={e.id} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} — {e.event_type.replace(/_/g, ' ')}
                {e.detail?.reason ? `: ${e.detail.reason}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
