// Nova Audit — intake/clock policy, authorized tests, benchmarks, software review, scenarios, finding details,
// report composition and secure delivery. Uses the same API rules the server enforces; screens never claim more.
import { useState } from 'react'
import { authedFetch } from '../../../lib/apiAuth'
import { C, css, Card, Field, Loading, ErrorBox, Empty, Badge, useLoad, useAction, Notice, money, when } from '../ops/ui'

const call = (op, { org, caseId, method = 'GET', body, query = {} }) => {
  const qs = new URLSearchParams({ resource: 'audit', op, ...(method === 'GET' ? { organization_id: org, case_id: caseId, ...query } : {}) })
  return authedFetch(`/api/client?${qs}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify({ organization_id: org, case_id: caseId, ...body }) })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status }); return j })
}
export const AuditCss = () => <style>{css}</style>

const WHO = { client: 'the client', nova: 'Nova', third_party: 'a third party' }

export function IntakeTab({ org, caseId, isOwner, clock = {}, onChanged }) {
  const d = useLoad(() => call('intake', { org, caseId }), [org, caseId])
  const act = useAction()
  const [i, setI] = useState(null); const [p, setP] = useState(null); const [a, setA] = useState({ authorized_by_name: '', role: '', channels: [], max_per_day: 1, ends_on: '', evidence: '' })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} />
  const intake = i || d.data.intake || {}; const pol = p || d.data.clock_policy || { start_event: '', hours_basis: 'business_hours', target_hours: 72, missing_input_rule: '', extension_notice: '', required_inputs: [] }
  const save = (body, ok) => act.run(() => call('intake', { org, caseId, method: 'POST', body }), ok).then(() => { d.reload(); onChanged?.() })
  const clockAct = (body, ok) => act.run(() => call('clock', { org, caseId, method: 'POST', body }), ok).then(() => { d.reload(); onChanged?.() })
  const polBody = () => ({ ...pol, target_hours: Number(pol.target_hours), ...(pol.aim_hours ? { aim_hours: Number(pol.aim_hours) } : {}), required_inputs: (pol.required_inputs || []).filter((x) => x.label?.trim()) })
  const started = !!d.data.clock_started_at
  const missing = (d.data.input_checklist || []).filter((x) => !x.received_at)
  const openExt = (d.data.extensions || []).find((x) => ['proposed', 'client_notified'].includes(x.status))
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {act.view}
      <Card title="Intake">
        <div className="ops-two">
          {[['website', 'Verified website (https://…)'], ['public_phone', 'Public phone'], ['public_email', 'Public email'], ['hours', 'Published hours'], ['location', 'Location'], ['industry', 'Industry'], ['contact_name', 'Owner / contact'], ['contact_role', 'Contact role']].map(([k, l]) => (
            <Field key={k} label={l} id={`in-${k}`}><input id={`in-${k}`} className="ops-input" value={intake[k] || ''} onChange={(e) => setI({ ...intake, [k]: e.target.value })} /></Field>
          ))}
        </div>
        <Field label="Requested scope" id="in-scope"><textarea id="in-scope" className="ops-textarea" rows={2} value={intake.requested_scope || ''} onChange={(e) => setI({ ...intake, requested_scope: e.target.value })} /></Field>
        <button className="ops-btn primary" disabled={act.busy} onClick={() => save({ intake }, 'Intake saved.')}>Save intake</button>
      </Card>
      <Card title={<>Clock policy {d.data.clock_policy_version ? `v${d.data.clock_policy_version} ` : ''}{d.data.clock_policy_approved_at ? <Badge value="approved" label={`approved ${when(d.data.clock_policy_approved_at)}`} /> : <Badge value="draft" label="not approved — clock cannot start" />}</>}>
        {started ? <Notice tone="ok">The clock started {when(d.data.clock_started_at)} under this approved policy. It can no longer change; use blockers and extensions below.</Notice> : !d.data.clock_policy && (
          <Notice tone="warn">No policy yet. <button className="ops-btn" style={{ marginLeft: 8 }} onClick={() => setP({ ...d.data.proposed_clock_policy })}>Fill in the proposed default</button> <span style={{ fontSize: 12 }}>It is only a proposal until the owner approves it.</span></Notice>
        )}
        <fieldset disabled={started} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Clock start event" id="cp-start"><input id="cp-start" className="ops-input" value={pol.start_event} onChange={(e) => setP({ ...pol, start_event: e.target.value })} /></Field>
          <div className="ops-two">
            <Field label="Hours basis" id="cp-basis"><select id="cp-basis" className="ops-select" value={pol.hours_basis} onChange={(e) => setP({ ...pol, hours_basis: e.target.value })}><option value="business_hours">Business hours</option><option value="elapsed_hours">Calendar (elapsed) hours</option></select></Field>
            <Field label="Deliver within (48–72 hours)" id="cp-h"><input id="cp-h" type="number" min={48} max={72} className="ops-input" value={pol.target_hours} onChange={(e) => setP({ ...pol, target_hours: Number(e.target.value) })} /></Field>
            <Field label="Aim for (hours, optional)" id="cp-aim"><input id="cp-aim" type="number" min={24} max={72} className="ops-input" value={pol.aim_hours || ''} onChange={(e) => setP({ ...pol, aim_hours: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          </div>
          <Field label="When inputs are missing" id="cp-miss"><input id="cp-miss" className="ops-input" value={pol.missing_input_rule} onChange={(e) => setP({ ...pol, missing_input_rule: e.target.value })} /></Field>
          <Field label="How the client is told about an extension" id="cp-ext"><input id="cp-ext" className="ops-input" value={pol.extension_notice} onChange={(e) => setP({ ...pol, extension_notice: e.target.value })} /></Field>
          <div style={{ fontSize: 12, color: C.dim, margin: '6px 0' }}>Required inputs before the clock starts</div>
          {(pol.required_inputs || []).map((x, n) => (
            <div key={n} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input aria-label={`Required input ${n + 1}`} className="ops-input" value={x.label} onChange={(e) => setP({ ...pol, required_inputs: pol.required_inputs.map((y, k) => (k === n ? { ...y, label: e.target.value, key: y.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) } : y)) })} />
              <select aria-label={`Who provides input ${n + 1}`} className="ops-select" value={x.responsible} onChange={(e) => setP({ ...pol, required_inputs: pol.required_inputs.map((y, k) => (k === n ? { ...y, responsible: e.target.value } : y)) })}><option value="client">Client</option><option value="nova">Nova</option><option value="third_party">Third party</option></select>
              <button type="button" className="ops-btn" onClick={() => setP({ ...pol, required_inputs: pol.required_inputs.filter((_, k) => k !== n) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="ops-btn" onClick={() => setP({ ...pol, required_inputs: [...(pol.required_inputs || []), { key: '', label: '', responsible: 'client' }] })}>Add required input</button>
        </fieldset>
        <p style={{ fontSize: 12, color: C.faint }}>The clock is a commitment to the client. Work happens on the research and test schedule below — never by waiting out the clock. Every saved change is a new version; approval applies to the exact version shown.</p>
        {!started && <div style={{ display: 'flex', gap: 8 }}>
          <button className="ops-btn" disabled={act.busy} onClick={() => save({ clock_policy: polBody() }, 'Policy saved as a new version (needs owner approval).')}>Save policy</button>
          {isOwner && <button className="ops-btn primary" disabled={act.busy} onClick={() => save({ clock_policy: polBody(), approve_clock_policy: true }, 'Policy approved — the clock can start once every required input is received.')}>Approve policy (owner)</button>}
        </div>}
        {(d.data.policy_versions || []).length > 0 && <details style={{ marginTop: 10, fontSize: 12, color: C.dim }}><summary>Version history ({d.data.policy_versions.length})</summary>
          {d.data.policy_versions.map((v) => <div key={v.version}>v{v.version} saved {when(v.created_at)}{v.approved_at ? ` · approved ${when(v.approved_at)}` : ' · not approved'} — {v.policy.target_hours}h {v.policy.hours_basis === 'business_hours' ? 'business' : 'calendar'}{v.policy.aim_hours ? `, aim ${v.policy.aim_hours}h` : ''}, {(v.policy.required_inputs || []).length} required input(s)</div>)}
        </details>}
      </Card>
      {(d.data.input_checklist || []).length > 0 && (
        <Card title={<>Required inputs {missing.length ? <Badge value="partial" label={`${missing.length} missing`} /> : <Badge value="ready" label="all received" />}</>}>
          <table className="ops-table"><tbody>
            {d.data.input_checklist.map((x) => <tr key={x.key}><td>{x.label}</td><td style={{ color: C.dim }}>from {WHO[x.responsible]}</td><td>{x.received_at ? <span style={{ color: C.faint, fontSize: 12 }}>received {when(x.received_at)}</span> : <button className="ops-btn" disabled={act.busy} onClick={() => clockAct({ action: 'receive-input', key: x.key }, `${x.label}: received.`)}>Mark received</button>}</td></tr>)}
          </tbody></table>
          {!started && missing.length > 0 && <p style={{ fontSize: 12, color: C.amber }}>The clock cannot start until these are received.</p>}
        </Card>
      )}
      {started && <ClockExceptions data={d.data} clock={clock} busy={act.busy} run={clockAct} openExt={openExt} />}
      <Card title="Permission for active tests (calls, forms)">
        {d.data.active_test_authorization ? (
          <p style={{ fontSize: 13 }}>Authorized by {d.data.active_test_authorization.authorized_by_name} ({d.data.active_test_authorization.role || '—'}) for {d.data.active_test_authorization.channels.join(', ')}, up to {d.data.active_test_authorization.max_per_day}/day until {d.data.active_test_authorization.ends_on}. {d.data.active_test_authorization.cancelled_at ? <Badge value="cancelled" /> : <button className="ops-btn danger" onClick={() => save({ cancel_active_tests: true }, 'Permission cancelled; planned active tests cancelled.')}>Cancel permission</button>}</p>
        ) : <Notice tone="warn">No permission recorded. Only public review is possible until the business authorizes active tests.</Notice>}
        <div className="ops-two">
          <Field label="Authorized by (name)" id="at-name"><input id="at-name" className="ops-input" value={a.authorized_by_name} onChange={(e) => setA({ ...a, authorized_by_name: e.target.value })} /></Field>
          <Field label="Their role" id="at-role"><input id="at-role" className="ops-input" value={a.role} onChange={(e) => setA({ ...a, role: e.target.value })} /></Field>
          <Field label="Ends on" id="at-end"><input id="at-end" type="date" className="ops-input" value={a.ends_on} onChange={(e) => setA({ ...a, ends_on: e.target.value })} /></Field>
          <Field label="Evidence of permission" id="at-ev"><input id="at-ev" className="ops-input" value={a.evidence} onChange={(e) => setA({ ...a, evidence: e.target.value })} placeholder="e.g. signed request form" /></Field>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 10 }}>{['phone', 'form', 'sms'].map((ch) => <label key={ch}><input type="checkbox" checked={a.channels.includes(ch)} onChange={(e) => setA({ ...a, channels: e.target.checked ? [...a.channels, ch] : a.channels.filter((x) => x !== ch) })} /> {ch}</label>)}</div>
        <button className="ops-btn" disabled={act.busy} onClick={() => save({ active_test_authorization: a }, 'Permission recorded.')}>Record permission</button>
      </Card>
    </div>
  )
}

// After the clock starts: blockers are recorded without moving the deadline; an extension changes it only once the
// client has been told why and has agreed.
function ClockExceptions({ data, clock, busy, run, openExt }) {
  const [bk, setBk] = useState({ description: '', responsible: 'client' })
  const [ex, setEx] = useState({ extra_hours: 24, reason: '' })
  const [nt, setNt] = useState({ channel: 'email', notice_text: '' })
  const [rs, setRs] = useState({ responder_name: '', evidence: '' })
  const atRisk = ['at_risk', 'overdue'].includes(clock.bucket)
  return (
    <>
      {atRisk && !openExt && <Notice tone="bad">The deadline is {clock.bucket === 'overdue' ? 'missed' : 'at risk'}. Tell the client now, explain why, and ask them to agree a revised delivery time (propose an extension below).</Notice>}
      <Card title="Blockers">
        {!(data.blockers || []).length ? <Empty>No blockers recorded.</Empty> : (
          <table className="ops-table"><tbody>{data.blockers.map((x) => <tr key={x.id}><td>{x.description}<div style={{ fontSize: 11, color: C.faint }}>raised {when(x.raised_at)} · owed by {WHO[x.responsible]}</div></td><td>{x.resolved_at ? <span style={{ fontSize: 12, color: C.faint }}>resolved {when(x.resolved_at)}</span> : <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'resolve-blocker', blocker_id: x.id }, 'Blocker resolved.')}>Resolve</button>}</td></tr>)}</tbody></table>
        )}
        <div className="ops-two">
          <Field label="What is blocking the audit" id="bk-d"><input id="bk-d" className="ops-input" value={bk.description} onChange={(e) => setBk({ ...bk, description: e.target.value })} /></Field>
          <Field label="Who must clear it" id="bk-r"><select id="bk-r" className="ops-select" value={bk.responsible} onChange={(e) => setBk({ ...bk, responsible: e.target.value })}><option value="client">Client</option><option value="nova">Nova</option><option value="third_party">Third party</option></select></Field>
        </div>
        <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'raise-blocker', ...bk }, 'Blocker recorded. The deadline has not changed.').then(() => setBk({ description: '', responsible: 'client' }))}>Record blocker</button>
        <p style={{ fontSize: 12, color: C.faint }}>Recording a blocker never moves the deadline.</p>
      </Card>
      <Card title="Extensions">
        {(data.extensions || []).map((x) => <div key={x.id} style={{ fontSize: 13, marginBottom: 8 }}><Badge value={x.status === 'agreed' ? 'ready' : x.status === 'declined' || x.status === 'withdrawn' ? 'blocked' : 'partial'} label={x.status.replace(/_/g, ' ')} /> +{Number(x.extra_hours)}h → {when(x.proposed_due_at)} — {x.reason}{x.notified_at ? <div style={{ fontSize: 11, color: C.faint }}>client told by {x.notice_channel} {when(x.notified_at)}{x.client_responder_name ? ` · answered by ${x.client_responder_name} ${when(x.client_response_at)}` : ''}</div> : null}</div>)}
        {!openExt && <>
          <div className="ops-two">
            <Field label="Extra hours needed" id="ex-h"><input id="ex-h" type="number" min={1} max={168} className="ops-input" value={ex.extra_hours} onChange={(e) => setEx({ ...ex, extra_hours: Number(e.target.value) })} /></Field>
            <Field label="Why (this is what the client will hear)" id="ex-r"><input id="ex-r" className="ops-input" value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} /></Field>
          </div>
          <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'propose-extension', ...ex }, 'Extension proposed. The deadline is unchanged until the client agrees.')}>Propose extension</button>
        </>}
        {openExt?.status === 'proposed' && <>
          <div className="ops-two">
            <Field label="How you told the client" id="nt-c"><select id="nt-c" className="ops-select" value={nt.channel} onChange={(e) => setNt({ ...nt, channel: e.target.value })}><option value="email">Email</option><option value="phone">Phone</option><option value="in_person">In person</option><option value="message">Message</option></select></Field>
            <Field label="What you told them" id="nt-t"><input id="nt-t" className="ops-input" value={nt.notice_text} onChange={(e) => setNt({ ...nt, notice_text: e.target.value })} /></Field>
          </div>
          <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'record-notice', extension_id: openExt.id, ...nt }, 'Notice recorded. Waiting for the client’s answer.')}>Record that the client was told</button>
        </>}
        {openExt?.status === 'client_notified' && <>
          <div className="ops-two">
            <Field label="Who answered at the client" id="rs-n"><input id="rs-n" className="ops-input" value={rs.responder_name} onChange={(e) => setRs({ ...rs, responder_name: e.target.value })} /></Field>
            <Field label="Evidence (e.g. their email)" id="rs-e"><input id="rs-e" className="ops-input" value={rs.evidence} onChange={(e) => setRs({ ...rs, evidence: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ops-btn primary" disabled={busy} onClick={() => run({ action: 'record-response', extension_id: openExt.id, agreed: true, ...rs }, 'Client agreed. The deadline moved by exactly the agreed hours.')}>Client agreed</button>
            <button className="ops-btn" disabled={busy} onClick={() => run({ action: 'record-response', extension_id: openExt.id, agreed: false, ...rs }, 'Client declined. The original deadline stands.')}>Client declined</button>
          </div>
        </>}
        {openExt && <button className="ops-btn danger" style={{ marginTop: 8 }} disabled={busy} onClick={() => run({ action: 'withdraw-extension', extension_id: openExt.id }, 'Extension withdrawn.')}>Withdraw</button>}
        {clock.originalDueAt && <p style={{ fontSize: 12, color: C.faint }}>Original deadline {when(clock.originalDueAt)}; current {when(clock.dueAt)} (paused time and client-agreed extensions only).</p>}
      </Card>
    </>
  )
}

export function TestsTab({ org, caseId }) {
  const d = useLoad(() => call('test-plan', { org, caseId }), [org, caseId])
  const act = useAction(); const [f, setF] = useState({ channel: 'public_review', target: '', planned_at: '', test_identity: 'Nova audit test', conditions: '', is_competitor: false })
  const go = (body, ok) => act.run(() => call('test-plan', { org, caseId, method: 'POST', body }), ok).then(d.reload)
  return (
    <Card title="Research and test schedule">
      {act.view}
      {d.loading ? <Loading /> : !d.data?.length ? <Empty>No tests planned.</Empty> : (
        <div className="ops-scroll"><table className="ops-table"><thead><tr><th>When</th><th>Channel</th><th>Target</th><th>Status</th><th>Result</th><th /></tr></thead><tbody>
          {d.data.map((t) => <tr key={t.id}><td>{when(t.planned_at)}<div style={{ color: C.faint, fontSize: 11 }}>{t.conditions}</div></td><td>{t.channel}{t.is_competitor ? ' (competitor)' : ''}</td><td>{t.target}</td><td><Badge value={t.status} /></td><td>{t.outcome ? <>{t.outcome.replace(/_/g, ' ')}{t.response_seconds != null && ` · ${t.response_seconds}s`}<div style={{ color: C.faint, fontSize: 11 }}>{t.interpretation.replace(/_/g, ' ')}</div></> : '—'}</td>
            <td>{t.status === 'planned' && <><button className="ops-btn" onClick={() => { const o = window.prompt('Outcome: answered, responded, no_response, voicemail, auto_reply'); if (!o) return; const sec = window.prompt('Response time in seconds (blank if none)'); const inHours = window.confirm('Was this within the business’s published hours?'); go({ action: 'record', id: t.id, outcome: o.trim(), response_seconds: sec, within_published_hours: inHours }, 'Result recorded.') }}>Record result</button> <button className="ops-btn danger" onClick={() => go({ action: 'cancel', id: t.id }, 'Cancelled.')}>Cancel</button></>}</td></tr>)}
        </tbody></table></div>
      )}
      <div className="ops-grid" style={{ marginTop: 12 }}>
        <Field label="Channel" id="tp-ch"><select id="tp-ch" className="ops-select" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{['public_review', 'phone', 'form', 'sms'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Public number or URL" id="tp-t"><input id="tp-t" className="ops-input" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        <Field label="Planned time" id="tp-at"><input id="tp-at" type="datetime-local" className="ops-input" value={f.planned_at} onChange={(e) => setF({ ...f, planned_at: e.target.value })} /></Field>
        <Field label="Test identity" id="tp-id"><input id="tp-id" className="ops-input" value={f.test_identity} onChange={(e) => setF({ ...f, test_identity: e.target.value })} /></Field>
        <Field label="Conditions" id="tp-c"><input id="tp-c" className="ops-input" value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} placeholder="day/time, within published hours?" /></Field>
      </div>
      <label style={{ fontSize: 13, color: C.dim, display: 'block', marginBottom: 10 }}><input type="checkbox" checked={f.is_competitor} onChange={(e) => setF({ ...f, is_competitor: e.target.checked })} /> Competitor (public review only)</label>
      <button className="ops-btn primary" disabled={act.busy} onClick={() => go({ action: 'create', ...f, planned_at: f.planned_at ? new Date(f.planned_at).toISOString() : undefined }, 'Planned.')}>Plan test</button>
      <p style={{ color: C.faint, fontSize: 12 }}>Active tests need recorded permission, use a clear test identity, never invent urgent problems, and never contact competitors.</p>
    </Card>
  )
}

export function BenchmarksTab({ org, caseId }) {
  const comps = useLoad(() => call('competitors', { org, caseId }), [org, caseId])
  const sw = useLoad(() => call('software', { org, caseId }), [org, caseId])
  const act = useAction()
  const [c, setC] = useState({ name: '', url: '', rationale: '', obs_kind: 'advertised', obs_text: '', obs_source: '' })
  const [s, setS] = useState({ name: '', category: '', cost: '', cost_source: 'owner_supplied', usage: 'unknown', classification: 'unknown_usage', notes: '' })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {act.view}
      <Card title="Competitors (up to three)">
        {comps.loading ? <Loading /> : !comps.data?.length ? <Empty>None yet.</Empty> : comps.data.map((x) => <div key={x.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}><strong>{x.name}</strong> <span style={{ color: C.faint }}>{x.url}</span><div style={{ color: C.dim }}>Why: {x.rationale}</div>{x.observations.map((o, i) => <div key={i} style={{ fontSize: 12 }}><Badge value={o.kind === 'observed' ? 'confirmed' : o.kind === 'advertised' ? 'sent' : 'draft'} label={o.kind} /> {o.text} {o.source && <span style={{ color: C.faint }}>({o.source})</span>}</div>)}</div>)}
        {(comps.data || []).length < 3 && (
          <div style={{ marginTop: 10 }}>
            <div className="ops-two">
              <Field label="Name" id="cm-n"><input id="cm-n" className="ops-input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
              <Field label="Website" id="cm-u"><input id="cm-u" className="ops-input" value={c.url} onChange={(e) => setC({ ...c, url: e.target.value })} /></Field>
            </div>
            <Field label="Why this competitor is relevant" id="cm-r"><input id="cm-r" className="ops-input" value={c.rationale} onChange={(e) => setC({ ...c, rationale: e.target.value })} /></Field>
            <div className="ops-grid">
              <Field label="Evidence kind" id="cm-k"><select id="cm-k" className="ops-select" value={c.obs_kind} onChange={(e) => setC({ ...c, obs_kind: e.target.value })}><option value="advertised">publicly advertised</option><option value="observed">directly observed</option><option value="untested">untested assumption</option></select></Field>
              <Field label="Statement" id="cm-t"><input id="cm-t" className="ops-input" value={c.obs_text} onChange={(e) => setC({ ...c, obs_text: e.target.value })} /></Field>
              <Field label="Source URL" id="cm-s"><input id="cm-s" className="ops-input" value={c.obs_source} onChange={(e) => setC({ ...c, obs_source: e.target.value })} /></Field>
            </div>
            <button className="ops-btn" disabled={act.busy} onClick={() => act.run(() => call('competitors', { org, caseId, method: 'POST', body: { action: 'create', name: c.name, url: c.url, rationale: c.rationale, observations: c.obs_text ? [{ kind: c.obs_kind, text: c.obs_text, source: c.obs_source }] : [] } }), 'Added.').then(comps.reload)}>Add competitor</button>
          </div>
        )}
      </Card>
      <Card title="Software review (owner-supplied only)">
        <Notice>Public information cannot show subscriptions, spend or usage. Nothing here recommends cancelling anything; decisions are the owner's.</Notice>
        {sw.loading ? <Loading /> : !sw.data?.length ? <Empty>No inventory supplied.</Empty> : (
          <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Tool</th><th>Monthly</th><th>Source</th><th>Usage</th><th>Classification</th></tr></thead><tbody>
            {sw.data.map((x) => <tr key={x.id}><td>{x.name}<div style={{ color: C.faint, fontSize: 11 }}>{x.category}</div></td><td>{x.monthly_cost_cents == null ? 'unknown' : money(x.monthly_cost_cents)}</td><td>{x.cost_source.replace(/_/g, ' ')}</td><td>{x.usage.replace(/_/g, ' ')}</td><td><Badge value="draft" label={x.classification.replace(/_/g, ' ')} /></td></tr>)}
          </tbody></table></div>
        )}
        <div className="ops-grid" style={{ marginTop: 10 }}>
          <Field label="Tool" id="sw-n"><input id="sw-n" className="ops-input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Monthly cost $ (blank = unknown)" id="sw-c"><input id="sw-c" className="ops-input" value={s.cost} onChange={(e) => setS({ ...s, cost: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Cost source" id="sw-s"><select id="sw-s" className="ops-select" value={s.cost_source} onChange={(e) => setS({ ...s, cost_source: e.target.value })}><option value="owner_supplied">owner supplied</option><option value="authorized_export">authorized export</option><option value="unknown">unknown</option></select></Field>
          <Field label="Usage" id="sw-u"><select id="sw-u" className="ops-select" value={s.usage} onChange={(e) => setS({ ...s, usage: e.target.value })}>{['used', 'rarely_used', 'unused', 'unknown'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></Field>
          <Field label="Classification" id="sw-k"><select id="sw-k" className="ops-select" value={s.classification} onChange={(e) => setS({ ...s, classification: e.target.value })}>{['unknown_usage', 'possible_overlap', 'confirmed_duplicate', 'cancellation_risk', 'keep'].map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
        </div>
        <button className="ops-btn" disabled={act.busy} onClick={() => act.run(() => call('software', { org, caseId, method: 'POST', body: { action: 'create', name: s.name, monthly_cost_cents: s.cost === '' ? null : Math.round(Number(s.cost) * 100), cost_source: s.cost_source, usage: s.usage, classification: s.classification, notes: s.notes } }), 'Added.').then(sw.reload)}>Add tool</button>
      </Card>
    </div>
  )
}

const SRC = ['verified_record', 'owner_provided', 'observed', 'assumed', 'industry_reference']
export function ScenariosTab({ org, caseId, findings }) {
  const d = useLoad(() => call('scenarios', { org, caseId }), [org, caseId])
  const act = useAction()
  const blank = { value: '', source: 'owner_provided', note: '' }
  const [f, setF] = useState({ label: '', finding_id: '', overlap_group: '', eligible_volume: { ...blank }, failure_share: { ...blank, source: 'assumed' }, conversion: { ...blank, source: 'assumed' }, average_sale_cents: { ...blank }, margin_share: { ...blank } })
  const row = (k, label, hint) => (
    <div className="ops-grid" key={k}>
      <Field label={label} id={`sc-${k}`} hint={hint}><input id={`sc-${k}`} className="ops-input" value={f[k].value} onChange={(e) => setF({ ...f, [k]: { ...f[k], value: e.target.value } })} inputMode="decimal" /></Field>
      <Field label="Source" id={`sc-${k}-s`}><select id={`sc-${k}-s`} className="ops-select" value={f[k].source} onChange={(e) => setF({ ...f, [k]: { ...f[k], source: e.target.value } })}>{SRC.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
      <Field label="Note" id={`sc-${k}-n`}><input id={`sc-${k}-n`} className="ops-input" value={f[k].note} onChange={(e) => setF({ ...f, [k]: { ...f[k], note: e.target.value } })} /></Field>
    </div>
  )
  const submit = () => {
    const inputs = {}; for (const k of ['eligible_volume', 'failure_share', 'conversion', 'average_sale_cents', 'margin_share']) if (f[k].value !== '') inputs[k] = { ...f[k], value: k === 'average_sale_cents' ? Math.round(Number(f[k].value) * 100) : Number(f[k].value) }
    act.run(() => call('scenarios', { org, caseId, method: 'POST', body: { action: 'create', label: f.label, finding_id: f.finding_id || null, overlap_group: f.overlap_group || null, inputs } }), (r) => `Saved as ${r.scenario.status}.`).then(d.reload)
  }
  return (
    <Card title="Financial scenarios">
      <Notice tone="warn">A scenario is not a measured loss. Every input shows its source. Only scenarios built entirely from verified records may be called verified. Scenarios that describe the same lost customers share an overlap group and are counted once.</Notice>
      {act.view}
      {d.loading ? <Loading /> : !d.data?.scenarios?.length ? <Empty>No scenarios.</Empty> : (
        <>
          {d.data.scenarios.map((s) => <div key={s.id} style={{ fontSize: 13, padding: '8px 0', borderBottom: `1px solid ${C.line}` }}><strong>{s.label}</strong> <Badge value={s.status === 'verified' ? 'confirmed' : 'draft'} label={s.status} /> {s.overlap_group && <span style={{ color: C.faint }}>group: {s.overlap_group}</span>}<div>{money(s.result.monthly_gross_opportunity_cents)}/month gross{s.result.monthly_contribution_cents != null && ` · ${money(s.result.monthly_contribution_cents)} contribution`}</div><div style={{ color: C.faint, fontSize: 11 }}>{Object.entries(s.result.input_sources).map(([k, v]) => `${k}: ${v.replace(/_/g, ' ')}`).join(' · ')}</div></div>)}
          <p style={{ fontSize: 13 }}>Total, overlaps counted once: <strong>{money(d.data.total.monthly_gross_opportunity_cents)}/month</strong> gross {d.data.total.any_unverified && <Badge value="draft" label="includes assumptions" />}</p>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <div className="ops-grid">
          <Field label="Label" id="sc-l"><input id="sc-l" className="ops-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Finding (optional)" id="sc-f"><select id="sc-f" className="ops-select" value={f.finding_id} onChange={(e) => setF({ ...f, finding_id: e.target.value })}><option value="">—</option>{(findings || []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
          <Field label="Overlap group (optional)" id="sc-g"><input id="sc-g" className="ops-input" value={f.overlap_group} onChange={(e) => setF({ ...f, overlap_group: e.target.value })} /></Field>
        </div>
        {row('eligible_volume', 'Eligible inquiries per month')}{row('failure_share', 'Share not handled (0–1)')}{row('conversion', 'Conversion if handled (0–1)')}{row('average_sale_cents', 'Average sale $')}{row('margin_share', 'Margin share (0–1, optional)', 'Leave blank to report gross only')}
        <button className="ops-btn primary" disabled={act.busy} onClick={submit}>Save scenario</button>
      </div>
    </Card>
  )
}

export function FindingDetailsTab({ org, caseId, findings, onSaved }) {
  const act = useAction(); const [open, setOpen] = useState(null); const [v, setV] = useState({})
  return (
    <Card title="Finding details required for the report">
      {act.view}
      {!findings?.length ? <Empty>No findings yet.</Empty> : findings.map((f) => {
        const missing = ['customer_impact', 'financial_impact_status', 'limitations', 'nova_can_implement', 'owner_decision'].filter((k) => !f[k])
        return (
          <div key={f.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 13 }}>{f.title} <Badge value={f.review_status === 'reviewed' ? 'approved' : 'draft'} label={f.review_status} /></span>{missing.length ? <Badge value="blocked" label={`missing ${missing.length}`} /> : <Badge value="healthy" label="complete" />}<button className="ops-btn" onClick={() => { setOpen(open === f.id ? null : f.id); setV({ customer_impact: f.customer_impact || '', financial_impact_status: f.financial_impact_status || 'unknown', limitations: f.limitations || '', nova_can_implement: f.nova_can_implement || 'unknown', owner_decision: f.owner_decision || '', period_start: f.period_start || '', period_end: f.period_end || '' }) }}>{open === f.id ? 'Close' : 'Edit'}</button></div>
            {open === f.id && (
              <div style={{ marginTop: 8 }}>
                <Field label="Customer impact" id="fd-ci"><textarea id="fd-ci" className="ops-textarea" rows={2} value={v.customer_impact} onChange={(e) => setV({ ...v, customer_impact: e.target.value })} /></Field>
                <div className="ops-grid">
                  <Field label="Financial impact" id="fd-fi"><select id="fd-fi" className="ops-select" value={v.financial_impact_status} onChange={(e) => setV({ ...v, financial_impact_status: e.target.value })}>{['unknown', 'scenario', 'verified', 'none'].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Can Nova implement the remedy?" id="fd-ni"><select id="fd-ni" className="ops-select" value={v.nova_can_implement} onChange={(e) => setV({ ...v, nova_can_implement: e.target.value })}>{['unknown', 'yes', 'partial', 'no'].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Period from" id="fd-ps"><input id="fd-ps" type="date" className="ops-input" value={v.period_start} onChange={(e) => setV({ ...v, period_start: e.target.value })} /></Field>
                  <Field label="Period to" id="fd-pe"><input id="fd-pe" type="date" className="ops-input" value={v.period_end} onChange={(e) => setV({ ...v, period_end: e.target.value })} /></Field>
                </div>
                <Field label="Limitations / confidence notes" id="fd-l"><textarea id="fd-l" className="ops-textarea" rows={2} value={v.limitations} onChange={(e) => setV({ ...v, limitations: e.target.value })} /></Field>
                <Field label="Owner decision required" id="fd-od"><input id="fd-od" className="ops-input" value={v.owner_decision} onChange={(e) => setV({ ...v, owner_decision: e.target.value })} /></Field>
                <button className="ops-btn primary" disabled={act.busy} onClick={() => act.run(() => call('finding-details', { org, caseId, method: 'POST', body: { finding_id: f.id, ...v } }), (r) => (r.review_reset ? 'Saved. The finding changed after review, so it needs review again.' : 'Saved.')).then(onSaved)}>Save details</button>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

export function DeliveryTab({ org, caseId, reports, onSaved }) {
  const act = useAction(); const [summary, setSummary] = useState(''); const [limits, setLimits] = useState(''); const [next, setNext] = useState(''); const [link, setLink] = useState(null); const [emailTo, setEmailTo] = useState('')
  const approved = (reports || []).filter((r) => r.status === 'approved')
  const download = async (id) => { const r = await act.run(() => call('report-pdf', { org, caseId, query: { report_id: id } }), 'PDF ready.'); if (r?.pdf_base64) { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdf_base64}`; a.download = r.filename; a.click() } }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {act.view}
      <Card title="Compose a report from recorded evidence">
        <Field label="One-page executive summary" id="dv-sum"><textarea id="dv-sum" className="ops-textarea" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
        <Field label="Additional limitations" id="dv-lim"><textarea id="dv-lim" className="ops-textarea" rows={2} value={limits} onChange={(e) => setLimits(e.target.value)} /></Field>
        <Field label="Next steps" id="dv-next"><input id="dv-next" className="ops-input" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <button className="ops-btn primary" disabled={act.busy} onClick={() => act.run(() => call('compose', { org, caseId, method: 'POST', body: { executive_summary: summary, limitations: limits, next_steps: next } }), (r) => `Draft v${r.report.version} created. Review and approve it in the Report tab.`).then(onSaved)}>Compose draft</button>
        <p style={{ color: C.faint, fontSize: 12 }}>Only reviewed findings are included. If nothing substantial was found, say so in the summary.</p>
      </Card>
      <Card title="Approved versions and client access">
        {!approved.length ? <Empty>No approved version yet.</Empty> : approved.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 13 }}>v{r.version} · approved {when(r.approved_at)}</span>
            <button className="ops-btn" onClick={() => download(r.id)}>Download PDF</button>
            <button className="ops-btn" onClick={async () => { const x = await act.run(() => call('publish', { org, caseId, method: 'POST', body: { report_id: r.id } }), (y) => y.note); if (x?.link) setLink(x.link) }}>Make available (link only)</button>
            <button className="ops-btn primary" disabled={act.busy || !emailTo.trim()} onClick={async () => { const x = await act.run(() => call('publish', { org, caseId, method: 'POST', body: { report_id: r.id, email_to: emailTo.trim() } }), (y) => `Email: ${y.notification_status}. ${y.note}`); if (x?.link) setLink(x.link) }}>Email link to client</button>
          </div>
        ))}
        <Field label="Client email for the report link" id="dv-email"><input id="dv-email" type="email" className="ops-input" placeholder="owner@client-business.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /></Field>
        {link && <Notice tone="ok">Client link (shown once; share only with the client): <span style={{ wordBreak: 'break-all' }}>{link}</span></Notice>}
        <p style={{ color: C.faint, fontSize: 12 }}>States are kept separate: generated → approved → available to client → notification sent → provider-confirmed delivery. "Make available" sends nothing. "Email link to client" sends the link once per version and address; a second send needs an explicit resend through the API.</p>
      </Card>
    </div>
  )
}
