import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useOrg } from '../../lib/OrgContext'
import { api, Banner, Btn, Field, Tabs, Pill, fmt, CARD, GOLD, inp, lbl } from '../../components/dashboard/pilotUi'

const CHANNELS = ['sms', 'voice', 'email']

// Messaging, booking and operations for the CURRENT organization. Nothing here sends a message: live
// sending is off unless the worker is started with WAVE1_SEND_ENABLED=true, and the eligibility gate
// (consent, opt-out, quiet hours, pause switches, staff takeover) runs again at send time.
export default function PilotConsole() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState('setup')
  if (!currentOrg) return null
  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
      <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Messaging &amp; Booking</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 24 }}>Missed-call follow-up, two-way text, forms and appointments for {currentOrg.name}.</p>
      <Tabs value={tab} onChange={setTab} tabs={[['setup', 'Setup'], ['conversations', 'Conversations'], ['appointments', 'Appointments'], ['operator', 'Operator view']]} />
      {tab === 'setup' && <Setup orgId={currentOrg.id} />}
      {tab === 'conversations' && <Conversations orgId={currentOrg.id} />}
      {tab === 'appointments' && <Appointments orgId={currentOrg.id} />}
      {tab === 'operator' && <Operator orgId={currentOrg.id} />}
    </div>
  )
}

function Setup({ orgId }) {
  const [s, setS] = useState(null)
  const [f, setF] = useState({})
  const [msg, setMsg] = useState(null)
  const load = useCallback(async () => {
    const r = await api('wave1', 'settings', { query: { organization_id: orgId } })
    if (!r.ok) { setMsg({ kind: 'error', t: r.data.error || 'Failed to load settings' }); setS({}); return }
    const d = r.data || {}
    setS(d)
    setF({ timezone: d.timezone || '', qs: d.quiet_hours?.start ?? 21, qe: d.quiet_hours?.end ?? 8, max: d.max_automated_per_day ?? 3, gap: d.min_gap_minutes ?? 10, num: d.sms_number_ref || '', hours: d.business_hours?.summary || '', tpl: d.templates?.missed_call || '', reg: d.provider_registration || 'unknown', cal: d.calcom_event_type_id || '', esc: (d.escalation_contacts || [])[0] || { name: '', phone: '', email: '' }, paused: d.paused === true, chp: d.channels_paused || [] })
  }, [orgId])
  useEffect(() => { load() }, [load])
  if (!s) return <Loader2 style={{ width: 22, height: 22, color: GOLD, animation: 'spin 1s linear infinite' }} />
  const K = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (extra = {}) => {
    const body = { organization_id: orgId, timezone: f.timezone, quiet_hours: { start: Number(f.qs), end: Number(f.qe) }, max_automated_per_day: Number(f.max), min_gap_minutes: Number(f.gap), sms_number_ref: f.num, business_hours: { summary: f.hours }, templates: { missed_call: f.tpl }, provider_registration: f.reg, calcom_event_type_id: f.cal || null, escalation_contacts: f.esc.name || f.esc.phone || f.esc.email ? [f.esc] : [], paused: f.paused, channels_paused: f.chp, ...extra }
    if (!f.timezone) delete body.timezone
    const r = await api('wave1', 'settings', { method: 'POST', body })
    setMsg(r.ok ? { kind: 'ok', t: 'Saved' } : { kind: 'error', t: r.data.error }); if (r.ok) load()
  }
  const formUrl = s.form_token ? `${window.location.origin}/api/client?resource=wave1&op=form-intake&token=${s.form_token}` : null
  return (
    <div>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      <div style={{ ...CARD, borderColor: f.paused ? 'rgba(248,113,113,0.4)' : undefined }}>
        <p style={lbl}>Pause switches</p>
        <label style={{ color: '#fff', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><input type="checkbox" checked={f.paused} onChange={(e) => setF((x) => ({ ...x, paused: e.target.checked }))} /> Pause ALL automation for this organization</label>
        <div style={{ display: 'flex', gap: 14 }}>{CHANNELS.map((c) => <label key={c} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.chp.includes(c)} onChange={(e) => setF((x) => ({ ...x, chp: e.target.checked ? [...x.chp, c] : x.chp.filter((y) => y !== c) }))} /> Pause {c}</label>)}</div>
        <div style={{ marginTop: 12 }}><Btn small onClick={() => save()}>Save switches &amp; settings</Btn></div>
      </div>
      <div style={CARD}>
        <p style={lbl}>Sending rules</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Business timezone (IANA, e.g. America/New_York) — blank blocks all automated sends"><input value={f.timezone} onChange={K('timezone')} style={inp} /></Field>
          <Field label="Phone number for this business (E.164)"><input value={f.num} onChange={K('num')} style={inp} placeholder="+12035550123" /></Field>
          <Field label="Quiet hours start (0-23)"><input type="number" value={f.qs} onChange={K('qs')} style={inp} /></Field>
          <Field label="Quiet hours end (0-23)"><input type="number" value={f.qe} onChange={K('qe')} style={inp} /></Field>
          <Field label="Max automated texts per contact per day"><input type="number" value={f.max} onChange={K('max')} style={inp} /></Field>
          <Field label="Minimum gap between automated texts (minutes)"><input type="number" value={f.gap} onChange={K('gap')} style={inp} /></Field>
        </div>
        <Field label="Business hours (as the owner states them)"><input value={f.hours} onChange={K('hours')} style={inp} placeholder="Mon-Fri 8am-5pm" /></Field>
        <Field label="Missed-call text — the owner must have reviewed this exact wording"><textarea rows={3} value={f.tpl} onChange={K('tpl')} style={{ ...inp, resize: 'vertical' }} placeholder="Sorry we missed your call. How can we help? Reply STOP to opt out." /></Field>
      </div>
      <div style={CARD}>
        <p style={lbl}>Human escalation contact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {['name', 'phone', 'email'].map((k) => <Field key={k} label={k}><input value={f.esc[k] || ''} onChange={(e) => setF((x) => ({ ...x, esc: { ...x.esc, [k]: e.target.value } }))} style={inp} /></Field>)}
        </div>
      </div>
      <div style={CARD}>
        <p style={lbl}>Provider &amp; scheduling</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Messaging registration status (from the provider, not assumed)"><select value={f.reg} onChange={K('reg')} style={inp}>{['unknown', 'not_started', 'pending', 'approved', 'rejected'].map((x) => <option key={x} value={x} style={{ background: '#111' }}>{x}</option>)}</select></Field>
          <Field label="Cal.com event type id"><input value={f.cal} onChange={K('cal')} style={inp} placeholder="numeric id" /></Field>
        </div>
      </div>
      <div style={CARD}>
        <p style={lbl}>Website contact form</p>
        {formUrl ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 8 }}>POST a JSON body <code>{'{fields:{name,phone,email,message,sms_consent}, submission_id, rendered_at, website_url_confirm:""}'}</code> to this URL from the client's site. The phone number does NOT grant text consent — only the explicit sms_consent checkbox does. Rotating the token disables the old URL.</p>
            <input readOnly value={formUrl} style={{ ...inp, marginBottom: 10 }} onFocus={(e) => e.target.select()} />
          </>
        ) : <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 10 }}>No form token yet.</p>}
        <Btn small kind="secondary" onClick={() => save({ rotate_form_token: true })}>{s.form_token ? 'Rotate token' : 'Create token'}</Btn>
      </div>
    </div>
  )
}

