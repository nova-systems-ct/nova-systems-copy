import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Check, Circle, Download, FileText, Search, Archive, RotateCcw, ExternalLink } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'
import { C, css, Card, Field, Badge, Notice, when } from './ops/ui'
import { fetchPdf } from '../../lib/auditPdf'
import { AuditCss, IntakeTab, TestsTab, BenchmarksTab, ScenariosTab, FindingDetailsTab, DeliveryTab } from './audit/AuditPlus'

// Audit workspace (repair 2026-10-26). One page, task order: business details → evidence review → findings → report →
// PDF in the Vault → approval. Every save shows saving / saved / failed, keeps typed text on failure, and typed text that
// was not saved yet survives a reload on this device. The clock card says exactly why it has or has not started.
const SECTIONS = [['overview', 'Overview'], ['evidence', 'Evidence'], ['findings', 'Findings'], ['report', 'Report & PDF'], ['clock', 'Clock & policy'], ['more', 'More tools']]
const local = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } },
}

async function auditCall(op, { org, method = 'GET', body, query = {} }) {
  const qs = new URLSearchParams({ resource: 'audit', op, ...(method === 'GET' ? { organization_id: org, ...query } : {}) })
  const r = await authedFetch(`/api/client?${qs}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify({ organization_id: org, ...body }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `The server answered ${r.status}.`), { status: r.status, body: j })
  return j
}

function SaveState({ state }) {
  if (!state) return null
  const map = { saving: [C.dim, 'Saving…'], saved: [C.green, state.at ? `Saved ${state.at}` : 'Saved'], failed: [C.red, state.text || 'Not saved'], unsaved: [C.amber, 'Not saved yet'] }
  const [color, text] = map[state.kind] || [C.dim, '']
  return <span role="status" aria-live="polite" style={{ fontSize: 13, color }}>{text}</span>
}

export default function AuditCaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentOrg, currentMembership } = useOrg()
  const org = currentOrg?.id
  const isOwner = currentMembership?.role === 'nova_super_admin'
  const [ws, setWs] = useState(null)
  const [error, setError] = useState(null)
  const [section, setSection] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('section')) || 'overview')
  const [evidence, setEvidence] = useState([])
  const [findings, setFindings] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [reports, setReports] = useState([])

  const load = useCallback(async () => {
    if (!org) return
    try {
      const [w, ev, f, rec, rep] = await Promise.all([
        auditCall('workspace', { org, query: { case_id: id } }),
        auditCall('evidence', { org, query: { case_id: id } }),
        auditCall('findings', { org, query: { case_id: id } }),
        auditCall('recommendations', { org, query: { case_id: id } }).catch(() => []),
        auditCall('reports', { org, query: { case_id: id } }).catch(() => []),
      ])
      setWs(w); setEvidence(ev); setFindings(f); setRecommendations(rec); setReports(rep); setError(null)
    } catch (e) { setError(e) }
  }, [org, id])
  useEffect(() => { load() }, [load])
  const go = (s) => { setSection(s); try { const u = new URL(window.location.href); u.searchParams.set('section', s); window.history.replaceState(null, '', u) } catch { /* ignore */ } }

  if (!currentOrg) return null
  if (error && !ws) return (
    <div className="ops-wrap"><style>{css}</style>
      <Notice tone="bad">{error.status === 404 ? 'This audit was not found in the selected business.' : `The audit could not be loaded: ${error.message}`}</Notice>
      <button className="ops-btn" onClick={() => navigate('/dashboard/audit')}>Back to audits</button> <button className="ops-btn" onClick={load}>Try again</button>
    </div>
  )
  if (!ws) return <div className="ops-wrap"><style>{css}</style><p role="status" style={{ color: C.faint }}>Loading audit…</p></div>

  const archived = !!ws.case.archived_at
  return (
    <div className="ops-wrap" style={{ maxWidth: 1080 }}>
      <style>{css}</style><AuditCss />
      <button onClick={() => navigate('/dashboard/audit')} className="ops-btn" style={{ border: 0, padding: '6px 0', color: C.dim, display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={16} /> All audits</button>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', margin: '10px 0 18px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', margin: 0 }}>{ws.case.scope === '360' ? 'Nova Audit · online and in person' : 'Nova Audit · online'}</p>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: '6px 0 4px', color: C.text, overflowWrap: 'anywhere' }}>{ws.business.name}</h1>
          <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>{ws.business.website || 'No website saved'} · started {when(ws.case.created_at)}{archived ? ' · archived' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/dashboard/audit/${id}/capture`} className="ops-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>In-person capture</Link>
          <ArchiveButton org={org} caseId={id} archived={archived} onDone={load} />
        </div>
      </header>
      {archived && <Notice tone="warn">This audit is archived: hidden from the audit list, nothing deleted. Restore it to show it again.</Notice>}
      <nav aria-label="Audit sections" className="ops-tabs" role="tablist">
        {SECTIONS.map(([k, l]) => <button key={k} role="tab" aria-selected={section === k} className={`ops-tab ${section === k ? 'active' : ''}`} style={{ background: 'none', border: 0, borderBottom: `2px solid ${section === k ? C.gold : 'transparent'}`, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => go(k)}>{l}{k === 'findings' && ws.findings.proposed ? ` (${ws.findings.proposed} to review)` : ''}</button>)}
      </nav>
      {section === 'overview' && <Overview ws={ws} org={org} caseId={id} reload={load} go={go} />}
      {section === 'evidence' && <EvidenceTab caseId={id} orgId={org} items={evidence} onSaved={load} />}
      {section === 'findings' && <FindingsTab caseId={id} orgId={org} items={findings} evidence={evidence} onSaved={load} />}
      {section === 'report' && <ReportSection ws={ws} org={org} caseId={id} reports={reports} reload={load} />}
      {section === 'clock' && <ClockSection ws={ws} org={org} caseId={id} isOwner={isOwner} reload={load} />}
      {section === 'more' && <MoreTools org={org} caseId={id} findings={findings} reports={reports} recommendations={recommendations} reload={load} />}
    </div>
  )
}

