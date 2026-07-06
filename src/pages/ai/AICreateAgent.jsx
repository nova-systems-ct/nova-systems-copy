import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Play, Pause, Loader2 } from 'lucide-react'
import { useSEO } from '@/hooks/useSEO'
import { useAdminGuard, GOLD } from './AIDashboardShell'

const STEPS = ['Client', 'Knowledge Base', 'Voice', 'Phone Number', 'Launch']

const BUSINESS_TYPES = ['Restaurant', 'Barbershop / Salon', 'Medical / Dental', 'Real Estate', 'Contractor', 'Retail', 'Other']

const inputStyle = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'inherit' }
const labelStyle = { display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }

function Field({ label, children }) {
  return <div style={{ marginBottom: 18 }}><label style={labelStyle}>{label}</label>{children}</div>
}

export default function AICreateAgent() {
  useAdminGuard()
  const navigate = useNavigate()
  useSEO({ title: 'Create Agent — Nova AI', description: 'Set up a new Nova AI voice and text agent.' })

  const [step, setStep] = useState(0)
  const [agentId, setAgentId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Step 1
  const [clientMode, setClientMode] = useState('new')
  const [existingClients, setExistingClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0])
  const [agentName, setAgentName] = useState('Nova')

  // Step 2
  const [kb, setKb] = useState({
    business_description: '', services: '', hours: '', address: '', booking_process: '',
    faqs: Array.from({ length: 10 }, () => ({ q: '', a: '' })),
    never_say: '', always_say: '', escalation: '', personality: '',
  })

  // Step 3
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [playingId, setPlayingId] = useState(null)

  // Step 4
  const [availableNumbers, setAvailableNumbers] = useState([])
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [phoneMode, setPhoneMode] = useState('new')
  const [manualNumber, setManualNumber] = useState('')
  const [provisionedNumber, setProvisionedNumber] = useState('')

  // Step 5
  const [status, setStatus] = useState('testing')
  const [launched, setLaunched] = useState(false)

  useEffect(() => {
    fetch('/api/intake?action=clients').then(r => r.json()).then(data => setExistingClients(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (step === 2) fetch('/api/nova-ai?action=voices').then(r => r.json()).then(data => setVoices(Array.isArray(data) ? data : [])).catch(() => {})
    if (step === 3 && phoneMode === 'new') {
      setLoadingNumbers(true)
      fetch('/api/nova-ai?action=get-twilio-numbers').then(r => r.json()).then(data => setAvailableNumbers(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoadingNumbers(false))
    }
  }, [step, phoneMode])

  const playPreview = async (v) => {
    if (playingId === v.id) { setPlayingId(null); return }
    setPlayingId(v.id)
    try {
      const r = await fetch('/api/nova-ai?action=get-voice-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: v.elevenlabs_voice_id, sample_text: `Hi! This is ${v.voice_name}, thanks for calling.` }),
      })
      const data = await r.json()
      if (data.audio_base64) {
        const audio = new Audio(`data:${data.mime_type};base64,${data.audio_base64}`)
        audio.onended = () => setPlayingId(null)
        audio.play()
      } else setPlayingId(null)
    } catch { setPlayingId(null) }
  }

  const goStep1 = async () => {
    setError('')
    const finalBusinessName = clientMode === 'existing'
      ? existingClients.find(c => c.id === selectedClientId)?.business_name || businessName
      : businessName
    if (!finalBusinessName.trim()) return setError('Business name is required.')
    setSaving(true)
    try {
      const r = await fetch('/api/nova-ai?action=agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', business_name: finalBusinessName, agent_name: agentName, client_id: clientMode === 'existing' ? selectedClientId : null }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create agent')
      setAgentId(data.agent.id)
      setStep(1)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const goStep2 = async () => {
    setError('')
    setSaving(true)
    try {
      await fetch('/api/nova-ai?action=agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: agentId, agent_name: agentName }),
      })
      const r = await fetch('/api/nova-ai?action=knowledge-base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', agent_id: agentId, ...kb }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to save knowledge base')
      setStep(2)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const goStep3 = async () => {
    setError('')
    if (!selectedVoice) return setError('Please select a voice.')
    setSaving(true)
    try {
      await fetch('/api/nova-ai?action=agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: agentId, voice_id: selectedVoice.elevenlabs_voice_id, voice_name: selectedVoice.voice_name }),
      })
      setStep(3)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const goStep4 = async () => {
    setError('')
    setSaving(true)
    try {
      if (phoneMode === 'existing') {
        if (!manualNumber.trim()) { setSaving(false); return setError('Enter the phone number you want to forward.') }
        await fetch('/api/nova-ai?action=agents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id: agentId, phone_number: manualNumber.trim() }),
        })
      } else if (provisionedNumber) {
        const r = await fetch('/api/nova-ai?action=provision-number', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: provisionedNumber, agent_id: agentId }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Failed to provision number')
      } else {
        setSaving(false); return setError('Select a phone number or choose to forward an existing one.')
      }
      setStep(4)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const launch = async (finalStatus) => {
    setError('')
    setSaving(true)
    try {
      const r = await fetch('/api/nova-ai?action=agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: agentId, status: finalStatus }),
      })
      if (!r.ok) throw new Error('Failed to launch agent')
      setLaunched(true)
      setTimeout(() => navigate(`/ai/agent/${agentId}`), 900)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const updateFaq = (i, field, value) => {
    const faqs = [...kb.faqs]
    faqs[i] = { ...faqs[i], [field]: value }
    setKb({ ...kb, faqs })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030201', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff', padding: '40px 24px 100px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={() => navigate('/ai/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 24, fontFamily: 'inherit' }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Dashboard
        </button>

        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 28 }}>Create Agent</h1>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36, flexWrap: 'wrap', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? GOLD : i === step ? 'transparent' : 'rgba(255,255,255,0.05)',
                  border: i === step ? `2px solid ${GOLD}` : 'none',
                  color: i < step ? '#0a0800' : i === step ? GOLD : 'rgba(255,255,255,0.3)',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {i < step ? <Check style={{ width: 12, height: 12 }} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 10px' }} />}
            </div>
          ))}
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>{error}</div>}

        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '32px 28px' }}>

          {/* STEP 1 — Client */}
          {step === 0 && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                <button onClick={() => setClientMode('new')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${clientMode === 'new' ? GOLD : 'rgba(255,255,255,0.12)'}`, background: clientMode === 'new' ? `${GOLD}14` : 'transparent', color: clientMode === 'new' ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>New Client</button>
                <button onClick={() => setClientMode('existing')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${clientMode === 'existing' ? GOLD : 'rgba(255,255,255,0.12)'}`, background: clientMode === 'existing' ? `${GOLD}14` : 'transparent', color: clientMode === 'existing' ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Existing Client</button>
              </div>

              {clientMode === 'existing' ? (
                <Field label="Select Client">
                  <select style={inputStyle} value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                    <option value="">Choose a client…</option>
                    {existingClients.map(c => <option key={c.id} value={c.id}>{c.business_name || c.full_name}</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Business Name"><input style={inputStyle} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Luca's Trattoria" /></Field>
                  <Field label="Business Type">
                    <select style={inputStyle} value={businessType} onChange={e => setBusinessType(e.target.value)}>
                      {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </>
              )}

              <Field label="Agent Name"><input style={inputStyle} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. Nova" /></Field>
            </>
          )}

          {/* STEP 2 — Knowledge base */}
          {step === 1 && (
            <>
              <Field label="Business Description"><textarea style={{ ...inputStyle, minHeight: 80 }} value={kb.business_description} onChange={e => setKb({ ...kb, business_description: e.target.value })} /></Field>
              <Field label="Services & Prices"><textarea style={{ ...inputStyle, minHeight: 80 }} value={kb.services} onChange={e => setKb({ ...kb, services: e.target.value })} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Hours"><input style={inputStyle} value={kb.hours} onChange={e => setKb({ ...kb, hours: e.target.value })} /></Field>
                <Field label="Address"><input style={inputStyle} value={kb.address} onChange={e => setKb({ ...kb, address: e.target.value })} /></Field>
              </div>
              <Field label="Booking Process"><textarea style={{ ...inputStyle, minHeight: 60 }} value={kb.booking_process} onChange={e => setKb({ ...kb, booking_process: e.target.value })} /></Field>

              <p style={{ ...labelStyle, marginTop: 8, marginBottom: 12 }}>Frequently Asked Questions</p>
              {kb.faqs.map((f, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input style={inputStyle} placeholder={`Question ${i + 1}`} value={f.q} onChange={e => updateFaq(i, 'q', e.target.value)} />
                  <input style={inputStyle} placeholder="Answer" value={f.a} onChange={e => updateFaq(i, 'a', e.target.value)} />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                <Field label="Always Say"><textarea style={{ ...inputStyle, minHeight: 60 }} value={kb.always_say} onChange={e => setKb({ ...kb, always_say: e.target.value })} /></Field>
                <Field label="Never Say"><textarea style={{ ...inputStyle, minHeight: 60 }} value={kb.never_say} onChange={e => setKb({ ...kb, never_say: e.target.value })} /></Field>
              </div>
              <Field label="Escalate To A Human When"><input style={inputStyle} value={kb.escalation} onChange={e => setKb({ ...kb, escalation: e.target.value })} /></Field>
              <Field label="Personality Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={kb.personality} onChange={e => setKb({ ...kb, personality: e.target.value })} /></Field>
            </>
          )}

          {/* STEP 3 — Voice */}
          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {voices.map(v => {
                const on = selectedVoice?.id === v.id
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v)}
                    style={{ padding: '18px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${on ? GOLD : 'rgba(255,255,255,0.1)'}`, background: on ? `${GOLD}12` : 'rgba(255,255,255,0.02)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{v.voice_name}</h4>
                      {on && <Check style={{ width: 16, height: 16, color: GOLD }} />}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 12 }}>{v.industry} · {v.description}</p>
                    <button onClick={(e) => { e.stopPropagation(); playPreview(v) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${GOLD}30`, borderRadius: 6, padding: '6px 10px', color: GOLD, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {playingId === v.id ? <Pause style={{ width: 11, height: 11 }} /> : <Play style={{ width: 11, height: 11 }} />} Preview
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* STEP 4 — Phone number */}
          {step === 3 && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                <button onClick={() => setPhoneMode('new')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${phoneMode === 'new' ? GOLD : 'rgba(255,255,255,0.12)'}`, background: phoneMode === 'new' ? `${GOLD}14` : 'transparent', color: phoneMode === 'new' ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Get a New Number</button>
                <button onClick={() => setPhoneMode('existing')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${phoneMode === 'existing' ? GOLD : 'rgba(255,255,255,0.12)'}`, background: phoneMode === 'existing' ? `${GOLD}14` : 'transparent', color: phoneMode === 'existing' ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Forward Existing Number</button>
              </div>

              {phoneMode === 'new' ? (
                loadingNumbers ? (
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading available Connecticut numbers…</p>
                ) : availableNumbers.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No numbers available right now — check Twilio credentials in Settings, or switch to forwarding an existing number.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableNumbers.map(n => (
                      <div key={n.phone_number} onClick={() => setProvisionedNumber(n.phone_number)} style={{ padding: '12px 16px', borderRadius: 8, border: `1px solid ${provisionedNumber === n.phone_number ? GOLD : 'rgba(255,255,255,0.1)'}`, background: provisionedNumber === n.phone_number ? `${GOLD}12` : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{n.friendly_name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{n.locality}, {n.region}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <Field label="Existing Phone Number to Forward"><input style={inputStyle} value={manualNumber} onChange={e => setManualNumber(e.target.value)} placeholder="+1 (203) 555-0100" /></Field>
              )}
            </>
          )}

          {/* STEP 5 — Launch */}
          {step === 4 && !launched && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                Your agent is configured. Call the number below to test it live, then choose a status.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '18px 20px', marginBottom: 22, textAlign: 'center' }}>
                <p style={{ color: GOLD, fontSize: 22, fontWeight: 800, letterSpacing: '0.02em' }}>{provisionedNumber || manualNumber || 'No number set'}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>Call this number to test {agentName}</p>
              </div>
              <Field label="Status">
                <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="testing">Testing</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </>
          )}
          {step === 4 && launched && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${GOLD}15`, border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check style={{ width: 22, height: 22, color: GOLD }} />
              </div>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Agent launched!</p>
            </div>
          )}
        </div>

        {/* Nav buttons */}
        {!launched && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              style={{ padding: '12px 22px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: step === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
            >
              Back
            </button>
            {step < 4 ? (
              <button
                onClick={[goStep1, goStep2, goStep3, goStep4][step]}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 26px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <>Continue <ArrowRight style={{ width: 14, height: 14 }} /></>}
              </button>
            ) : (
              <button
                onClick={() => launch(status)}
                disabled={saving}
                style={{ padding: '12px 26px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'Launching…' : 'Launch Agent'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
