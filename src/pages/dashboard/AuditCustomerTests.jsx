// Nova Audit, system 22: the screen where Nova staff enter the customer-style tests they ran on a
// prospect (a call, a text, a form...), see the dollar range the server calculates from them and
// the owner's three numbers, save that range as an estimate finding, and print a one-page Audit.
// The rules live on the server (api/_auditTests.js); this screen only collects and shows.
import { useState } from 'react'
import { authedFetch } from '../../lib/apiAuth'
import AuditRecordWindows from './AuditRecordWindows'
import { exportFrom } from '../../lib/auditRecords'
import { TESTS, testsFrom, printableAudit, usd } from '../../lib/auditTests'

const GOLD = '#C9A84C'
const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, marginBottom: 20 }
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }
const btn = { padding: '10px 16px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const quiet = { ...btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }

const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

async function post(op, body) {
  const r = await authedFetch(`/api/client?resource=audit&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, data: d }
}

export default function AuditCustomerTests({ caseId, orgId, evidence, businessName, onSaved }) {
  const tests = testsFrom(evidence)
  const records = evidence.map(exportFrom).filter(Boolean)
  const [form, setForm] = useState({ kind: 'phone_open_hours', performed_at: localNow(), performed_by: '', target: '', responded: 'no', response_time: '', notes: '' })
  const [owner, setOwner] = useState({ per_week: '', avg_job: '', close: '' })
  const [estimate, setEstimate] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(businessName || '')
  const unit = (TESTS.find((t) => t[0] === form.kind) || [])[2]

  const save = async () => {
    setBusy(true); setMsg(null)
    const { ok, data } = await post('customer-test', { organization_id: orgId, case_id: caseId, kind: form.kind, performed_at: new Date(form.performed_at).toISOString(), performed_by: form.performed_by, target: form.target, responded: form.responded === 'yes', response_time: form.response_time === '' ? null : Number(form.response_time), notes: form.notes })
    setBusy(false)
    if (!ok) return setMsg({ ok: false, text: data.error || 'The test could not be saved.' })
    setMsg({ ok: true, text: 'Test saved as evidence.' }); setEstimate(null)
    setForm((f) => ({ ...f, performed_at: localNow(), response_time: '', notes: '' })); onSaved()
  }
  const calculate = async () => {
    setBusy(true); setMsg(null)
    const { ok, data } = await post('customer-test', { op2: 'estimate', organization_id: orgId, case_id: caseId, inquiries_per_week: Number(owner.per_week), avg_job_cents: Math.round(Number(owner.avg_job) * 100), close_rate_pct: Number(owner.close) })
    setBusy(false)
    if (!ok) { setEstimate(null); return setMsg({ ok: false, text: data.error || 'No range could be calculated.' }) }
    setEstimate(data.estimate)
  }
  const saveFinding = async () => {
    setBusy(true); setMsg(null)
    const { ok, data } = await post('findings', { organization_id: orgId, case_id: caseId, title: 'Inquiries that get no answer', statement_type: 'estimate', detail: `${tests.filter((t) => !t.answered).length} of ${tests.length} customer-style tests got no answer.`, priority: 'high', confidence: 'medium', recommended_action: 'Answer every call, text and form quickly, and follow up on every open quote.', estimate_low: estimate.estimate_low, estimate_high: estimate.estimate_high, estimate_unit: 'USD per month', estimate_assumptions: estimate.estimate_assumptions, evidence_ids: tests.map((t) => t.id) })
    setBusy(false)
    if (!ok) return setMsg({ ok: false, text: data.error || (data.problems || []).join('; ') || 'The finding could not be saved.' })
    setMsg({ ok: true, text: 'Saved as an estimate finding, linked to the tests. It still goes through review before any report.' }); onSaved()
  }
  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return setMsg({ ok: false, text: 'Allow pop-ups for this site to print.' })
    w.document.write(printableAudit({ business: name.trim() || 'Your business', tests, estimate, records }))
    w.document.close(); w.focus(); w.print()
  }
  const field = (key, label, extra = {}) => <div><label style={lbl}>{label}</label><input style={inp} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} /></div>

  return (
    <div>
      <AuditRecordWindows caseId={caseId} orgId={orgId} records={records} onSaved={onSaved} />
      <div style={CARD}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 10 }}>Add a test you ran</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>Contact the business the way a customer would, then record exactly what happened. Each test is saved as first-hand evidence with who ran it and when.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div><label style={lbl}>Test</label><select style={{ ...inp, appearance: 'none' }} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{TESTS.map(([k, l]) => <option key={k} value={k} style={{ background: '#111' }}>{l}</option>)}</select></div>
          {field('performed_at', 'When', { type: 'datetime-local' })}
          {field('target', 'Number, page or profile tested', { placeholder: '(203) 555-0100' })}
          {field('performed_by', 'Who ran it (blank = you)')}
          <div><label style={lbl}>Did they respond?</label><select style={{ ...inp, appearance: 'none' }} value={form.responded} onChange={(e) => setForm({ ...form, responded: e.target.value })}><option value="no" style={{ background: '#111' }}>No answer</option><option value="yes" style={{ background: '#111' }}>Yes, a person dealt with it</option></select></div>
          {unit && field('response_time', form.responded === 'yes' ? `Time to respond (${unit})` : `Waited before closing the test (${unit}, optional)`, { inputMode: 'decimal' })}
        </div>
        <div style={{ marginTop: 12 }}><label style={lbl}>Notes (optional)</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes} maxLength={1500} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Voicemail full, rang 8 times, auto-reply only…" /></div>
        <button style={{ ...btn, marginTop: 14 }} disabled={busy || form.target.trim().length < 3} onClick={save}>{busy ? 'Saving…' : 'Save test'}</button>
        {msg && <p role="status" style={{ marginTop: 10, fontSize: 12, color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</p>}
      </div>

      <div style={CARD}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 10 }}>Tests on this audit ({tests.length})</p>
        {tests.length ? tests.map((t) => <p key={t.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '8px 0' }}><strong style={{ color: t.answered ? '#4ade80' : '#f87171' }}>{t.answered ? 'Answered' : 'No answer'}</strong> · {(TESTS.find((x) => x[0] === t.kind) || [0, t.kind])[1]} · {new Date(t.when).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>) : <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>No tests yet. Three or more are needed before any dollar figure.</p>}
      </div>

      <div style={CARD}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 10 }}>What unanswered inquiries may be worth</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>Three numbers from the owner. The server turns them and the tests into a range with every assumption written out. It never gives a single number.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <div><label style={lbl}>Inquiries per week</label><input style={inp} inputMode="decimal" value={owner.per_week} onChange={(e) => setOwner({ ...owner, per_week: e.target.value })} /></div>
          <div><label style={lbl}>Average job ($)</label><input style={inp} inputMode="decimal" value={owner.avg_job} onChange={(e) => setOwner({ ...owner, avg_job: e.target.value })} /></div>
          <div><label style={lbl}>Inquiries that become jobs (%)</label><input style={inp} inputMode="decimal" value={owner.close} onChange={(e) => setOwner({ ...owner, close: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 12 }}><label style={lbl}>Business name on the printout</label><input style={inp} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button style={btn} disabled={busy} onClick={calculate}>Calculate the range</button>
          {estimate && <button style={quiet} disabled={busy} onClick={saveFinding}>Save as an estimate finding</button>}
          <button style={quiet} disabled={!tests.length && !records.length} onClick={print}>Print one-page Audit</button>
        </div>
        {estimate && <div style={{ marginTop: 16 }}><p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{usd(estimate.estimate_low)} to {usd(estimate.estimate_high)} a month</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{estimate.estimate_assumptions}</p></div>}
      </div>
    </div>
  )
}