function ArchiveButton({ org, caseId, archived, onDone }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const run = async () => { setBusy(true); setErr(''); try { await auditCall('archive', { org, method: 'POST', body: { case_id: caseId, archived: !archived } }); await onDone() } catch (e) { setErr(e.message) } setBusy(false) }
  return <>{err && <span style={{ color: C.red, fontSize: 12 }}>{err}</span>}<button className="ops-btn" disabled={busy} onClick={run} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{archived ? <><RotateCcw size={15} /> Restore</> : <><Archive size={15} /> Archive</>}</button></>
}

// ------------------------------------------------------------------------------------------------ overview
function Overview({ ws, org, caseId, reload, go }) {
  const steps = ws.next_steps
  const next = steps.find((s) => !s.done)
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Next steps">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {steps.map((s) => (
            <li key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 4px', borderBottom: `1px solid ${C.line}` }}>
              {s.done ? <Check size={18} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} aria-label="done" /> : <Circle size={18} color={s === next ? C.gold : C.faint} style={{ flexShrink: 0, marginTop: 2 }} aria-label="not done" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: s === next ? C.text : C.dim }}>{s.label}</div>
                <div style={{ fontSize: 13, color: C.faint }}>{s.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="ops-two">
        <DetailsCard ws={ws} org={org} caseId={caseId} reload={reload} />
        <ReviewCard ws={ws} org={org} caseId={caseId} reload={reload} go={go} />
      </div>
      <div className="ops-two">
        <Card title={`Findings · ${ws.findings.total}`} actions={<button className="ops-btn" onClick={() => go('findings')}>{ws.findings.proposed ? `Review ${ws.findings.proposed}` : 'Open findings'}</button>}>
          {!ws.findings.total ? <p style={{ color: C.faint, fontSize: 13 }}>No findings yet. Run the review or add evidence-backed findings.</p> : (
            <>
              <p style={{ fontSize: 13, color: C.dim, marginTop: 0 }}>{ws.findings.by_priority.high} high · {ws.findings.by_priority.medium} medium · {ws.findings.by_priority.low} low · {ws.findings.reviewed} reviewed, {ws.findings.proposed} proposed</p>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {ws.findings.top.map((f) => <li key={f.id} style={{ fontSize: 14 }}><Badge value={f.priority === 'high' ? 'failed' : f.priority === 'medium' ? 'pending' : 'unknown'} label={f.priority || 'no priority'} /> {f.title} {f.review_status !== 'reviewed' && <span style={{ color: C.faint, fontSize: 12 }}>(proposed)</span>}</li>)}
              </ul>
            </>
          )}
        </Card>
        <PdfCard ws={ws} org={org} caseId={caseId} reload={reload} go={go} />
      </div>
      <ClockCard ws={ws} org={org} caseId={caseId} reload={reload} go={go} />
    </div>
  )
}

