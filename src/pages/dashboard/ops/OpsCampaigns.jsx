import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, useLoad, C, Card, Field, Loading, ErrorBox, Empty, Badge, PageHeader, when, useAction, Notice } from './ui'

// Minimal CSV parser (quoted fields supported). Headers: name, phone, last_date.
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch; continue }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = '' } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = [] } else cur += ch
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
}

export default function OpsCampaigns() {
  const { orgId } = useOutletContext()
  const list = useLoad(() => api('campaigns', { org: orgId }), [orgId])
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', message: 'Hi {{first_name}}, this is {{business_name}}. Would you like us to schedule your next visit? Reply STOP to opt out.', csv: '', budget: '' })
  const act = useAction()
  const rows = form.csv ? parseCsv(form.csv) : []
  const create = async (e) => {
    e.preventDefault()
    const r = await act.run(() => api('campaigns', { org: orgId, method: 'POST', body: { action: 'create', name: form.name, purpose: 'past_customer_reactivation', message: form.message, rows, message_budget: form.budget === '' ? null : Number(form.budget) } }), (x) => `Imported ${x.preview.total_rows} rows: ${x.preview.eligible} eligible, ${x.preview.blocked} blocked. Review before approval.`)
    if (r?.campaign) nav(`/dashboard/ops/campaigns/${r.campaign.id}`)
  }
  const onFile = async (f) => { if (!f) return; const t = await f.text(); setForm((s) => ({ ...s, csv: t })) }
  return (
    <>
      <PageHeader title="Nova Revive" sub="Recover stalled requests and re-contact past customers who gave permission. Nothing is sent until the owner approves the exact rules, people and message." />
      <ErrorBox error={list.error} onRetry={list.reload} />
      <StalledCampaign orgId={orgId} onCreated={(id) => nav(`/dashboard/ops/campaigns/${id}`)} />
      <div className="ops-two" style={{ marginTop: 16 }}>
        <Card title="Campaigns">
          {list.loading ? <Loading /> : !list.data?.length ? <Empty>No campaigns.</Empty> : (
            <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Name</th><th>Status</th><th>Sent</th><th>Created</th></tr></thead><tbody>
              {list.data.map((c) => <tr key={c.id} className="clickable" onClick={() => nav(`/dashboard/ops/campaigns/${c.id}`)}><td><Link to={`/dashboard/ops/campaigns/${c.id}`} style={{ color: C.text }}>{c.name}</Link></td><td><Badge value={c.status} /></td><td>{c.sent_count}{c.message_budget != null ? ` / ${c.message_budget}` : ''}</td><td style={{ color: C.dim }}>{when(c.created_at)}</td></tr>)}
            </tbody></table></div>
          )}
        </Card>
        <Card title="Past-customer list (draft)">
          <form onSubmit={create}>
            <Field label="Name" id="cp-name"><input id="cp-name" className="ops-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Message" id="cp-msg" hint="Must identify the business ({{business_name}}) and include opt-out wording (STOP). No prices or promotional claims."><textarea id="cp-msg" className="ops-textarea" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <Field label="Customer list (CSV with name, phone, last_date)" id="cp-file"><input id="cp-file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="ops-input" /></Field>
            <Field label="…or paste CSV" id="cp-csv"><textarea id="cp-csv" className="ops-textarea" rows={4} value={form.csv} onChange={(e) => setForm({ ...form, csv: e.target.value })} placeholder={'name,phone,last_date\nPat Example,203-555-0100,2026-05-01'} /></Field>
            <Field label="Message budget (optional cap)" id="cp-budget"><input id="cp-budget" className="ops-input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} inputMode="numeric" /></Field>
            <p style={{ color: C.faint, fontSize: 12 }}>{rows.length} row(s) read. Nothing is sent when you import.</p>
            <button className="ops-btn primary" disabled={act.busy || !rows.length}>Import and preview</button>
            {act.view}
          </form>
        </Card>
      </div>
    </>
  )
}

const REASONS = [['incomplete_inquiry', 'Inquiries that stopped before a service was chosen'], ['abandoned_quote', 'Quotes the customer never booked'], ['unfinished_booking', 'Bookings left before signing or paying'], ['missed_appointment', 'Missed appointments']]

