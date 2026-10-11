import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Lightbulb, FileCheck2, Plus, Loader2, CheckCircle2, XCircle, Clock, Video, AlertTriangle, CalendarDays, Send, BarChart3, DollarSign, IdCard } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, marginBottom: 16 }
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }

// Zion Studio (master prompt §16) — Isaac's own real journal-to-video pipeline. Journal/facts are
// private-by-default (server-enforced by author_user_id ownership, not just hidden here);
// ideas/scripts/videos/review are real Nova-internal production tooling gated at growth.view.
// Missing character reference assets block only the render step — everything else here works
// without them, exactly as specified.
export default function ZionStudio() {
  const [tab, setTab] = useState('journal')
  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Zion Studio</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Journal to Video</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Real events only. Nothing here is published without your approval.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
        {[['journal', 'Journal', BookOpen], ['ideas', 'Ideas & Scripts', Lightbulb], ['review', 'Review', FileCheck2], ['calendar', 'Calendar', CalendarDays], ['published', 'Published', Send], ['analytics', 'Analytics', BarChart3], ['revenue', 'Revenue', DollarSign], ['bible', 'Profile Bible', IdCard]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? GOLD : 'transparent'}`, color: tab === key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <Icon style={{ width: 13, height: 13 }} /> {label}
          </button>
        ))}
      </div>

      {tab === 'journal' && <JournalTab />}
      {tab === 'ideas' && <IdeasTab />}
      {tab === 'review' && <ReviewTab />}
      {tab === 'calendar' && <CalendarTab />}
      {tab === 'published' && <PublishedTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'bible' && <ProfileBibleTab />}
    </div>
  )
}

function JournalTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [facts, setFacts] = useState({})
  const [form, setForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), text_content: '', time_spent_minutes: '', wins: '', setbacks: '', lessons: '', next_plan: '', factsText: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await authedFetch('/api/client?resource=zion&op=journal')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load journal')
      setEntries(await r.json())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const loadFacts = async (entryId) => {
    if (expanded === entryId) { setExpanded(null); return }
    setExpanded(entryId)
    if (facts[entryId]) return
    const r = await authedFetch(`/api/client?resource=zion&op=facts&journal_entry_id=${encodeURIComponent(entryId)}`)
    setFacts((f) => ({ ...f, [entryId]: r.ok ? [] : [] }))
    if (r.ok) setFacts((f) => ({ ...f, [entryId]: [] })) // placeholder replaced below
    r.ok && r.json().then((data) => setFacts((f) => ({ ...f, [entryId]: data })))
  }

  const confirmFact = async (entryId, factId, status) => {
    await authedFetch('/api/client?resource=zion&op=facts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: factId, status, disclosure_allowed: status === 'confirmed' }),
    })
    const r = await authedFetch(`/api/client?resource=zion&op=facts&journal_entry_id=${encodeURIComponent(entryId)}`)
    if (r.ok) setFacts((f) => ({ ...f, [entryId]: [] }))
    r.ok && r.json().then((data) => setFacts((f) => ({ ...f, [entryId]: data })))
  }

  const submit = async () => {
    setSaving(true)
    try {
      const facts = form.factsText.split('\n').map((s) => s.trim()).filter(Boolean)
      const r = await authedFetch('/api/client?resource=zion&op=journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, time_spent_minutes: form.time_spent_minutes || null, facts }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to save')
      setForm({ entry_date: new Date().toISOString().slice(0, 10), text_content: '', time_spent_minutes: '', wins: '', setbacks: '', lessons: '', next_plan: '', factsText: '' })
      load()
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={CARD}>
        <p style={{ ...lbl, marginBottom: 14 }}>New Entry</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
            <div><label style={lbl}>What happened today</label><textarea value={form.text_content} onChange={(e) => setForm((f) => ({ ...f, text_content: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Real events only — this becomes the raw material for facts, not a finished story." /></div>
            <div><label style={lbl}>Time Spent (min)</label><input type="number" value={form.time_spent_minutes} onChange={(e) => setForm((f) => ({ ...f, time_spent_minutes: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Wins</label><input value={form.wins} onChange={(e) => setForm((f) => ({ ...f, wins: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Setbacks</label><input value={form.setbacks} onChange={(e) => setForm((f) => ({ ...f, setbacks: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Lessons</label><input value={form.lessons} onChange={(e) => setForm((f) => ({ ...f, lessons: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Next Plan</label><input value={form.next_plan} onChange={(e) => setForm((f) => ({ ...f, next_plan: e.target.value }))} style={inp} /></div>
          </div>
          <div>
            <label style={lbl}>Specific facts worth confirming (one per line — each starts unconfirmed until you approve it)</label>
            <textarea value={form.factsText} onChange={(e) => setForm((f) => ({ ...f, factsText: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Signed a new client today.&#10;Gave a professor a pamphlet about Nova." />
          </div>
          <button onClick={submit} disabled={saving} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Plus style={{ width: 13, height: 13 }} /> {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}><p style={{ color: '#f87171', fontSize: 13 }}>{error}</p></div>}
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div> : entries.length === 0 && !error ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No journal entries yet.</p>
      ) : entries.map((e) => (
        <div key={e.id} style={CARD}>
          <div onClick={() => loadFacts(e.id)} style={{ cursor: 'pointer' }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{new Date(e.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            {e.text_content && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{e.text_content}</p>}
          </div>
          {expanded === e.id && facts[e.id] && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ ...lbl, marginBottom: 10 }}>Facts</p>
              {facts[e.id].length === 0 ? <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>No facts submitted with this entry.</p> : facts[e.id].map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0' }}>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, flex: 1 }}>{f.statement}</p>
                  {f.status === 'unconfirmed' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => confirmFact(e.id, f.id, 'confirmed')} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: '#4ade80', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                      <button onClick={() => confirmFact(e.id, f.id, 'rejected')} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: f.status === 'confirmed' ? '#4ade80' : '#f87171', textTransform: 'uppercase' }}>{f.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function IdeasTab() {
  const [ideas, setIdeas] = useState([])
  const [confirmedFacts, setConfirmedFacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ angle: '', story_type: 'recap', source_fact_ids: [] })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [ideasRes, journalRes] = await Promise.all([
      authedFetch('/api/client?resource=zion&op=ideas'),
      authedFetch('/api/client?resource=zion&op=journal'),
    ])
    setIdeas(ideasRes.ok ? await ideasRes.json() : [])
    if (journalRes.ok) {
      const entries = await journalRes.json()
      const all = []
      for (const e of entries) {
        const fr = await authedFetch(`/api/client?resource=zion&op=facts&journal_entry_id=${e.id}`)
        if (fr.ok) all.push(...(await fr.json()).filter((f) => f.status === 'confirmed'))
      }
      setConfirmedFacts(all)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.angle.trim()) return
    setSaving(true)
    const r = await authedFetch('/api/client?resource=zion&op=ideas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...form }),
    })
    const data = await r.json()
    if (!r.ok) alert(data.error || 'Failed to create idea')
    else { setForm({ angle: '', story_type: 'recap', source_fact_ids: [] }); load() }
    setSaving(false)
  }

  return (
    <div>
      <div style={CARD}>
        <p style={{ ...lbl, marginBottom: 14 }}>New Idea</p>
        {confirmedFacts.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>No confirmed facts yet — confirm one in the Journal tab before starting an idea.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lbl}>Angle</label><input value={form.angle} onChange={(e) => setForm((f) => ({ ...f, angle: e.target.value }))} style={inp} placeholder="How I fixed a broken CRM pipeline at 2am" /></div>
          <div>
            <label style={lbl}>Story Type</label>
            <select value={form.story_type} onChange={(e) => setForm((f) => ({ ...f, story_type: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              {['recap', 'lesson', 'process_explanation', 'reflection'].map((t) => <option key={t} value={t} style={{ background: '#111' }}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          {confirmedFacts.length > 0 && (
            <div>
              <label style={lbl}>Confirmed Facts to Cite</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {confirmedFacts.map((f) => {
                  const on = form.source_fact_ids.includes(f.id)
                  return <button key={f.id} onClick={() => setForm((s) => ({ ...s, source_fact_ids: on ? s.source_fact_ids.filter((x) => x !== f.id) : [...s.source_fact_ids, f.id] }))} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, background: on ? `${GOLD}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? GOLD + '50' : 'rgba(255,255,255,0.1)'}`, color: on ? GOLD : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}>{f.statement.slice(0, 40)}</button>
                })}
              </div>
            </div>
          )}
          <button onClick={submit} disabled={!form.angle.trim() || saving} style={{ padding: '10px 16px', background: form.angle.trim() ? G : '#161410', border: 'none', borderRadius: 8, color: form.angle.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: form.angle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {saving ? 'Creating…' : 'Create Idea'}
          </button>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div> : ideas.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No ideas yet.</p>
      ) : ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} expanded={expanded === idea.id} onToggle={() => setExpanded(expanded === idea.id ? null : idea.id)} onChanged={load} />
      ))}
    </div>
  )
}

function IdeaCard({ idea, expanded, onToggle, onChanged }) {
  const [scripts, setScripts] = useState([])
  const [scriptForm, setScriptForm] = useState({ hook: '', body: '' })
  const [videoStatus, setVideoStatus] = useState('')

  useEffect(() => {
    if (!expanded) return
    authedFetch(`/api/client?resource=zion&op=scripts&idea_id=${idea.id}`).then((r) => r.ok ? r.json() : []).then(setScripts)
  }, [expanded, idea.id])

  const saveScript = async () => {
    if (!scriptForm.body.trim()) return
    const r = await authedFetch('/api/client?resource=zion&op=scripts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea_id: idea.id, ...scriptForm }),
    })
    if (r.ok) { setScriptForm({ hook: '', body: '' }); onChanged() }
  }

  const createVideoDraft = async (scriptId) => {
    const r = await authedFetch('/api/client?resource=zion&op=videos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-draft', idea_id: idea.id, script_id: scriptId }),
    })
    const data = await r.json()
    setVideoStatus(r.ok ? `Video draft created (${data.video.id.slice(0, 8)}) — submit it from Review once ready.` : data.error)
  }

  return (
    <div style={CARD}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{idea.angle}</p>
        <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase' }}>{idea.status.replace(/_/g, ' ')}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {scripts.map((s) => (
            <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>v{s.version}: {s.hook}</p>
              <button onClick={() => createVideoDraft(s.id)} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}30`, borderRadius: 6, color: GOLD, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Video style={{ width: 10, height: 10 }} /> Create Video Draft
              </button>
            </div>
          ))}
          {videoStatus && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8 }}>{videoStatus}</p>}
          <div style={{ marginTop: 12 }}>
            <label style={lbl}>New Script Version</label>
            <input value={scriptForm.hook} onChange={(e) => setScriptForm((f) => ({ ...f, hook: e.target.value }))} style={{ ...inp, marginBottom: 8 }} placeholder="Hook" />
            <textarea value={scriptForm.body} onChange={(e) => setScriptForm((f) => ({ ...f, body: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} placeholder="Script body" />
            <button onClick={saveScript} disabled={!scriptForm.body.trim()} style={{ padding: '8px 14px', background: scriptForm.body.trim() ? G : '#161410', border: 'none', borderRadius: 7, color: scriptForm.body.trim() ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 700, cursor: scriptForm.body.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Save Script</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewTab() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await authedFetch('/api/client?resource=zion&op=videos')
    setVideos(r.ok ? await r.json() : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (videoId, action, extra = {}) => {
    const body = { video_id: videoId, action, ...extra }
    if (action === 'schedule' && !extra.scheduled_at) {
      const when = window.prompt('Schedule for when? (ISO date/time, e.g. 2026-09-25T15:00)')
      if (!when) return
      body.scheduled_at = new Date(when).toISOString()
    }
    const r = await authedFetch('/api/client?resource=zion&op=review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await r.json()
    if (!r.ok) alert(data.error || 'Action failed')
    load()
  }

  const requestRender = async (videoId) => {
    const r = await authedFetch('/api/client?resource=zion&op=videos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request-render', id: videoId }),
    })
    const data = await r.json()
    alert(data.error || 'Render requested.')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
  if (videos.length === 0) return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No videos in production yet.</p>

  return (
    <div>
      {videos.map((v) => (
        <div key={v.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Video {v.id.slice(0, 8)}</p>
            <StatusBadge status={v.status} />
          </div>
          {v.status === 'draft' && (
            <button onClick={() => requestRender(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}30`, borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
              <Video style={{ width: 12, height: 12 }} /> Request Render
            </button>
          )}
          {(v.status === 'draft' || v.status === 'ready_for_review' || v.status === 'changes_requested') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => act(v.id, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 7, color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><CheckCircle2 style={{ width: 12, height: 12 }} /> Approve</button>
              <button onClick={() => act(v.id, 'request_changes', { notes: window.prompt('What needs to change?') || '' })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: `${GOLD}12`, border: `1px solid ${GOLD}40`, borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><Clock style={{ width: 12, height: 12 }} /> Request Changes</button>
              <button onClick={() => act(v.id, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><XCircle style={{ width: 12, height: 12 }} /> Reject</button>
            </div>
          )}
          {v.status === 'approved' && (
            <button onClick={() => act(v.id, 'schedule')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Schedule</button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(201,168,76,0.06)', border: `1px solid ${GOLD}20`, borderRadius: 10 }}>
        <AlertTriangle style={{ width: 14, height: 14, color: GOLD, flexShrink: 0, marginTop: 2 }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6 }}>
          No video-rendering provider or character reference asset is connected yet — "Request Render" reports this honestly rather than faking a result. Publishing adapters (TikTok/Instagram/LinkedIn/YouTube/Facebook) are implemented but await real account authorization — no connect UI is built yet.
        </p>
      </div>
    </div>
  )
}

// Calendar: real aggregation of scheduled Zion videos + scheduled marketing content
// (api/client.js's handleZionCalendar) — not a Zion-only view pretending to show everything.
function CalendarTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authedFetch('/api/client?resource=zion&op=calendar')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load calendar')))
      .then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: GOLD }} />
  if (error) return <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
  if (!items.length) return <EmptyState text="Nothing scheduled yet." />
  return (
    <div>
      {items.map((it) => (
        <div key={`${it.kind}-${it.id}`} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{it.label}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${GOLD}18`, color: GOLD, textTransform: 'uppercase' }}>{it.kind === 'zion_video' ? 'Zion' : 'Marketing'}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{new Date(it.scheduled_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}

// Published: distinguishes provider-confirmed publication from manually recorded publication —
// the real, structural distinction, not a generic "published" badge.
function PublishedTab() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authedFetch('/api/client?resource=zion&op=published')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load published videos')))
      .then(setVideos).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: GOLD }} />
  if (error) return <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
  if (!videos.length) return <EmptyState text="Nothing published yet." />
  return (
    <div>
      {videos.map((v) => (
        <div key={v.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{v.platform_variant || 'Video'} {v.id.slice(0, 8)}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: v.publish_confirmation_source === 'provider' ? 'rgba(74,222,128,0.15)' : 'rgba(167,139,250,0.15)', color: v.publish_confirmation_source === 'provider' ? '#4ade80' : '#a78bfa', textTransform: 'uppercase' }}>
              {v.publish_confirmation_source === 'provider' ? 'Provider-confirmed' : v.publish_confirmation_source === 'manual' ? 'Manually recorded' : 'Confirmation unknown'}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{v.published_at ? new Date(v.published_at).toLocaleString() : '—'}</p>
        </div>
      ))}
    </div>
  )
}

// Analytics: shows unavailable/stale data honestly — never defaults metrics to zero, which would
// look like a real, confirmed zero-engagement result instead of "we don't actually know."
function AnalyticsTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authedFetch('/api/client?resource=zion&op=analytics')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load analytics')))
      .then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: GOLD }} />
  if (error) return <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
  if (!rows.length) return <EmptyState text="No published videos to analyze yet." />
  const statusColor = { unavailable: 'rgba(255,255,255,0.3)', stale: '#f87171', fresh: '#4ade80' }
  return (
    <div>
      {rows.map((v) => (
        <div key={v.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{v.platform_variant || 'Video'} {v.id.slice(0, 8)}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${statusColor[v.data_status]}18`, color: statusColor[v.data_status], textTransform: 'uppercase' }}>{v.data_status === 'unavailable' ? 'Data unavailable' : v.data_status === 'stale' ? 'Stale (24h+)' : 'Fresh'}</span>
          </div>
          {v.data_status === 'unavailable' ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>No metrics have been recorded for this video yet — honestly unavailable, not zero.</p>
          ) : (
            <pre style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(v.metrics, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  )
}

// Revenue: distinguishes estimates, verified income, expenses, and profit — profit is computed
// server-side from verified figures only (never includes estimates), and this entire tab is
// platform-owner-only (personal financial data), enforced server-side too.
function RevenueTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ record_type: 'estimate', amount_cents: '', source: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    authedFetch('/api/client?resource=zion&op=revenue')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Revenue records are private to the platform owner' : 'Failed to load revenue')))
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.amount_cents) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=zion&op=revenue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount_cents: Math.round(Number(form.amount_cents) * 100) }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to record entry')
      setForm({ record_type: 'estimate', amount_cents: '', source: '', notes: '' })
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  if (loading) return <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: GOLD }} />
  if (error) return <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>

  const fmt = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[['Estimates', data.summary.estimate_cents, 'rgba(255,255,255,0.4)'], ['Verified Income', data.summary.verified_income_cents, '#4ade80'], ['Expenses', data.summary.expense_cents, '#f87171'], ['Profit (verified only)', data.summary.profit_cents, GOLD]].map(([label, cents, color]) => (
          <div key={label} style={{ ...CARD, marginBottom: 0, textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
            <p style={{ color, fontSize: 20, fontWeight: 800 }}>{fmt(cents)}</p>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={lbl}>Type</label>
          <select value={form.record_type} onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value }))} style={{ ...inp, width: 150 }}>
            <option value="estimate" style={{ background: '#111' }}>Estimate</option>
            <option value="verified_income" style={{ background: '#111' }}>Verified Income</option>
            <option value="expense" style={{ background: '#111' }}>Expense</option>
          </select>
        </div>
        <div><label style={lbl}>Amount ($)</label><input type="number" value={form.amount_cents} onChange={(e) => setForm((f) => ({ ...f, amount_cents: e.target.value }))} style={{ ...inp, width: 110 }} /></div>
        <div><label style={lbl}>Source</label><input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={{ ...inp, width: 160 }} placeholder="sponsorship, rendering cost..." /></div>
        <button onClick={submit} disabled={saving || !form.amount_cents} style={{ padding: '10px 16px', background: form.amount_cents ? G : '#161410', border: 'none', borderRadius: 8, color: form.amount_cents ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: form.amount_cents ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Record</button>
      </div>

      {data.records.length === 0 ? <EmptyState text="No revenue records yet." /> : data.records.map((r) => (
        <div key={r.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{r.source || r.record_type.replace(/_/g, ' ')}</p>
            <p style={{ color: r.record_type === 'expense' ? '#f87171' : r.record_type === 'verified_income' ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 700 }}>{r.record_type === 'expense' ? '-' : ''}{fmt(r.amount_cents)}</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>{r.record_type.replace(/_/g, ' ')} · {new Date(r.recorded_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

// Profile Bible: versioned character references, approved voice/assets, privacy rules. Missing
// assets block only the render step (see ReviewTab) — this tab itself always works.
function ProfileBibleTab() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ asset_type: 'appearance_reference', storage_path: '', notes: '', privacy: 'owner_only' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    authedFetch('/api/client?resource=zion&op=character-assets')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load assets')))
      .then(setAssets).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=zion&op=character-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to save asset')
      setForm({ asset_type: 'appearance_reference', storage_path: '', notes: '', privacy: 'owner_only' })
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const approve = async (id) => {
    try {
      const r = await authedFetch('/api/client?resource=zion&op=character-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to approve')
      load()
    } catch (e) { alert(e.message) }
  }

  if (loading) return <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: GOLD }} />
  if (error) return <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>

  return (
    <div>
      <div style={{ ...CARD, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={lbl}>Asset type</label>
          <select value={form.asset_type} onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))} style={{ ...inp, width: 180 }}>
            <option value="appearance_reference" style={{ background: '#111' }}>Appearance reference</option>
            <option value="voice_reference" style={{ background: '#111' }}>Voice reference</option>
            <option value="profile_bible" style={{ background: '#111' }}>Profile bible (text)</option>
          </select>
        </div>
        <div><label style={lbl}>Storage path / notes</label><input value={form.storage_path} onChange={(e) => setForm((f) => ({ ...f, storage_path: e.target.value }))} style={{ ...inp, width: 220 }} placeholder="private storage reference" /></div>
        <div>
          <label style={lbl}>Privacy</label>
          <select value={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.value }))} style={{ ...inp, width: 150 }}>
            <option value="owner_only" style={{ background: '#111' }}>Owner only</option>
            <option value="staff_visible" style={{ background: '#111' }}>Staff visible</option>
          </select>
        </div>
        <button onClick={submit} disabled={saving} style={{ padding: '10px 16px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add Version</button>
      </div>

      {assets.length === 0 ? <EmptyState text="No character reference assets on file yet — this blocks only the render step." /> : assets.map((a) => (
        <div key={a.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{a.asset_type.replace(/_/g, ' ')} v{a.version}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{a.privacy === 'owner_only' ? 'Private' : 'Staff visible'}</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: a.status === 'approved' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: a.status === 'approved' ? '#4ade80' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{a.status}</span>
              {a.status !== 'approved' && <button onClick={() => approve(a.id)} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', background: `${GOLD}18`, border: 'none', borderRadius: 6, color: GOLD, cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>}
            </div>
          </div>
          {a.notes && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 }}>{a.notes}</p>}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{text}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = { draft: 'rgba(255,255,255,0.4)', ready_for_review: GOLD, approved: '#4ade80', scheduled: '#a78bfa', published: '#4ade80', changes_requested: GOLD, rejected: '#f87171' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: `${colors[status] || '#888'}18`, color: colors[status] || '#888', textTransform: 'uppercase' }}>{(status || '').replace(/_/g, ' ')}</span>
}
