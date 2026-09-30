import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

async function call(op, body = {}, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=meetings&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=meetings&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}
const Field = ({ label, children }) => (
  <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase' }}>{label}</p>
    <p style={{ color: children ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 4 }}>{children || 'Not recorded'}</p>
  </div>
)

export default function IncidentDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [containment, setContainment] = useState(''); const [recovery, setRecovery] = useState(''); const [summary, setSummary] = useState('')

  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await call('meeting', { id }, 'GET')) } catch (e) { setError(e.message) } setLoading(false) }, [id])
  useEffect(() => { load() }, [load])
  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await load() } catch (e) { setError(e.message) } setBusy(false) }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  if (!data) return <div style={{ padding: 48 }}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Not found.</p></div>
  const { meeting, participants, transcript, evidence, action_items: actionItems } = data
  const d = meeting.incident_details || {}
  const inSession = meeting.status === 'in_session'

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <Link to="/dashboard/command/incidents" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none', marginBottom: 16 }}><ArrowLeft style={{ width: 13, height: 13 }} /> Incident Room</Link>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{meeting.title}</h1>
      <p style={{ color: meeting.status === 'in_session' ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginTop: 6 }}>{meeting.status}</p>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginTop: 20 }}>
        <Field label="Severity">{d.severity}</Field>
        <Field label="Detection">{d.detection}</Field>
        <Field label="Affected systems">{d.affected_systems}</Field>
        <Field label="Containment">{d.containment}</Field>
        <Field label="Recovery">{d.recovery}</Field>
      </div>

      {inSession && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Containment update…" value={containment} onChange={(e) => setContainment(e.target.value)} />
          <button disabled={busy || !containment.trim()} onClick={() => act(async () => { await call('update-incident-details', { id, containment }); setContainment('') })} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Recovery update…" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
          <button disabled={busy || !recovery.trim()} onClick={() => act(async () => { await call('update-incident-details', { id, recovery }); setRecovery('') })} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
        </div>
      )}

      <section style={{ marginTop: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Participants</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{participants.map((p) => <span key={p.id} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}>{p.label} — {p.availability}</span>)}</div>
      </section>

      <section style={{ marginTop: 20 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Timeline / transcript</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
          {transcript.map((t) => <div key={t.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}><b style={{ color: '#fff' }}>{t.speaker_label}</b> ({new Date(t.created_at).toLocaleTimeString()}): {t.content}</div>)}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Evidence</p>
        {evidence.map((e) => <p key={e.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{e.source} — {e.observation}</p>)}
        {evidence.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>None added.</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Action items</p>
        {actionItems.map((a) => <p key={a.id} style={{ fontSize: 12, color: a.status === 'done' ? 'rgba(255,255,255,0.35)' : '#fff' }}>{a.description} — {a.status}</p>)}
      </section>

      {inSession && (
        <div style={{ marginTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <textarea style={{ ...inp, minHeight: 70, marginBottom: 10 }} placeholder="Post-incident review summary (required to close)…" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <button disabled={busy || summary.trim().length < 5} onClick={() => act(() => call('close-meeting', { id, summary }))} style={{ padding: '11px 18px', background: summary.trim().length >= 5 ? G : '#161410', border: 'none', borderRadius: 8, color: summary.trim().length >= 5 ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close incident</button>
        </div>
      )}
    </div>
  )
}
