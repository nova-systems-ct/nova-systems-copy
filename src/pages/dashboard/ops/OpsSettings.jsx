import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, useLoad, C, Card, Field, Loading, ErrorBox, Empty, Badge, PageHeader, money, when, useAction, Notice } from './ui'

const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu']

export default function OpsSettings() {
  const { orgId, business } = useOutletContext()
  const s = useLoad(() => api('settings', { org: orgId }), [orgId])
  const can = business.can_configure
  return (
    <>
      <PageHeader title="Settings" sub={can ? 'Prices, agreements and policies take effect only after you approve them.' : 'Read-only: only the business owner can change these.'} />
      <ErrorBox error={s.error} onRetry={s.reload} />
      {s.loading ? <Loading /> : s.data && (
        <div style={{ display: 'grid', gap: 16 }}>
          <Profile data={s.data} orgId={orgId} can={can} onSaved={s.reload} />
          <Prices orgId={orgId} can={can} />
          <Templates orgId={orgId} can={can} />
          <div className="ops-two">
            <Payments orgId={orgId} can={can} />
            <Voice data={s.data} orgId={orgId} can={can} onSaved={s.reload} />
          </div>
          <div className="ops-two">
            <Followups data={s.data} orgId={orgId} can={can} onSaved={s.reload} />
            <Reporting data={s.data} orgId={orgId} can={can} onSaved={s.reload} />
          </div>
          {can && <Team orgId={orgId} />}
        </div>
      )}
    </>
  )
}

function Profile({ data, orgId, can, onSaved }) {
  const w = data.wave || {}; const o = data.ops || {}
  const [f, setF] = useState({ display_name: o.display_name || '', industry: o.industry || '', timezone: w.timezone || '', escalation_phone: w.escalation_contacts?.[0]?.phone || '', hours: w.business_hours || {} })
  const act = useAction()
  const setDay = (d, k, v) => setF((x) => ({ ...x, hours: { ...x.hours, [d]: v === null ? undefined : [{ ...(x.hours[d]?.[0] || { start: '08:00', end: '17:00' }), [k]: v }] } }))
  const save = (e) => { e.preventDefault(); const hours = Object.fromEntries(Object.entries(f.hours).filter(([, v]) => v && v[0])); act.run(() => api('settings', { org: orgId, method: 'POST', body: { display_name: f.display_name, industry: f.industry, timezone: f.timezone || undefined, business_hours: hours, escalation_phone: f.escalation_phone } }), 'Saved.').then(onSaved) }
  return (
    <Card title="Business, hours and escalation">
      <form onSubmit={save}>
        <div className="ops-two">
          <Field label="Name customers see" id="p-name"><input id="p-name" className="ops-input" value={f.display_name} disabled={!can} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
          <Field label="Industry" id="p-ind"><input id="p-ind" className="ops-input" value={f.industry} disabled={!can} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Field>
          <Field label="Time zone" id="p-tz" hint="Required. Without it nothing is scheduled or sent."><select id="p-tz" className="ops-select" value={f.timezone} disabled={!can} onChange={(e) => setF({ ...f, timezone: e.target.value })}><option value="">Not set</option>{ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select></Field>
          <Field label="Escalation phone (a real person)" id="p-esc" hint="Calls and conversations that need a person go here."><input id="p-esc" className="ops-input" value={f.escalation_phone} disabled={!can} onChange={(e) => setF({ ...f, escalation_phone: e.target.value })} inputMode="tel" /></Field>
        </div>
        <fieldset style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontSize: 12, color: C.dim, padding: '0 6px' }}>Bookable hours</legend>
          {DAYS.map(([d, l]) => { const v = f.hours[d]?.[0]; return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <label style={{ width: 70, fontSize: 13 }}><input type="checkbox" checked={!!v} disabled={!can} onChange={(e) => setDay(d, 'start', e.target.checked ? '08:00' : null)} /> {l}</label>
              {v && <><input aria-label={`${l} opens`} type="time" className="ops-input" style={{ width: 130 }} value={v.start} disabled={!can} onChange={(e) => setDay(d, 'start', e.target.value)} /><span style={{ color: C.faint }}>to</span><input aria-label={`${l} closes`} type="time" className="ops-input" style={{ width: 130 }} value={v.end} disabled={!can} onChange={(e) => setDay(d, 'end', e.target.value)} /></>}
            </div>) })}
        </fieldset>
        {can && <button className="ops-btn primary" disabled={act.busy}>Save</button>}
        {act.view}
      </form>
      {can && <PauseSwitch paused={!!data.wave?.paused} orgId={orgId} onSaved={onSaved} />}
    </Card>
  )
}
function PauseSwitch({ paused, orgId, onSaved }) {
  const act = useAction()
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 13 }}>Automation is <strong style={{ color: paused ? C.red : C.green }}>{paused ? 'PAUSED' : 'on'}</strong> for this business. </span>
      <button className={`ops-btn${paused ? '' : ' danger'}`} disabled={act.busy} onClick={() => act.run(() => api('settings', { org: orgId, method: 'POST', body: { paused: !paused } }), paused ? 'Automation resumed.' : 'Automation paused: no automated texts will go out.').then(onSaved)}>{paused ? 'Resume automation' : 'Pause all automation'}</button>
      {act.view}
    </div>
  )
}

