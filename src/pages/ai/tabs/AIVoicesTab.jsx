import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Plus, Mic, X } from 'lucide-react'
import { GOLD } from '../AIDashboardShell'

export default function AIVoicesTab() {
  const [voices, setVoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ voice_name: '', elevenlabs_voice_id: '', industry: '', language: 'en-es', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  const load = () => {
    fetch('/api/nova-ai?action=voices').then(r => r.json()).then(data => {
      setVoices(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  const playPreview = async (v) => {
    if (playingId === v.id) { audioRef.current?.pause(); setPlayingId(null); return }
    setPlayingId(v.id)
    try {
      const r = await fetch('/api/nova-ai?action=get-voice-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: v.elevenlabs_voice_id, sample_text: `Hi! This is ${v.voice_name}, thanks for calling.` }),
      })
      const data = await r.json()
      if (data.audio_base64) {
        const audio = new Audio(`data:${data.mime_type};base64,${data.audio_base64}`)
        audioRef.current = audio
        audio.onended = () => setPlayingId(null)
        audio.play()
      } else { setPlayingId(null) }
    } catch { setPlayingId(null) }
  }

  const submitVoice = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/nova-ai?action=voices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to add voice')
      setShowAdd(false)
      setForm({ voice_name: '', elevenlabs_voice_id: '', industry: '', language: 'en-es', description: '' })
      load()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'inherit', marginBottom: 12 }
  const labelStyle = { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Voices</h1>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus style={{ width: 14, height: 14 }} /> Add New Voice
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {voices.map(v => (
            <div key={v.id} style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${GOLD}12`, border: `1px solid ${GOLD}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mic style={{ width: 16, height: 16, color: GOLD }} />
                </div>
                <div>
                  <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{v.voice_name}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{v.industry || 'General'} · {v.language}</p>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5, marginBottom: 16, minHeight: 34 }}>{v.description}</p>
              <button
                onClick={() => playPreview(v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD}30`, borderRadius: 8, color: GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {playingId === v.id ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
                {playingId === v.id ? 'Playing…' : 'Play Sample'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowAdd(false)}>
          <form onSubmit={submitVoice} style={{ background: '#0a0800', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Add New Voice</h3>
              <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            <label style={labelStyle}>Voice Name</label>
            <input style={inputStyle} required value={form.voice_name} onChange={e => setForm({ ...form, voice_name: e.target.value })} />
            <label style={labelStyle}>ElevenLabs Voice ID</label>
            <input style={inputStyle} required value={form.elevenlabs_voice_id} onChange={e => setForm({ ...form, elevenlabs_voice_id: e.target.value })} />
            <label style={labelStyle}>Industry</label>
            <input style={inputStyle} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
              {saving ? 'Saving…' : 'Add Voice'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
