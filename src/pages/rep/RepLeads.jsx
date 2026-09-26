import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, useLoad, dt, label } from '../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Modal, Table, Tabs, Loading, GOLD, FAINT, LINE } from '../../components/sales/kit'

const STAGE_TONE = { new: 'muted', contacted: 'muted', qualified: 'gold', discovery_scheduled: 'gold', discovery_completed: 'gold', proposal: 'gold', awaiting_signature_payment: 'warn', submitted_for_verification: 'warn', won: 'good', lost: 'bad' }
export const StageBadge = ({ stage }) => <Badge tone={STAGE_TONE[stage] || 'muted'}>{label(stage)}</Badge>

export default function RepLeads() {
  const nav = useNavigate()
  const [view, setView] = useState('list')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const meta = useLoad(() => api('leads', 'meta', { method: 'GET' }), [])
  const { data, loading, error, reload } = useLoad(() => api('leads', 'list', { method: 'GET', query: { q } }), [q])
  const rows = data || []
  const stages = meta.data?.stages || []
  const overdue = (d) => d.next_action_at && new Date(d.next_action_at) < new Date() && !['won', 'lost'].includes(d.stage)
  return (
    <Page eyebrow="Leads & contacts" title="My leads" subtitle="Only leads assigned to you appear here. If a business you add is already being worked, you will be told without any details about who has it." actions={<Btn kind="primary" onClick={() => setAdding(true)}>Add a prospect</Btn>} wide>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ flex: '1 1 240px', maxWidth: 360 }}><Input placeholder="Search business or contact" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" /></div>
        <Tabs tabs={[{ key: 'list', label: 'List' }, { key: 'board', label: 'Pipeline' }]} value={view} onChange={setView} />
      </div>
      {error && <Banner tone="bad">{error}</Banner>}
      {loading && !data ? <Loading /> : view === 'list' ? (
        <Card>
          <Table onRow={(r) => nav(`/rep/leads/${r.id}`)} rows={rows} empty="No leads yet. Add a prospect, or ask your manager to assign leads."
            columns={[
              { key: 'business', label: 'Business', render: (r) => <><strong>{r.business?.name || 'Unnamed'}</strong><div style={{ color: FAINT, fontSize: 12 }}>{r.business?.city}</div></> },
              { key: 'contact', label: 'Contact', render: (r) => <>{r.contact?.name || '—'}{r.contact?.do_not_contact && <> <Badge tone="bad">Do not contact</Badge></>}<div style={{ color: FAINT, fontSize: 12 }}>{r.contact?.phone || r.contact?.email}</div></> },
              { key: 'stage', label: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
              { key: 'next', label: 'Next action', render: (r) => <span style={{ color: overdue(r) ? '#f87171' : '#fff' }}>{r.next_action || (['won', 'lost'].includes(r.stage) ? '—' : 'None set')}<div style={{ color: FAINT, fontSize: 12 }}>{r.next_action_at ? dt(r.next_action_at) : ''}</div></span> },
              { key: 'updated', label: 'Updated', render: (r) => dt(r.updated_at) },
            ]} />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(230px, 1fr)', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
          {stages.map((s) => (
            <div key={s.key} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${LINE}`, borderRadius: 12, padding: 10, minHeight: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>{s.label}</strong><span style={{ color: FAINT, fontSize: 12 }}>{rows.filter((r) => r.stage === s.key).length}</span></div>
              {rows.filter((r) => r.stage === s.key).map((r) => (
                <Link key={r.id} to={`/rep/leads/${r.id}`} style={{ display: 'block', background: 'rgba(255,255,255,0.04)', border: `1px solid ${overdue(r) ? '#f8717166' : LINE}`, borderRadius: 8, padding: '8px 10px', marginBottom: 8, color: '#fff', textDecoration: 'none', fontSize: 13 }}>
                  <strong>{r.business?.name}</strong><div style={{ color: FAINT, fontSize: 11.5 }}>{r.contact?.name}{r.next_action_at ? ` · ${overdue(r) ? 'overdue' : dt(r.next_action_at)}` : ''}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      {adding && <AddProspect onClose={() => setAdding(false)} onDone={(id) => { setAdding(false); reload(); nav(`/rep/leads/${id}`) }} />}
    </Page>
  )
}

function AddProspect({ onClose, onDone }) {
  const [f, setF] = useState({ business_name: '', website: '', phone: '', city: '', state: '', contact_name: '', contact_email: '', contact_phone: '', contact_title: '', source: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [fields, setFields] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null); setFields({})
    const r = await api('leads', 'create', { body: f }); setBusy(false)
    if (r.ok) onDone(r.data.deal_id); else { setErr(r.data?.error || 'Could not add.'); setFields(r.data?.errors || {}) }
  }
  return (
    <Modal title="Add a prospect" onClose={onClose}>
      <form onSubmit={submit}>
        <Muted style={{ marginBottom: 12 }}>Only add businesses you have a real, factual reason to contact. Use their published contact details.</Muted>
        <Field label="Business name" error={fields.business_name}><Input value={f.business_name} onChange={set('business_name')} required /></Field>
        <Field label="Website" error={fields.website}><Input value={f.website} onChange={set('website')} placeholder="https://" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="Business phone"><Input value={f.phone} onChange={set('phone')} /></Field><Field label="City"><Input value={f.city} onChange={set('city')} /></Field></div>
        <Field label="Contact name" error={fields.contact_name}><Input value={f.contact_name} onChange={set('contact_name')} required /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="Contact email" error={fields.contact}><Input type="email" value={f.contact_email} onChange={set('contact_email')} /></Field><Field label="Contact phone"><Input value={f.contact_phone} onChange={set('contact_phone')} /></Field></div>
        <Field label="Where did you find them?" hint="e.g. their public website, a referral, a visit"><Input value={f.source} onChange={set('source')} /></Field>
        {err && <Banner tone="bad">{err}</Banner>}
        <Btn kind="primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Add prospect'}</Btn>
      </form>
    </Modal>
  )
}
