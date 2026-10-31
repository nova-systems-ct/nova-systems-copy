import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, X, ChevronRight } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'
import { C, css, Card, Field, Badge, Notice, when } from './ops/ui'

// Audits list (repair 2026-10-26). "New audit" asks for about five business details and online / in-person, creates the
// business if it is new, and never silently duplicates an open audit. Archived and clearly marked test audits
// (names starting LOCAL TEST / TEST / DEMO) are hidden by default and can be shown; nothing is deleted from here.
// Deadline math stays server-side (api/_auditClock.js).
const STATE_LABEL = { waiting_for_client: 'Not started', queue: 'Not started', active: 'Clock running', at_risk: 'At risk', overdue: 'Overdue', reviewer_wait: 'Waiting for review', paused: 'Paused', completed: 'Completed' }
const STATE_TONE = { active: 'running', at_risk: 'pending', overdue: 'failed', paused: 'paused', completed: 'completed' }
const DRAFT_KEY = 'nova.audit.new'
const local = { get: () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null } }, set: (v) => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY) } catch { /* unavailable */ } } }
const blank = { name: '', location: '', website: '', industry: '', goal: '', phone: '', mode: 'online' }

export default function AuditCases() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [cases, setCases] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTest, setShowTest] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(searchParams.get('new') === '1' || !!local.get())
  const [form, setForm] = useState(() => ({ ...blank, ...(local.get() || {}) }))
  const [saving, setSaving] = useState(false)
  const [startErr, setStartErr] = useState(null)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true); setError('')
    try {
      const [caseRes, bizRes] = await Promise.all([
        authedFetch(`/api/client?resource=audit&op=cases&organization_id=${encodeURIComponent(currentOrg.id)}`),
        authedFetch(`/api/client?resource=crm&op=businesses&organization_id=${encodeURIComponent(currentOrg.id)}`),
      ])
      if (!caseRes.ok) throw new Error((await caseRes.json().catch(() => ({}))).error || `The server answered ${caseRes.status}.`)
      setCases(await caseRes.json())
      setBusinesses(bizRes.ok ? await bizRes.json() : [])
    } catch (e) { setError(`Audits could not be loaded: ${e.message}`) }
    setLoading(false)
  }, [currentOrg])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (open) local.set(Object.values({ ...form, mode: '' }).some(Boolean) ? form : null) }, [form, open])

  const start = async (forceNew = false) => {
    setSaving(true); setStartErr(null)
    try {
      const r = await authedFetch('/api/client?resource=audit&op=start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: currentOrg.id, ...form, force_new: forceNew }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 409 && d.existing_case_id) { setStartErr({ text: d.error, existing: d.existing_case_id }); setSaving(false); return }
      if (!r.ok) throw new Error(d.error || `The server answered ${r.status}.`)
      local.set(null); setForm(blank); setOpen(false)
      navigate(`/dashboard/audit/${d.case.id}`)
    } catch (e) { setStartErr({ text: `Not started: ${e.message} Your details are still here.` }) }
    setSaving(false)
  }

  if (!currentOrg) return null
  const bizName = (c) => c.intake?.name || businesses.find((b) => b.id === c.business_id)?.name || 'Unnamed business'
  const isTest = (c) => /^(LOCAL TEST|TEST|DEMO)(\W|$)/.test(bizName(c))
  const testCount = cases.filter((c) => isTest(c) && !c.archived_at).length
  const archivedCount = cases.filter((c) => c.archived_at).length
  const shown = cases.filter((c) => (showArchived ? !!c.archived_at : !c.archived_at) && (showTest || showArchived || !isTest(c)))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="ops-wrap" style={{ maxWidth: 1080 }}>
      <style>{css}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <p style={{ color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', margin: 0 }}>Nova Audit</p>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: '6px 0 4px', color: C.text }}>Audits</h1>
          <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>{loading ? 'Loading…' : `${shown.length} ${showArchived ? 'archived' : 'open'} audit${shown.length === 1 ? '' : 's'}`}</p>
        </div>
        {!open && <button className="ops-btn primary" onClick={() => setOpen(true)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={16} /> New audit</button>}
      </header>

      {open && (
        <Card title="Start an audit" actions={<button className="ops-btn" aria-label="Close" onClick={() => { setOpen(false); setStartErr(null) }} style={{ border: 0 }}><X size={18} /></button>} style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: C.dim, marginTop: 0 }}>Five details are enough to start: name, area, website, industry and the owner's main goal. Nova researches the public footprint from these; everything can be edited later.</p>
          <div className="ops-two">
            <Field label="Business name (required)" id="na-name"><input id="na-name" className="ops-input" value={form.name} onChange={set('name')} autoCapitalize="words" /></Field>
            <Field label="Website" id="na-web"><input id="na-web" className="ops-input" value={form.website} onChange={set('website')} inputMode="url" autoCapitalize="none" placeholder="business.com" /></Field>
            <Field label="Industry or main service" id="na-ind"><input id="na-ind" className="ops-input" value={form.industry} onChange={set('industry')} placeholder="Roofing, restaurant, dental…" /></Field>
            <Field label="City / area" id="na-loc"><input id="na-loc" className="ops-input" value={form.location} onChange={set('location')} placeholder="Waterbury, CT" /></Field>
            <Field label="Main goal or concern" id="na-goal"><input id="na-goal" className="ops-input" value={form.goal} onChange={set('goal')} placeholder="More booked jobs, fewer missed calls…" /></Field>
            <Field label="Main phone (optional)" id="na-ph"><input id="na-ph" className="ops-input" value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
              <legend style={{ fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}>How will you audit?</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['online', 'Online'], ['in_person', 'Online and in person']].map(([v, l]) => <button key={v} type="button" aria-pressed={form.mode === v} className={`ops-btn ${form.mode === v ? 'primary' : ''}`} onClick={() => setForm((f) => ({ ...f, mode: v }))}>{l}</button>)}
              </div>
            </fieldset>
          </div>
          {startErr && <Notice tone={startErr.existing ? 'warn' : 'bad'}>{startErr.text}{startErr.existing && <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}><button className="ops-btn primary" onClick={() => { local.set(null); navigate(`/dashboard/audit/${startErr.existing}`) }}>Open the existing audit</button><button className="ops-btn" disabled={saving} onClick={() => start(true)}>Start a new one anyway</button></div>}</Notice>}
          <button className="ops-btn primary" disabled={saving || form.name.trim().length < 2} onClick={() => start(false)}>{saving ? 'Starting…' : 'Start audit'}</button>
        </Card>
      )}

      {error && <Notice tone="bad">{error} <button className="ops-btn" onClick={load}>Try again</button></Notice>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={`ops-btn ${!showArchived && !showTest ? 'primary' : ''}`} onClick={() => { setShowArchived(false); setShowTest(false) }}>Open</button>
        {testCount > 0 && <button className={`ops-btn ${showTest && !showArchived ? 'primary' : ''}`} aria-pressed={showTest} onClick={() => { setShowArchived(false); setShowTest((v) => !v) }}>{showTest ? 'Hide' : 'Show'} test audits ({testCount})</button>}
        {archivedCount > 0 && <button className={`ops-btn ${showArchived ? 'primary' : ''}`} aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>Archived ({archivedCount})</button>}
      </div>

      {loading ? <p role="status" style={{ color: C.faint }}>Loading audits…</p> : !shown.length ? (
        <Card><p style={{ color: C.dim, fontSize: 14, margin: 0 }}>{showArchived ? 'No archived audits.' : 'No open audits. Use “New audit” to start one.'}</p></Card>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
          {shown.map((c) => {
            const n = c.audit_findings?.[0]?.count ?? 0
            return (
              <li key={c.id}>
                <button onClick={() => navigate(`/dashboard/audit/${c.id}`)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'transparent', border: 0, borderBottom: `1px solid ${C.line}`, cursor: 'pointer', color: C.text, fontFamily: 'inherit', minHeight: 64 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bizName(c)} {isTest(c) && <span style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>TEST</span>}</div>
                    <div style={{ fontSize: 13, color: C.dim }}>{c.scope === '360' ? 'Online and in person' : 'Online'} · {n} finding{n === 1 ? '' : 's'} · started {when(c.created_at)}{c.clock?.dueAt ? ` · due ${when(c.clock.dueAt)}` : ''}</div>
                  </div>
                  <Badge value={STATE_TONE[c.clock?.bucket] || 'unknown'} label={STATE_LABEL[c.clock?.bucket] || 'Not started'} />
                  <ChevronRight size={18} color={C.faint} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
