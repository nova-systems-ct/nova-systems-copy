import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, PlayCircle, PauseCircle, FileText, Lightbulb, ListChecks, FileCheck2, Send, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, marginBottom: 20 }
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }

const STATUS_FLOW = ['intake', 'inputs_pending', 'ready', 'researching', 'evidence_gathered', 'findings_drafted', 'report_draft', 'qa_review', 'approved', 'delivered', 'customer_decision', 'implementation', 'outcome_tracking', 'closed']

function fmtRemaining(seconds) {
  if (seconds == null) return '—'
  const abs = Math.abs(seconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  return `${seconds < 0 ? '-' : ''}${h}h ${m}m`
}

export default function AuditCaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('evidence')
  const [evidence, setEvidence] = useState([])
  const [findings, setFindings] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrg) return
    setError('')
    try {
      const caseRes = await authedFetch(`/api/client?resource=audit&op=cases&organization_id=${encodeURIComponent(currentOrg.id)}&id=${encodeURIComponent(id)}`)
      if (!caseRes.ok) throw new Error((await caseRes.json().catch(() => ({}))).error || 'Failed to load case')
      setData(await caseRes.json())
      const [evRes, fRes, rRes, repRes] = await Promise.all([
        authedFetch(`/api/client?resource=audit&op=evidence&organization_id=${encodeURIComponent(currentOrg.id)}&case_id=${encodeURIComponent(id)}`),
        authedFetch(`/api/client?resource=audit&op=findings&organization_id=${encodeURIComponent(currentOrg.id)}&case_id=${encodeURIComponent(id)}`),
        authedFetch(`/api/client?resource=audit&op=recommendations&organization_id=${encodeURIComponent(currentOrg.id)}&case_id=${encodeURIComponent(id)}`),
        authedFetch(`/api/client?resource=audit&op=reports&organization_id=${encodeURIComponent(currentOrg.id)}&case_id=${encodeURIComponent(id)}`),
      ])
      setEvidence(evRes.ok ? await evRes.json() : [])
      setFindings(fRes.ok ? await fRes.json() : [])
      setRecommendations(rRes.ok ? await rRes.json() : [])
      setReports(repRes.ok ? await repRes.json() : [])
    } catch (e) {
      setError(e.message)
    }
  }, [currentOrg, id])

  useEffect(() => { load() }, [load])

  const doAction = async (action, extra = {}) => {
    setBusy(true)
    try {
      const r = await authedFetch('/api/client?resource=audit&op=cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organization_id: currentOrg.id, id, ...extra }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Action failed')
      await load()
    } catch (e) {
      alert(e.message)
    }
    setBusy(false)
  }

  if (error) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>
        <button onClick={() => navigate('/dashboard/audit')} style={{ marginTop: 16, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← Back to Cases</button>
      </div>
    )
  }
  if (!data) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  const clock = data.clock || {}
  const latestReport = reports[0]

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <button onClick={() => navigate('/dashboard/audit')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> All Cases
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>{data.scope === '360' ? '360 Audit' : 'Digital Audit'}</p>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>Case {data.id.slice(0, 8)}</h1>
        </div>
        <select value={data.status} onChange={(e) => doAction('update-status', { status: e.target.value })} disabled={busy} style={{ ...inp, width: 'auto', appearance: 'none', cursor: 'pointer' }}>
          {STATUS_FLOW.map((s) => <option key={s} value={s} style={{ background: '#111' }}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Clock panel */}
      <div style={CARD}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Deadline Clock</p>
        {!data.start_condition_met_at ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Clock has not started — intake/access requirements not yet confirmed satisfied.</p>
            <button onClick={() => doAction('mark-ready')} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <PlayCircle style={{ width: 14, height: 14 }} /> Start Clock (Inputs Confirmed)
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{fmtRemaining(clock.remainingSeconds)} {clock.remainingSeconds < 0 ? 'overdue' : 'remaining'}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>
                Due {clock.dueAt ? new Date(clock.dueAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'} · {data.target_hours}h target ({data.clock_basis === 'business_hours' ? 'business hours' : 'elapsed'}) · {Math.round((data.total_paused_seconds || 0) / 60)}m paused so far
              </p>
            </div>
            {data.paused_at ? (
              <button onClick={() => doAction('resume')} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <PlayCircle style={{ width: 14, height: 14 }} /> Resume
              </button>
            ) : (
              <button onClick={() => { const reason = window.prompt('Reason for pausing (e.g. waiting on client access)?'); if (reason != null) doAction('pause', { reason }) }} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <PauseCircle style={{ width: 14, height: 14 }} /> Pause
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
        {[['evidence', 'Evidence', FileText, evidence.length], ['findings', 'Findings', Lightbulb, findings.length], ['recommendations', 'Recommendations', ListChecks, recommendations.length], ['report', 'Report', FileCheck2, reports.length]].map(([key, label, Icon, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? GOLD : 'transparent'}`, color: tab === key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <Icon style={{ width: 13, height: 13 }} /> {label} {count > 0 && `(${count})`}
          </button>
        ))}
      </div>

      {tab === 'evidence' && <EvidenceTab caseId={id} orgId={currentOrg.id} items={evidence} onSaved={load} />}
      {tab === 'findings' && <FindingsTab caseId={id} orgId={currentOrg.id} items={findings} evidence={evidence} onSaved={load} />}
      {tab === 'recommendations' && <RecommendationsTab caseId={id} orgId={currentOrg.id} items={recommendations} findings={findings} onSaved={load} />}
      {tab === 'report' && <ReportTab caseId={id} orgId={currentOrg.id} reports={reports} onSaved={load} />}
    </div>
  )
}

function AddForm({ fields, onSubmit, submitLabel }) {
  const [values, setValues] = useState(Object.fromEntries(fields.map((f) => [f.key, f.default || ''])))
  const [saving, setSaving] = useState(false)
  const requiredMissing = fields.some((f) => f.required && !String(values[f.key] || '').trim())
  return (
    <div style={{ ...CARD, marginBottom: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={lbl}>{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'select' ? (
              <select value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="" style={{ background: '#111' }}>Select…</option>
                {f.options.map((o) => <option key={o.value} value={o.value} style={{ background: '#111' }}>{o.label}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder={f.placeholder} />
            ) : (
              <input value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={inp} placeholder={f.placeholder} />
            )}
          </div>
        ))}
        <button
          onClick={async () => { setSaving(true); await onSubmit(values); setValues(Object.fromEntries(fields.map((f) => [f.key, f.default || '']))); setSaving(false) }}
          disabled={requiredMissing || saving}
          style={{ padding: '10px 16px', background: requiredMissing ? '#161410' : G, border: 'none', borderRadius: 8, color: requiredMissing ? 'rgba(255,255,255,0.25)' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: requiredMissing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
        >
          <Plus style={{ width: 13, height: 13 }} /> {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

function EvidenceTab({ caseId, orgId, items, onSaved }) {
  const submit = async (v) => {
    const r = await authedFetch('/api/client?resource=audit&op=evidence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, case_id: caseId, source: v.source, method: v.method, observation: v.observation, source_quality: v.source_quality, confidence: v.confidence }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to save evidence'); return }
    onSaved()
  }
  return (
    <div>
      <AddForm submitLabel="Add Evidence" onSubmit={submit} fields={[
        { key: 'source', label: 'Source', required: true, placeholder: 'Google Business Profile, live site scan, phone test…' },
        { key: 'method', label: 'Method', placeholder: 'Manual review, automated scan, test call…' },
        { key: 'observation', label: 'Observation', required: true, type: 'textarea', placeholder: 'Exactly what was observed — fact only, not an interpretation.' },
        { key: 'source_quality', label: 'Source Quality', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'unavailable', label: 'Unavailable' }] },
        { key: 'confidence', label: 'Confidence', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
      ]} />
      {items.length === 0 ? <EmptyRow text="No evidence recorded yet." /> : items.map((e) => (
        <Row key={e.id} title={e.source} sub={e.observation} tag={e.confidence ? `${e.confidence} confidence` : null} date={e.capture_date} />
      ))}
    </div>
  )
}

function FindingsTab({ caseId, orgId, items, evidence, onSaved }) {
  const [selectedEvidence, setSelectedEvidence] = useState([])
  const submit = async (v) => {
    const r = await authedFetch('/api/client?resource=audit&op=findings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, case_id: caseId, title: v.title, statement_type: v.statement_type, detail: v.detail, priority: v.priority, evidence_ids: selectedEvidence }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to save finding'); return }
    setSelectedEvidence([])
    onSaved()
  }
  return (
    <div>
      {evidence.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ ...lbl, marginBottom: 8 }}>Link Evidence (optional)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {evidence.map((e) => {
              const on = selectedEvidence.includes(e.id)
              return (
                <button key={e.id} onClick={() => setSelectedEvidence((s) => on ? s.filter((x) => x !== e.id) : [...s, e.id])} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, background: on ? `${GOLD}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? GOLD + '50' : 'rgba(255,255,255,0.1)'}`, color: on ? GOLD : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {e.source}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <AddForm submitLabel="Add Finding" onSubmit={submit} fields={[
        { key: 'title', label: 'Title', required: true, placeholder: 'Broken contact form' },
        { key: 'statement_type', label: 'Statement Type', required: true, type: 'select', options: [{ value: 'observed_fact', label: 'Observed Fact' }, { value: 'stated_claim', label: 'Stated Claim (from customer)' }, { value: 'inference', label: 'Inference' }, { value: 'estimate', label: 'Estimate' }] },
        { key: 'detail', label: 'Detail', required: true, type: 'textarea', placeholder: 'Full description, distinguishing what was observed from what is being inferred.' },
        { key: 'priority', label: 'Priority', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
      ]} />
      {items.length === 0 ? <EmptyRow text="No findings drafted yet." /> : items.map((f) => (
        <Row key={f.id} title={f.title} sub={f.detail} tag={f.statement_type.replace('_', ' ')} date={f.created_at} />
      ))}
    </div>
  )
}

function RecommendationsTab({ caseId, orgId, items, findings, onSaved }) {
  const submit = async (v) => {
    const r = await authedFetch('/api/client?resource=audit&op=recommendations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, case_id: caseId, finding_id: v.finding_id || null, mechanism: v.mechanism, impact_estimate: v.impact_estimate, effort_range: v.effort_range, cost_range: v.cost_range, verification_plan: v.verification_plan }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to save recommendation'); return }
    onSaved()
  }
  return (
    <div>
      <AddForm submitLabel="Add Recommendation" onSubmit={submit} fields={[
        { key: 'finding_id', label: 'Linked Finding', type: 'select', options: findings.map((f) => ({ value: f.id, label: f.title })) },
        { key: 'mechanism', label: 'Mechanism', required: true, type: 'textarea', placeholder: 'What to do and why it addresses the finding.' },
        { key: 'impact_estimate', label: 'Impact Estimate', placeholder: 'Range with stated assumptions — never an invented dollar figure.' },
        { key: 'effort_range', label: 'Effort Range', placeholder: 'e.g. 2-4 hours' },
        { key: 'cost_range', label: 'Cost Range', placeholder: 'e.g. $0 (included) or $150-300' },
        { key: 'verification_plan', label: 'Verification Plan', placeholder: 'How we would confirm this worked.' },
      ]} />
      {items.length === 0 ? <EmptyRow text="No recommendations yet." /> : items.map((r) => (
        <Row key={r.id} title={r.mechanism} sub={r.impact_estimate} tag={r.effort_range} date={r.created_at} />
      ))}
    </div>
  )
}

function ReportTab({ caseId, orgId, reports, onSaved }) {
  const [creating, setCreating] = useState(false)
  const createDraft = async () => {
    setCreating(true)
    const r = await authedFetch('/api/client?resource=audit&op=reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, case_id: caseId, action: 'create-draft', content: {} }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to create draft'); setCreating(false); return }
    onSaved()
    setCreating(false)
  }
  const approve = async (id) => {
    if (!window.confirm('Approve this exact report version? Any further edits will require a new version.')) return
    const r = await authedFetch('/api/client?resource=audit&op=reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, case_id: caseId, action: 'approve', id }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to approve'); return }
    onSaved()
  }
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={createDraft} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus style={{ width: 13, height: 13 }} /> {creating ? 'Creating…' : `New Draft (v${(reports[0]?.version || 0) + 1})`}
        </button>
      </div>
      {reports.length === 0 ? <EmptyRow text="No report versions yet." /> : reports.map((r) => (
        <div key={r.id} style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Version {r.version}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          {r.status === 'approved' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', color: '#4ade80', textTransform: 'uppercase' }}>
              <FileCheck2 style={{ width: 12, height: 12 }} /> Approved — Immutable
            </span>
          ) : (
            <button onClick={() => approve(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${GOLD}40`, borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Send style={{ width: 12, height: 12 }} /> Approve This Version
            </button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(201,168,76,0.06)', border: `1px solid ${GOLD}20`, borderRadius: 10 }}>
        <AlertTriangle style={{ width: 14, height: 14, color: GOLD, flexShrink: 0, marginTop: 2 }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6 }}>
          A full branded PDF/report-content builder is not yet implemented (docs/PRODUCT_BUILD_STATE.md) — this tracks real, immutable, versioned report records with delivery status. The rendered document itself is the next dependency-ready increment.
        </p>
      </div>
    </div>
  )
}

function Row({ title, sub, tag, date }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 8, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{title}</p>
        {sub && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>{sub}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {tag && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase' }}>{tag}</span>}
        {date && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
      </div>
    </div>
  )
}

function EmptyRow({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{text}</p>
    </div>
  )
}
