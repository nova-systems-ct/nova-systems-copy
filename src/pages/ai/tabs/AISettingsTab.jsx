import { useEffect, useState } from 'react'
import { GOLD } from '../AIDashboardShell'

const FIELDS = [
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key' },
  { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID' },
  { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token' },
  { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key' },
]

export default function AISettingsTab() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/nova-ai?action=settings').then(r => r.json()).then(data => {
      setValues(data || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/nova-ai?action=settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      })
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'monospace' }

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 640 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
      <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>Settings</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 32, lineHeight: 1.6 }}>
        These keys are used by the backend API routes that power your Nova AI agents — voice synthesis, transcription, and telephony. Saving here takes effect immediately, no redeploy needed.
      </p>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</label>
              <input
                type="password"
                style={inputStyle}
                value={values[f.key] || ''}
                onChange={e => { setValues({ ...values, [f.key]: e.target.value }); setSaved(false) }}
                placeholder="Not set"
              />
            </div>
          ))}
          <button onClick={save} disabled={saving} style={{ alignSelf: 'flex-start', padding: '12px 26px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
