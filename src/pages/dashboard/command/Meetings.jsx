import { useState, useEffect, useCallback } from 'react'
import { Video, Loader2, X, Plus, ShieldAlert } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const AVAIL_COLOR = { available: '#4ade80', unavailable: '#f87171', reserved: 'rgba(255,255,255,0.4)', vacant: 'rgba(255,255,255,0.4)', failed: '#f87171' }

async function call(op, body, method = 'POST') {
  const url = method === 'GET' ? `/api/client?resource=meetings&op=${op}&${new URLSearchParams(body).toString()}` : `/api/client?resource=meetings&op=${op}`
  const r = await authedFetch(url, method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

function MeetingDetail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [note, setNote] = useState('')
  const [evSource, setEvSource] = useState(''); const [evObs, setEvObs] = useState('')
  const [actionDesc, setActionDesc] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => { const d = await call('meeting', { id }, 'GET'); setData(d) }, [id])
  useEffect(() => { load() }, [load])

  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await load(); onChanged?.() } catch (e) { setError(e.message) } setBusy(false) }

  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD }} /></div>
  const { meeting, participants, transcript, evidence, action_items: actionItems } = data
  const inSession = meeting.status === 'in_session'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto', background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{meeting.title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        <p style={{ color: inSession ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>{meeting.status} · {meeting.meeting_type}</p>
        {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Participants</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {participants.map((p) => (
            <span key={p.id} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, background: `${AVAIL_COLOR[p.availability]}18`, color: AVAIL_COLOR[p.availability] }}>{p.label} — {p.availability}</span>
          ))}
        </div>

        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Transcript</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
          {transcript.map((t) => (
            <div key={t.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}><b style={{ color: '#fff' }}>{t.speaker_label}</b> <span style={{ color: 'rgba(255,255,255,0.3)' }}>({t.entry_type})</span>: {t.content}</div>
          ))}
          {transcript.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No entries yet.</p>}
        </div>
        {inSession && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input style={inp} placeholder="Add a statement or question…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button disabled={busy || !note.trim()} onClick={() => act(async () => { await call('add-transcript-entry', { meeting_id: id, entry_type: 'statement', content: note }); setNote('') })} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          </div>
        )}

        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Evidence</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {evidence.map((e) => <div key={e.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{e.source} — {e.observation}</div>)}
          {evidence.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No evidence added.</p>}
        </div>
        {inSession && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Source" value={evSource} onChange={(e) => setEvSource(e.target.value)} />
            <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Observation" value={evObs} onChange={(e) => setEvObs(e.target.value)} />
            <button disabled={busy || !evSource.trim() || !evObs.trim()} onClick={() => act(async () => { await call('add-meeting-evidence', { meeting_id: id, source: evSource, observation: evObs }); setEvSource(''); setEvObs('') })} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          </div>
        )}

        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Action items</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {actionItems.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: a.status === 'done' ? 'rgba(255,255,255,0.35)' : '#fff' }}>
              <span style={{ textDecoration: a.status === 'done' ? 'line-through' : 'none' }}>{a.description}</span>
              {a.status === 'open' && <button onClick={() => act(() => call('complete-action-item', { id: a.id }))} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>Mark done</button>}
            </div>
          ))}
          {actionItems.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No action items.</p>}
        </div>
        {inSession && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input style={inp} placeholder="New action item…" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} />
            <button disabled={busy || !actionDesc.trim()} onClick={() => act(async () => { await call('create-action-item', { meeting_id: id, description: actionDesc }); setActionDesc('') })} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          </div>
        )}

        {inSession && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            <textarea style={{ ...inp, minHeight: 70, marginBottom: 10 }} placeholder="Closing summary (required to close)…" value={summary} onChange={(e) => setSummary(e.target.value)} />
            <button disabled={busy || summary.trim().length < 5} onClick={() => act(() => call('close-meeting', { id, summary }))} style={{ padding: '11px 18px', background: summary.trim().length >= 5 ? G : '#161410', border: 'none', borderRadius: 8, color: summary.trim().length >= 5 ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close meeting</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Meetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [incident, setIncident] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setMeetings(await call('meetings', {}, 'GET')) } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const meetNow = async () => {
    setCreating(true); setError('')
    try {
      const d = await call(incident ? 'open-incident' : 'meet-now', { title, reason })
      setTitle(''); setReason(''); setIncident(false)
      await load()
      setOpenId(d.meeting.id)
    } catch (e) { setError(e.message) }
    setCreating(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Committee Room</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Meet Now opens a real, persisted meeting with an honest participant list — reserved and vacant seats are shown exactly as that.</p>
        </div>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
        <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Reason (for the agenda)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          <input type="checkbox" checked={incident} onChange={(e) => setIncident(e.target.checked)} /> Incident
        </label>
        <button disabled={creating || !title.trim()} onClick={meetNow} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: title.trim() ? G : '#161410', border: 'none', borderRadius: 8, color: title.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: title.trim() ? 'pointer' : 'not-allowed' }}>
          {incident ? <ShieldAlert style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />} {incident ? 'Open Incident' : 'Meet Now'}
        </button>
      </div>

      {loading ? <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD }} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meetings.map((m) => (
            <button key={m.id} onClick={() => setOpenId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', textAlign: 'left', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
              <Video style={{ width: 16, height: 16, color: GOLD }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{m.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{m.meeting_type} · opened {new Date(m.opened_at).toLocaleString()}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: m.status === 'in_session' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>{m.status}</span>
            </button>
          ))}
          {meetings.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No meetings yet.</p>}
        </div>
      )}
      {openId && <MeetingDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}