function DetailsCard({ ws, org, caseId, reload }) {
  const key = `nova.audit.details:${caseId}`
  const fromServer = Object.fromEntries(ws.details.map((d) => [d.key, d.value || '']))
  const [v, setV] = useState(() => ({ ...fromServer, ...(local.get(key) || {}) }))
  const dirty = ws.details.some((d) => (v[d.key] || '') !== (d.value || ''))
  const [state, setState] = useState(() => (local.get(key) ? { kind: 'unsaved' } : null))
  useEffect(() => { local.set(key, dirty ? v : null); if (dirty && state?.kind !== 'saving') setState((s) => (s?.kind === 'failed' ? s : { kind: 'unsaved' })) }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setState({ kind: 'saving' })
    try {
      await auditCall('details', { org, method: 'POST', body: { case_id: caseId, name: v.name, website: v.website, industry: v.industry, location: v.location, public_phone: v.public_phone } })
      local.set(key, null); setState({ kind: 'saved', at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }); await reload()
    } catch (e) { setState({ kind: 'failed', text: `Not saved: ${e.message} Your text is kept on this device.` }) }
  }
  return (
    <Card title="Business details" actions={<SaveState state={state} />}>
      {ws.details.map((d) => (
        <Field key={d.key} label={d.label} id={`bd-${d.key}`}>
          <input id={`bd-${d.key}`} className="ops-input" value={v[d.key] || ''} onChange={(e) => setV({ ...v, [d.key]: e.target.value })} inputMode={d.key === 'public_phone' ? 'tel' : d.key === 'website' ? 'url' : 'text'} autoCapitalize={d.key === 'website' ? 'none' : 'words'} placeholder={d.key === 'website' ? 'business.com' : ''} />
        </Field>
      ))}
      <button className="ops-btn primary" disabled={!dirty || state?.kind === 'saving'} onClick={save}>Save details</button>
    </Card>
  )
}

function ReviewCard({ ws, org, caseId, reload, go }) {
  const [busy, setBusy] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr(''); setRes(null)
    try { setRes(await auditCall('review', { org, method: 'POST', body: { case_id: caseId } })); await reload() } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const e = ws.evidence
  return (
    <Card title="Evidence review">
      <p style={{ fontSize: 13, color: C.dim, marginTop: 0 }}>Reads up to four public pages of the website and the domain's public email records. Nothing is submitted and no one is contacted. A missing item on a page is never treated as proof.</p>
      <p style={{ fontSize: 14, margin: '8px 0' }}><strong>{e.total}</strong> evidence records · {e.website_and_email} website/email · {e.in_person} in person · {e.other} other</p>
      <p style={{ fontSize: 12, color: C.faint }}>{ws.case.last_review_at ? `Last review ${when(ws.case.last_review_at)}` : 'Not reviewed yet'}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="ops-btn primary" disabled={busy || !ws.business.website} onClick={run} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{busy ? <><Loader2 size={15} className="animate-spin" /> Reviewing (up to 30 s)…</> : <><Search size={15} /> {ws.case.last_review_at ? 'Run the review again' : 'Run website and email review'}</>}</button>
        <button className="ops-btn" onClick={() => go('evidence')}>Add evidence by hand</button>
      </div>
      {!ws.business.website && <p style={{ fontSize: 13, color: C.amber }}>Save the website in Business details to run the review.</p>}
      {err && <Notice tone="bad">{err}</Notice>}
      {res && <Notice tone="ok">Checked {res.checks.total} things on {res.website}: {res.checks.issues} issue{res.checks.issues === 1 ? '' : 's'}, {res.checks.ok} fine, {res.checks.unknown} could not be checked. {res.findings_proposed} new finding{res.findings_proposed === 1 ? '' : 's'} proposed for your review{res.findings_already_recorded ? `; ${res.findings_already_recorded} already recorded` : ''}.</Notice>}
    </Card>
  )
}

