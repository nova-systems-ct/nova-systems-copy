import { useState, useEffect } from 'react'
import { Check, Loader2, AlertCircle, Globe } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const inp = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = {
  display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7,
}
const ta = { ...inp, resize: 'vertical', lineHeight: 1.6 }

const SECTIONS = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'Main headline and subheadline on the homepage',
    fields: [
      { key: 'headline',    label: 'Headline',    type: 'text',     placeholder: 'Stop losing\nrevenue',          multiline: false },
      { key: 'subheadline', label: 'Subheadline', type: 'textarea', placeholder: 'Every missed call is money walking out your door. We stop the leak.', rows: 3 },
      { key: 'cta_label',   label: 'CTA Button',  type: 'text',     placeholder: 'Deploy Nova Pulse' },
    ],
    defaults: {
      headline: 'Stop losing\nrevenue',
      subheadline: 'Every missed call is money walking out your door. We stop the leak.',
      cta_label: 'Deploy Nova Pulse',
    },
  },
  {
    key: 'solutions',
    label: 'Solutions',
    description: 'Section heading for the solutions area',
    fields: [
      { key: 'headline',    label: 'Section Headline', type: 'text',     placeholder: 'Everything your business needs' },
      { key: 'subheadline', label: 'Subheadline',      type: 'textarea', placeholder: 'One system. Every tool.', rows: 2 },
    ],
    defaults: { headline: '', subheadline: '' },
  },
  {
    key: 'pricing',
    label: 'Pricing',
    description: 'Pricing section headline and intro text',
    fields: [
      { key: 'headline',    label: 'Section Headline', type: 'text',     placeholder: 'Simple, transparent pricing' },
      { key: 'subheadline', label: 'Subheadline',      type: 'textarea', placeholder: 'No surprises. No hidden fees.', rows: 2 },
    ],
    defaults: { headline: '', subheadline: '' },
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    description: 'Portfolio section headline — featured images come from the Portfolio Manager tab',
    fields: [
      { key: 'headline',    label: 'Section Headline', type: 'text',     placeholder: 'Built for real clients. Deployed for real results.' },
      { key: 'description', label: 'Description',      type: 'textarea', placeholder: 'No mockups. No demos.', rows: 2 },
    ],
    defaults: { headline: '', description: '' },
  },
  {
    key: 'footer',
    label: 'Footer',
    description: 'Footer tagline and contact info',
    fields: [
      { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Operational intelligence for ambitious businesses.' },
      { key: 'email',   label: 'Contact Email', type: 'text', placeholder: 'hello@nova-systems.app' },
    ],
    defaults: { tagline: '', email: '' },
  },
]

const SQL = `CREATE TABLE IF NOT EXISTS site_content (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key  TEXT NOT NULL UNIQUE,
  content_json JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);`

export default function SiteEditor() {
  const [activeKey, setActiveKey] = useState('hero')
  const [allContent, setAllContent] = useState({})
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [supabaseError, setSupabaseError] = useState(false)

  const activeSection = SECTIONS.find(s => s.key === activeKey)

  const load = async () => {
    try {
      const r = await fetch('/api/client?resource=site-content')
      if (!r.ok) { setSupabaseError(true); return }
      const rows = await r.json()
      if (!Array.isArray(rows)) { setSupabaseError(true); return }
      const map = {}
      rows.forEach(row => { map[row.section_key] = row.content_json || {} })
      setAllContent(map)
      setSupabaseError(false)
    } catch {
      setSupabaseError(true)
    }
  }

  useEffect(() => { load() }, [])

  // When switching sections, sync draft from saved content
  useEffect(() => {
    if (!activeSection) return
    const saved = allContent[activeKey] || {}
    const merged = { ...activeSection.defaults, ...saved }
    setDrafts(d => ({ ...d, [activeKey]: merged }))
  }, [activeKey, allContent])

  const draftFor = (key) => drafts[key] || allContent[key] || {}
  const currentDraft = draftFor(activeKey)

  const setField = (field, value) => {
    setDrafts(d => ({
      ...d,
      [activeKey]: { ...draftFor(activeKey), [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/client?resource=site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: activeKey, content_json: currentDraft }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { setError(d.error || 'Save failed'); setSaving(false); return }
      setAllContent(c => ({ ...c, [activeKey]: currentDraft }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Save failed')
    }
    setSaving(false)
  }

  const isDirty = JSON.stringify(currentDraft) !== JSON.stringify({ ...(activeSection?.defaults || {}), ...(allContent[activeKey] || {}) })

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Dashboard</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Website Editor</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Edit homepage text content. Changes go live immediately.</p>
      </div>

      {/* Supabase not configured */}
      {supabaseError && (
        <div style={{ padding: '18px 22px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>Supabase table required</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 10 }}>Run this SQL in Supabase → SQL Editor:</p>
          <pre style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.5)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', overflowX: 'auto', lineHeight: 1.8 }}>{SQL}</pre>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>

        {/* Section list */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>Sections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map(s => {
              const on = activeKey === s.key
              const hasContent = !!(allContent[s.key] && Object.values(allContent[s.key]).some(v => v))
              return (
                <button key={s.key} onClick={() => setActiveKey(s.key)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: on ? `${GOLD}12` : 'transparent', border: `1px solid ${on ? GOLD + '30' : 'transparent'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ color: on ? GOLD : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: on ? 600 : 400 }}>{s.label}</span>
                  {hasContent && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 1.7 }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>Green dot</span> = content saved in Supabase. Sections without content use their defaults.
            </p>
          </div>
        </div>

        {/* Editor panel */}
        <div>
          {activeSection && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Globe style={{ width: 14, height: 14, color: GOLD }} />
                    <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{activeSection.label}</h2>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{activeSection.description}</p>
                </div>
                <button onClick={handleSave} disabled={saving || (!isDirty && !saved)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: saved ? 'rgba(34,197,94,0.12)' : G, border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 8, color: saved ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: saving || (!isDirty && !saved) ? 'not-allowed' : 'pointer', opacity: saving || (!isDirty && !saved) ? 0.6 : 1, fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s' }}>
                  {saving ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Saving…</>
                  : saved ? <><Check style={{ width: 13, height: 13 }} /> Saved!</>
                  : 'Save Changes'}
                </button>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16 }}>
                  <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {activeSection.fields.map(field => (
                  <div key={field.key}>
                    <label style={lbl}>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={currentDraft[field.key] || ''}
                        onChange={e => setField(field.key, e.target.value)}
                        rows={field.rows || 3}
                        style={ta}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentDraft[field.key] || ''}
                        onChange={e => setField(field.key, e.target.value)}
                        style={inp}
                        placeholder={field.placeholder}
                      />
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, marginTop: 5 }}>
                      Default: <span style={{ color: 'rgba(255,255,255,0.28)' }}>{field.placeholder}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, lineHeight: 1.7 }}>
                  Changes save to <code style={{ color: GOLD, background: `${GOLD}12`, padding: '1px 6px', borderRadius: 4 }}>site_content</code> in Supabase and reflect on the live homepage immediately (no redeploy needed).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
