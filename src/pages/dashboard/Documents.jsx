import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Send, Save, FileText } from 'lucide-react'
import { getClients, getLeads, saveDocument, getDocuments } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const DOC_TYPES = ['Proposal', 'Contract', 'Invoice', 'MOU', 'Custom']

export default function Documents() {
  const [clients, setClients] = useState([])
  const [leads, setLeads] = useState([])
  const [docs, setDocs] = useState([])
  const [entityType, setEntityType] = useState('client')
  const [entityId, setEntityId] = useState('')
  const [docType, setDocType] = useState('Proposal')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    setClients(getClients())
    setLeads(getLeads())
    setDocs(getDocuments())
  }, [])

  const entities = entityType === 'client' ? clients : leads
  const selectedEntity = entities.find(e => e.id === entityId)

  const generate = async () => {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
    if (!apiKey) { setError('VITE_CLAUDE_API_KEY not set. Add it to your .env file to use AI generation.'); return }
    if (!entityId) { setError('Please select a client or lead first.'); return }
    setGenerating(true)
    setError('')
    setResult('')
    setSaved(false)
    setEmailSent(false)

    const entityName = selectedEntity?.name || 'Unknown'
    const industry = selectedEntity?.industry || ''
    const contact = entityType === 'client' ? selectedEntity?.owner_name : selectedEntity?.contact_name

    const prompt = docType === 'Proposal'
      ? `Write a professional business proposal from Nova Systems to ${entityName} (${industry}). Contact: ${contact || 'Decision Maker'}. ${description}. Include: executive summary, problem statement, our solution, pricing, next steps. Format cleanly.`
      : docType === 'Contract'
      ? `Write a professional service contract between Nova Systems (Isaac Nova, CT) and ${entityName}. ${description}. Include: scope of work, payment terms, duration, termination clause, confidentiality. Format as a legal-style contract.`
      : docType === 'Invoice'
      ? `Generate a professional invoice from Nova Systems to ${entityName}. ${description}. Include invoice number, date, itemized services, subtotal, total, payment instructions (Venmo/Zelle).`
      : docType === 'MOU'
      ? `Write a Memorandum of Understanding between Nova Systems and ${entityName}. ${description}. Include: purpose, scope of partnership, responsibilities of each party, timeline, signatures section.`
      : `Write a professional business document for Nova Systems. Client/Lead: ${entityName}. ${description}. Format professionally.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: 'You are a professional business document writer for Nova Systems, a Connecticut-based operational infrastructure company. Generate professional, concise business documents.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      setResult(data.content?.[0]?.text || '')
    } catch (err) {
      setError(err.message || 'Generation failed. Check your API key.')
    }
    setGenerating(false)
  }

  const saveDoc = () => {
    if (!result) return
    saveDocument({
      ...(entityType === 'client' ? { client_id: entityId } : { lead_id: entityId }),
      entity_name: selectedEntity?.name || '',
      type: docType,
      content: result,
      sent: false,
    })
    setDocs(getDocuments())
    setSaved(true)
  }

  const sendToClient = async () => {
    if (!result || !selectedEntity) return
    const email = entityType === 'client' ? selectedEntity.email : selectedEntity.email
    if (!email) { setError('No email on file for this client/lead.'); return }
    setSendingEmail(true)
    try {
      await fetch('/api/notify?action=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${docType} from Nova Systems — ${selectedEntity.name}`,
          body: result,
          to: email,
          name: selectedEntity.name,
        }),
      })
      setEmailSent(true)
      if (saved) {
        const docs2 = getDocuments()
        // mark the latest doc as sent
        const latest = docs2[0]
        if (latest) {
          const all = JSON.parse(localStorage.getItem('nova_crm_docs') || '[]')
          const updated = all.map(d => d.id === latest.id ? { ...d, sent: true } : d)
          localStorage.setItem('nova_crm_docs', JSON.stringify(updated))
          setDocs(getDocuments())
        }
      }
    } catch {}
    setSendingEmail(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Documents</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>AI Document Generator</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>Generate proposals, contracts, invoices, and MOUs using Claude AI.</p>
      </div>

      {/* Generator */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, marginBottom: 40 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 24 }}>Generate Document</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Entity type toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>For</label>
            <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              {['client', 'lead'].map(t => (
                <button key={t} onClick={() => { setEntityType(t); setEntityId('') }} style={{ flex: 1, padding: '10px', background: entityType === t ? `${GOLD}18` : 'transparent', border: 'none', color: entityType === t ? GOLD : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: entityType === t ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', borderRight: t === 'client' ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Entity select */}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              {entityType === 'client' ? 'Client' : 'Lead'}
            </label>
            <select value={entityId} onChange={e => setEntityId(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              <option value="" style={{ background: '#111' }}>Select {entityType}…</option>
              {entities.map(e => <option key={e.id} value={e.id} style={{ background: '#111' }}>{e.name}</option>)}
            </select>
          </div>

          {/* Doc type */}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              {DOC_TYPES.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Describe what you need</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }}
            placeholder="e.g. 6-month website + social media management proposal for $1,500 startup + $1,000/month, focused on their local barber audience…"
          />
        </div>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <button onClick={generate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: generating ? 'rgba(255,255,255,0.06)' : G, border: 'none', borderRadius: 8, color: generating ? 'rgba(255,255,255,0.4)' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {generating ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
          {generating ? 'Generating with Claude…' : 'Generate Document'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${GOLD}22`, borderRadius: 16, padding: 32, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Generated {docType}</p>
              {selectedEntity && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{selectedEntity.name}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveDoc} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: saved ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${saved ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, color: saved ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Save style={{ width: 13, height: 13 }} /> {saved ? 'Saved' : 'Save to Record'}
              </button>
              <button onClick={sendToClient} disabled={sendingEmail || !selectedEntity?.email} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: emailSent ? 'rgba(34,197,94,0.12)' : G, border: emailSent ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 7, color: emailSent ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: sendingEmail || !selectedEntity?.email ? 'not-allowed' : 'pointer', opacity: !selectedEntity?.email ? 0.5 : 1, fontFamily: 'inherit' }}>
                <Send style={{ width: 13, height: 13 }} /> {emailSent ? 'Sent!' : sendingEmail ? 'Sending…' : 'Send to Client'}
              </button>
            </div>
          </div>
          <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 24, maxHeight: 500, overflowY: 'auto' }}>
            <pre style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: "'Inter',system-ui,sans-serif", margin: 0 }}>{result}</pre>
          </div>
        </div>
      )}

      {/* Saved docs */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Saved Documents</p>
        {docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
            <FileText style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No documents saved yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${GOLD}10`, border: `1px solid ${GOLD}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: 14, height: 14, color: GOLD }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{d.type} — {d.entity_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: d.sent ? 'rgba(34,197,94,0.1)' : `${GOLD}10`, color: d.sent ? '#4ade80' : GOLD, border: `1px solid ${d.sent ? 'rgba(34,197,94,0.3)' : GOLD + '30'}` }}>{d.sent ? 'Sent' : 'Draft'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