function PdfCard({ ws, org, caseId, reload, go }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const latest = ws.latest_report
  const draft = async () => { setBusy('draft'); setErr(''); setMsg(''); try { const r = await auditCall('draft-report', { org, method: 'POST', body: { case_id: caseId } }); setMsg(r.unchanged ? `Nothing changed since version ${r.report.version}.` : `Version ${r.report.version} drafted from the recorded evidence.`); await reload() } catch (e) { setErr(e.message) } setBusy('') }
  const pdf = async () => { setBusy('pdf'); setErr(''); setMsg(''); try { const r = await auditCall('pdf', { org, method: 'POST', body: { case_id: caseId, report_id: latest.id } }); setMsg(`${r.reused ? 'Already saved' : 'Saved'} in the Vault: ${r.document.file_name}`); await reload() } catch (e) { setErr(e.message) } setBusy('') }
  const pdfLatest = latest && ws.pdfs.find((p) => p.audit_report_id === latest.id)
  return (
    <Card title="Report and PDF" actions={<button className="ops-btn" onClick={() => go('report')}>All versions</button>}>
      <p style={{ fontSize: 14, marginTop: 0 }}>{latest ? <>Version {latest.version} · <Badge value={latest.status === 'approved' ? 'approved' : 'draft'} label={latest.status} /> · {when(latest.created_at)}</> : 'No report yet.'}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="ops-btn" disabled={!!busy || !ws.evidence.total} onClick={draft}>{busy === 'draft' ? 'Drafting…' : latest ? 'Draft a new version' : 'Draft the report'}</button>
        <button className="ops-btn primary" disabled={!!busy || !latest} onClick={pdf} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileText size={15} /> {busy === 'pdf' ? 'Generating…' : 'Generate PDF'}</button>
        {pdfLatest && <PdfButtons org={org} caseId={caseId} doc={pdfLatest} onError={setErr} />}
      </div>
      {!ws.evidence.total && <p style={{ fontSize: 13, color: C.faint }}>A report needs evidence first.</p>}
      {latest?.status !== 'approved' && latest && <p style={{ fontSize: 12, color: C.faint }}>A draft PDF is marked "Draft – not approved" on every page. Clients can only open approved versions.</p>}
      {msg && <Notice tone="ok">{msg}</Notice>}{err && <Notice tone="bad">{err}</Notice>}
    </Card>
  )
}