function Prices({ orgId, can }) {
  const list = useLoad(() => api('prices', { org: orgId }), [orgId])
  const [f, setF] = useState({ service_key: '', name: '', duration_minutes: 60, buffer_minutes: 0, price: '', deposit: '', quote_required: false })
  const act = useAction()
  const create = (e) => { e.preventDefault(); act.run(() => api('prices', { org: orgId, method: 'POST', body: { action: 'create', service_key: f.service_key, name: f.name, duration_minutes: Number(f.duration_minutes), buffer_minutes: Number(f.buffer_minutes), price_cents: f.quote_required ? null : Math.round(Number(f.price) * 100), deposit_cents: Math.round(Number(f.deposit || 0) * 100), quote_required: f.quote_required } }), 'Draft saved. Approve it to make it quotable.').then(list.reload) }
  const go = (id, action) => act.run(() => api('prices', { org: orgId, method: 'POST', body: { action, id } }), action === 'approve' ? 'Approved — this is now the price customers are quoted.' : 'Retired.').then(list.reload)
  return (
    <Card title="Prices (only approved prices are ever quoted)">
      {act.view}
      {list.loading ? <Loading /> : !list.data?.length ? <Empty>No prices yet. Until one is approved, the assistant hands every request to a person.</Empty> : (
        <div className="ops-scroll"><table className="ops-table"><thead><tr><th>Service</th><th>Price</th><th>Deposit</th><th>Length</th><th>Version</th><th>Status</th><th /></tr></thead><tbody>
          {list.data.map((p) => <tr key={p.id}><td>{p.name}<div style={{ color: C.faint, fontSize: 11 }}>{p.service_key}</div></td><td>{p.quote_required ? 'by quote' : money(p.price_cents)}</td><td>{money(p.deposit_cents)}</td><td>{p.duration_minutes}+{p.buffer_minutes} min</td><td>v{p.version}</td><td><Badge value={p.status} />{p.approved_at && <div style={{ color: C.faint, fontSize: 11 }}>{when(p.approved_at)}</div>}</td>
            <td>{can && p.status === 'draft' && <button className="ops-btn" onClick={() => go(p.id, 'approve')}>Approve</button>}{can && p.status === 'approved' && <button className="ops-btn danger" onClick={() => go(p.id, 'retire')}>Retire</button>}</td></tr>)}
        </tbody></table></div>
      )}
      {can && (
        <form onSubmit={create} style={{ marginTop: 14 }}>
          <div className="ops-grid">
            <Field label="Key (letters, digits, _)" id="pr-key"><input id="pr-key" className="ops-input" value={f.service_key} onChange={(e) => setF({ ...f, service_key: e.target.value })} required pattern="[a-z0-9_]{2,40}" /></Field>
            <Field label="Service name" id="pr-name"><input id="pr-name" className="ops-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="Minutes" id="pr-dur"><input id="pr-dur" type="number" className="ops-input" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} min={10} /></Field>
            <Field label="Buffer minutes" id="pr-buf"><input id="pr-buf" type="number" className="ops-input" value={f.buffer_minutes} onChange={(e) => setF({ ...f, buffer_minutes: e.target.value })} min={0} /></Field>
            <Field label="Price $" id="pr-price"><input id="pr-price" className="ops-input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} disabled={f.quote_required} inputMode="decimal" /></Field>
            <Field label="Deposit $" id="pr-dep"><input id="pr-dep" className="ops-input" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} inputMode="decimal" /></Field>
          </div>
          <label style={{ fontSize: 13, color: C.dim, display: 'block', marginBottom: 10 }}><input type="checkbox" checked={f.quote_required} onChange={(e) => setF({ ...f, quote_required: e.target.checked })} /> Priced by quote (the assistant never names a price; an owner enters it)</label>
          <button className="ops-btn" disabled={act.busy}>Save as draft</button>
        </form>
      )}
    </Card>
  )
}

