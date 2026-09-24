import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, Plug, Building2, Plus, X, Loader2, CheckCircle2, XCircle, Send } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }
const TABS = [
  { key: 'content', label: 'Content Pipeline', icon: Lightbulb },
  { key: 'brands', label: 'Brands', icon: Building2 },
  { key: 'adapters', label: 'Platform Status', icon: Plug },
]

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const STATUS_COLORS = { idea: 'rgba(255,255,255,0.4)', brief: GOLD, drafted: GOLD, fact_checked: '#a78bfa', approved: '#4ade80', scheduled: '#a78bfa', published: '#4ade80', rejected: '#f87171' }
function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'rgba(255,255,255,0.4)'
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${color}18`, color, textTransform: 'uppercase' }}>{(status || '').replace(/_/g, ' ')}</span>
}
const ADAPTER_COLORS = { not_implemented: 'rgba(255,255,255,0.3)', not_connected: 'rgba(255,255,255,0.4)', authorization_required: GOLD, connected: '#4ade80', operation_tested: '#4ade80', degraded: '#f87171', disconnected: '#f87171' }

// Marketing automation workspace (master prompt §17, restored scope). Content pipeline
// (idea -> fact-check -> approval, admin.view-gated), brand configuration, and honest per-
// platform adapter status — every platform shows exactly what api/client.js's real state is,
// never a hopeful guess. See api/_socialAdapters/registry.js for what "authorization_required"
// actually requires per platform.
export default function Marketing() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState('content')
  const [content, setContent] = useState([])
  const [brands, setBrands] = useState([])
  const [adapters, setAdapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ideaModal, setIdeaModal] = useState(false)
  const [ideaForm, setIdeaForm] = useState({ brand_id: '', content_type: 'social_post', title: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setError('')
    try {
      const q = `organization_id=${encodeURIComponent(currentOrg.id)}`
      const [contentRes, brandsRes, adaptersRes] = await Promise.all([
        authedFetch(`/api/client?resource=marketing&op=content&${q}`),
        authedFetch(`/api/client?resource=marketing&op=brands&${q}`),
        authedFetch(`/api/client?resource=marketing&op=adapters`),
      ])
      if (!contentRes.ok) throw new Error((await contentRes.json().catch(() => ({}))).error || 'Failed to load marketing data')
      setContent(await contentRes.json())
      setBrands(brandsRes.ok ? await brandsRes.json() : [])
      setAdapters(adaptersRes.ok ? await adaptersRes.json() : [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { load() }, [load])

  const brandName = (id) => brands.find((b) => b.id === id)?.name || 'Unknown brand'

  const createIdea = async () => {
    if (!ideaForm.brand_id || !ideaForm.title.trim()) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=marketing&op=content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', organization_id: currentOrg.id, ...ideaForm }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to create idea')
      setIdeaModal(false)
      setIdeaForm({ brand_id: '', content_type: 'social_post', title: '', notes: '' })
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const advance = async (item, action) => {
    try {
      let body = { action, organization_id: currentOrg.id, id: item.id }
      if (action === 'update-draft') body.notes = item.notes || 'Drafted content.'
      if (action === 'fact-check') {
        const notes = window.prompt('Source notes (the real factual basis for this content):', item.source_notes || '')
        if (!notes) return
        body.source_notes = notes
      }
      const r = await authedFetch('/api/client?resource=marketing&op=content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Action failed')
      load()
    } catch (e) { alert(e.message) }
  }

  const testAdapter = async (platform) => {
    const accountId = window.prompt(`Account connection ID to test for ${platform} (create one via 'connect' first — no connect UI yet, this tests an existing connection):`)
    if (!accountId) return
    try {
      const r = await authedFetch('/api/client?resource=marketing&op=adapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test-connection', platform, account_id: accountId }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Test failed')
      alert(d.ok ? 'Connection verified.' : `Not connected: ${d.detail}`)
      load()
    } catch (e) { alert(e.message) }
  }

  if (!currentOrg) return null

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Marketing</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Content pipeline, brand configuration, and honest platform connection status.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === t.key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon style={{ width: 14, height: 14 }} /> {t.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : (
        <>
          {tab === 'content' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={() => setIdeaModal(true)} disabled={brands.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: brands.length ? G : '#161410', border: 'none', borderRadius: 8, color: brands.length ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: brands.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  <Plus style={{ width: 13, height: 13 }} /> New Idea
                </button>
              </div>
              {brands.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 14 }}>Add a brand first.</p>}
              {content.length === 0 ? <EmptyRow text="No content ideas yet." /> : content.map((item) => (
                <div key={item.id} style={CARD}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{item.title}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>{brandName(item.brand_id)} · {item.content_type}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {['idea', 'brief'].includes(item.status) && <ActionBtn onClick={() => advance(item, 'update-draft')} icon={Send} label="Mark Drafted" color={GOLD} />}
                    {item.status === 'drafted' && <ActionBtn onClick={() => advance(item, 'fact-check')} icon={CheckCircle2} label="Fact-Check" color="#a78bfa" />}
                    {item.status === 'fact_checked' && <ActionBtn onClick={() => advance(item, 'approve')} icon={CheckCircle2} label="Approve (admin.view)" color="#4ade80" />}
                    {item.status === 'fact_checked' && <ActionBtn onClick={() => advance(item, 'reject')} icon={XCircle} label="Reject" color="#f87171" />}
                  </div>
                </div>
              ))}
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>Platform-specific variants (per-platform captions/scripts) are created via the API once content is approved — no dedicated UI yet.</p>
            </div>
          )}

          {tab === 'brands' && (
            brands.length === 0 ? <EmptyRow text="No brands configured." /> : brands.map((b) => (
              <div key={b.id} style={CARD}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{b.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>{b.kind} · approval policy: {b.approval_policy || 'draft_only'}</p>
                {Array.isArray(b.content_pillars) && b.content_pillars.length > 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 }}>Pillars: {b.content_pillars.join(', ')}</p>
                )}
              </div>
            ))
          )}

          {tab === 'adapters' && (
            <div>
              {adapters.map((a) => (
                <div key={a.platform} style={CARD}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{a.platform}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${ADAPTER_COLORS[a.state]}18`, color: ADAPTER_COLORS[a.state], textTransform: 'uppercase' }}>{a.state.replace(/_/g, ' ')}</span>
                  </div>
                  {a.notes && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 }}>{a.notes}</p>}
                  <button onClick={() => testAdapter(a.platform)} style={{ marginTop: 10, fontSize: 11, fontWeight: 700, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}>Test Connection</button>
                </div>
              ))}
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>A state only ever changes as the result of a real HTTP call against that platform's real API — never a hand-set flag. No OAuth connect UI is built yet; connecting an account today happens via the API directly (requires a real developer app for that platform, which is Isaac's own account-creation step).</p>
            </div>
          )}
        </>
      )}

      {ideaModal && (
        <Modal title="New Content Idea" onClose={() => setIdeaModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Brand *</label>
              <select value={ideaForm.brand_id} onChange={(e) => setIdeaForm((f) => ({ ...f, brand_id: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="" style={{ background: '#111' }}>Select…</option>
                {brands.map((b) => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Content type</label>
              <select value={ideaForm.content_type} onChange={(e) => setIdeaForm((f) => ({ ...f, content_type: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="social_post" style={{ background: '#111' }}>Social post</option>
                <option value="article" style={{ background: '#111' }}>Article</option>
                <option value="video" style={{ background: '#111' }}>Video</option>
                <option value="email" style={{ background: '#111' }}>Email</option>
              </select>
            </div>
            <div><label style={lbl}>Title *</label><input value={ideaForm.title} onChange={(e) => setIdeaForm((f) => ({ ...f, title: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Notes</label><textarea rows={3} value={ideaForm.notes} onChange={(e) => setIdeaForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inp, resize: 'vertical' }} /></div>
            <button onClick={createIdea} disabled={!ideaForm.brand_id || !ideaForm.title.trim() || saving} style={{ padding: 13, background: ideaForm.brand_id && ideaForm.title.trim() ? G : '#161410', border: 'none', borderRadius: 9, color: ideaForm.brand_id && ideaForm.title.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create Idea'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ActionBtn({ onClick, icon: Icon, label, color }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '7px 12px', background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 7, color, cursor: 'pointer', fontFamily: 'inherit' }}>
      <Icon style={{ width: 12, height: 12 }} /> {label}
    </button>
  )
}

function EmptyRow({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{text}</p>
    </div>
  )
}
