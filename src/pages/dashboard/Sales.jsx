import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useOrg } from '../../lib/OrgContext'
import { authedFetch } from '../../lib/apiAuth'
import { api, Banner, Btn, Field, Tabs, Pill, fmt, CARD, GOLD, inp, lbl } from '../../components/dashboard/pilotUi'

const PATH = ['new', 'prospect', 'contacted', 'discovery', 'audit_ordered', 'audit_delivered', 'recommendation', 'proposal', 'pilot_agreement', 'onboarding', 'installation', 'active_pilot', 'results_review']
const OUT = ['won_paid', 'won_extended', 'closed_no_conversion', 'lost', 'disqualified', 'nurture', 'paused']
const TERMINAL = ['won_paid', 'won_extended', 'closed_no_conversion', 'lost', 'disqualified']
const label = (s) => s.replace(/_/g, ' ')

// Owner sales view for the CURRENT organization. Stage rules (loss/win reasons, "proposal accepted with
// evidence before pilot agreement") are enforced by the server; this page shows the server's refusals.
export default function Sales() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState('pipeline')
  if (!currentOrg) return null
  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Growth</p>
      <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Sales &amp; Contacts</h1>
      <Tabs value={tab} onChange={setTab} tabs={[['pipeline', 'Pipeline'], ['contacts', 'Contacts']]} />
      {tab === 'pipeline' ? <Pipeline orgId={currentOrg.id} /> : <Contacts orgId={currentOrg.id} />}
    </div>
  )
}