// Revive from the business's own records: the rules shown are proposals until the owner approves the campaign.
function StalledCampaign({ orgId, onCreated }) {
  const [rules, setRules] = useState({ reasons: REASONS.map(([k]) => k), min_age_days: 2, max_age_days: 90, attempt_limit: 1, attempt_window_days: 30 })
  const [name, setName] = useState('Follow up on stalled requests')
  const [message, setMessage] = useState('Hi {{first_name}}, this is {{business_name}} following up on {{service_name}}. Would you still like to book? Reply YES for open times, or STOP to opt out.')
  const key = JSON.stringify(rules)
  const preview = useLoad(() => api('campaigns', { org: orgId, query: { view: 'stalled-preview', rules: key } }), [orgId, key])
  const act = useAction()
  const num = (k) => (e) => setRules({ ...rules, [k]: Number(e.target.value) })
  const create = async () => {
    const r = await act.run(() => api('campaigns', { org: orgId, method: 'POST', body: { action: 'create', purpose: 'stalled_recovery', name, message, rules } }), (x) => `Found ${x.preview.total_rows} stalled record(s): ${x.preview.eligible} eligible. Review before approval.`)
    if (r?.campaign) onCreated(r.campaign.id)
  }
  const pv = preview.data?.preview
  return (
    <Card title="Recover stalled requests (from your own records)">
      <div className="ops-two">
        <div>
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}><legend style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Which stalled records</legend>
            {REASONS.map(([k, l]) => <label key={k} style={{ display: 'block', fontSize: 13, marginBottom: 4 }}><input type="checkbox" checked={rules.reasons.includes(k)} onChange={(e) => setRules({ ...rules, reasons: e.target.checked ? [...rules.reasons, k] : rules.reasons.filter((x) => x !== k) })} /> {l}</label>)}
          </fieldset>
          <Field label="Only records idle at least (days)" id="rv-min"><input id="rv-min" type="number" min={1} className="ops-input" value={rules.min_age_days} onChange={num('min_age_days')} /></Field>
          <Field label="…and at most (days)" id="rv-max"><input id="rv-max" type="number" min={1} className="ops-input" value={rules.max_age_days} onChange={num('max_age_days')} /></Field>
          <Field label="Messages per person, at most" id="rv-lim" hint="Counted across all campaigns in the window below."><input id="rv-lim" type="number" min={1} max={5} className="ops-input" value={rules.attempt_limit} onChange={num('attempt_limit')} /></Field>
          <Field label="Window (days)" id="rv-win"><input id="rv-win" type="number" min={1} className="ops-input" value={rules.attempt_window_days} onChange={num('attempt_window_days')} /></Field>
        </div>
        <div>
          <Field label="Campaign name" id="rv-name"><input id="rv-name" className="ops-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Message" id="rv-msg" hint="{{service_name}} is the service they asked about. Must identify the business and include STOP. No prices, urgency or personal claims."><textarea id="rv-msg" className="ops-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
          {preview.loading ? <Loading /> : preview.error ? <Notice tone="bad">{preview.error.message}</Notice> : pv && (
            <div style={{ fontSize: 13, marginBottom: 10 }} data-testid="revive-preview">
              <strong>{pv.total_rows}</strong> stalled record(s) match; <strong>{pv.eligible}</strong> eligible.
              {Object.entries(pv.by_reason).filter(([k]) => k !== 'eligible').map(([k, v]) => <div key={k} style={{ color: C.faint }}>{k.replace(/_/g, ' ')}: {v}</div>)}
            </div>
          )}
          <button className="ops-btn primary" disabled={act.busy || !pv?.total_rows} onClick={create}>Save as draft for approval</button>
          <p style={{ color: C.faint, fontSize: 12 }}>These settings are a proposal. Nothing is sent until the owner approves this exact campaign.</p>
          {act.view}
        </div>
      </div>
    </Card>
  )
}

