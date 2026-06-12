import { useState, useRef } from 'react'
import { X, Sparkles, Loader2, Check, Pen } from 'lucide-react'
import { saveDocument } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G    = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const DOC_TYPES = ['Proposal', 'Contract', 'Invoice', 'Scope of Work', 'Letter of Intent']

const inp = {
  width: '100%', padding: '11px 14px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = {
  display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8,
}

function SignaturePad({ label, onChange }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const [signed, setSigned] = useState(false)

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  const start = (e) => {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p   = getPos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    drawing.current = true
    setSigned(true)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth  = 2.5
    ctx.lineCap    = 'round'
    ctx.lineJoin   = 'round'
    ctx.strokeStyle = GOLD
    const p = getPos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const stop = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setSigned(false)
    onChange('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={lbl}>
          <Pen style={{ width: 10, height: 10, display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          {label}
        </label>
        {signed && (
          <button type="button" onClick={clear} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={110}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move}  onTouchEnd={stop}
        style={{
          width: '100%', height: 110, display: 'block', cursor: 'crosshair',
          background: 'rgba(255,255,255,0.02)', touchAction: 'none',
          border: `1px solid ${signed ? GOLD + '50' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8,
        }}
      />
      {!signed && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 5 }}>
          Draw your signature above
        </p>
      )}
    </div>
  )
}

export default function DocumentGeneratorModal({ clientId, leadId, entityName, industry, onClose, onSaved }) {
  const [docType,     setDocType]     = useState('Proposal')
  const [description, setDescription] = useState('')
  const [generating,  setGenerating]  = useState(false)
  const [generated,   setGenerated]   = useState('')
  const [error,       setError]       = useState('')
  const [isaacSig,    setIsaacSig]    = useState('')
  const [clientSig,   setClientSig]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  const generate = async () => {
    if (!description.trim()) return
    setGenerating(true)
    setError('')
    setGenerated('')
    try {
      const res  = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_name: entityName, industry, doc_type: docType, description, client_id: clientId, lead_id: leadId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed')
      setGenerated(data.text)
    } catch (err) {
      setError(err.message)
    }
    setGenerating(false)
  }

  const save = () => {
    setSaving(true)
    saveDocument({
      client_id:        clientId  || null,
      lead_id:          leadId    || null,
      entity_name:      entityName,
      type:             docType,
      content:          generated,
      isaac_signature:  isaacSig,
      client_signature: clientSig,
      signed_at:        (isaacSig || clientSig) ? new Date().toISOString() : null,
      sent:             false,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { onSaved?.(); onClose() }, 900)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 700, maxHeight: '94vh', overflowY: 'auto', background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 5 }}>AI Document Generator</p>
            <h3 style={{ color: '#fff', fontSize: 19, fontWeight: 700 }}>{entityName}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, flexShrink: 0 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
          <div>
            <label style={lbl}>Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              {DOC_TYPES.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Description / Instructions *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.65 }}
              placeholder={`Describe what this ${docType.toLowerCase()} should cover — services, pricing, timeline, terms, etc.`}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating || !description.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: generating || !description.trim() ? '#161410' : G, border: `1px solid ${generating || !description.trim() ? 'rgba(255,255,255,0.07)' : 'transparent'}`, borderRadius: 9, color: generating || !description.trim() ? 'rgba(255,255,255,0.25)' : '#0a0800', fontSize: 13, fontWeight: 700, cursor: generating || !description.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
          >
            {generating
              ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Generating with Claude…</>
              : <><Sparkles style={{ width: 15, height: 15 }} /> Generate with Claude AI</>}
          </button>
        </div>

        {/* Preview + signatures */}
        {generated && (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 12 }}>Generated Document</p>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${GOLD}22`, borderRadius: 10, padding: '20px 24px', maxHeight: 380, overflowY: 'auto' }}>
                <pre style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{generated}</pre>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Signatures (optional)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <SignaturePad label="Isaac Nova — Nova Systems" onChange={setIsaacSig} />
                <SignaturePad label={`Client — ${entityName}`} onChange={setClientSig} />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || saved}
              style={{ width: '100%', padding: 14, background: saved ? 'rgba(34,197,94,0.12)' : G, border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 9, color: saved ? '#4ade80' : '#0a0800', fontSize: 13, fontWeight: 700, cursor: saving || saved ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', fontFamily: 'inherit' }}
            >
              {saved
                ? <><Check style={{ width: 15, height: 15 }} /> Saved to Documents</>
                : 'Save Document'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
