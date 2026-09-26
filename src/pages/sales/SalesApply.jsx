import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { api, dt } from '../../lib/salesApi'
import { useSEO } from '../../hooks/useSEO'
import { PublicShell, Card, Muted, Btn, Field, Input, Textarea, Select, Check, Banner, Badge, GOLD, FAINT, Loading } from '../../components/sales/kit'

const SCENARIOS = [
  { key: 'scenario_no_data', prompt: 'A small-business owner asks: "How much more money will I make if I hire Nova?" You have not looked at their business yet. What do you say, and why?' },
  { key: 'scenario_objection', prompt: 'A prospect says they already have a website and "everything is fine." What is your next question, and what are you trying to learn?' },
]
const CHANNELS = [['in_person', 'In-person visits'], ['telephone', 'Telephone'], ['email', 'Email'], ['messaging', 'Text / social messaging'], ['other', 'Other approved channel']]
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const FALLBACK_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu']
const EMPTY = { name: '', phone: '', city: '', timezone: '', hours_per_week: '', availability_days: [], preferred_hours: '', availability_notes: '', experience: '', channels: [], motivation: '', scenario_no_data: '', scenario_objection: '', ack_privacy: false, ack_truthful: false, ack_no_guarantee: false, ack_conduct: false }

// Public application for the Sales Representative role. Applicants are real signed-in users (magic link), so they can save, leave and
// resume, and see ONLY their own status. Reviewer notes and scores are never sent to this page.
export default function SalesApply() {
  useSEO({ title: 'Apply — Sales Representative | Nova Systems', description: 'Apply to join Nova Systems as a sales representative.' })
  const loc = useLocation()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(undefined)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null))
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const loadMe = async () => {
    const r = await api('apply', 'me', { method: 'GET' })
    if (r.ok) { setMe(r.data); setLoadError(null) } else if (r.status === 401) { setMe(null); setSession(null) } else setLoadError(r.data?.error || 'Could not load your application.')
  }
  useEffect(() => { if (session) loadMe(); else if (session === null) setMe(null) }, [session])

  if (session === undefined) return <PublicShell><Loading /></PublicShell>
  if (!session) return <PublicShell narrow><Start statusOnly={loc.pathname === '/apply/status'} /></PublicShell>
  if (loadError) return <PublicShell><Banner tone="bad">{loadError}</Banner></PublicShell>
  if (me === undefined) return <PublicShell><Loading /></PublicShell>
  if (!me?.application) return <PublicShell narrow><Start statusOnly={false} note="We could not find an application for this account. Start one below." /></PublicShell>
  const app = me.application
  return (
    <PublicShell>
      {app.can_edit ? <Form app={app} reload={loadMe} /> : <Status app={app} reload={loadMe} />}
      <p style={{ marginTop: 28, color: FAINT, fontSize: 12 }}>
        Signed in as {session.user.email}. <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 12, padding: 0 }}>Sign out</button>
      </p>
    </PublicShell>
  )
}

function Start({ statusOnly, note }) {
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null)
    const r = await api('apply', 'start', { body: { email, hp } })
    setBusy(false)
    if (r.ok) setSent(true); else setError(r.data?.error || 'Something went wrong.')
  }
  if (sent) return (
    <Card title="Check your email">
      <Muted>If that address can apply, a one-time sign-in link is on its way. Open it on this device to {statusOnly ? 'see your application status' : 'start or continue your application'}. You can close this page.</Muted>
    </Card>
  )
  return (
    <>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Careers</p>
      <h1 style={{ fontSize: 'clamp(26px,5vw,34px)', fontWeight: 800, margin: '6px 0 12px' }}>{statusOnly ? 'Check your application' : 'Apply as a sales representative'}</h1>
      <Muted style={{ marginBottom: 20 }}>
        Nova investigates how a business handles new customers before recommending anything, and our representatives sell the same way: honestly, with evidence, and with no invented figures or guarantees.
        There is <strong>no income, role or work guaranteed</strong> at the application stage. We review every application personally.
      </Muted>
      {note && <Banner tone="warn">{note}</Banner>}
      <Card title="Start or continue">
        <form onSubmit={submit}>
          <Field label="Email address" hint="We email you a one-time link, so you can save your progress and come back. No password is needed to apply.">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-5000px' }}><label>Leave blank<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label></div>
          {error && <Banner tone="bad">{error}</Banner>}
          <Btn kind="primary" type="submit" disabled={busy || !email}>{busy ? 'Sending…' : 'Email me a link'}</Btn>
        </form>
      </Card>
      <Muted style={{ fontSize: 12 }}>We only ask what we need. We never ask for a Social Security number, bank details, government ID or tax information in an application. <Link to="/privacy" style={{ color: GOLD }}>Privacy policy</Link></Muted>
    </>
  )
}