export function OpsCampaignDetail() {
  const { orgId, business } = useOutletContext()
  const { id } = useParams()
  const d = useLoad(() => api('campaign', { org: orgId, query: { id } }), [orgId, id])
  const [att, setAtt] = useState(''); const act = useAction()
  const go = (action, body = {}, ok) => act.run(() => api('campaigns', { org: orgId, method: 'POST', body: { action, campaign_id: id, ...body } }), ok).then((r) => { d.reload(); return r })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />
  const { campaign: c, recipients, preview, outcomes: o } = d.data
  const money = (v) => `$${((v || 0) / 100).toFixed(2)}`
  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link to="/dashboard/ops/campaigns" style={{ color: C.gold, fontSize: 13 }}>← Campaigns</Link></p>
      <PageHeader title={c.name} sub={<>Status <Badge value={c.status} /> · {preview.eligible} eligible of {preview.total_rows} imported</>} />
      {act.view}
      <div className="ops-two">
        <Card title="Message">
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{c.message_template}</p>
          <p style={{ color: C.faint, fontSize: 12 }}>Batches of {c.batch_size}, {c.min_gap_seconds}–{c.max_gap_seconds} s apart. Quiet hours, opt-outs, replies, bookings and active requests are re-checked before every message.</p>
          <div style={{ fontSize: 13 }}>{Object.entries(preview.by_reason).map(([k, v]) => <div key={k}>{k.replace(/_/g, ' ')}: <strong>{v}</strong></div>)}</div>
        </Card>
        <Card title="Approval and control">
          {c.status === 'draft' && (business.can_configure ? (
            <>
              <Field label="Written permission confirmation" id="att" hint="Confirm how these customers agreed to be contacted for this purpose. This is recorded with your name."><textarea id="att" className="ops-textarea" rows={3} value={att} onChange={(e) => setAtt(e.target.value)} /></Field>
              <button className="ops-btn primary" disabled={act.busy} onClick={() => go('approve', { attestation: att }, 'Approved. The exact audience, message, schedule and budget are frozen.')}>Approve campaign</button>
            </>
          ) : <Notice tone="warn">Waiting for the business owner's approval.</Notice>)}
          {c.status === 'approved' && business.can_configure && <button className="ops-btn primary" disabled={act.busy} onClick={() => go('start', {}, (x) => `Scheduled ${x.scheduled} message(s)${x.mode === 'live' ? '' : ' — DRY RUN: messaging is not live, nothing will be sent'}.`)}>Start</button>}
          {c.status === 'running' && <button className="ops-btn" disabled={act.busy} onClick={() => go('pause', {}, 'Paused.')}>Pause</button>}
          {c.status === 'paused' && business.can_configure && <button className="ops-btn" disabled={act.busy} onClick={() => go('resume', {}, 'Resumed.')}>Resume</button>}
          {['draft', 'approved', 'running', 'paused'].includes(c.status) && <button className="ops-btn danger" style={{ marginLeft: 8 }} disabled={act.busy} onClick={() => go('cancel', { reason: 'cancelled from dashboard' }, 'Cancelled; nothing further will be sent.')}>Cancel</button>}
          {c.approval_snapshot && <p style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>Approved {when(c.approved_at)} for {c.approval_snapshot.eligible_count} recipients.</p>}
          {c.rules && <p style={{ color: C.faint, fontSize: 12 }}>Rules{c.approval_snapshot?.rules ? ' (approved)' : ' (proposed)'}: {c.rules.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}; idle {c.rules.min_age_days}–{c.rules.max_age_days} days; at most {c.rules.attempt_limit} message(s) per person per {c.rules.attempt_window_days} days.</p>}
        </Card>
      </div>
      {o && (
        <Card title="Outcomes" style={{ marginTop: 16 }}>
          <table className="ops-table"><tbody>
            {[['Eligible', o.eligible], ['Sent (provider accepted)', o.sent], ['Dry run — not sent', o.dry_run_not_sent], ['Stopped before sending', o.stopped], ['Replied', o.replied], ['Back in qualification or booking', o.qualified], ['Booked', o.booked], ['Completed jobs', o.completed_jobs], ['Completed job value', money(o.completed_job_value_cents)], ['Deposits collected', money(o.deposits_collected_cents)], ['Refunds', money(o.refunds_cents)]].map(([k, v]) => <tr key={k}><td>{k}</td><td><strong>{v}</strong></td></tr>)}
          </tbody></table>
          <p style={{ color: C.faint, fontSize: 12 }}>{o.note}</p>
        </Card>
      )}
      <Card title="Recipients" style={{ marginTop: 16 }}>
        <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Name</th><th>Phone</th><th>{c.purpose === 'stalled_recovery' ? 'Stalled since' : 'Last visit'}</th><th>Eligibility</th><th>Send</th></tr></thead><tbody>
          {recipients.map((r) => <tr key={r.id}><td>{r.display_name || '—'}{r.revive_reason && <div style={{ fontSize: 11, color: C.faint }}>{r.revive_reason.replace(/_/g, ' ')}</div>}</td><td>{r.phone_e164}</td><td>{r.last_service_date || '—'}</td><td><Badge value={r.eligibility} label={r.eligibility === 'eligible' ? 'eligible' : String(r.blocked_reason).replace(/_/g, ' ')} /></td><td><Badge value={r.send_status} label={r.send_status === 'dry_run' ? 'dry run — not sent' : null} />{r.stop_reason && <div style={{ fontSize: 11, color: C.faint }}>{r.stop_reason.replace(/_/g, ' ')}</div>}</td></tr>)}
        </tbody></table></div>
      </Card>
    </>
  )
}
