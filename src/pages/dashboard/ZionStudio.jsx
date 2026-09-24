import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Lightbulb, FileCheck2, Plus, Loader2, CheckCircle2, XCircle, Clock, Video, AlertTriangle } from 'lucide-react'
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
        {[['journal', 'Journal', BookOpen], ['ideas', 'Ideas & Scripts', Lightbulb], ['review', 'Review', FileCheck2]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? GOLD : 'transparent'}`, color: tab === key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <Icon style={{ width: 13, height: 13 }} /> {label}
          </button>
        ))}
      </div>

      {tab === 'journal' && <JournalTab />}
      {tab === 'ideas' && <IdeasTab />}
      {tab === 'review' && <ReviewTab />}
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
          No video-rendering provider or character reference asset is connected yet — "Request Render" reports this honestly rather than faking a result. Publishing adapters (TikTok/Instagram/etc.) are not built.
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = { draft: 'rgba(255,255,255,0.4)', ready_for_review: GOLD, approved: '#4ade80', scheduled: '#a78bfa', published: '#4ade80', changes_requested: GOLD, rejected: '#f87171' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: `${colors[status] || '#888'}18`, color: colors[status] || '#888', textTransform: 'uppercase' }}>{(status || '').replace(/_/g, ' ')}</span>
}
