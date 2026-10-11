import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useOrg } from '../../lib/OrgContext'
import { api, Banner, Btn, Field, Tabs, Pill, fmt, CARD, GOLD, inp, lbl } from '../../components/dashboard/pilotUi'

const STATUS_NEXT = { proposed: ['agreed', 'closed'], agreed: ['onboarding', 'closed'], onboarding: ['active', 'closed'], active: ['review', 'closed'], review: ['converted', 'extended', 'closed'], extended: ['review', 'closed'], converted: [], closed: [] }
const PERMISSION_KINDS = [['business_name', 'Use the business name'], ['logo', 'Use the logo'], ['quotation', 'Quote them'], ['video', 'Video testimonial'], ['case_study', 'Written case study']]
const INTERVIEW_PROMPTS = [
  'Before this pilot, how did you handle calls and messages you could not answer? (Ask for a specific recent example.)',
  'What did you see change during the pilot? Ask for what they noticed, not what we hope they say.',
  'Was there anything that did not work, or that you had to fix by hand?',
  'Which numbers do you trust from this pilot, and which do you not yet?',
  'Would you continue paying for this? What would have to be true for the answer to be yes?',
  'Only if they offer: is there anything you are comfortable with us quoting? (Recorded separately, per use — never assumed.)',
]

// Pilot records for the CURRENT organization (the client's org). Every status change, go-live and
// permission is enforced server-side (api/_wave1Api.js); this page shows the server's real refusal reasons.
export default function Pilots() {
  const { currentOrg } = useOrg()
  const [pilots, setPilots] = useState([])
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const orgId = currentOrg?.id

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const r = await api('wave1', 'pilots', { query: { organization_id: orgId } })
    if (r.ok) { setPilots(r.data); setErr('') } else setErr(r.data.error || 'Failed to load pilots — has the Wave One migration been applied?')
    setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const create = async () => {
    const r = await api('wave1', 'pilots', { method: 'POST', body: { organization_id: orgId, action: 'create', name } })
    if (!r.ok) { setErr(r.data.error || 'Failed'); return }
    setName(''); await load(); setSel(r.data.pilot.id)
  }
  if (!orgId) return null
  const pilot = pilots.find((p) => p.id === sel)

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
      <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Pilots</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 24 }}>Pilot records for {currentOrg.name}. Switch organization (top left) to manage another client's pilot.</p>
      <Banner>{err}</Banner>
      {loading ? <Loader2 style={{ width: 26, height: 26, color: GOLD, animation: 'spin 1s linear infinite' }} /> : !pilot ? (
        <>
          <div style={CARD}>
            <p style={lbl}>New pilot</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ace Plumbing — Wave One pilot" style={inp} />
              <Btn onClick={create} disabled={!name.trim()}><Plus style={{ width: 12, height: 12, verticalAlign: -2 }} /> Create</Btn>
            </div>
          </div>
          {pilots.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No pilots for this organization yet.</p> : pilots.map((p) => (
            <div key={p.id} onClick={() => setSel(p.id)} style={{ ...CARD, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', marginBottom: 10 }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{p.name}</span>
              <Pill text={p.status} tone={p.status === 'active' ? 'good' : p.status === 'closed' ? 'bad' : 'warn'} />
            </div>
          ))}
        </>
      ) : <PilotDetail key={pilot.id} pilot={pilot} orgId={orgId} onBack={() => { setSel(null); load() }} onChanged={load} />}
    </div>
  )
}

function PilotDetail({ pilot, orgId, onBack, onChanged }) {
  const [tab, setTab] = useState('overview')
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: 'inherit' }}>← All pilots</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{pilot.name}</h2>
        <Pill text={pilot.status} tone={pilot.status === 'active' ? 'good' : 'warn'} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['checklist', 'Install & acceptance'], ['permissions', 'Permissions'], ['results', 'Results'], ['interview', 'Interview']]} />
      {tab === 'overview' && <Overview pilot={pilot} orgId={orgId} onChanged={onChanged} />}
      {tab === 'checklist' && <Checklist pilot={pilot} orgId={orgId} />}
      {tab === 'permissions' && <Permissions pilot={pilot} orgId={orgId} />}
      {tab === 'results' && <Results pilot={pilot} orgId={orgId} />}
      {tab === 'interview' && <Interview />}
    </div>
  )
}

