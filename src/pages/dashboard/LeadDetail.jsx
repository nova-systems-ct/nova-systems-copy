import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, X, Check, Save, Sparkles, Loader2 } from 'lucide-react'
import { getLead, updateLead, getDocuments, saveDocument, addActivity } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const TABS = ['Overview', 'Proposals', 'Demos', 'Documents', 'Notes']
const STAGES = ['New Contact', 'Proposal Sent', 'Demo Shown', 'Negotiating', 'Closed Won', 'Closed Lost']

const STAGE_CFG = {
  'New Contact':   { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.12)' },
  'Proposal Sent': { color: GOLD,                    bg: `${GOLD}14`,               border: `${GOLD}35` },
  'Demo Shown':    { color: '#60a5fa',               bg: 'rgba(59,130,246,0.1)',    border: 'rgba(59,130,246,0.3)' },
  'Negotiating':   { color: '#a78bfa',               bg: 'rgba(167,139,250,0.1)',   border: 'rgba(167,139,250,0.3)' },
  'Closed Won':    { color: '#4ade80',               bg: 'rgba(34,197,94,0.1)',     border: 'rgba(34,197,94,0.3)' },
  'Closed Lost':   { color: '#f87171',               bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)' },
}

function StageBadge({ stage }) {
  const c = STAGE_CFG[stage] || STAGE_CFG['New Contact']
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{stage}</span>
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [docs, setDocs] = useState([])
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')
  const [genError, setGenError] = useState('')
  const [demoUrl, setDemoUrl] = useState('')

  useEffect(() => {
    const l = getLead(id)
    if (!l) { navigate('/dashboard/leads'); return }
    setLead(l)
    setNotes(l.notes || '')
    setDocs(getDocuments({ lead_id: id }))
  }, [id])

  if (!lead) return null

  const updateStage = stage => {
    updateLead(id, { stage })
    setLead(l => ({ ...l, stage }))
    addActivity('lead', `${lead.name} stage → ${stage}`)
  }

  const saveNotes = () => {
    updateLead(id, { notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const generateProposal = async () => {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
    if (!apiKey) { setGenError('VITE_CLAUDE_API_KEY not set — add it to your .env file.'); return }
    setGenerating(true)
    setGenError('')
    setGenResult('')
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
          max_tokens: 1500,
          system: 'You are a professional business document writer for Nova Systems, a Connecticut-based operational infrastructure company. Generate professional, concise business documents.',
          messages: [{
            role: 'user',
            content: `Write a professional proposal for ${lead.name} (${lead.industry} industry). Contact: ${lead.contact_name}. They want: ${lead.what_they_want}. They need: ${lead.what_they_need}. Potential value: ${lead.potential_value}. Format as a clean, professional business proposal from Nova Systems.`,
          }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const text = data.content?.[0]?.text || ''
      setGenResult(text)
      saveDocument({ lead_id: id, entity_name: lead.name, type: 'Proposal', content: text, sent: false })
      setDocs(getDocuments({ lead_id: id }))
    } catch (err) {
      setGenError(err.message || 'Generation failed')
    }
    setGenerating(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard/leads')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> All Leads
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{lead.name}</h1>
            <StageBadge stage={lead.stage} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{lead.industry}</span>
            {lead.contact_name && <><span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span><span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{lead.contact_name}</span></>}
            {lead.potential_value && <><span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span><span style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>{lead.potential_value}</span></>}
          </div>
        </div>
      </div>

      {/* Stage selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
        {STAGES.map(s => {
          const cfg = STAGE_CFG[s]
          const on = lead.stage === s
          return (
            <button key={s} onClick={() => updateStage(s)} style={{ padding: '7px 14px', background: on ? cfg.bg : 'transparent', border: `1px solid ${on ? cfg.border : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, cursor: 'pointer', color: on ? cfg.color : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: on ? 700 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              {s}
            </button>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`, color: tab === t ? GOLD : 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1, transition: 'all 0.15s' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Contact Info</p>
            <InfoRow label="Contact" value={lead.contact_name} />
            <InfoRow label="Industry" value={lead.industry} />
            <InfoRow label="Email" value={lead.email && <a href={`mailto:${lead.email}`} style={{ color: '#60a5fa' }}>{lead.email}</a>} />
            <InfoRow label="Phone" value={lead.phone} />
            {lead.meeting_date && <InfoRow label="Meeting" value={new Date(lead.meeting_date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Deal Info</p>
            <InfoRow label="Potential Value" value={lead.potential_value} />
            <InfoRow label="What They Want" value={lead.what_they_want} />
            <InfoRow label="What They Need" value={lead.what_they_need} />
            <InfoRow label="Next Steps" value={lead.next_steps} />
          </div>
        </div>
      )}

      {/* Proposals */}
      {tab === 'Proposals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={generateProposal} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit' }}>
              {generating ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
              {generating ? 'Generating…' : 'Generate Proposal with AI'}
            </button>
          </div>
          {genError && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>{genError}</div>}
          {genResult && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${GOLD}25`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Generated Proposal</p>
              <pre style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{genResult}</pre>
            </div>
          )}
          {docs.filter(d => d.type === 'Proposal').length === 0 && !genResult && (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No proposals yet. Click "Generate Proposal with AI" above.</p>
            </div>
          )}
        </div>
      )}

      {/* Demos */}
      {tab === 'Demos' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input value={demoUrl} onChange={e => setDemoUrl(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Paste demo URL (e.g. https://demo.nova-systems.app/...)…" />
            <button onClick={() => {
              if (!demoUrl) return
              saveDocument({ lead_id: id, entity_name: lead.name, type: 'Demo Link', content: demoUrl, sent: false })
              setDocs(getDocuments({ lead_id: id }))
              setDemoUrl('')
            }} style={{ padding: '10px 18px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Save Link</button>
          </div>
          {docs.filter(d => d.type === 'Demo Link').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No demo links saved yet.</p>
            </div>
          ) : docs.filter(d => d.type === 'Demo Link').map(d => (
            <div key={d.id} style={{ padding: '14px 18px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href={d.content} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 13 }}>{d.content}</a>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{new Date(d.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {tab === 'Documents' && (
        <div>
          {docs.filter(d => d.type !== 'Demo Link').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No documents yet. Use the Documents page to generate.</p>
            </div>
          ) : docs.filter(d => d.type !== 'Demo Link').map(d => (
            <div key={d.id} style={{ padding: '14px 18px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{d.type}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: d.sent ? 'rgba(34,197,94,0.1)' : `${GOLD}10`, color: d.sent ? '#4ade80' : GOLD, border: `1px solid ${d.sent ? 'rgba(34,197,94,0.3)' : GOLD + '30'}` }}>{d.sent ? 'Sent' : 'Draft'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {tab === 'Notes' && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28 }}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={14} style={{ ...inp, resize: 'vertical', lineHeight: 1.7 }} placeholder="Add notes about this lead…" />
          <button onClick={saveNotes} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: notesSaved ? 'rgba(34,197,94,0.15)' : G, border: notesSaved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 7, color: notesSaved ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {notesSaved ? <><Check style={{ width: 13, height: 13 }} /> Saved</> : <><Save style={{ width: 13, height: 13 }} /> Save Notes</>}
          </button>
        </div>
      )}
    </div>
  )
}
