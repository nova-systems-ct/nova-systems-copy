import { useState } from 'react'
import { useOrg } from '../../../lib/OrgContext'
import { api, useLoad, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Loading, Stats, Stat, FAINT, useNotice } from '../../../components/sales/kit'

const STAGE_TONE = { won: 'good', lost: 'bad', submitted_for_verification: 'warn', awaiting_signature_payment: 'warn' }

export default function TeamLeads() {
  const { hasPermission } = useOrg()
  const owner = hasPermission('sales.owner')
  const [rep, setRep] = useState('')
  const [stage, setStage] = useState('')
  const [view, setView] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(null)
  const query = { rep_id: rep || undefined, stage: stage || undefined, overdue: view === 'overdue' ? 'true' : undefined, unassigned: view === 'unassigned' ? 'true' : undefined }
  const { data, loading, error, reload } = useLoad(() => api('leads', 'team-list', { method: 'GET', query }), [rep, stage, view])
  const meta = useLoad(() => api('leads', 'meta', { method: 'GET' }), [])
  const reps = useLoad(() => api('salesteam', 'reps', { method: 'GET', query: { status: 'active' } }), [])
  const { notice, show } = useNotice()
  const rows = data?.deals || []
  return (
    <Page eyebrow="Sales Team" title="Leads & pipeline" subtitle="Leads, contacts and the pipeline live in the same CRM as the rest of Nova. Reassigning a lead records who moved it and why." wide actions={owner && <><Btn kind="primary" onClick={() => setAdding('one')}>Create lead</Btn><Btn onClick={() => setAdding('import')}>Import</Btn></>}>
      {notice}
      <Tabs value={view} onChange={setView} tabs={[{ key: 'all', label: 'All' }, { key: 'overdue', label: 'Overdue follow-ups' }, ...(owner ? [{ key: 'unassigned', label: 'Unassigned pool' }] : [])]} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select value={rep} onChange={(e) => setRep(e.target.value)} style={{ maxWidth: 240 }} aria-label="Representative"><option value="">All representatives</option>{(reps.data || []).map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</Select>
        <Select value={stage} onChange={(e) => setStage(e.target.value)} style={{ maxWidth: 240 }} aria-label="Stage"><option value="">All stages</option>{(meta.data?.stages || []).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
      </div>
      {data?.counts && <Stats>{Object.entries(data.counts).filter(([, c]) => c).map(([s, c]) => <Stat key={s} label={label(s)} value={c} />)}</Stats>}
      {error && <Banner tone="bad">{error}</Banner>}
      {loading && !data ? <Loading /> : <Card><Table rows={rows} onRow={(r) => setOpenId(r.id)} empty="No leads match." columns={[
        { key: 'b', label: 'Business', render: (r) => <strong>{r.business_name || '—'}</strong> }, { key: 'r', label: 'Rep', render: (r) => r.rep_name || <Badge tone="warn">Unassigned</Badge> },
        { key: 's', label: 'Stage', render: (r) => <Badge tone={STAGE_TONE[r.stage] || 'gold'}>{label(r.stage)}</Badge> },
        { key: 'n', label: 'Next action', render: (r) => <span style={{ color: r.overdue ? '#f87171' : '#fff' }}>{r.next_action || 'None'}{r.next_action_at ? ` — ${dt(r.next_action_at)}` : ''}{r.overdue && ' (overdue)'}</span> },
        { key: 'st', label: 'Idle', render: (r) => (r.stale_days ? `${r.stale_days}d` : '') },
      ]} /></Card>}
      {openId && <Detail id={openId} owner={owner} reps={reps.data || []} onClose={() => { setOpenId(null); reload() }} show={show} />}
      {adding && <Create mode={adding} reps={reps.data || []} onClose={() => setAdding(null)} onDone={() => { setAdding(null); reload() }} />}
      {owner && rep && <Card title="Bulk action"><Btn kind="danger" onClick={async () => { const to = window.prompt('Reassign ALL open leads of this representative to which user id? (leave empty to return them to the unassigned pool)'); if (to === null) return; const why = window.prompt('Reason:'); if (!why) return; show(await api('leads', 'reassign-from-rep', { body: { from_user_id: rep, to_user_id: to || null, reason: why } }), 'Leads reassigned.'); reload() }}>Reassign all open leads from this rep</Btn><Muted style={{ marginTop: 6, fontSize: 12 }}>Leads already submitted for verification stay with the original rep so credit is not lost.</Muted></Card>}
    </Page>
  )
}

function Detail({ id, owner, reps, onClose, show }) {
  const { data, loading, error, reload } = useLoad(() => api('leads', 'team-get', { method: 'GET', query: { id } }), [id])
  const [to, setTo] = useState('')
  if (loading && !data) return <Modal title="Lead" onClose={onClose} wide><Loading /></Modal>
  if (error && !data) return <Modal title="Lead" onClose={onClose}><Banner tone="bad">{error}</Banner></Modal>
  const { deal, business, contact, activities, stage_history: hist, assignment_history: asg, rep_name } = data
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); return r }
  return (
    <Modal title={business?.name || 'Lead'} onClose={onClose} wide>
      <p style={{ margin: '0 0 10px' }}><Badge tone="gold">{label(deal.stage)}</Badge> Rep: <strong>{rep_name || 'unassigned'}</strong> · {contact?.name} · {contact?.phone || contact?.email} {contact?.do_not_contact && <Badge tone="bad">Do not contact</Badge>}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Select value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 260 }} aria-label="Assign to"><option value="">Choose representative…</option>{owner && <option value="__pool">Return to unassigned pool</option>}{reps.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</Select>
        <Btn disabled={!to} onClick={() => { const why = window.prompt('Reason for reassigning:'); if (why) act(() => api('leads', 'assign', { body: { deal_id: id, to_user_id: to === '__pool' ? null : to, reason: why } }), 'Reassigned.') }}>Reassign</Btn>
        {owner && <Btn kind="quiet" onClick={() => { const s = window.prompt('Override stage to (e.g. contacted, lost) — cannot be "won":'); const why = window.prompt('Written reason (10+ characters):'); if (s && why) act(() => api('leads', 'stage-override', { body: { deal_id: id, to: s, reason: why } }), 'Stage overridden and audited.') }}>Owner stage override</Btn>}
        {owner && contact?.do_not_contact && <Btn kind="quiet" onClick={() => { const why = window.prompt('Documented written permission from the contact (10+ characters):'); if (why) act(() => api('leads', 'clear-dnc', { body: { contact_id: contact.id, reason: why } }), 'Cleared.') }}>Clear do-not-contact</Btn>}
      </div>
      <Card title="Assignment history">{asg.map((a) => <p key={a.id} style={{ margin: '0 0 6px', fontSize: 13 }}><span style={{ color: FAINT }}>{dt(a.created_at)}</span> — {a.reason}</p>)}</Card>
      <Card title="Stage history">{hist.map((h) => <p key={h.id} style={{ margin: '0 0 6px', fontSize: 13 }}><span style={{ color: FAINT }}>{dt(h.created_at)}</span> — {h.from_stage ? `${label(h.from_stage)} → ` : ''}<strong>{label(h.to_stage)}</strong> ({label(h.actor_kind)}){h.reason ? `: ${h.reason}` : ''}</p>)}</Card>
      <Card title="Activity"><Table rows={activities} empty="Nothing logged." columns={[{ key: 'w', label: 'When', render: (a) => dt(a.occurred_at || a.created_at) }, { key: 'k', label: 'Type', render: (a) => label(a.kind) }, { key: 'b', label: 'What', render: (a) => a.body }]} /></Card>
    </Modal>
  )
}

