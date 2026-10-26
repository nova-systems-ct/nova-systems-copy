import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Camera, Link2, Save, Eye, CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { useOrg } from '../../../lib/OrgContext'
import { authedFetch } from '../../../lib/apiAuth'

// In-person audit capture (iPad-first, 2026-10-25 design). Every item is saved to the server as an evidence record
// (source, method, time, author), so progress survives refreshes and another device. Progress = items with at least one
// saved record. What the owner SAYS is labelled as the owner's statement, never as an observation. Not offline: if the
// connection drops, typed text stays on this device as a draft until it is saved.
const GOLD = '#C9A84C'; const TEXT = '#FAFAFA'; const DIM = 'rgba(250,250,250,0.64)'; const FAINT = 'rgba(250,250,250,0.42)'; const LINE = 'rgba(250,250,250,0.10)'; const PANEL = '#0F0F0F'
export const SECTIONS = [
  ['intake', 'Business & intake', 'Who the business serves and how requests arrive', [['profile', 'Business information', 'Services, hours, team, area served — confirm with the owner'], ['channels', 'How inquiries arrive', 'Phone, walk-in, web form, social, referrals'], ['answering', 'Who answers', 'Who picks up, and what happens when nobody can']]],
  ['booking', 'Booking', 'How new jobs are scheduled and managed', [['current', 'How a job is booked today', 'Watch it happen if possible'], ['tool', 'Calendar or tool used', 'Paper, shared calendar, software'], ['after_hours', 'After hours', 'What a customer can do at night or on weekends']]],
  ['followup', 'Response & follow-up', 'How quickly and reliably customers hear back', [['speed', 'Reply time', 'Owner’s estimate is a statement; a timed test is an observation'], ['quotes', 'Quotes not booked', 'Is anyone following up, and when'], ['reviews', 'Reviews and referrals', 'Are customers asked, and how']]],
  ['payments', 'Payments', 'How customers pay and invoices are handled', [['how', 'How customers pay', 'Deposits, cash, card, invoice'], ['invoices', 'Invoices and reminders', 'Who sends them; late payments'], ['refunds', 'Refunds and disputes', 'How they are handled and recorded']]],
  ['software', 'Software & tools', 'Tools, integrations and their cost', [['list', 'Tools in use', 'Name, purpose and monthly cost (owner-supplied)'], ['gaps', 'Tools that do not connect', 'Where information is typed twice'], ['data', 'Customer records', 'Where customer history lives']]],
  ['handoffs', 'Staff & handoffs', 'Who does what, and where work gets stuck', [['roles', 'Who does what', 'Roles and responsibilities'], ['stuck', 'Where requests get stuck', 'Handoffs that fail or wait'], ['escalation', 'When the owner is unavailable', 'Who decides, who is told']]],
]
const SOURCES = [['observed', 'Observed on site'], ['owner_said', 'Owner said'], ['document', 'Document shown'], ['system', 'System screen']]
const call = async (op, { org, method = 'GET', body, query = {} }) => {
  const qs = new URLSearchParams({ resource: 'audit', op, ...(method === 'GET' ? { organization_id: org, ...query } : {}) })
  const r = await authedFetch(`/api/client?${qs}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify({ organization_id: org, ...body }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j
}
const draftKey = (caseId, s, p) => `nova-capture:${caseId}:${s}:${p}`
const readDraft = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const writeDraft = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k) } catch { /* storage unavailable */ } }

// Downscale a camera photo to at most 1600 px (JPEG) so it fits the upload limit and uploads quickly on Wi-Fi.
async function shrink(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url })
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale)
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', 0.82)
  } finally { URL.revokeObjectURL(url) }
}

export default function AuditCapture() {
  const { id } = useParams()
  const { currentOrg } = useOrg()
  const org = currentOrg?.id
  const [audit, setAudit] = useState(null); const [evidence, setEvidence] = useState([]); const [err, setErr] = useState(null)
  const [sec, setSec] = useState('intake'); const [prompt, setPrompt] = useState('profile')
  const [form, setForm] = useState({ observation: '', source: 'observed', confidence: 'medium', reference: '' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [photo, setPhoto] = useState(null)

  const load = async () => {
    if (!org) return
    try {
      const [c, ev] = await Promise.all([call('cases', { org, query: { id } }), call('evidence', { org, query: { case_id: id } })])
      setAudit(c); setEvidence(Array.isArray(ev) ? ev : []); setErr(null)
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [org, id])

  const k = draftKey(id, sec, prompt)
  useEffect(() => { const d = readDraft(k); setForm(d || { observation: '', source: 'observed', confidence: 'medium', reference: '' }); setPhoto(null); setMsg(null) }, [k])
  const update = (patch) => { const next = { ...form, ...patch }; setForm(next); writeDraft(k, next.observation || next.reference ? next : null) }

  const methodOf = (s, p) => `in_person:${s}:${p}`
  const saved = useMemo(() => { const m = {}; for (const e of evidence) if (String(e.method || '').startsWith('in_person:')) { const key = e.method.split(':').slice(1, 3).join(':'); (m[key] ||= []).push(e) } return m }, [evidence])
  const doneIn = (s) => SECTIONS.find((x) => x[0] === s)[3].filter(([p]) => saved[`${s}:${p}`]?.length).length
  const totalDone = SECTIONS.reduce((a, [s]) => a + doneIn(s), 0); const total = SECTIONS.reduce((a, x) => a + x[3].length, 0)
  const section = SECTIONS.find((x) => x[0] === sec); const item = section[3].find((x) => x[0] === prompt)
  const sourceLabel = SOURCES.find((x) => x[0] === form.source)[1]

  const save = async () => {
    if (!form.observation.trim() && !photo) { setMsg({ tone: 'bad', text: 'Write what you saw or heard (or add a photo) first.' }); return }
    setBusy(true); setMsg(null)
    const observation = `${form.source === 'owner_said' ? 'Owner said: ' : ''}${form.observation.trim() || 'Photo'}`
    const source = `In person — ${sourceLabel}${form.reference.trim() ? ` — ${form.reference.trim()}` : ''} (${section[1]} › ${item[1]})`
    try {
      if (photo) await call('evidence-photo', { org, method: 'POST', body: { case_id: id, image_base64: photo, observation, source, method: methodOf(sec, prompt), confidence: form.confidence } })
      else await call('evidence', { org, method: 'POST', body: { case_id: id, observation, source, method: methodOf(sec, prompt), confidence: form.confidence } })
      writeDraft(k, null); setForm({ observation: '', source: form.source, confidence: form.confidence, reference: '' }); setPhoto(null)
      setMsg({ tone: 'ok', text: `Saved ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.` }); await load()
    } catch (e) { setMsg({ tone: 'bad', text: `Not saved: ${e.message}. Your text is kept on this device — check the Wi-Fi and press Save again.` }) }
    setBusy(false)
  }
  const pick = async (file) => { if (!file) return; try { setPhoto(await shrink(file)) } catch { setMsg({ tone: 'bad', text: 'That photo could not be read.' }) } }
  // Streamed through the app (the iPad on the local Wi-Fi route cannot reach Supabase storage URLs).
  const viewPhoto = async (e) => {
    const w = window.open('', '_blank')
    try {
      const r = await authedFetch(`/api/client?${new URLSearchParams({ resource: 'audit', op: 'evidence-photo', organization_id: org, case_id: id, evidence_id: e.id, stream: '1' })}`)
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `The server answered ${r.status}.`) }
      const url = URL.createObjectURL(await r.blob()); if (w) w.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (x) { w?.close(); setMsg({ tone: 'bad', text: `Photo not opened: ${x.message}` }) }
  }

  if (err) return <div style={{ padding: 24, color: '#F07167' }} role="alert">{err}</div>
  if (!audit) return <div style={{ padding: 24, color: DIM }}>Loading the audit…</div>
  const biz = audit.businesses?.name || 'Business'
  return (
    <div className="ac" style={{ padding: 'clamp(16px,3vw,36px)', color: TEXT, maxWidth: 1360 }}>
      <style>{`
        .ac-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start}
        .ac-panel{background:${PANEL};border:1px solid ${LINE};border-radius:16px;padding:18px}
        .ac-tabs{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px}
        .ac-tab{text-align:left;background:${PANEL};border:1px solid ${LINE};border-radius:14px;padding:14px;color:${TEXT};cursor:pointer;min-height:76px}
        .ac-tab[aria-pressed=true]{border-color:${GOLD};background:rgba(201,168,76,0.08)}
        .ac-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:0;border-top:1px solid ${LINE};color:${TEXT};padding:14px 4px;cursor:pointer;min-height:56px}
        .ac-item:first-child{border-top:0}
        .ac-item[aria-pressed=true] .ac-item-title{color:${GOLD}}
        .ac-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;padding:13px 16px;font-weight:600;font-size:15px;cursor:pointer;min-height:48px;border:1px solid ${LINE};background:transparent;color:${TEXT}}
        .ac-primary{background:linear-gradient(135deg,#B8933F,${GOLD} 45%,#E0C476);color:#0A0A0A;border:0}
        .ac-input{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.14);border-radius:12px;color:${TEXT};padding:13px 14px;font-size:16px;box-sizing:border-box}
        .ac-input:focus,.ac-btn:focus-visible,.ac-tab:focus-visible,.ac-item:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
        .ac-bar{height:4px;background:${LINE};border-radius:4px;margin-top:10px}
        @media (max-width:1100px){.ac-grid{grid-template-columns:minmax(0,1fr)}}
        @media (max-width:640px){.ac-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
      <Link to={`/dashboard/audit/${id}`} style={{ color: GOLD, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={16} />Back to the audit</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', borderBottom: `1px solid ${LINE}`, padding: '14px 0 18px', marginBottom: 18 }}>
        <div>
          <p style={{ margin: 0, color: GOLD, fontSize: 11, letterSpacing: '.32em', textTransform: 'uppercase' }}>In-person audit</p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(34px,4.5vw,50px)', fontWeight: 800, letterSpacing: '-.03em' }}>Nova <span style={{ color: GOLD }}>Audit</span></h1>
          <p style={{ margin: 0, color: DIM, fontSize: 16 }}>{biz}{audit.businesses?.website ? ` · ${audit.businesses.website.replace(/^https?:\/\//, '')}` : ''}</p>
        </div>
        <div style={{ minWidth: 220 }} aria-label={`${totalDone} of ${total} items have saved evidence`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: DIM }}><span>{totalDone} of {total} items</span><span>{Math.round((totalDone / total) * 100)}%</span></div>
          <div className="ac-bar"><div style={{ width: `${(totalDone / total) * 100}%`, height: 4, background: GOLD, borderRadius: 4 }} /></div>
        </div>
      </div>

      <div className="ac-tabs" role="group" aria-label="Audit areas">
        {SECTIONS.map(([s, label, , items]) => (
          <button key={s} className="ac-tab" aria-pressed={s === sec} onClick={() => { setSec(s); setPrompt(items[0][0]) }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
            <div style={{ color: FAINT, fontSize: 12, marginTop: 4 }}>{doneIn(s)} / {items.length} recorded</div>
            <div className="ac-bar"><div style={{ width: `${(doneIn(s) / items.length) * 100}%`, height: 4, background: GOLD, borderRadius: 4 }} /></div>
          </button>
        ))}
      </div>

      <div className="ac-grid">
        <section className="ac-panel" aria-label={section[1]}>
          <h2 style={{ margin: '0 0 2px', fontSize: 19 }}>{section[1]}</h2>
          <p style={{ margin: '0 0 8px', color: DIM, fontSize: 14 }}>{section[2]}</p>
          {section[3].map(([p, title, hint]) => {
            const n = saved[`${sec}:${p}`]?.length || 0
            return (
              <button key={p} className="ac-item" aria-pressed={p === prompt} onClick={() => setPrompt(p)}>
                {n ? <CheckCircle2 size={22} color={GOLD} /> : <Circle size={22} color={FAINT} />}
                <span style={{ flex: 1 }}><span className="ac-item-title" style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{title}</span><span style={{ color: FAINT, fontSize: 13 }}>{hint}</span></span>
                <span style={{ color: FAINT, fontSize: 12 }}>{n ? `${n} saved` : ''}</span><ChevronRight size={18} color={FAINT} />
              </button>
            )
          })}
          {(saved[`${sec}:${prompt}`] || []).length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
              <p style={{ margin: '0 0 8px', color: FAINT, fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase' }}>Saved for “{item[1]}”</p>
              {saved[`${sec}:${prompt}`].map((e) => (
                <div key={e.id} style={{ padding: '8px 0', borderTop: `1px solid ${LINE}`, fontSize: 14 }}>
                  <div>{e.observation}</div>
                  <div style={{ color: FAINT, fontSize: 12, marginTop: 2 }}>{new Date(e.capture_date || e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {e.confidence || 'no'} confidence{e.snapshot_path ? ' · ' : ''}{e.snapshot_path && <button onClick={() => viewPhoto(e)} style={{ background: 'none', border: 0, color: GOLD, cursor: 'pointer', fontSize: 12, padding: 0 }}>View photo</button>}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ac-panel" aria-label="Capture evidence">
          <h2 style={{ margin: '0 0 2px', fontSize: 19, display: 'flex', gap: 10, alignItems: 'center' }}><FileText size={20} color={GOLD} />Capture evidence</h2>
          <p style={{ margin: '0 0 14px', color: DIM, fontSize: 14 }}>{item[1]} — add a note, a photo or a source.</p>
          <label htmlFor="ac-obs" style={{ display: 'block', fontSize: 13, color: DIM, marginBottom: 6 }}>{form.source === 'owner_said' ? 'What the owner said (recorded as their statement)' : 'What you observed'}</label>
          <textarea id="ac-obs" className="ac-input" rows={5} maxLength={3000} value={form.observation} onChange={(e) => update({ observation: e.target.value })} placeholder="Key details, quotes, issues or opportunities…" />
          <div style={{ color: FAINT, fontSize: 12, textAlign: 'right', marginTop: 4 }}>{form.observation.length} / 3000</div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginTop: 8 }}>
            <div><label htmlFor="ac-src" style={{ display: 'block', fontSize: 13, color: DIM, marginBottom: 6 }}>Source</label>
              <select id="ac-src" className="ac-input" value={form.source} onChange={(e) => update({ source: e.target.value })}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label htmlFor="ac-conf" style={{ display: 'block', fontSize: 13, color: DIM, marginBottom: 6 }}>Confidence</label>
              <select id="ac-conf" className="ac-input" value={form.confidence} onChange={(e) => update({ confidence: e.target.value })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          </div>
          <label htmlFor="ac-ref" style={{ display: 'block', fontSize: 13, color: DIM, margin: '12px 0 6px' }}>Reference (optional) <Link2 size={13} style={{ verticalAlign: '-2px' }} /></label>
          <input id="ac-ref" className="ac-input" value={form.reference} onChange={(e) => update({ reference: e.target.value })} placeholder="e.g. front desk, booking screen, price sheet" />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
            <label className="ac-btn" style={{ cursor: 'pointer' }}><Camera size={18} />{photo ? 'Change photo' : 'Take photo'}<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} /></label>
            {photo && <img src={photo} alt="Photo to be saved" style={{ height: 56, borderRadius: 8, border: `1px solid ${LINE}` }} />}
            {photo && <button className="ac-btn" onClick={() => setPhoto(null)}>Remove</button>}
          </div>
          {msg && <p role={msg.tone === 'bad' ? 'alert' : 'status'} style={{ fontSize: 14, color: msg.tone === 'bad' ? '#F4A29B' : '#7BD389', margin: '0 0 12px' }}>{msg.text}</p>}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <button className="ac-btn ac-primary" disabled={busy} onClick={save}><Save size={18} />{busy ? 'Saving…' : 'Save'}</button>
            <Link className="ac-btn" to={`/dashboard/audit/${id}`} style={{ textDecoration: 'none' }}><Eye size={18} />Open the audit</Link>
          </div>
          <p style={{ color: FAINT, fontSize: 12, margin: '12px 0 0' }}>Saved items become evidence on this audit. Findings and the report are written from them on the audit page. Photos stay private to Nova.</p>
        </section>
      </div>
    </div>
  )
}