function Overview({ pilot, orgId, onChanged }) {
  const [form, setForm] = useState({ start_date: pilot.start_date || '', end_date: pilot.end_date || '', baseline_start: pilot.baseline_start || '', baseline_end: pilot.baseline_end || '', provider_cost_payer: pilot.provider_cost_payer || '', support_contact: pilot.support_contact || '', rollback_plan: pilot.rollback_plan || '', offboarding_plan: pilot.offboarding_plan || '' })
  const [agr, setAgr] = useState({ agreement_status: pilot.agreement_status === 'not_sent' ? 'draft' : pilot.agreement_status, agreement_version: pilot.agreement_version || '', agreement_evidence: '' })
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState(null)
  const post = async (body, okText) => {
    const r = await api('wave1', 'pilots', { method: 'POST', body: { organization_id: orgId, pilot_id: pilot.id, ...body } })
    setMsg(r.ok ? { kind: 'ok', t: okText } : { kind: 'error', t: [r.data.error, ...(r.data.open || [])].filter(Boolean).join(' — ') })
    if (r.ok) onChanged()
  }
  const S = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const next = STATUS_NEXT[pilot.status] || []
  return (
    <div>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      <div style={CARD}>
        <p style={lbl}>Agreement</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>Nova has no agreement template in this system. Use a template your attorney has reviewed, then record its version and how acceptance was evidenced here. Nothing in this system is labeled legally approved.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Status"><select value={agr.agreement_status} onChange={(e) => setAgr((a) => ({ ...a, agreement_status: e.target.value }))} style={inp}>{['draft', 'sent', 'accepted', 'declined'].map((s) => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}</select></Field>
          <Field label="Template version"><input value={agr.agreement_version} onChange={(e) => setAgr((a) => ({ ...a, agreement_version: e.target.value }))} style={inp} /></Field>
        </div>
        {agr.agreement_status === 'accepted' && <Field label="Acceptance evidence (signed-document or email reference)"><input value={agr.agreement_evidence} onChange={(e) => setAgr((a) => ({ ...a, agreement_evidence: e.target.value }))} style={inp} /></Field>}
        <Btn small onClick={() => post({ action: 'record-agreement', ...agr }, 'Agreement recorded')}>Record</Btn>
        {pilot.agreement_accepted_at && <p style={{ color: '#4ade80', fontSize: 11, marginTop: 8 }}>Accepted {fmt(pilot.agreement_accepted_at)} — {pilot.agreement_evidence}</p>}
      </div>
      <div style={CARD}>
        <p style={lbl}>Plan</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Baseline start"><input type="date" value={form.baseline_start} onChange={S('baseline_start')} style={inp} /></Field>
          <Field label="Baseline end"><input type="date" value={form.baseline_end} onChange={S('baseline_end')} style={inp} /></Field>
          <Field label="Pilot start"><input type="date" value={form.start_date} onChange={S('start_date')} style={inp} /></Field>
          <Field label="Pilot end"><input type="date" value={form.end_date} onChange={S('end_date')} style={inp} /></Field>
        </div>
        <Field label="Who pays provider costs (must be agreed before go-live)"><select value={form.provider_cost_payer} onChange={S('provider_cost_payer')} style={inp}><option value="" style={{ background: '#111' }}>Not agreed yet</option>{['nova', 'client', 'shared'].map((s) => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}</select></Field>
        <Field label="Support contact"><input value={form.support_contact} onChange={S('support_contact')} style={inp} /></Field>
        <Field label="Rollback plan"><textarea rows={2} value={form.rollback_plan} onChange={S('rollback_plan')} style={{ ...inp, resize: 'vertical' }} /></Field>
        <Field label="Offboarding plan (export + retention)"><textarea rows={2} value={form.offboarding_plan} onChange={S('offboarding_plan')} style={{ ...inp, resize: 'vertical' }} /></Field>
        <Btn small onClick={() => post({ action: 'update', ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')) }, 'Plan saved')}>Save plan</Btn>
      </div>
      <div style={CARD}>
        <p style={lbl}>Move status (currently {pilot.status})</p>
        {next.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>This pilot is {pilot.status}: no further moves.{pilot.outcome_reason ? ` Outcome reason: ${pilot.outcome_reason}` : ''}</p> : (
          <>
            {next.some((n) => ['converted', 'extended', 'closed'].includes(n)) && <Field label="Outcome reason (required to convert, extend or close)"><input value={reason} onChange={(e) => setReason(e.target.value)} style={inp} placeholder="What actually happened — not what we hoped" /></Field>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {next.map((n) => <Btn key={n} kind={n === 'closed' ? 'danger' : 'secondary'} small onClick={() => post({ action: 'set-status', status: n, outcome_reason: reason }, `Moved to ${n}`)}>{n}</Btn>)}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>Going active is refused until the agreement is accepted with evidence, provider costs are assigned, and every acceptance and go-live check has evidence.</p>
          </>
        )}
      </div>
    </div>
  )
}

function Checklist({ pilot, orgId }) {
  const [items, setItems] = useState([])
  const [pre, setPre] = useState(null)
  const [msg, setMsg] = useState(null)
  const load = useCallback(async () => {
    const [c, p] = await Promise.all([api('wave1', 'pilot-checklist', { query: { organization_id: orgId, pilot_id: pilot.id } }), api('wave1', 'preflight', { query: { organization_id: orgId } })])
    if (c.ok) setItems(c.data); if (p.ok) setPre(p.data)
  }, [orgId, pilot.id])
  useEffect(() => { load() }, [load])
  const seed = async () => { const r = await api('wave1', 'pilot-checklist', { method: 'POST', body: { organization_id: orgId, pilot_id: pilot.id, action: 'seed' } }); setMsg(r.ok ? { kind: 'ok', t: 'Standard checklist created' } : { kind: 'error', t: r.data.error }); load() }
  const mark = async (item, status) => {
    let evidence = ''
    if (status === 'passed') { evidence = window.prompt(`Evidence for "${item.label}" — what was observed, when, by whom:`) || ''; if (!evidence.trim()) return }
    const r = await api('wave1', 'pilot-checklist', { method: 'POST', body: { organization_id: orgId, pilot_id: pilot.id, item_key: item.item_key, status, evidence } })
    setMsg(r.ok ? null : { kind: 'error', t: r.data.error }); load()
  }
  return (
    <div>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      <div style={CARD}>
        <p style={lbl}>Automated preflight (this organization + this deployment)</p>
        {pre && <p style={{ color: pre.ready ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{pre.ready ? 'All automated checks pass' : 'Not ready'}</p>}
        {pre?.checks.map((c) => (
          <div key={c.key} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ width: 70 }}><Pill text={c.status} tone={c.status === 'pass' ? 'good' : c.status === 'fail' ? 'bad' : 'warn'} /></span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 }}>{c.key.replace(/_/g, ' ')}{c.detail ? <span style={{ color: 'rgba(255,255,255,0.35)' }}> — {c.detail}</span> : null}</span>
          </div>
        ))}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10 }}>"Unknown" means this system cannot check it (worker running, provider webhook registration). Verify by hand.</p>
      </div>
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ ...lbl, marginBottom: 0 }}>Installation checklist</p>
          {items.length === 0 && <Btn small onClick={seed}>Create standard checklist</Btn>}
        </div>
        {items.map((i) => (
          <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
            <span style={{ width: 72 }}><Pill text={i.phase.replace('_', ' ')} tone="neutral" /></span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: '#fff', fontSize: 12 }}>{i.label}</p>
              {i.evidence && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>Evidence: {i.evidence} ({fmt(i.checked_at)})</p>}
            </div>
            <Pill text={i.status} tone={i.status === 'passed' ? 'good' : i.status === 'failed' ? 'bad' : 'warn'} />
            <Btn small kind="secondary" onClick={() => mark(i, 'passed')}>Passed…</Btn>
            <Btn small kind="danger" onClick={() => mark(i, 'failed')}>Failed</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}

function Permissions({ pilot, orgId }) {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)
  const load = useCallback(async () => { const r = await api('wave1', 'pilot-permissions', { query: { organization_id: orgId, pilot_id: pilot.id } }); if (r.ok) setRows(r.data) }, [orgId, pilot.id])
  useEffect(() => { load() }, [load])
  const by = Object.fromEntries(rows.map((r) => [r.kind, r]))
  const grant = async (kind) => {
    const who = window.prompt('Name of the person who gave this permission:'); if (!who) return
    const ev = window.prompt('How was it given? (email date, signed form, recorded call…)'); if (!ev) return
    const r = await api('wave1', 'pilot-permissions', { method: 'POST', body: { organization_id: orgId, pilot_id: pilot.id, kind, granted: true, granted_by_name: who, evidence: ev } })
    setMsg(r.ok ? null : { kind: 'error', t: r.data.error }); load()
  }
  const revoke = async (kind) => { await api('wave1', 'pilot-permissions', { method: 'POST', body: { organization_id: orgId, pilot_id: pilot.id, kind, granted: false } }); load() }
  return (
    <div>
      <Banner kind="warn">Permission to publish is a separate decision from accepting the service. It is never required, never assumed, and each use is granted on its own.</Banner>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      {PERMISSION_KINDS.map(([k, label]) => {
        const p = by[k]; const on = p?.granted
        return (
          <div key={k} style={{ ...CARD, padding: '14px 20px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{label}</p>
              {on && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>Granted by {p.granted_by_name} — {p.evidence} ({fmt(p.granted_at)})</p>}
              {!on && p?.revoked_at && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>Revoked {fmt(p.revoked_at)}</p>}
            </div>
            <Pill text={on ? 'granted' : 'not granted'} tone={on ? 'good' : 'neutral'} />
            {on ? <Btn small kind="danger" onClick={() => revoke(k)}>Revoke</Btn> : <Btn small kind="secondary" onClick={() => grant(k)}>Record permission…</Btn>}
          </div>
        )
      })}
    </div>
  )
}

function Results({ pilot, orgId }) {
  const [r, setR] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { (async () => { const x = await api('wave1', 'pilot-results', { query: { organization_id: orgId, pilot_id: pilot.id } }); if (x.ok) setR(x.data); else setErr(x.data.error) })() }, [orgId, pilot.id])
  const exportSummary = () => {
    const lines = [`Pilot results — ${pilot.name}`, `Generated ${new Date().toISOString()}`, '', 'BASELINE', JSON.stringify(r.baseline, null, 2), '', 'PILOT PERIOD', JSON.stringify(r.pilot_period, null, 2), '', `Test activity excluded: ${JSON.stringify(r.test_activity_excluded)}`, '', 'NOT MEASURED', ...Object.entries(r.not_measured).map(([k, v]) => `- ${k}: ${v}`), '', 'DEFINITIONS', ...Object.entries(r.definitions).map(([k, v]) => `- ${k}: ${v}`), '', `LIMITATIONS: ${r.limitations}`]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })); a.download = `pilot-results-${pilot.id.slice(0, 8)}.txt`; a.click()
  }
  if (err) return <Banner>{err}</Banner>
  if (!r) return <Loader2 style={{ width: 22, height: 22, color: GOLD, animation: 'spin 1s linear infinite' }} />
  const Block = ({ title, d }) => (
    <div style={CARD}>
      <p style={lbl}>{title}</p>
      {!d.defined ? <p style={{ color: GOLD, fontSize: 12 }}>{d.note}</p> : Object.entries(d).filter(([k]) => k !== 'defined').map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{k.replace(/_/g, ' ')}</span><span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{v}</span>
        </div>
      ))}
    </div>
  )
  return (
    <div>
      <Block title="Baseline period" d={r.baseline} />
      <Block title="Pilot period" d={r.pilot_period} />
      <div style={CARD}>
        <p style={lbl}>Excluded and not measured</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>Test activity excluded from every number above: {r.test_activity_excluded.conversations} conversations, {r.test_activity_excluded.messages} messages, {r.test_activity_excluded.appointments} appointments.</p>
        {Object.entries(r.not_measured).map(([k, v]) => <p key={k} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6 }}><b style={{ color: GOLD }}>{k.replace(/_/g, ' ')}:</b> {v}</p>)}
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 10 }}>{r.limitations}</p>
      </div>
      <Btn small onClick={exportSummary}>Export summary (.txt)</Btn>
    </div>
  )
}

function Interview() {
  return (
    <div style={CARD}>
      <p style={lbl}>Results-review interview prompts</p>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>Ask open questions and write down what they actually say. The last prompt is optional and only if they offer.</p>
      <ol style={{ paddingLeft: 18, margin: 0 }}>{INTERVIEW_PROMPTS.map((p, i) => <li key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>{p}</li>)}</ol>
    </div>
  )
}
