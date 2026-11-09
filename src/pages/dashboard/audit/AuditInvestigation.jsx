import { useState } from 'react'
import { authedFetch } from '../../../lib/apiAuth'
import { C, Card, Field, Notice, when } from '../ops/ui'

const areas = { acquisition: 'Acquisition and offers', costs: 'Costs and revenue', identity: 'Identity', website: 'Website journey', social: 'Social channels', reputation: 'Reviews', news: 'Public news', competitors: 'Competitors', contact: 'Calls and inquiries', operations: 'Systems and handoffs', retention: 'Retention' }
const blank = { kind: 'source', area: 'social', question: '', target: '', channel: 'email', test_identity: '', scheduled_at: '', identity_confirmed: false, language: 'en-US', speech_transcription: false }
export default function AuditInvestigation({ org, caseId, plan, clock, sendEnabled, reload, go }) {
  const [hours, setHours] = useState(72)
  const [inPerson, setInPerson] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [add, setAdd] = useState(blank)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState({ outcome: 'observed', source: '', observation: '', performed_at: '', responded_at: '', observed_until: '', within_published_hours: '' })
  const [reason, setReason] = useState('')
  const [approval, setApproval] = useState({ max_cost_usd: '', expires_at: '', response_window_minutes: 240 })
  const run = async (body) => {
    setBusy(true); setErr(''); setNotice('')
    try {
      const r = await authedFetch('/api/client?resource=audit&op=diagnostic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: org, case_id: caseId, ...body }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not save the investigation.')
      await reload(); setNotice('Investigation saved.'); return true
    } catch (e) { setErr(e.message); return false } finally { setBusy(false) }
  }
  const stamp = v => v ? new Date(v).toISOString() : undefined
  const task = plan?.tasks.find(t => t.id === selected)
  const editable = !plan || ['draft', 'running'].includes(plan.status)
  const choose = t => { setSelected(t.id); setReason(''); setResult({ outcome: t.kind === 'contact' ? 'responded' : 'observed', source: '', observation: '', performed_at: '', responded_at: '', observed_until: '', within_published_hours: '' }) }
  return <section style={{ display: 'grid', gap: 20 }} aria-label="Full audit investigation">
    <div style={{ borderLeft: `3px solid ${C.gold}`, padding: '6px 0 6px 18px' }}>
      <h2 style={{ fontSize: 25, fontWeight: 500, margin: '0 0 8px' }}>The full business diagnostic</h2>
      <p style={{ color: C.dim, maxWidth: 740, margin: 0, lineHeight: 1.7 }}>Follow the evidence across the business: discovery, buying, delivery and returning customers. Public research, authorized customer tests and optional on-site observations share one investigation.</p>
    </div>
    {err && <div role="alert"><Notice tone="bad">{err}</Notice></div>}
    {notice && <p role="status" style={{ color: C.green }}>{notice}</p>}
    {!plan ? <Card title="Prepare a 24–72 hour investigation">
      <p style={{ color: C.dim }}>Preparation saves the investigation questions. It does not start the clock, contact anyone or charge for a provider.</p>
      <Field label="Agreed delivery window, calendar hours" id="inv-hours"><input id="inv-hours" className="ops-input" type="number" min="24" max="72" value={hours} onChange={e => setHours(Number(e.target.value))} /></Field>
      <label style={{ display: 'block', margin: '14px 0' }}><input type="checkbox" checked={inPerson} onChange={e => setInPerson(e.target.checked)} /> Include an optional in-person observation</label>
      <button className="ops-btn primary" disabled={busy} onClick={() => run({ action: 'prepare', duration_hours: hours, in_person: inPerson })}>Prepare investigation</button>
    </Card> : <>
      <Card title={`${plan.duration_hours}-hour investigation`}>
        <p style={{ color: C.dim }}>Status: <strong style={{ color: C.text }}>{plan.status}</strong>. {plan.started_at ? `Started ${when(plan.started_at)}. Initial deadline ${when(plan.deadline_at)}.` : 'Not started. Approve the matching calendar-hour delivery policy and start the clock first.'}</p>
        {clock?.message && <p style={{ color: C.dim }}>{clock.message}</p>}
        <p>{plan.tasks.filter(t => t.status === 'completed').length} of {plan.tasks.length} checks recorded. {plan.tasks.filter(t => t.status === 'blocked').length} blocked. {plan.tasks.filter(t => t.status === 'waived').length} explicitly excluded.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="ops-btn" onClick={() => go('clock')}>Delivery policy and clock</button>
          <button className="ops-btn" onClick={() => go('clock')}>Business test permission</button>
          {editable && <button className="ops-btn primary" disabled={busy} onClick={() => run({ action: 'start' })}>{plan.started_at ? 'Ensure research is queued' : 'Start investigation'}</button>}
          {editable && <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'finish' })}>Submit for review</button>}
          {editable && <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'cancel' })}>Stop investigation</button>}
          <button className="ops-btn" disabled={busy} onClick={reload}>Refresh results</button>
        </div>
        <p style={{ fontSize: 13, color: C.dim }}>Scheduled checks require Nova’s background worker. Email and phone tests have separately approved provider execution; forms and social submissions remain analyst tasks. {sendEnabled ? 'Sending is enabled; each test still needs current permission, exact-content approval and a reserved budget.' : 'Provider sending is disabled. No automatic call or email will be sent.'}</p>
      </Card>
      <div aria-label="Investigation timeline" style={{ display: 'grid', gap: 0 }}>
        {plan.tasks.map(t => <button key={t.id} className="ops-btn" onClick={() => choose(t)} aria-pressed={selected === t.id} style={{ width: '100%', textAlign: 'left', whiteSpace: 'normal', padding: '16px 12px', borderRadius: 0, border: 0, borderBottom: `1px solid ${C.line}`, background: selected === t.id ? '#181610' : 'transparent' }}>
          <span style={{ display: 'block', fontSize: 12, color: C.gold, marginBottom: 6 }}>{areas[t.area]} · {t.status}{t.scheduled_at ? ` · ${when(t.scheduled_at)}` : ''}</span>
          <span style={{ display: 'block', color: C.text, lineHeight: 1.5 }}>{t.question}</span>
          {t.target && <span style={{ display: 'block', overflowWrap: 'anywhere', color: C.dim, marginTop: 6 }}>{t.target}</span>}
          {(t.observation || t.exclusion_reason) && <span style={{ display: 'block', color: C.dim, marginTop: 8, lineHeight: 1.5 }}>{(t.observation || t.exclusion_reason).slice(0, 450)}</span>}
          {t.response_seconds != null && <span style={{ display: 'block', marginTop: 6 }}>Response: {t.response_seconds} seconds{!t.meaningful_response ? ' (automated acknowledgement)' : ''}</span>}
        </button>)}
      </div>
      {task && editable && (!['completed', 'waived'].includes(task.status) || (task.requires_review && !task.reviewed_by)) && <Card title="Record the actual result">
        <p>{task.question}</p>
        {task.candidates?.length > 0 && <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
          <p style={{ color: C.dim }}>Source candidates, not verified claims or confirmed accounts:</p>
          {task.candidates.map((candidate, index) => <div key={candidate.url || candidate.target || index} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 12 }}>
            <p style={{ margin: '0 0 6px', overflowWrap: 'anywhere' }}>{candidate.title || candidate.channel || candidate.kind}: {candidate.url || candidate.target}</p>
            {candidate.url && <><a className="ops-btn" href={candidate.url} target="_blank" rel="noreferrer">Read source</a> <button className="ops-btn" onClick={() => setAdd({ ...blank, kind: 'source', area: candidate.kind === 'news' ? 'news' : 'social', target: candidate.url, question: `Verify this source and assess relevance: ${candidate.title || candidate.channel || candidate.url}` })}>Prepare source check</button></>}
          </div>)}
        </div>}
        {task.dispatch && <Notice tone="warn">Provider attempt: {task.dispatch.state}. {task.dispatch.reason || ''} Delivery: {task.dispatch.delivery_state || 'not confirmed'}. A connected call or an incoming email still needs review.</Notice>}
        {task.automation_observation && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, color: C.dim }}>{JSON.stringify(task.automation_observation, null, 2)}</pre>}
        {['source', 'research', 'discovery'].includes(task.kind) && task.status === 'completed' && task.requires_review && !task.reviewed_by && <>
          <Field label="Analyst assessment: identity, relevant facts and remaining uncertainty" id="inv-review"><textarea id="inv-review" className="ops-textarea" value={result.observation} onChange={e => setResult({ ...result, observation: e.target.value })} /></Field>
          <button className="ops-btn" disabled={busy || !result.observation.trim()} onClick={() => run({ action: 'review-source', task_id: task.id, observation: result.observation })}>Save source review</button>
        </>}
        {!['source', 'research', 'discovery'].includes(task.kind) && <>
          <Field label="Observed outcome" id="inv-outcome"><select id="inv-outcome" className="ops-select" value={result.outcome} onChange={e => setResult({ ...result, outcome: e.target.value })}>{(task.kind === 'contact' ? ['answered', 'responded', 'auto_reply', 'voicemail', 'no_response', 'not_applicable'] : ['observed', 'verified_working', 'issue_observed', 'unavailable', 'not_applicable']).map(x => <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>)}</select></Field>
          <div className="ops-two">
            <Field label="Performed at (your device time)" id="inv-performed"><input id="inv-performed" className="ops-input" type="datetime-local" value={result.performed_at} onChange={e => setResult({ ...result, performed_at: e.target.value })} /></Field>
            {task.kind === 'contact' && <Field label="Response received at, if any" id="inv-response"><input id="inv-response" className="ops-input" type="datetime-local" value={result.responded_at} onChange={e => setResult({ ...result, responded_at: e.target.value })} /></Field>}
            {result.outcome === 'no_response' && <Field label="Observed until" id="inv-until"><input id="inv-until" className="ops-input" type="datetime-local" value={result.observed_until} onChange={e => setResult({ ...result, observed_until: e.target.value })} /></Field>}
            {task.kind === 'contact' && <Field label="Within published hours?" id="inv-open"><select id="inv-open" className="ops-select" value={result.within_published_hours} onChange={e => setResult({ ...result, within_published_hours: e.target.value })}><option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></Field>}
          </div>
          <Field label="Evidence URL, file reference or message thread" id="inv-source"><input id="inv-source" className="ops-input" value={result.source} onChange={e => setResult({ ...result, source: e.target.value })} /></Field>
          <Field label="What happened? Include conditions and limitations." id="inv-observation"><textarea id="inv-observation" className="ops-textarea" value={result.observation} onChange={e => setResult({ ...result, observation: e.target.value })} /></Field>
          <button className="ops-btn primary" disabled={busy || !result.performed_at} onClick={() => run({ action: 'record', task_id: task.id, ...result, performed_at: stamp(result.performed_at), responded_at: stamp(result.responded_at), observed_until: stamp(result.observed_until), within_published_hours: result.within_published_hours === '' ? null : result.within_published_hours === 'yes' })}>Save evidence and result</button>
        </>}
        {task.kind === 'contact' && ['email', 'phone'].includes(task.channel) && !task.dispatch?.provider_id && <div style={{ margin: '20px 0', borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
          <h3>Owner approval for this exact automated test</h3>
          <p style={{ color: C.dim }}>Approval does not enable sending or create a provider budget. Both remain separate gates.</p>
          <Field label="Maximum provider cost, USD" id="inv-max-cost"><input id="inv-max-cost" className="ops-input" type="number" min="0" step="0.01" value={approval.max_cost_usd} onChange={e => setApproval({ ...approval, max_cost_usd: e.target.value })} /></Field>
          <Field label="Approval expires (device time, within 24 hours)" id="inv-approval-expiry"><input id="inv-approval-expiry" className="ops-input" type="datetime-local" value={approval.expires_at} onChange={e => setApproval({ ...approval, expires_at: e.target.value })} /></Field>
          <Field label="Observe responses for this many minutes" id="inv-window"><input id="inv-window" className="ops-input" type="number" min="1" max="4320" value={approval.response_window_minutes} onChange={e => setApproval({ ...approval, response_window_minutes: Number(e.target.value) })} /></Field>
          <button className="ops-btn" disabled={busy || !approval.expires_at || !approval.max_cost_usd} onClick={() => run({ action: 'approve-dispatch', task_id: task.id, ...approval, expires_at: stamp(approval.expires_at) })}>Approve and queue this test</button>
        </div>}
        {['source', 'research', 'discovery'].includes(task.kind) && plan.status === 'running' && <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'retry', task_id: task.id })}>Retry automated check</button>}
        <Field label="If this check cannot be completed, explain the exclusion" id="inv-exclusion"><textarea id="inv-exclusion" className="ops-textarea" value={reason} onChange={e => setReason(e.target.value)} /></Field>
        <button className="ops-btn" disabled={busy || !reason.trim()} onClick={() => run({ action: 'waive', task_id: task.id, reason })}>Record coverage exclusion</button>
      </Card>}
      {editable && <Card title="Add a source or customer test">
        <div className="ops-two">
          <Field label="Check type" id="inv-kind"><select id="inv-kind" className="ops-select" value={add.kind} onChange={e => setAdd({ ...add, kind: e.target.value })}><option value="source">Read a public source</option><option value="contact">Authorized customer test</option><option value="review">Analyst review</option><option value="in_person">In-person observation</option></select></Field>
          <Field label="Business area" id="inv-area"><select id="inv-area" className="ops-select" value={add.area} onChange={e => setAdd({ ...add, area: e.target.value })}>{Object.entries(areas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="Question to investigate" id="inv-question"><input id="inv-question" className="ops-input" value={add.question} onChange={e => setAdd({ ...add, question: e.target.value })} /></Field>
        <Field label="Exact public URL, email address or phone number" id="inv-target"><input id="inv-target" className="ops-input" value={add.target} onChange={e => setAdd({ ...add, target: e.target.value })} /></Field>
        <Field label="Scheduled time (optional, your device time)" id="inv-schedule"><input id="inv-schedule" className="ops-input" type="datetime-local" value={add.scheduled_at} onChange={e => setAdd({ ...add, scheduled_at: e.target.value })} /></Field>
        {add.kind === 'source' && <label style={{ display: 'block', margin: '14px 0' }}><input type="checkbox" checked={add.identity_confirmed} onChange={e => setAdd({ ...add, identity_confirmed: e.target.checked })} /> I confirmed this source belongs to or concerns this exact business.</label>}
        {add.kind === 'contact' && <>
          <Field label="Channel" id="inv-channel"><select id="inv-channel" className="ops-select" value={add.channel} onChange={e => setAdd({ ...add, channel: e.target.value })}>{['phone', 'email', 'form', 'sms', 'social'].map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Test language" id="inv-language"><select id="inv-language" className="ops-select" value={add.language} onChange={e => setAdd({ ...add, language: e.target.value })}><option value="en-US">English</option><option value="es-US">Spanish</option></select></Field>
          {add.channel === 'phone' && <label style={{ display: 'block', margin: '12px 0' }}><input type="checkbox" checked={add.speech_transcription} onChange={e => setAdd({ ...add, speech_transcription: e.target.checked })} /> Request speech transcription only if documented business permission covers it.</label>}
          <Field label="Truthful test identity" id="inv-identity"><input id="inv-identity" className="ops-input" value={add.test_identity} onChange={e => setAdd({ ...add, test_identity: e.target.value })} /></Field>
        </>}
        <button className="ops-btn" disabled={busy} onClick={async () => { if (await run({ action: 'add', ...add, scheduled_at: stamp(add.scheduled_at) })) setAdd(blank) }}>Add investigation check</button>
      </Card>}
    </>}
  </section>
}