function Pipeline({ orgId }) {
  const [p, setP] = useState(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [nd, setNd] = useState({ business_id: '' })
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api('crm', 'pipeline', { query: { organization_id: orgId } }), api('crm', 'businesses', { query: { organization_id: orgId } })])
    if (a.ok) { setP(a.data); setErr('') } else setErr(a.data.error || 'Failed to load the pipeline — has the CRM migration been applied?')
    if (b.ok) setBusinesses(b.data)
  }, [orgId])
  useEffect(() => { load() }, [load])
  const create = async () => { const r = await api('crm', 'deals', { method: 'POST', body: { organization_id: orgId, action: 'create', business_id: nd.business_id || null } }); if (r.ok) { setNd({ business_id: '' }); await load(); setOpenId(r.data.deal.id) } else setErr(r.data.error) }
  if (!p) return err ? <Banner>{err}</Banner> : <Loader2 style={{ width: 22, height: 22, color: GOLD, animation: 'spin 1s linear infinite' }} />
  const all = Object.values(p.by_stage).flat()
  const deal = all.find((d) => d.id === openId)
  const nameOf = (d) => businesses.find((b) => b.id === d.business_id)?.name || `Deal ${d.id.slice(0, 6)}`
  if (deal) return <DealPanel key={deal.id} deal={deal} orgId={orgId} title={nameOf(deal)} onBack={() => { setOpenId(null); load() }} onChanged={load} />
  const Row = ({ d }) => (
    <div onClick={() => setOpenId(d.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', flexWrap: 'wrap' }}>
      <span style={{ color: '#fff', fontSize: 13, flex: 1, minWidth: 160 }}>{nameOf(d)}</span>
      <Pill text={label(d.stage)} tone={TERMINAL.includes(d.stage) ? 'bad' : 'warn'} />
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{d.next_action ? `${d.next_action} — ${fmt(d.next_action_at)}` : 'no next action'}</span>
    </div>
  )
  return (
    <div>
      <Banner>{err}</Banner>
      <div style={CARD}>
        <p style={lbl}>New deal</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={nd.business_id} onChange={(e) => setNd({ business_id: e.target.value })} style={inp}><option value="" style={{ background: '#111' }}>No business linked</option>{businesses.map((b) => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}</select>
          <Btn onClick={create}>Create</Btn>
        </div>
      </div>
      {p.overdue_next_action.length > 0 && <div style={{ ...CARD, borderColor: 'rgba(248,113,113,0.3)' }}><p style={{ ...lbl, color: '#f87171' }}>Follow-up overdue ({p.overdue_next_action.length})</p>{p.overdue_next_action.map((d) => <Row key={d.id} d={d} />)}</div>}
      {p.no_next_action.length > 0 && <div style={{ ...CARD, borderColor: `${GOLD}40` }}><p style={{ ...lbl, color: GOLD }}>Open deals with no next action ({p.no_next_action.length})</p>{p.no_next_action.map((d) => <Row key={d.id} d={d} />)}</div>}
      {[...PATH, ...OUT].filter((s) => p.by_stage[s]?.length).map((s) => (
        <div key={s} style={CARD}><p style={lbl}>{label(s)} ({p.by_stage[s].length})</p>{p.by_stage[s].map((d) => <Row key={d.id} d={d} />)}</div>
      ))}
      {all.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No deals yet.</p>}
    </div>
  )
}

function DealPanel({ deal, orgId, title, onBack, onChanged }) {
  const [msg, setMsg] = useState(null)
  const [plan, setPlan] = useState({ next_action: deal.next_action || '', next_action_at: deal.next_action_at ? deal.next_action_at.slice(0, 16) : '', notes: deal.discovery?.notes || '' })
  const [acts, setActs] = useState([])
  const [props, setProps] = useState([])
  const [products, setProducts] = useState([])
  const [na, setNa] = useState({ kind: 'note', body: '', due_at: '' })
  const [np, setNp] = useState({ product_ids: [], price: '' })
  const load = useCallback(async () => {
    const [a, pr, pd] = await Promise.all([api('crm', 'activities', { query: { organization_id: orgId, deal_id: deal.id } }), api('crm', 'proposals', { query: { organization_id: orgId, deal_id: deal.id } }), api('products', 'list', { query: {} })])
    if (a.ok) setActs(a.data); if (pr.ok) setProps(pr.data); if (pd.ok && Array.isArray(pd.data)) setProducts(pd.data)
  }, [orgId, deal.id])
  useEffect(() => { load() }, [load])
  const run = async (fn, okText) => { const r = await fn(); setMsg(r.ok ? { kind: 'ok', t: okText } : { kind: 'error', t: r.data.error }); if (r.ok) { load(); onChanged() } return r }
  const setStage = (stage) => {
    let extra = {}
    if (['lost', 'closed_no_conversion'].includes(stage)) { const r = window.prompt('Why was this lost? (recorded, required)'); if (!r) return; extra = { lost_reason: r } }
    if (['won_paid', 'won_extended'].includes(stage)) { const r = window.prompt('What actually made them say yes? (recorded, required)'); if (!r) return; extra = { win_reason: r } }
    run(() => api('crm', 'deals', { method: 'POST', body: { organization_id: orgId, action: 'update-stage', id: deal.id, stage, ...extra } }), `Moved to ${label(stage)}`)
  }
  const savePlan = () => run(() => api('crm', 'deal-plan', { method: 'POST', body: { organization_id: orgId, id: deal.id, next_action: plan.next_action, next_action_at: plan.next_action_at ? new Date(plan.next_action_at).toISOString() : null, discovery: { ...(deal.discovery || {}), notes: plan.notes } } }), 'Saved')
  const addAct = () => run(() => api('crm', 'activities', { method: 'POST', body: { organization_id: orgId, action: 'create', deal_id: deal.id, kind: na.kind, body: na.body, due_at: na.due_at ? new Date(na.due_at).toISOString() : null } }), 'Added').then((r) => r.ok && setNa({ kind: 'note', body: '', due_at: '' }))
  const closed = TERMINAL.includes(deal.stage)
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginBottom: 12, padding: 0, fontFamily: 'inherit' }}>← Pipeline</button>
      <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 14 }}>{title} <Pill text={label(deal.stage)} tone={closed ? 'bad' : 'warn'} /></h2>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      {!closed && (
        <div style={CARD}>
          <p style={lbl}>Move stage</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[...PATH, ...OUT].filter((s) => s !== deal.stage).map((s) => <Btn key={s} small kind={['lost', 'closed_no_conversion', 'disqualified'].includes(s) ? 'danger' : 'secondary'} onClick={() => setStage(s)}>{label(s)}</Btn>)}</div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>Pilot agreement needs an accepted proposal. Losing or winning needs a recorded reason. A closed deal cannot be reopened.</p>
        </div>
      )}
      <div style={CARD}>
        <p style={lbl}>Next action &amp; discovery notes</p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <Field label="Next action"><input value={plan.next_action} onChange={(e) => setPlan((x) => ({ ...x, next_action: e.target.value }))} style={inp} /></Field>
          <Field label="When"><input type="datetime-local" value={plan.next_action_at} onChange={(e) => setPlan((x) => ({ ...x, next_action_at: e.target.value }))} style={inp} /></Field>
        </div>
        <Field label="Discovery notes (what they told us — not our assumptions)"><textarea rows={4} value={plan.notes} onChange={(e) => setPlan((x) => ({ ...x, notes: e.target.value }))} style={{ ...inp, resize: 'vertical' }} /></Field>
        <Btn small onClick={savePlan}>Save</Btn>
      </div>
      <div style={CARD}>
        <p style={lbl}>Notes, tasks &amp; reminders</p>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 200px auto', gap: 8, marginBottom: 12 }}>
          <select value={na.kind} onChange={(e) => setNa((x) => ({ ...x, kind: e.target.value }))} style={inp}>{['note', 'task', 'reminder'].map((k) => <option key={k} value={k} style={{ background: '#111' }}>{k}</option>)}</select>
          <input value={na.body} onChange={(e) => setNa((x) => ({ ...x, body: e.target.value }))} style={inp} placeholder="What happened / what to do" />
          <input type="datetime-local" value={na.due_at} onChange={(e) => setNa((x) => ({ ...x, due_at: e.target.value }))} style={inp} />
          <Btn small disabled={!na.body.trim()} onClick={addAct}>Add</Btn>
        </div>
        {acts.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
            <Pill text={a.kind} tone="neutral" /><span style={{ color: a.done_at ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: 12, flex: 1, textDecoration: a.done_at ? 'line-through' : 'none' }}>{a.body}</span>
            {a.due_at && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{fmt(a.due_at)}</span>}
            {['task', 'reminder'].includes(a.kind) && !a.done_at && <Btn small kind="secondary" onClick={() => run(() => api('crm', 'activities', { method: 'POST', body: { organization_id: orgId, action: 'complete', id: a.id } }), 'Done')}>Done</Btn>}
          </div>
        ))}
      </div>
      <div style={CARD}>
        <p style={lbl}>Proposals (versioned)</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>Prices are never filled in for you. A price can only be recorded for a product whose pricing has been approved in the catalog; leave it empty until then.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {products.map((pd) => { const on = np.product_ids.includes(pd.id); return <button key={pd.id} onClick={() => setNp((x) => ({ ...x, product_ids: on ? x.product_ids.filter((i) => i !== pd.id) : [...x.product_ids, pd.id] }))} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, background: on ? `${GOLD}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? GOLD + '60' : 'rgba(255,255,255,0.1)'}`, color: on ? GOLD : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}>{pd.name}{pd.pricing_approved ? '' : ' (no approved price)'}</button> })}
          {products.length === 0 && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>No products in the catalog.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={np.price} onChange={(e) => setNp((x) => ({ ...x, price: e.target.value }))} style={{ ...inp, maxWidth: 200 }} placeholder="Price in cents (optional)" />
          <Btn small disabled={!np.product_ids.length} onClick={() => run(() => api('crm', 'proposals', { method: 'POST', body: { organization_id: orgId, action: 'create-draft', deal_id: deal.id, scope: { items: np.product_ids.map((product_id) => ({ product_id })) }, price_cents: np.price === '' ? null : Number(np.price) } }), 'New proposal version created')}>New version</Btn>
        </div>
        {props.map((pr) => (
          <div key={pr.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontSize: 13, width: 40 }}>v{pr.version}</span>
            <Pill text={pr.status} tone={pr.status === 'accepted' ? 'good' : pr.status === 'superseded' || pr.status === 'declined' ? 'bad' : 'warn'} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flex: 1 }}>{pr.price_cents != null ? `$${(pr.price_cents / 100).toLocaleString()}` : 'no price'}{pr.acceptance_evidence ? ` · accepted ${fmt(pr.accepted_at)} — ${pr.acceptance_evidence}` : ''}</span>
            {pr.status === 'draft' && <Btn small kind="secondary" onClick={() => run(() => api('crm', 'proposals', { method: 'POST', body: { organization_id: orgId, action: 'send', id: pr.id } }), 'Marked sent')}>Mark sent</Btn>}
            {pr.status === 'sent' && <Btn small kind="secondary" onClick={() => { const ev = window.prompt('Acceptance evidence (signed-document or email reference):'); if (ev) run(() => api('crm', 'proposals', { method: 'POST', body: { organization_id: orgId, action: 'accept', id: pr.id, acceptance_evidence: ev } }), 'Acceptance recorded') }}>Record acceptance…</Btn>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Contacts({ orgId }) {
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState([])
  const [dups, setDups] = useState(null)
  const [imp, setImp] = useState('')
  const [msg, setMsg] = useState(null)
  const LIMIT = 50
  const load = useCallback(async () => { const r = await api('crm', 'contacts', { query: { organization_id: orgId, q, limit: LIMIT, offset } }); if (r.ok) setRows(r.data); else setMsg({ kind: 'error', t: r.data.error }) }, [orgId, q, offset])
  useEffect(() => { load() }, [load])
  const exportCsv = async () => {
    const r = await authedFetch(`/api/client?resource=crm&op=contacts-export&organization_id=${encodeURIComponent(orgId)}`)
    if (!r.ok) { setMsg({ kind: 'error', t: 'Export failed' }); return }
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'contacts.csv'; a.click()
  }
  const findDups = async () => { const r = await api('crm', 'contacts-duplicates', { query: { organization_id: orgId } }); if (r.ok) setDups(r.data.groups); else setMsg({ kind: 'error', t: r.data.error }) }
  const merge = async (keep, drop) => {
    const pre = await api('crm', 'contacts-merge', { method: 'POST', body: { organization_id: orgId, keep_id: keep.id, drop_id: drop.id } })
    if (!pre.ok) { setMsg({ kind: 'error', t: pre.data.error }); return }
    const p = pre.data.preview
    if (!window.confirm(`Merge "${drop.name}" INTO "${keep.name}"?\n\n${p.deals_moved} deal(s) and ${p.conversations_affected} conversation(s) move over.${p.suppression_carried ? '\nAn opt-out / do-not-contact on either record is kept.' : ''}\n\nThe duplicate is retired, not deleted.`)) return
    const r = await api('crm', 'contacts-merge', { method: 'POST', body: { organization_id: orgId, keep_id: keep.id, drop_id: drop.id, confirm: true } })
    setMsg(r.ok ? { kind: 'ok', t: 'Merged' } : { kind: 'error', t: r.data.error }); if (r.ok) { findDups(); load() }
  }
  const doImport = async () => {
    const lines = imp.trim().split(/\r?\n/).filter(Boolean)
    const head = lines.shift()?.split(',').map((h) => h.trim().toLowerCase()) || []
    const rowsIn = lines.map((l) => { const c = l.split(','); return Object.fromEntries(head.map((h, i) => [h, (c[i] || '').trim()])) })
    const r = await api('crm', 'contacts-import', { method: 'POST', body: { organization_id: orgId, source: 'csv_import', rows: rowsIn } })
    setMsg(r.ok ? { kind: 'ok', t: `Created ${r.data.created}, duplicates skipped ${r.data.duplicates}, invalid ${r.data.invalid}, errors ${r.data.errors}. Imported contacts have NO text/email consent.` } : { kind: 'error', t: r.data.error }); if (r.ok) { setImp(''); load() }
  }
  return (
    <div>
      <Banner kind={msg?.kind}>{msg?.t}</Banner>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0) }} placeholder="Search name, email or phone" style={{ ...inp, maxWidth: 320 }} />
        <Btn small kind="secondary" onClick={exportCsv}>Export CSV</Btn><Btn small kind="secondary" onClick={findDups}>Find duplicates</Btn>
      </div>
      {dups && (
        <div style={CARD}>
          <p style={lbl}>Possible duplicates — nothing is merged automatically</p>
          {dups.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>None found.</p> : dups.map((g, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 4 }}>matched on {g.matched_on}</p>
              {g.contacts.map((c) => <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}><span style={{ color: '#fff', fontSize: 12, flex: 1 }}>{c.name} · {c.email || c.phone}{c.suppressed ? ' · OPTED OUT' : ''}</span>{g.contacts.filter((o) => o.id !== c.id).slice(0, 1).map((o) => <Btn key={o.id} small kind="secondary" onClick={() => merge(c, o)}>Keep this, merge the other in…</Btn>)}</div>)}
            </div>
          ))}
        </div>
      )}
      {rows.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#fff', fontSize: 13, flex: 1, minWidth: 160 }}>{c.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{c.email || '—'} · {c.phone || '—'}</span>
          {c.suppressed && <Pill text="opted out" tone="bad" />}{c.do_not_contact && <Pill text="do not contact" tone="bad" />}{c.sms_consent_at ? <Pill text="text consent recorded" tone="good" /> : <Pill text="no text consent" tone="neutral" />}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Btn small kind="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Previous</Btn><Btn small kind="secondary" disabled={rows.length < LIMIT} onClick={() => setOffset(offset + LIMIT)}>Next</Btn></div>
      <div style={{ ...CARD, marginTop: 24 }}>
        <p style={lbl}>Import (CSV with header: name,email,phone — max 500 rows)</p>
        <textarea rows={4} value={imp} onChange={(e) => setImp(e.target.value)} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} placeholder={'name,email,phone\nJane Doe,jane@example.com,203-555-0142'} />
        <Btn small disabled={!imp.trim()} onClick={doImport}>Import</Btn>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>Imports never grant consent to text or email; duplicates are skipped by phone and email.</p>
      </div>
    </div>
  )
}