function Templates({ orgId, can }) {
  const list = useLoad(() => api('templates', { org: orgId }), [orgId])
  const [f, setF] = useState({ title: 'Service Agreement', body: 'Agreement between {{business_name}} and {{customer_name}}.\n\nService: {{service_name}}. Price: {{price}}. Deposit: {{deposit}}.\n\nAppointment: {{appointment}}.' }); const [ack, setAck] = useState(false)
  const act = useAction()
  const create = (e) => { e.preventDefault(); act.run(() => api('templates', { org: orgId, method: 'POST', body: { action: 'create', template_key: 'service_agreement', title: f.title, body: f.body } }), 'Draft saved.').then(list.reload) }
  const approve = (id) => act.run(() => api('templates', { org: orgId, method: 'POST', body: { action: 'approve', id, acknowledge_not_legal_advice: ack } }), 'Approved for use with customers.').then(list.reload)
  return (
    <Card title="Customer agreement">
      <Notice tone="warn">Approving text here is your business approval. It is not legal advice and not a legal review — have an attorney review the terms before relying on them.</Notice>
      {act.view}
      {list.loading ? <Loading /> : !list.data?.length ? <Empty>No agreement yet. Without an approved agreement, bookings are handed to a person.</Empty> : list.data.map((t) => (
        <details key={t.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 0' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t.title} v{t.version} <Badge value={t.status} /> <Badge value={t.legal_review === 'attorney_reviewed' ? 'approved' : 'draft'} label={t.legal_review === 'attorney_reviewed' ? 'attorney reviewed' : 'not legally reviewed'} /></summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: C.dim, fontFamily: 'inherit' }}>{t.body}</pre>
          {can && t.status === 'draft' && <><label style={{ fontSize: 12, color: C.dim, display: 'block', margin: '6px 0' }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand this is a business approval, not a legal review.</label><button className="ops-btn" disabled={!ack || act.busy} onClick={() => approve(t.id)}>Approve v{t.version}</button></>}
        </details>
      ))}
      {can && (
        <form onSubmit={create} style={{ marginTop: 12 }}>
          <Field label="Title" id="tp-title"><input id="tp-title" className="ops-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Text" id="tp-body" hint="Allowed fields: {{business_name}} {{customer_name}} {{service_name}} {{price}} {{deposit}} {{appointment}} {{agreement_date}}"><textarea id="tp-body" className="ops-textarea" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <button className="ops-btn" disabled={act.busy}>Save new version as draft</button>
        </form>
      )}
    </Card>
  )
}

function Payments({ orgId, can }) {
  const a = useLoad(() => api('payment-account', { org: orgId }), [orgId])
  const act = useAction()
  const set = (mode) => act.run(() => api('payment-account', { org: orgId, method: 'POST', body: { mode } }), 'Saved.').then(a.reload)
  return (
    <Card title="Deposits">
      {a.loading ? <Loading /> : (
        <>
          <p style={{ fontSize: 13 }}>Mode: <Badge value={a.data?.mode === 'not_configured' ? 'blocked' : 'partial'} label={(a.data?.mode || 'not_configured').replace(/_/g, ' ')} /></p>
          <p style={{ fontSize: 12, color: C.dim }}>Who receives the money: {a.data?.funds_recipient || 'nobody — online deposits are off'}</p>
          <p style={{ fontSize: 12, color: C.faint }}>Live payments are disabled in this version. Paying a business's own Stripe account requires a connection that is not built yet; Nova does not hold client funds by default.</p>
          {can && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="ops-btn" onClick={() => set('nova_test_platform')} disabled={act.busy}>Use Nova TEST mode (test businesses only)</button><button className="ops-btn danger" onClick={() => set('not_configured')} disabled={act.busy}>Turn deposits off</button></div>}
          {act.view}
        </>
      )}
    </Card>
  )
}

function Voice({ data, orgId, can, onSaved }) {
  const v = data.voice || {}
  const [script, setScript] = useState(v.disclosure_script || 'You are speaking with an automated assistant.')
  const act = useAction()
  const save = (status) => act.run(() => api('voice-settings', { org: orgId, method: 'POST', body: { status, disclosure_script: script } }), status === 'active' ? 'Voice assistant active (needs the phone number connected to answer real calls).' : 'Saved.').then(onSaved)
  return (
    <Card title="AI voice receptionist">
      <p style={{ fontSize: 13 }}>Status: <Badge value={v.status === 'active' ? 'healthy' : 'blocked'} label={v.status || 'not configured'} /></p>
      <Field label="Opening disclosure (said first on every call)" id="vc-script"><textarea id="vc-script" className="ops-textarea" rows={2} value={script} disabled={!can} onChange={(e) => setScript(e.target.value)} /></Field>
      <p style={{ fontSize: 12, color: C.faint }}>Without an active assistant, calls are forwarded to your escalation phone. Calls are not recorded. Card numbers are never taken by phone.</p>
      {can && <div style={{ display: 'flex', gap: 8 }}><button className="ops-btn primary" onClick={() => save('active')} disabled={act.busy}>Activate</button><button className="ops-btn" onClick={() => save('paused')} disabled={act.busy}>Pause</button></div>}
      {act.view}
    </Card>
  )
}

function Followups({ data, orgId, can, onSaved }) {
  const o = data.ops || {}
  const [review, setReview] = useState(o.review_url || ''); const [terms, setTerms] = useState(o.referral_terms || '')
  const act = useAction()
  return (
    <Card title="Feedback and referrals">
      <Field label="Review link (shown to every customer asked for feedback)" id="fu-rev" hint="Requests are neutral: no star filtering, no rewards for reviews."><input id="fu-rev" className="ops-input" value={review} disabled={!can} onChange={(e) => setReview(e.target.value)} placeholder="https://…" /></Field>
      {can && <button className="ops-btn" disabled={act.busy} onClick={() => act.run(() => api('settings', { org: orgId, method: 'POST', body: { review_url: review } }), 'Saved.').then(onSaved)}>Save link</button>}
      <Field label={`Referral terms (${o.referral_terms_status || 'none'})`} id="fu-terms" hint="Referral invitations go out only after you approve these terms. They never depend on a review."><textarea id="fu-terms" className="ops-textarea" rows={3} value={terms} disabled={!can} onChange={(e) => setTerms(e.target.value)} /></Field>
      {can && <div style={{ display: 'flex', gap: 8 }}><button className="ops-btn" disabled={act.busy} onClick={() => act.run(() => api('settings', { org: orgId, method: 'POST', body: { referral_terms: terms } }), 'Saved as draft.').then(onSaved)}>Save draft</button>{o.referral_terms_status === 'draft' && <button className="ops-btn primary" disabled={act.busy} onClick={() => act.run(() => api('settings', { org: orgId, method: 'POST', body: { approve_referral_terms: true } }), 'Referral terms approved.').then(onSaved)}>Approve terms</button>}</div>}
      {act.view}
    </Card>
  )
}

function Reporting({ data, orgId, can, onSaved }) {
  const o = data.ops || {}
  const [f, setF] = useState({ phone: o.scoreboard_recipient_phone || '', consent: false, attribution: o.attribution_method || '', fee: o.nova_fee_cents_monthly != null ? String(o.nova_fee_cents_monthly / 100) : '', labor: o.labor_minutes_per_inquiry || '', laborOk: !!o.labor_baseline_approved })
  useEffect(() => { setF((x) => ({ ...x, phone: o.scoreboard_recipient_phone || '' })) }, [o.scoreboard_recipient_phone])
  const act = useAction()
  const save = () => act.run(() => api('settings', { org: orgId, method: 'POST', body: { ...(f.phone !== (o.scoreboard_recipient_phone || '') ? { scoreboard_phone: f.phone, scoreboard_sms_consent: f.consent } : {}), attribution_method: f.attribution || null, nova_fee_cents_monthly: f.fee === '' ? null : Math.round(Number(f.fee) * 100), labor_minutes_per_inquiry: f.labor === '' ? null : Number(f.labor), labor_baseline_approved: f.laborOk } }), 'Saved.').then(onSaved)
  return (
    <Card title="Weekly report">
      <Field label="Owner's mobile for the Sunday text" id="rp-phone"><input id="rp-phone" className="ops-input" value={f.phone} disabled={!can} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
      <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 10 }}><input type="checkbox" checked={f.consent} disabled={!can} onChange={(e) => setF({ ...f, consent: e.target.checked })} /> The owner agreed to receive this weekly report by text.</label>
      <Field label="Attribution method (blank = no 'revenue from Nova' figure)" id="rp-attr"><input id="rp-attr" className="ops-input" value={f.attribution} disabled={!can} onChange={(e) => setF({ ...f, attribution: e.target.value })} placeholder="e.g. deposits on jobs that started from a missed call, campaign or referral" /></Field>
      <div className="ops-two">
        <Field label="Nova monthly fee $ (for return calculation)" id="rp-fee"><input id="rp-fee" className="ops-input" value={f.fee} disabled={!can} onChange={(e) => setF({ ...f, fee: e.target.value })} inputMode="decimal" /></Field>
        <Field label="Minutes a person spends per inquiry" id="rp-lab"><input id="rp-lab" className="ops-input" value={f.labor} disabled={!can} onChange={(e) => setF({ ...f, labor: e.target.value })} inputMode="numeric" /></Field>
      </div>
      <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 10 }}><input type="checkbox" checked={f.laborOk} disabled={!can} onChange={(e) => setF({ ...f, laborOk: e.target.checked })} /> I approve this baseline for "estimated time avoided" (always labeled as an estimate).</label>
      {can && <button className="ops-btn primary" disabled={act.busy} onClick={save}>Save</button>}
      {act.view}
    </Card>
  )
}

function Team({ orgId }) {
  const [f, setF] = useState({ email: '', name: '', role: 'client_employee' }); const act = useAction()
  return (
    <Card title="People">
      <div className="ops-grid">
        <Field label="Email" id="tm-email"><input id="tm-email" type="email" className="ops-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Name" id="tm-name"><input id="tm-name" className="ops-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role" id="tm-role"><select id="tm-role" className="ops-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="client_employee">Staff (inbox, requests, jobs)</option><option value="client_owner">Owner (everything, incl. prices and approvals)</option></select></Field>
      </div>
      <button className="ops-btn" disabled={act.busy || !f.email} onClick={() => act.run(() => api('invite-owner', { org: orgId, method: 'POST', body: f }), (r) => r.next_step)}>Add person</button>
      {act.view}
    </Card>
  )
}