function Form({ app, reload }) {
  const [p, setP] = useState({ ...EMPTY, ...(app.profile || {}), hours_per_week: app.profile?.hours_per_week ?? '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState(null)
  const dirty = useRef(false)
  const zones = useMemo(() => { try { return Intl.supportedValuesOf('timeZone') } catch { return FALLBACK_ZONES } }, [])
  useEffect(() => { if (!p.timezone) { try { setP((x) => ({ ...x, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })) } catch { /* keep blank */ } } }, [])
  const set = (k, v) => { dirty.current = true; setP((x) => ({ ...x, [k]: v })) }
  const toggle = (k, v) => set(k, p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v])

  const save = async (silent) => {
    setSaving(true)
    const r = await api('apply', 'save', { body: { profile: { ...p, hours_per_week: p.hours_per_week === '' ? null : Number(p.hours_per_week) } } })
    setSaving(false)
    if (r.ok) { setSavedAt(new Date()); dirty.current = false; setErrors({}) } else { setErrors(r.data?.errors || {}); if (!silent) setBanner({ tone: 'bad', text: r.data?.error || 'Could not save.' }) }
    return r
  }
  useEffect(() => { const t = setInterval(() => { if (dirty.current && !submitting) save(true) }, 20000); return () => clearInterval(t) }) // autosave

  const submit = async (e) => {
    e.preventDefault(); setSubmitting(true); setBanner(null)
    const r = await api('apply', 'submit', { body: { profile: { ...p, hours_per_week: p.hours_per_week === '' ? null : Number(p.hours_per_week) } } })
    setSubmitting(false)
    if (r.ok) { reload(); window.scrollTo({ top: 0 }) } else { setErrors(r.data?.errors || {}); setBanner({ tone: 'bad', text: r.data?.error || 'Could not submit.' }); document.getElementById('form-top')?.scrollIntoView() }
  }
  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 3 * 1024 * 1024) return setBanner({ tone: 'bad', text: 'Files must be 3 MB or smaller.' })
    const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(f) })
    const r = await api('apply', 'upload-resume', { body: { file_base64: b64 } })
    setBanner(r.ok ? { tone: 'good', text: 'Résumé uploaded. Only Nova reviewers can see it.' } : { tone: 'bad', text: r.data?.error || 'Upload failed.' })
    if (r.ok) reload()
    e.target.value = ''
  }
  const withdraw = async () => { if (!window.confirm('Withdraw this application? You can apply again later.')) return; const r = await api('apply', 'withdraw', { body: {} }); if (r.ok) reload(); else setBanner({ tone: 'bad', text: r.data?.error || 'Could not withdraw.' }) }
  const E = (k) => errors[k]

  return (
    <form onSubmit={submit} noValidate id="form-top">
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Sales representative application</p>
      <h1 style={{ fontSize: 'clamp(24px,5vw,32px)', fontWeight: 800, margin: '6px 0 6px' }}>{app.status === 'changes_requested' ? 'Update your application' : 'Your application'}</h1>
      <Muted style={{ marginBottom: 14 }}>Reference <strong style={{ color: '#fff' }}>{app.reference_code}</strong> · <Badge tone="gold">{app.stage_label}</Badge> · {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Your progress is saved when you press Save, and automatically as you type.'}</Muted>
      <Banner tone="warn">{app.next_step}</Banner>
      {app.open_change_requests?.map((c) => <Banner key={c.id} tone="warn"><strong>From Nova:</strong> {c.message}{c.fields?.length ? <> (fields: {c.fields.join(', ')})</> : null}</Banner>)}
      {banner && <Banner tone={banner.tone} onClose={() => setBanner(null)}>{banner.text}</Banner>}

      <Card title="About you">
        <Field label="Full name" error={E('name')}><Input value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></Field>
        <Field label="Phone" error={E('phone')} hint="A number we can reach you on."><Input type="tel" value={p.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" /></Field>
        <Field label="Location (city, state)" error={E('city')}><Input value={p.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" /></Field>
        <Field label="Time zone" error={E('timezone')}>
          <Select value={p.timezone} onChange={(e) => set('timezone', e.target.value)}><option value="">Choose…</option>{zones.map((z) => <option key={z}>{z}</option>)}</Select>
        </Field>
      </Card>

      <Card title="Availability">
        <Field label="Hours per week you could work" error={E('hours_per_week')}><Input type="number" min="1" max="80" value={p.hours_per_week} onChange={(e) => set('hours_per_week', e.target.value)} /></Field>
        <Field label="Days you are usually available" error={E('availability_days')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DAYS.map(([k, l]) => <button type="button" key={k} onClick={() => toggle('availability_days', k)} aria-pressed={p.availability_days.includes(k)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${p.availability_days.includes(k) ? GOLD : 'rgba(255,255,255,0.15)'}`, background: p.availability_days.includes(k) ? `${GOLD}22` : 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}</div>
        </Field>
        <Field label="Preferred hours" error={E('preferred_hours')}><Input value={p.preferred_hours} onChange={(e) => set('preferred_hours', e.target.value)} placeholder="e.g. weekday evenings, Saturday mornings" /></Field>
        <Field label="Anything else about your availability" error={E('availability_notes')}><Textarea rows={2} value={p.availability_notes} onChange={(e) => set('availability_notes', e.target.value)} /></Field>
      </Card>

      <Card title="Experience">
        <Field label="Relevant sales or customer-service experience" hint="If you have none yet, say so honestly — training is provided." error={E('experience')}><Textarea rows={5} value={p.experience} onChange={(e) => set('experience', e.target.value)} /></Field>
        <Field label="Ways you would be comfortable working with customers" error={E('channels')}>
          {CHANNELS.map(([k, l]) => <Check key={k} checked={p.channels.includes(k)} onChange={() => toggle('channels', k)}>{l}</Check>)}
        </Field>
        <Field label="Why do you want this role?" error={E('motivation')}><Textarea rows={5} value={p.motivation} onChange={(e) => set('motivation', e.target.value)} /></Field>
      </Card>

      <Card title="Two short scenarios" right={<Muted style={{ fontSize: 12 }}>There is no perfect answer — we are looking at how you think.</Muted>}>
        {SCENARIOS.map((s) => <Field key={s.key} label={s.prompt} error={E(s.key)}><Textarea rows={5} value={p[s.key]} onChange={(e) => set(s.key, e.target.value)} /></Field>)}
      </Card>

      <Card title="Résumé (optional)">
        <Muted style={{ marginBottom: 10 }}>PDF or Word, up to 3 MB. It is stored privately; only Nova reviewers can open it.{app.has_resume ? ' A résumé is on file — uploading again replaces it.' : ''}</Muted>
        <input type="file" accept=".pdf,.docx,application/pdf" onChange={upload} aria-label="Upload résumé" />
      </Card>

      <Card title="Privacy and acknowledgements">
        <Muted style={{ marginBottom: 12 }}>We use your answers only to evaluate your application and, if you are accepted, to set up your training. We do not collect bank details, government IDs or tax identifiers at this stage. <Link to="/privacy" style={{ color: GOLD }}>Read the privacy policy</Link>. (Draft notice version — Nova will confirm the final wording.)</Muted>
        <Check checked={p.ack_privacy} onChange={(v) => set('ack_privacy', v)}>I have read the privacy notice and agree that Nova may process my application. {E('ack_privacy') && <em style={{ color: '#f87171' }}>{E('ack_privacy')}</em>}</Check>
        <Check checked={p.ack_truthful} onChange={(v) => set('ack_truthful', v)}>My answers are my own and truthful. {E('ack_truthful') && <em style={{ color: '#f87171' }}>{E('ack_truthful')}</em>}</Check>
        <Check checked={p.ack_no_guarantee} onChange={(v) => set('ack_no_guarantee', v)}>I understand that no income, hiring, interview or work is guaranteed. {E('ack_no_guarantee') && <em style={{ color: '#f87171' }}>{E('ack_no_guarantee')}</em>}</Check>
        <Check checked={p.ack_conduct} onChange={(v) => set('ack_conduct', v)}>I understand that Nova representatives may not invent figures, guarantee results, or make claims they cannot support. {E('ack_conduct') && <em style={{ color: '#f87171' }}>{E('ack_conduct')}</em>}</Check>
      </Card>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn kind="primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : app.status === 'changes_requested' ? 'Resubmit application' : 'Submit application'}</Btn>
        <Btn kind="quiet" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Btn>
        <Btn kind="danger" onClick={withdraw}>Withdraw</Btn>
      </div>
    </form>
  )
}

function Status({ app, reload }) {
  const [busy, setBusy] = useState(false)
  const withdraw = async () => { if (!window.confirm('Withdraw this application?')) return; setBusy(true); await api('apply', 'withdraw', { body: {} }); setBusy(false); reload() }
  const done = app.status === 'submitted' || app.status === 'under_review' || app.status === 'interview_requested'
  return (
    <>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Your application</p>
      <h1 style={{ fontSize: 'clamp(24px,5vw,32px)', fontWeight: 800, margin: '6px 0 14px' }}>{done && app.status === 'submitted' ? 'Thank you — we have your application' : app.stage_label}</h1>
      <Card>
        <p style={{ margin: '0 0 8px' }}>Reference: <strong style={{ color: GOLD, letterSpacing: '0.08em' }}>{app.reference_code}</strong> <Badge tone={app.status === 'accepted' ? 'good' : app.status === 'rejected' ? 'bad' : 'gold'}>{app.stage_label}</Badge></p>
        <Muted>{app.next_step}</Muted>
        {app.applicant_message && <Banner tone="warn"><strong>Message from Nova:</strong> {app.applicant_message}</Banner>}
      </Card>
      {app.history?.length > 0 && (
        <Card title="History">
          {app.history.map((h, i) => <p key={i} style={{ margin: '0 0 6px', fontSize: 13 }}><span style={{ color: FAINT }}>{dt(h.at)}</span> — {h.label}</p>)}
        </Card>
      )}
      {app.invitation && <Card title="Invitation"><Muted>Status: {app.invitation.status}{app.invitation.expires_at ? ` · expires ${dt(app.invitation.expires_at)}` : ''}. The secure link is sent to your email — Nova staff cannot see it again.</Muted></Card>}
      {app.status === 'accepted' && <Card><Muted>After you accept your invitation and set a password you can <Link to="/login" style={{ color: GOLD }}>sign in</Link> to start training. Training never activates your account by itself — Nova activates you separately once everything is complete.</Muted></Card>}
      {['submitted', 'under_review', 'interview_requested', 'accepted'].includes(app.status) && <Btn kind="danger" onClick={withdraw} disabled={busy}>Withdraw application</Btn>}
    </>
  )
}