function PdfButtons({ org, caseId, doc, onError }) {
  const [busy, setBusy] = useState(false)
  const run = async (open) => { setBusy(true); try { await fetchPdf({ org, caseId, documentId: doc.id, fileName: doc.file_name, open }) } catch (e) { onError?.(`PDF not opened: ${e.message}`) } setBusy(false) }
  return <>
    <button className="ops-btn" disabled={busy} onClick={() => run(true)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ExternalLink size={15} /> Open</button>
    <button className="ops-btn" disabled={busy} onClick={() => run(false)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Download size={15} /> Download</button>
  </>
}

function ClockCard({ ws, org, caseId, reload, go }) {
  const c = ws.clock; const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const start = async () => { setBusy(true); setErr(''); try { await auditCall('cases', { org, method: 'POST', body: { action: 'mark-ready', id: caseId } }); await reload() } catch (e) { setErr(e.message) } setBusy(false) }
  const tone = c.state === 'running' ? 'ok' : c.state === 'ready_to_start' ? 'ok' : 'warn'
  return (
    <Card title="Delivery clock">
      <Notice tone={tone}>{c.message}</Notice>
      {c.state === 'inputs_missing' && <ul style={{ fontSize: 13, color: C.dim }}>{c.missing.map((m) => <li key={m.key}>{m.label} <span style={{ color: C.faint }}>(from {m.responsible === 'nova' ? 'Nova' : m.responsible === 'third_party' ? 'a third party' : 'the client'})</span></li>)}</ul>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['no_policy', 'policy_not_approved'].includes(c.state) && <button className="ops-btn primary" onClick={() => go('clock')}>{c.state === 'no_policy' ? 'Review the proposed policy' : 'Review and approve the policy'}</button>}
        {c.state === 'inputs_missing' && <button className="ops-btn primary" onClick={() => go('clock')}>Mark inputs received</button>}
        {c.state === 'ready_to_start' && <button className="ops-btn primary" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start the clock'}</button>}
        {['running', 'paused'].includes(c.state) && <button className="ops-btn" onClick={() => go('clock')}>Blockers and extensions</button>}
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      <p style={{ fontSize: 12, color: C.faint, marginBottom: 0 }}>The clock is a delivery commitment to the client. It never starts by itself, and the countdown does not trigger any background work.</p>
    </Card>
  )
}

// ------------------------------------------------------------------------------------------------ report & PDF section
function ReportSection({ ws, org, caseId, reports, reload }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(null); const [msg, setMsg] = useState('')
  const pdfFor = (r) => ws.pdfs.filter((p) => p.audit_report_id === r.id)
  const gen = async (r) => { setBusy(`pdf:${r.id}`); setErr(null); setMsg(''); try { const x = await auditCall('pdf', { org, method: 'POST', body: { case_id: caseId, report_id: r.id } }); setMsg(`${x.reused ? 'Already saved' : 'Saved'} in the Vault: ${x.document.file_name}`); await reload() } catch (e) { setErr({ text: e.message }) } setBusy('') }
  const approve = async (r) => {
    setBusy(`ap:${r.id}`); setErr(null); setMsg('')
    try { await auditCall('reports', { org, method: 'POST', body: { case_id: caseId, action: 'approve', id: r.id } }); setMsg(`Version ${r.version} approved. Its content is now locked.`); await reload() }
    catch (e) { setErr({ text: e.message, problems: e.body?.problems }) }
    setBusy('')
  }
  const draft = async () => { setBusy('draft'); setErr(null); setMsg(''); try { const r = await auditCall('draft-report', { org, method: 'POST', body: { case_id: caseId } }); setMsg(r.unchanged ? `Nothing changed since version ${r.report.version}.` : `Version ${r.report.version} drafted.`); await reload() } catch (e) { setErr({ text: e.message }) } setBusy('') }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Report versions" actions={<button className="ops-btn primary" disabled={!!busy} onClick={draft}>{busy === 'draft' ? 'Drafting…' : 'Draft from recorded evidence'}</button>}>
        {msg && <Notice tone="ok">{msg}</Notice>}
        {err && <Notice tone="bad">{err.text}{err.problems?.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{err.problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}</ul> : null}</Notice>}
        {!reports.length ? <p style={{ color: C.faint, fontSize: 13 }}>No versions yet.</p> : reports.map((r, i) => (
          <div key={r.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.line}`, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>Version {r.version}</strong><Badge value={r.status === 'approved' ? 'approved' : 'draft'} label={r.status} />
              <span style={{ fontSize: 12, color: C.faint }}>{when(r.created_at)}{i > 0 ? ' · superseded' : ' · current'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="ops-btn" disabled={!!busy} onClick={() => gen(r)}>{busy === `pdf:${r.id}` ? 'Generating…' : 'Generate PDF'}</button>
              {r.status !== 'approved' && i === 0 && <button className="ops-btn primary" disabled={!!busy} onClick={() => approve(r)}>{busy === `ap:${r.id}` ? 'Checking…' : 'Approve this version'}</button>}
              {pdfFor(r).slice(0, 1).map((d) => <PdfButtons key={d.id} org={org} caseId={caseId} doc={d} onError={(t) => setErr({ text: t })} />)}
            </div>
            {pdfFor(r).length > 0 && <div style={{ fontSize: 12, color: C.faint }}>In the Vault: {pdfFor(r).map((d) => `${d.file_name} (${Math.round((d.file_size || 0) / 1024)} KB, ${when(d.created_at)})`).join('; ')}</div>}
          </div>
        ))}
        <p style={{ fontSize: 12, color: C.faint }}>Approval checks every section, every finding (reviewed, evidence, confidence, action, impact, limitations, owner decision) and wording Nova does not use. The server lists exactly what is missing. Client links are made in More tools → Client delivery.</p>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ clock & policy
function ClockSection({ ws, org, caseId, isOwner, reload }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ClockCard ws={ws} org={org} caseId={caseId} reload={reload} go={() => {}} />
      <IntakeTab org={org} caseId={caseId} isOwner={isOwner} clock={ws.clock.clock || {}} onChanged={reload} />
    </div>
  )
}

function MoreTools({ org, caseId, findings, reports, recommendations, reload }) {
  const [tool, setTool] = useState('details')
  const tools = [['details', 'Finding details'], ['recommendations', 'Recommendations'], ['tests', 'Planned tests'], ['benchmarks', 'Competitors & software'], ['scenarios', 'Financial scenarios'], ['delivery', 'Client delivery']]
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div role="group" aria-label="Tools" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tools.map(([k, l]) => <button key={k} className={`ops-btn ${tool === k ? 'primary' : ''}`} aria-pressed={tool === k} onClick={() => setTool(k)}>{l}</button>)}</div>
      {tool === 'details' && <FindingDetailsTab org={org} caseId={caseId} findings={findings} onSaved={reload} />}
      {tool === 'recommendations' && <RecommendationsTab caseId={caseId} orgId={org} items={recommendations} findings={findings} onSaved={reload} />}
      {tool === 'tests' && <TestsTab org={org} caseId={caseId} />}
      {tool === 'benchmarks' && <BenchmarksTab org={org} caseId={caseId} />}
      {tool === 'scenarios' && <ScenariosTab org={org} caseId={caseId} findings={findings} />}
      {tool === 'delivery' && <DeliveryTab org={org} caseId={caseId} reports={reports} onSaved={reload} />}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ shared add form
// Keeps what was typed when the save fails (the old form cleared it either way), and keeps unsaved text on this device.
function AddForm({ fields, onSubmit, submitLabel, storageKey }) {
  const blank = Object.fromEntries(fields.map((f) => [f.key, f.default || '']))
  const [values, setValues] = useState(() => ({ ...blank, ...(storageKey ? local.get(storageKey) || {} : {}) }))
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState(null)
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (storageKey) local.set(storageKey, Object.values(values).some((x) => String(x || '').trim()) ? values : null) }, [values, storageKey])
  const requiredMissing = fields.some((f) => f.required && !String(values[f.key] || '').trim())
  const submit = async () => {
    setSaving(true); setState({ kind: 'saving' })
    const ok = await onSubmit(values)
    if (ok) { setValues(blank); if (storageKey) local.set(storageKey, null); setState({ kind: 'saved', at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }) }
    else setState({ kind: 'failed', text: 'Not saved. Your text is still here.' })
    setSaving(false)
  }
  return (
    <Card>
      {fields.map((f) => (
        <Field key={f.key} label={`${f.label}${f.required ? ' (required)' : ''}`} id={`af-${storageKey}-${f.key}`}>
          {f.type === 'select' ? (
            <select id={`af-${storageKey}-${f.key}`} className="ops-select" value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
              <option value="">Choose…</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea id={`af-${storageKey}-${f.key}`} className="ops-textarea" rows={3} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} />
          ) : (
            <input id={`af-${storageKey}-${f.key}`} className="ops-input" value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} />
          )}
        </Field>
      ))}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="ops-btn primary" onClick={submit} disabled={requiredMissing || saving} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={15} /> {saving ? 'Saving…' : submitLabel}</button>
        <SaveState state={state} />
      </div>
    </Card>
  )
}

async function postAudit(op, body) {
  const r = await authedFetch(`/api/client?resource=audit&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data: d }
}
const Problems = ({ problems, title }) => (problems?.length ? <Notice tone="bad"><strong>{title}</strong><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></Notice> : null)

function EvidenceTab({ caseId, orgId, items, onSaved }) {
  const [problems, setProblems] = useState([])
  const submit = async (v) => {
    setProblems([])
    const { ok, data } = await postAudit('evidence', { organization_id: orgId, case_id: caseId, source: v.source, method: v.method, observation: v.observation, source_quality: v.source_quality, confidence: v.confidence })
    if (!ok) { setProblems([data.error || 'The evidence was not saved.']); return false }
    await onSaved(); return true
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Problems problems={problems} title="Not saved" />
      <AddForm storageKey={`nova.audit.evidence:${caseId}`} submitLabel="Add evidence" onSubmit={submit} fields={[
        { key: 'source', label: 'Source', required: true, placeholder: 'Owner-provided call log, Google Business Profile, test call…' },
        { key: 'method', label: 'Method', placeholder: 'Manual review, owner export, test call…' },
        { key: 'observation', label: 'Observation', required: true, type: 'textarea', placeholder: 'Exactly what was observed or provided: fact only, not an interpretation.' },
        { key: 'source_quality', label: 'Source quality', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'unavailable', label: 'Unavailable' }] },
        { key: 'confidence', label: 'Confidence', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
      ]} />
      <Card title={`Recorded evidence · ${items.length}`}>
        {!items.length ? <p style={{ color: C.faint, fontSize: 13 }}>No evidence recorded yet.</p> : items.map((e) => (
          <details key={e.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 14 }}>{e.observation.slice(0, 140)}{e.observation.length > 140 ? '…' : ''} <span style={{ color: C.faint, fontSize: 12 }}>· {e.confidence || 'unrated'} confidence · {when(e.capture_date)}</span></summary>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}><div>{e.observation}</div><div style={{ color: C.faint, marginTop: 4 }}>Source: {e.source}</div><div style={{ color: C.faint }}>Method: {e.method || '—'} · recorded by {e.author || '—'}</div></div>
          </details>
        ))}
      </Card>
    </div>
  )
}

function FindingsTab({ caseId, orgId, items, evidence, onSaved }) {
  const [selectedEvidence, setSelectedEvidence] = useState([])
  const [problems, setProblems] = useState([])
  const [type, setType] = useState('')
  const [busy, setBusy] = useState('')
  const submit = async (v) => {
    setProblems([])
    const { ok, data } = await postAudit('findings', { organization_id: orgId, case_id: caseId, ...v, statement_type: type, evidence_ids: selectedEvidence })
    if (!ok) { setProblems(data.problems || [data.error || 'The finding was not saved.']); return false }
    setSelectedEvidence([]); await onSaved(); return true
  }
  const review = async (id, review_status) => {
    setBusy(id); setProblems([])
    const { ok, data } = await postAudit('findings', { organization_id: orgId, case_id: caseId, action: 'review', id, review_status })
    if (!ok) setProblems(data.problems || [data.error || 'The review was not saved.']); else await onSaved()
    setBusy('')
  }
  const order = { high: 0, medium: 1, low: 2 }
  const sorted = [...items].sort((a, b) => (a.review_status === 'rejected') - (b.review_status === 'rejected') || (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Problems problems={problems} title="Not saved" />
      <Card title={`Findings · ${items.filter((f) => f.review_status !== 'rejected').length}`}>
        {!items.length ? <p style={{ color: C.faint, fontSize: 13 }}>No findings yet. Run the evidence review on the Overview, or add one below.</p> : sorted.map((f) => (
          <div key={f.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.line}`, opacity: f.review_status === 'rejected' ? 0.55 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge value={f.priority === 'high' ? 'failed' : f.priority === 'medium' ? 'pending' : 'unknown'} label={f.priority || 'no priority'} />
              <Badge value={f.review_status === 'reviewed' ? 'approved' : f.review_status === 'rejected' ? 'cancelled' : 'draft'} label={f.review_status === 'draft' ? (f.origin === 'automated_review' ? 'proposed by review' : 'draft') : f.review_status} />
              <span style={{ fontSize: 12, color: C.faint }}>{String(f.statement_type).replace('_', ' ')}{f.confidence ? ` · ${f.confidence} confidence` : ''}</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 4px' }}>{f.title}</p>
            <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>{f.detail}</p>
            {f.customer_impact && <p style={{ fontSize: 13, color: C.dim, margin: '4px 0 0' }}><strong style={{ color: C.text }}>Why it matters:</strong> {f.customer_impact}</p>}
            {f.recommended_action && <p style={{ fontSize: 13, color: C.dim, margin: '4px 0 0' }}><strong style={{ color: C.text }}>Next step:</strong> {f.recommended_action}</p>}
            {f.limitations && <p style={{ fontSize: 12, color: C.faint, margin: '4px 0 0' }}>{f.limitations}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {f.review_status !== 'reviewed' && <button className="ops-btn" disabled={busy === f.id} onClick={() => review(f.id, 'reviewed')}>Confirm (mark reviewed)</button>}
              {f.review_status !== 'rejected' && <button className="ops-btn danger" disabled={busy === f.id} onClick={() => review(f.id, 'rejected')}>Reject</button>}
              {f.review_status === 'rejected' && <button className="ops-btn" disabled={busy === f.id} onClick={() => review(f.id, 'draft')}>Restore</button>}
            </div>
          </div>
        ))}
      </Card>
      <details><summary style={{ cursor: 'pointer', color: C.gold, fontSize: 14, padding: '8px 0' }}>Add a finding by hand</summary>
        <Card>
          {evidence.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: C.dim, margin: '0 0 8px' }}>Link evidence (required for facts, owner statements and inferences)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {evidence.slice(-30).map((e) => { const on = selectedEvidence.includes(e.id); return <button key={e.id} type="button" aria-pressed={on} onClick={() => setSelectedEvidence((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))} className="ops-btn" style={{ fontSize: 12, padding: '6px 10px', background: on ? 'rgba(201,168,76,0.15)' : 'transparent', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.observation.slice(0, 60)}</button> })}
              </div>
            </div>
          )}
          <Field label="Statement type" id="nf-type"><select id="nf-type" className="ops-select" value={type} onChange={(e) => setType(e.target.value)}><option value="">Choose…</option>{[['observed_fact', 'Observed fact'], ['stated_claim', 'Owner statement'], ['inference', 'Inference'], ['estimate', 'Estimate (range + assumptions)'], ['unknown', 'Unknown / cannot be determined']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          {type && <AddForm key={type} storageKey={`nova.audit.finding:${caseId}:${type}`} submitLabel="Add finding" onSubmit={submit} fields={[
            { key: 'title', label: 'Title', required: true, placeholder: 'No click-to-call link on the home page' },
            { key: 'detail', label: 'Detail', required: true, type: 'textarea', placeholder: type === 'unknown' ? 'What cannot be determined and what would be needed.' : 'What was observed, separate from what is inferred.' },
            ...(type !== 'unknown' ? [{ key: 'confidence', label: 'Confidence', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] }, { key: 'recommended_action', label: 'Recommended action', placeholder: 'What the business should do about it' }] : []),
            ...(type === 'estimate' ? [{ key: 'estimate_low', label: 'Estimate, low', required: true }, { key: 'estimate_high', label: 'Estimate, high', required: true }, { key: 'estimate_unit', label: 'Unit', placeholder: 'USD per month, calls per week…' }, { key: 'estimate_assumptions', label: 'Assumptions', required: true, type: 'textarea', placeholder: 'Every input behind the range, and where each came from.' }] : []),
            { key: 'priority', label: 'Priority', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
          ]} />}
        </Card>
      </details>
    </div>
  )
}

function RecommendationsTab({ caseId, orgId, items, findings, onSaved }) {
  const [problems, setProblems] = useState([])
  const submit = async (v) => {
    setProblems([])
    const { ok, data } = await postAudit('recommendations', { organization_id: orgId, case_id: caseId, finding_id: v.finding_id || null, mechanism: v.mechanism, impact_estimate: v.impact_estimate, effort_range: v.effort_range, cost_range: v.cost_range, verification_plan: v.verification_plan })
    if (!ok) { setProblems([data.error || 'The recommendation was not saved.']); return false }
    await onSaved(); return true
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Problems problems={problems} title="Not saved" />
      <AddForm storageKey={`nova.audit.rec:${caseId}`} submitLabel="Add recommendation" onSubmit={submit} fields={[
        { key: 'finding_id', label: 'Linked finding', type: 'select', options: findings.map((f) => ({ value: f.id, label: f.title.slice(0, 80) })) },
        { key: 'mechanism', label: 'What to do', required: true, type: 'textarea', placeholder: 'What to do and why it addresses the finding.' },
        { key: 'impact_estimate', label: 'Impact estimate', placeholder: 'Range with stated assumptions, never an invented dollar figure.' },
        { key: 'effort_range', label: 'Effort', placeholder: 'e.g. 2–4 hours' },
        { key: 'cost_range', label: 'Cost', placeholder: 'e.g. $0 (included) or $150–300' },
        { key: 'verification_plan', label: 'How we will verify it worked' },
      ]} />
      <Card title={`Recommendations · ${items.length}`}>{!items.length ? <p style={{ color: C.faint, fontSize: 13 }}>None yet. Without any, the report uses each finding's recommended next step.</p> : items.map((r) => <p key={r.id} style={{ fontSize: 14, borderBottom: `1px solid ${C.line}`, padding: '8px 0', margin: 0 }}>{r.mechanism} <span style={{ color: C.faint, fontSize: 12 }}>{r.effort_range ? `· ${r.effort_range}` : ''}</span></p>)}</Card>
    </div>
  )
}