function Conversations({ orgId }) {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => { const r = await api('wave1', 'conversations', { query: { organization_id: orgId } }); if (r.ok) setList(r.data); else setErr(r.data.error) }, [orgId])
  useEffect(() => { load() }, [load])
  const show = async (id) => { const r = await api('wave1', 'conversations', { query: { organization_id: orgId, id } }); if (r.ok) setOpen(r.data) }
  const takeover = async (on) => { await api('wave1', 'takeover', { method: 'POST', body: { organization_id: orgId, conversation_id: open.id, on } }); show(open.id); load() }
  if (open) {
    return (
      <div>
        <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginBottom: 12, padding: 0, fontFamily: 'inherit' }}>← All conversations</button>
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div><p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{open.contact?.name}</p><p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{open.contact?.phone_e164 || open.contact?.email} · {open.channel}</p></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {open.contact?.suppressed && <Pill text="opted out" tone="bad" />}
              {open.staff_takeover ? <><Pill text="staff has taken over — automation stopped" tone="warn" /><Btn small kind="secondary" onClick={() => takeover(false)}>Hand back</Btn></> : <Btn small onClick={() => takeover(true)}>Take over (stop automation)</Btn>}
            </div>
          </div>
          {open.messages.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>No messages.</p>}
          {open.messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'inbound' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
              <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 10, background: m.direction === 'inbound' ? 'rgba(255,255,255,0.06)' : `${GOLD}18`, border: `1px solid ${m.direction === 'inbound' ? 'rgba(255,255,255,0.08)' : GOLD + '40'}` }}>
                <p style={{ color: '#fff', fontSize: 13 }}>{m.body || <em style={{ color: 'rgba(255,255,255,0.35)' }}>(no text recorded)</em>}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4 }}>{fmt(m.created_at)} · {m.direction === 'outbound' ? (m.automated ? 'automated' : 'staff') : 'received'} · <Pill text={m.status === 'blocked' && m.blocked_reason === 'send_disabled_dry_run' ? 'dry run — not sent' : m.status} tone={['delivered', 'received'].includes(m.status) ? 'good' : ['failed', 'undelivered', 'ambiguous'].includes(m.status) ? 'bad' : 'warn'} />{m.blocked_reason && m.blocked_reason !== 'send_disabled_dry_run' ? ` (${m.blocked_reason})` : ''}</p>
              </div>
            </div>
          ))}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 12 }}>This inbox is read-only: sending a manual reply from here is not implemented yet.</p>
        </div>
      </div>
    )
  }
  return (
    <div>
      <Banner>{err}</Banner>
      {list.length === 0 && !err && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No conversations yet.</p>}
      {list.map((c) => (
        <div key={c.id} onClick={() => show(c.id)} style={{ ...CARD, cursor: 'pointer', padding: '14px 20px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div><p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.crm_contacts?.name || 'Unknown'}</p><p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{c.crm_contacts?.phone_e164} · last inbound {fmt(c.last_inbound_at)}</p></div>
          <div style={{ display: 'flex', gap: 8 }}>{c.crm_contacts?.suppressed && <Pill text="opted out" tone="bad" />}{c.staff_takeover && <Pill text="staff" tone="warn" />}{c.appointment_confirmed && <Pill text="booked" tone="good" />}</div>
        </div>
      ))}
    </div>
  )
}

function Appointments({ orgId }) {
  const [list, setList] = useState([])
  const [contacts, setContacts] = useState([])
  const [msg, setMsg] = useState(null)
  const [f, setF] = useState({ contact_id: '', start_at: '', duration: 30, mode: 'request-manual' })
  const [slots, setSlots] = useState(null)
  const load = useCallback(async () => {
    const [a, c] = await Promise.all([api('wave1', 'appointments', { query: { organization_id: orgId } }), api('crm', 'contacts', { query: { organization_id: orgId, limit: 200 } })])
    if (a.ok) setList(a.data); if (c.ok) setContacts(c.data)
  }, [orgId])
  useEffect(() => { load() }, [load])
  const act = async (body, okText) => {
    const r = await api('wave1', 'appointments', { method: 'POST', body: { organization_id: orgId, ...body } })
    setMsg(r.ok ? { kind: r.data.confirmed === false ? 'warn' : 'ok', t: r.data.note || okText } : { kind: r.status === 202 ? 'warn' : 'error', t: r.data.error }); load()
  }
  const findSlots = async () => {
    const day = f.start_at.slice(0, 10) || new Date().toISOString().slice(0, 10)
    const r = await api('wave1', 'availability', { query: { organization_id: orgId, start: day, end: day } })
    setSlots(r.ok ? r.data.slots : []); if (!r.ok) setMsg({ kind: 'error', t: r.data.error })
  }
  const toIso = (local) => (local ? new Date(local).toISOString() : '')
  return (
    <div>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      <div style={CARD}>
        <p style={lbl}>New appointment</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Contact"><select value={f.contact_id} onChange={(e) => setF((x) => ({ ...x, contact_id: e.target.value }))} style={inp}><option value="" style={{ background: '#111' }}>Select…</option>{contacts.map((c) => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.name} {c.phone || c.email || ''}</option>)}</select></Field>
          <Field label="Start (your local time)"><input type="datetime-local" value={f.start_at} onChange={(e) => setF((x) => ({ ...x, start_at: e.target.value }))} style={inp} /></Field>
          <Field label="How"><select value={f.mode} onChange={(e) => setF((x) => ({ ...x, mode: e.target.value }))} style={inp}><option value="request-manual" style={{ background: '#111' }}>Request only — staff confirm with the customer</option><option value="book" style={{ background: '#111' }}>Book through Cal.com</option></select></Field>
          <Field label="Length (minutes)"><input type="number" value={f.duration} onChange={(e) => setF((x) => ({ ...x, duration: e.target.value }))} style={inp} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn small disabled={!f.contact_id || !f.start_at} onClick={() => act({ action: f.mode, contact_id: f.contact_id, start_at: toIso(f.start_at), duration_minutes: Number(f.duration) }, 'Saved')}>{f.mode === 'book' ? 'Book' : 'Save request'}</Btn>
          {f.mode === 'book' && <Btn small kind="secondary" onClick={findSlots}>Show open times that day</Btn>}
        </div>
        {slots && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>{slots.length ? `Open (shown in your local time): ${slots.map((s) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).join(', ')}` : 'No open times returned by the scheduling source.'}</p>}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10 }}>An appointment is only "confirmed" when the scheduling source says so, or when staff record how the customer confirmed. Anything else stays "requested".</p>
      </div>
      {list.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No appointments.</p>}
      {list.map((a) => (
        <div key={a.id} style={{ ...CARD, padding: '14px 20px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{fmt(a.start_at)} <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>· {contacts.find((c) => c.id === a.contact_id)?.name || 'contact'} · {a.provider}</span></p>
            {a.notes && <p style={{ color: a.notes.startsWith('AMBIGUOUS') ? '#f87171' : 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{a.notes}</p>}
          </div>
          <Pill text={a.status} tone={a.status === 'confirmed' ? 'good' : a.status === 'cancelled' ? 'bad' : 'warn'} />
          {a.status === 'requested' && a.provider === 'manual' && <Btn small kind="secondary" onClick={() => { const n = window.prompt('How was this confirmed with the customer?'); if (n) act({ action: 'confirm', id: a.id, confirmation_note: n }, 'Confirmed') }}>Record confirmation…</Btn>}
          {a.provider === 'calcom' && a.provider_booking_id && a.status !== 'cancelled' && <Btn small kind="secondary" onClick={() => act({ action: 'sync', id: a.id }, 'Synced with Cal.com')}>Sync</Btn>}
          {!['cancelled', 'completed'].includes(a.status) && <Btn small kind="danger" onClick={() => window.confirm('Cancel this appointment?') && act({ action: 'cancel', id: a.id }, 'Cancelled')}>Cancel</Btn>}
        </div>
      ))}
    </div>
  )
}

function Operator({ orgId }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { (async () => { const r = await api('wave1', 'operator', { query: { organization_id: orgId } }); if (r.ok) setD(r.data); else setErr(r.data.error) })() }, [orgId])
  if (err) return <Banner>{err}</Banner>
  if (!d) return <Loader2 style={{ width: 22, height: 22, color: GOLD, animation: 'spin 1s linear infinite' }} />
  return (
    <div>
      {d.paused && <Banner kind="warn">All automation for this organization is PAUSED.</Banner>}
      {d.channels_paused.length > 0 && <Banner kind="warn">Paused channels: {d.channels_paused.join(', ')}</Banner>}
      <div style={CARD}>
        <p style={lbl}>Messages that did not go out normally ({d.problem_messages.length})</p>
        {d.problem_messages.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>None.</p> : d.problem_messages.map((m) => <p key={m.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 0' }}>{fmt(m.created_at)} — <Pill text={m.status} tone="bad" /> {m.blocked_reason || m.error_code || ''} {m.status === 'ambiguous' ? '— outcome unknown: check the provider before anyone resends' : ''}</p>)}
      </div>
      <div style={CARD}>
        <p style={lbl}>Failed or dead-lettered jobs ({d.dead_or_failed_jobs.length})</p>
        {d.dead_or_failed_jobs.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>None.</p> : d.dead_or_failed_jobs.map((j) => <p key={j.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 0' }}>{fmt(j.created_at)} — {j.job_type} — {j.status} — {j.last_error || 'no error recorded'}</p>)}
      </div>
      <div style={CARD}>
        <p style={lbl}>Upcoming appointments ({d.upcoming_appointments.length})</p>
        {d.upcoming_appointments.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>None.</p> : d.upcoming_appointments.map((a) => <p key={a.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 0' }}>{fmt(a.start_at)} — <Pill text={a.status} tone={a.status === 'confirmed' ? 'good' : 'warn'} /></p>)}
      </div>
      <Banner kind="warn">Not available yet (not implemented, so nothing is shown rather than a false "all clear"): {d.not_available.join('; ')}.</Banner>
    </div>
  )
}
