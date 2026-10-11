import { useState } from 'react'
import { api, useLoad, money, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Loading, useNotice } from '../../../components/sales/kit'

const READINESS = [['draft', 'Draft'], ['internal_test', 'Internal Test'], ['pilot_approved', 'Pilot Approved'], ['available_for_sale', 'Available for Sale'], ['paused', 'Paused']]
const INFO_KEYS = ['what_it_is', 'who_for', 'includes', 'excludes', 'prerequisites', 'discovery_questions', 'objections', 'timeline_note']
const KINDS = ['script', 'email_template', 'sms_template', 'message_template', 'checklist', 'objection', 'faq', 'guide', 'link']

export default function CatalogAdmin() {
  const [tab, setTab] = useState('products')
  const prods = useLoad(() => api('catalog', 'products', { method: 'GET' }), [])
  const kit = useLoad(() => api('catalog', 'toolkit', { method: 'GET' }), [])
  const terms = useLoad(() => api('catalog', 'audit-terms', { method: 'GET' }), [])
  const [info, setInfo] = useState(null)
  const [tk, setTk] = useState(null)
  const { notice, show } = useNotice()
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) { prods.reload(); kit.reload(); terms.reload() } return r }
  return (
    <Page eyebrow="Sales Team" title="Catalog, readiness & toolkit" subtitle="Nothing is Available for Sale by default and nothing has an invented price. A price, a readiness state, sales information and every toolkit item are your decisions." wide>
      {notice}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'products', label: 'Products' }, { key: 'toolkit', label: 'Toolkit', count: kit.data?.length }, { key: 'audit', label: 'Audit terms' }]} />
      {tab === 'products' && (prods.loading && !prods.data ? <Loading /> : (prods.data?.products || []).map((p) => (
        <Card key={p.id} title={p.name} right={<Badge tone={p.readiness === 'available_for_sale' ? 'good' : p.readiness === 'pilot_approved' ? 'warn' : 'muted'}>{p.readiness_label}</Badge>}>
          <Muted>{p.description}</Muted>
          <p style={{ margin: '8px 0' }}><strong>Price:</strong> {p.price ? `${money(p.price.unit_price_cents)}${p.price.billing === 'monthly' ? ' / month' : ''} (approved)` : <span style={{ color: '#fbbf24' }}>none approved</span>} · <strong>Sales info:</strong> {p.info_reviewed ? 'reviewed' : p.info && Object.keys(p.info).length ? 'saved, not reviewed' : 'none'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select value={p.readiness} onChange={(e) => { const to = e.target.value; const reason = window.prompt(`Move "${p.name}" to ${label(to)} — reason:`); if (!reason) return; const body = { product_id: p.id, to, reason }; if (to === 'pilot_approved') body.pilot_terms = window.prompt('Pilot terms reps must use (scope, limits, what is not promised):', p.pilot_terms || ''); act(() => api('catalog', 'set-readiness', { body }), 'Readiness updated.') }} style={{ maxWidth: 220 }} aria-label={`Readiness of ${p.name}`}>{READINESS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            <Btn small onClick={() => { const v = window.prompt('Price in dollars (e.g. 500.00). This is the price reps will be allowed to quote:'); if (!v) return; const billing = window.prompt('Billing: one_time or monthly', 'one_time'); act(() => api('catalog', 'set-pricing', { body: { product_id: p.id, unit_price_cents: Math.round(Number(v) * 100), billing, confirm: window.confirm('Confirm this is the price Nova has decided to charge.') } }), 'Price approved.') }}>Set price</Btn>
            <Btn small onClick={() => setInfo(p)}>Sales info</Btn>
            {!p.info_reviewed && p.info && <Btn small kind="primary" onClick={() => { if (window.confirm('Confirm you have reviewed this information for accuracy.')) act(() => api('catalog', 'review-info', { body: { product_id: p.id, confirm: true } }), 'Reviewed — reps can now see it.') }}>Mark reviewed</Btn>}
          </div>
        </Card>
      )))}
      {tab === 'toolkit' && (
        <>
          <div style={{ marginBottom: 12 }}><Btn kind="primary" onClick={() => setTk({ kind: 'script', title: '', body: '', program_slug: '', compliance_note: '' })}>New item</Btn></div>
          <Banner tone="warn">Starter items were loaded as <strong>drafts</strong>. Reps see nothing until you review and approve each item. Editing an approved item creates a new draft; the approved one stays live until you approve the new one.</Banner>
          <Card><Table rows={kit.data || []} empty="No items." columns={[{ key: 'k', label: 'Type', render: (i) => label(i.kind) }, { key: 't', label: 'Title', render: (i) => i.title }, { key: 'v', label: 'Version', render: (i) => `v${i.version}` }, { key: 's', label: 'Status', render: (i) => <Badge tone={i.status === 'approved' ? 'good' : i.status === 'draft' ? 'warn' : 'muted'}>{i.status}</Badge> }, { key: 'a', label: '', render: (i) => (
            <div style={{ display: 'flex', gap: 6 }}><Btn small kind="quiet" onClick={() => setTk(i)}>{i.status === 'draft' ? 'Edit' : 'View / revise'}</Btn>
              {i.status === 'draft' && <Btn small kind="primary" onClick={() => { if (window.confirm('Confirm you reviewed this item: accurate, no invented figures or guarantees, compliant with contact rules.')) act(() => api('catalog', 'toolkit-approve', { body: { id: i.id, confirm: true } }), 'Approved.') }}>Approve</Btn>}
              {i.status === 'approved' && <Btn small kind="danger" onClick={() => act(() => api('catalog', 'toolkit-retire', { body: { id: i.id } }), 'Retired.')}>Retire</Btn>}</div>) }]} /></Card>
        </>
      )}
      {tab === 'audit' && <AuditTerms data={terms.data} act={act} />}
      {info && <InfoModal p={info} onClose={() => setInfo(null)} onDone={() => { setInfo(null); prods.reload() }} />}
      {tk && <ToolkitModal item={tk} onClose={() => setTk(null)} onDone={() => { setTk(null); kit.reload() }} />}
    </Page>
  )
}

