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
      <PageHeader title="Reactivation campaigns" sub="Re-contact past customers who gave permission. Importing a list never creates permission; unknown permission is blocked." />
      <ErrorBox error={list.error} onRetry={list.reload} />
      <div className="ops-two">
        <Card title="Campaigns">
          {list.loading ? <Loading /> : !list.data?.length ? <Empty>No campaigns.</Empty> : (
            <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Name</th><th>Status</th><th>Sent</th><th>Created</th></tr></thead><tbody>
              {list.data.map((c) => <tr key={c.id} className="clickable" onClick={() => nav(`/dashboard/ops/campaigns/${c.id}`)}><td><Link to={`/dashboard/ops/campaigns/${c.id}`} style={{ color: C.text }}>{c.name}</Link></td><td><Badge value={c.status} /></td><td>{c.sent_count}{c.message_budget != null ? ` / ${c.message_budget}` : ''}</td><td style={{ color: C.dim }}>{when(c.created_at)}</td></tr>)}
            </tbody></table></div>
          )}
        </Card>
        <Card title="New campaign (draft)">
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

export function OpsCampaignDetail() {
  const { orgId, business } = useOutletContext()
  const { id } = useParams()
  const d = useLoad(() => api('campaign', { org: orgId, query: { id } }), [orgId, id])
  const [att, setAtt] = useState(''); const act = useAction()
  const go = (action, body = {}, ok) => act.run(() => api('campaigns', { org: orgId, method: 'POST', body: { action, campaign_id: id, ...body } }), ok).then((r) => { d.reload(); return r })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />
  const { campaign: c, recipients, preview } = d.data
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
        </Card>
      </div>
      <Card title="Recipients" style={{ marginTop: 16 }}>
        <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Name</th><th>Phone</th><th>Last visit</th><th>Eligibility</th><th>Send</th></tr></thead><tbody>
          {recipients.map((r) => <tr key={r.id}><td>{r.display_name || '—'}</td><td>{r.phone_e164}</td><td>{r.last_service_date || '—'}</td><td><Badge value={r.eligibility} label={r.eligibility === 'eligible' ? 'eligible' : String(r.blocked_reason).replace(/_/g, ' ')} /></td><td><Badge value={r.send_status} label={r.send_status === 'dry_run' ? 'dry run — not sent' : null} />{r.stop_reason && <div style={{ fontSize: 11, color: C.faint }}>{r.stop_reason.replace(/_/g, ' ')}</div>}</td></tr>)}
        </tbody></table></div>
      </Card>
    </>
  )
}