function Create({ mode, reps, onClose, onDone }) {
  const [f, setF] = useState({ business_name: '', website: '', phone: '', city: '', contact_name: '', contact_email: '', contact_phone: '', assign_to: '' })
  const [csv, setCsv] = useState('')
  const [err, setErr] = useState(null)
  const [res, setRes] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const one = async () => { const r = await api('leads', 'owner-create', { body: { ...f, assign_to: f.assign_to || undefined } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  const bulk = async () => {
    const lines = csv.trim().split('\n').map((l) => l.split(',').map((x) => x.trim())); const head = lines.shift() || []
    const rows = lines.filter((l) => l.some(Boolean)).map((l) => Object.fromEntries(head.map((h, i) => [h, l[i] || ''])))
    const r = await api('leads', 'import', { body: { rows, assign_to: f.assign_to || undefined } }); if (r.ok) setRes(r.data); else setErr(r.data?.error)
  }
  return (
    <Modal title={mode === 'one' ? 'Create a lead' : 'Import leads'} onClose={onClose} wide>
      <Field label="Assign to (optional)"><Select value={f.assign_to} onChange={set('assign_to')}><option value="">Unassigned pool</option>{reps.map((r) => <option key={r.user_id} value={r.user_id}>{r.display_name || r.email}</option>)}</Select></Field>
      {mode === 'one' ? <>
        <Field label="Business name"><Input value={f.business_name} onChange={set('business_name')} /></Field><Field label="Website"><Input value={f.website} onChange={set('website')} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="Business phone"><Input value={f.phone} onChange={set('phone')} /></Field><Field label="City"><Input value={f.city} onChange={set('city')} /></Field></div>
        <Field label="Contact name"><Input value={f.contact_name} onChange={set('contact_name')} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="Contact email"><Input value={f.contact_email} onChange={set('contact_email')} /></Field><Field label="Contact phone"><Input value={f.contact_phone} onChange={set('contact_phone')} /></Field></div>
        {err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={one}>Create</Btn>
      </> : <>
        <Field label="CSV (first row = headers)" hint="Headers: business_name, website, phone, city, contact_name, contact_email, contact_phone. Duplicates are skipped. An import never creates consent to text or email."><Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} /></Field>
        {err && <Banner tone="bad">{err}</Banner>}
        {res && <Banner tone="good">{res.created} created · {res.duplicates} duplicates skipped · {res.failed} invalid.</Banner>}
        <Btn kind="primary" onClick={bulk} disabled={!csv.trim()}>Import</Btn> {res && <Btn kind="quiet" onClick={onDone}>Done</Btn>}
      </>}
    </Modal>
  )
}