function InfoModal({ p, onClose, onDone }) {
  const [f, setF] = useState(() => Object.fromEntries(INFO_KEYS.map((k) => [k, Array.isArray(p.info?.[k]) ? p.info[k].join('\n') : p.info?.[k] || ''])))
  const [err, setErr] = useState(null)
  const list = new Set(['includes', 'excludes', 'prerequisites', 'discovery_questions', 'objections'])
  const save = async () => { const info = Object.fromEntries(INFO_KEYS.map((k) => [k, list.has(k) ? f[k].split('\n').map((x) => x.trim()).filter(Boolean) : f[k]])); const r = await api('catalog', 'save-info', { body: { product_id: p.id, info } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return (
    <Modal title={`Sales information — ${p.name}`} onClose={onClose} wide>
      <Muted style={{ marginBottom: 10 }}>Facts only — no prices, guarantees or unapproved timelines. Saving marks it unreviewed until you confirm the review.</Muted>
      {INFO_KEYS.map((k) => <Field key={k} label={label(k)} hint={list.has(k) ? 'One per line' : undefined}><Textarea rows={list.has(k) ? 4 : 3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
      {err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={save}>Save</Btn>
    </Modal>
  )
}

function ToolkitModal({ item, onClose, onDone }) {
  const [f, setF] = useState({ kind: item.kind, title: item.title, body: item.body, program_slug: item.program_slug || '', compliance_note: item.compliance_note || '' })
  const [err, setErr] = useState(null)
  const save = async () => { const r = await api('catalog', 'toolkit-save', { body: { ...f, id: item.id } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return (
    <Modal title={item.id ? `${item.title} (v${item.version}, ${item.status})` : 'New toolkit item'} onClose={onClose} wide>
      <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</Select></Field>
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Content"><Textarea rows={12} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <Field label="Compliance note"><Input value={f.compliance_note} onChange={(e) => setF({ ...f, compliance_note: e.target.value })} /></Field>
      {item.status && item.status !== 'draft' && <Banner tone="warn">Saving creates a new draft version. The approved version stays live until you approve the new one.</Banner>}
      {err && <Banner tone="bad">{err}</Banner>}<Btn kind="primary" onClick={save}>Save</Btn>
    </Modal>
  )
}

function AuditTerms({ data, act }) {
  const [f, setF] = useState({ turnaround_min_hours: '', turnaround_max_hours: '', statement: '' })
  return (
    <>
      <Card title="Audit turnaround">
        {data?.approved ? <Banner tone="good">Approved: {data.approved.turnaround_min_hours}–{data.approved.turnaround_max_hours} hours. Reps use exactly: “{data.approved.statement}”</Banner> : <Banner tone="warn">Not approved. Reps are told not to promise any timeline. (24–72 hours was proposed in the original brief but never approved.)</Banner>}
        {data?.pending && <Muted>Pending version saved {dt(data.pending.created_at)} — approve it below.</Muted>}
      </Card>
      <Card title="Propose terms">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="Minimum hours"><Input type="number" value={f.turnaround_min_hours} onChange={(e) => setF({ ...f, turnaround_min_hours: e.target.value })} /></Field><Field label="Maximum hours"><Input type="number" value={f.turnaround_max_hours} onChange={(e) => setF({ ...f, turnaround_max_hours: e.target.value })} /></Field></div>
        <Field label="The exact sentence reps may use"><Textarea rows={3} value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} /></Field>
        <Btn onClick={() => act(() => api('catalog', 'save-audit-terms', { body: { turnaround_min_hours: Number(f.turnaround_min_hours), turnaround_max_hours: Number(f.turnaround_max_hours), statement: f.statement } }), 'Saved as pending.')}>Save proposal</Btn>
        {data?.pending?.value?.turnaround_min_hours != null && <> <Btn kind="primary" onClick={() => { if (window.confirm('Approve these audit terms for reps to use?')) act(() => api('catalog', 'approve-audit-terms', { body: { config_id: data.pending.id } }), 'Approved.') }}>Approve pending version</Btn></>}
      </Card>
    </>
  )
}
