import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, useLoad, useAction, C, Card, Field, Loading, Empty, Badge, PageHeader, Notice, money, when } from './ui'

const CHANNELS = [['email', 'Email'], ['phone', 'Phone'], ['in_person', 'In person'], ['referral', 'Referral'], ['partner', 'Partner'], ['social', 'Social'], ['letter', 'Letter']]

// Nova Demand: prepare an acquisition campaign, approve it, record real contacts, and see what it produced.
// Nothing on this screen sends a message: contacts are made by people or approved channels and recorded here.
export default function OpsDemand() {
  const { orgId, business } = useOutletContext()
  const list = useLoad(() => api('demand', { org: orgId, query: { action: 'list' } }), [orgId])
  const [open, setOpen] = useState(null)
  return (
    <>
      <PageHeader title="Nova Demand" sub="Campaigns that go out and create sales opportunities. Prepare, get approval, record real contacts, and count what reached a paid job." />
      {open ? <Campaign orgId={orgId} id={open} business={business} onBack={() => { setOpen(null); list.reload() }} /> : (
        <div className="ops-two">
          <Card title="Campaigns">
            {list.loading ? <Loading /> : !(list.data?.campaigns || []).length ? <Empty>No Demand campaigns yet.</Empty> : (
              <table className="ops-table"><thead><tr><th>Campaign</th><th>Status</th><th>Prospects → booked</th><th /></tr></thead><tbody>
                {list.data.campaigns.map((c) => <tr key={c.id}><td><strong>{c.name}</strong><div style={{ color: C.faint, fontSize: 12 }}>{c.objective}</div></td><td><Badge value={c.status === 'approved' ? 'ready' : c.status === 'draft' || c.status === 'pending_approval' ? 'partial' : c.status} label={c.status.replace(/_/g, ' ')} /></td><td>{c.funnel.prospects} → {c.funnel.contacted} contacted → {c.funnel.inquiries} inquiries → {c.funnel.booked} booked</td><td><button className="ops-btn" onClick={() => setOpen(c.id)}>Open</button></td></tr>)}
              </tbody></table>
            )}
          </Card>
          <NewCampaign orgId={orgId} onCreated={(id) => { list.reload(); setOpen(id) }} />
        </div>
      )}
    </>
  )
}

function NewCampaign({ orgId, onCreated }) {
  const prices = useLoad(() => api('prices', { org: orgId }), [orgId])
  const approved = (prices.data || []).filter((p) => p.status === 'approved' && !p.quote_required)
  const [f, setF] = useState({ name: '', objective: '', service_key: '', offer_text: '', audience: '', area: '', capacity_note: '', volume_limit: 25, channels: ['email'] })
  const act = useAction()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const create = async (e) => { e.preventDefault(); const r = await act.run(() => api('demand', { org: orgId, method: 'POST', body: { action: 'create', ...f } }), 'Campaign created as a draft.'); if (r?.campaign) onCreated(r.campaign.id) }
  return (
    <Card title="Prepare a campaign">
      <form onSubmit={create}>
        <Field label="Campaign name" id="dm-name"><input id="dm-name" className="ops-input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Objective (what counts as success)" id="dm-obj" hint="For example: two new paying customers for this service within 30 days."><input id="dm-obj" className="ops-input" value={f.objective} onChange={set('objective')} required /></Field>
        <Field label="Service to sell (approved services only)" id="dm-svc"><select id="dm-svc" className="ops-select" value={f.service_key} onChange={set('service_key')} required><option value="">Choose…</option>{approved.map((p) => <option key={p.id} value={p.service_key}>{p.name} — {money(p.price_cents, p.currency)}</option>)}</select></Field>
        <Field label="Offer (the reason to talk)" id="dm-offer" hint="Only approved terms. No invented discounts or urgency."><textarea id="dm-offer" className="ops-textarea" rows={3} value={f.offer_text} onChange={set('offer_text')} required /></Field>
        <Field label="Who it is for" id="dm-aud"><input id="dm-aud" className="ops-input" value={f.audience} onChange={set('audience')} placeholder="Type of business or buyer, and why they need it" /></Field>
        <Field label="Area" id="dm-area"><input id="dm-area" className="ops-input" value={f.area} onChange={set('area')} placeholder="e.g. Waterbury, CT and 15 miles" /></Field>
        <Field label="Capacity" id="dm-cap"><input id="dm-cap" className="ops-input" value={f.capacity_note} onChange={set('capacity_note')} placeholder="What the business can actually take on" /></Field>
        <Field label="Maximum prospects to contact" id="dm-vol"><input id="dm-vol" type="number" min={1} className="ops-input" value={f.volume_limit} onChange={set('volume_limit')} /></Field>
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}><legend style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Permitted channels</legend>
          {CHANNELS.map(([k, l]) => <label key={k} style={{ marginRight: 12, fontSize: 13 }}><input type="checkbox" checked={f.channels.includes(k)} onChange={(e) => setF({ ...f, channels: e.target.checked ? [...f.channels, k] : f.channels.filter((x) => x !== k) })} /> {l}</label>)}
        </fieldset>
        <button className="ops-btn primary" disabled={act.busy || !approved.length}>Create draft campaign</button>
        {!prices.loading && !approved.length && <p style={{ fontSize: 12, color: C.amber }}>Approve at least one priced service first.</p>}
        {act.view}
      </form>
    </Card>
  )
}

function Campaign({ orgId, id, business, onBack }) {
  const d = useLoad(() => api('demand', { org: orgId, query: { action: 'detail', id } }), [orgId, id])
  const act = useAction()
  const [p, setP] = useState({ business_name: '', website: '', contact_name: '', contact_route: '', source: '', fit_evidence: '' })
  const go = (body, ok) => act.run(() => api('demand', { org: orgId, method: 'POST', body: { id, ...body } }), ok).then((r) => { d.reload(); return r })
  if (d.loading) return <Loading />
  const c = d.data?.campaign; const fn = d.data?.funnel || {}
  if (!c) return <Notice tone="bad">Campaign not found.</Notice>
  const link = `${window.location.origin}${business?.kind === 'nova_internal' ? '/book' : '/book'}?c=${c.code}`
  return (
    <>
      <button className="ops-btn" onClick={onBack} style={{ marginBottom: 12 }}>← Campaigns</button>
      {act.view}
      <Card title={`${c.name} · ${c.status.replace(/_/g, ' ')}`} actions={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {c.status === 'draft' && <button className="ops-btn" onClick={() => go({ action: 'submit' }, 'Submitted for approval.')}>Submit for approval</button>}
        {['draft', 'pending_approval'].includes(c.status) && <button className="ops-btn primary" onClick={() => go({ action: 'approve' }, 'Approved. Prospects can now be approved for contact within the limit.')}>Approve campaign</button>}
        {c.status === 'approved' && <button className="ops-btn" onClick={() => go({ action: 'approve-prospects' }, (x) => `${x.approved} prospect(s) approved for contact.`)}>Approve prospects for contact</button>}
        {c.status === 'approved' && <button className="ops-btn" onClick={() => go({ action: 'pause' }, 'Paused.')}>Pause</button>}
        {c.status === 'paused' && <button className="ops-btn" onClick={() => go({ action: 'resume' }, 'Resumed.')}>Resume</button>}
      </div>}>
        <p style={{ marginTop: 0 }}>{c.objective}</p>
        <p style={{ color: C.dim, fontSize: 13 }}>Offer: {c.offer_text}</p>
        <p style={{ color: C.dim, fontSize: 13 }}>Channels: {c.channels.join(', ')} · limit {c.volume_limit || 'none'} · code <strong>{c.code}</strong>{c.approved_at ? ` · approved ${when(c.approved_at)}` : ''}</p>
        <p style={{ color: C.dim, fontSize: 13 }}>Attribution link for replies: <span style={{ wordBreak: 'break-all' }}>{link}</span></p>
        <table className="ops-table"><tbody>
          {[['Prospects researched', fn.prospects], ['Approved for contact', fn.approved_for_contact], ['Contacted', fn.contacted], ['Replied', fn.replied], ['Inquiries (with this campaign’s code)', fn.inquiries], ['Quoted', fn.quoted], ['Booked', fn.booked], ['Completed jobs', fn.completed_jobs], ['Completed job value', money(fn.completed_job_value_cents)], ['Deposits collected', money(fn.deposits_collected_cents)], ['Refunds', money(fn.refunds_cents)], ['Asked not to be contacted', fn.do_not_contact]].map(([k, v]) => <tr key={k}><td>{k}</td><td><strong>{v}</strong></td></tr>)}
        </tbody></table>
        <p style={{ color: C.faint, fontSize: 12 }}>{fn.note} Attribution: {c.attribution_rule}</p>
      </Card>
      <div className="ops-two" style={{ marginTop: 16 }}>
        <Card title="Prospects">
          {!d.data.prospects.length ? <Empty>No prospects yet. Add researched businesses with their source and why they fit.</Empty> : (
            <table className="ops-table"><tbody>
              {d.data.prospects.map((x) => <tr key={x.id}><td><strong>{x.business_name}</strong><div style={{ color: C.faint, fontSize: 12 }}>{x.fit_evidence}</div><div style={{ color: C.faint, fontSize: 11 }}>Source: {x.source}</div></td><td><Badge value={x.status === 'do_not_contact' ? 'blocked' : 'partial'} label={x.status.replace(/_/g, ' ')} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {x.status === 'approved_for_contact' && c.channels.map((ch) => <button key={ch} className="ops-btn" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => go({ action: 'prospect-event', prospect_id: x.id, kind: 'contacted', channel: ch }, 'Contact recorded.')}>Contacted ({ch})</button>)}
                  {x.status === 'contacted' && <button className="ops-btn" onClick={() => go({ action: 'prospect-event', prospect_id: x.id, kind: 'replied' }, 'Reply recorded.')}>Replied</button>}
                  {!['do_not_contact', 'won', 'lost'].includes(x.status) && <button className="ops-btn danger" style={{ marginLeft: 4 }} onClick={() => go({ action: 'prospect-event', prospect_id: x.id, kind: 'do_not_contact' }, 'Marked do-not-contact.')}>Do not contact</button>}
                </td></tr>)}
            </tbody></table>
          )}
        </Card>
        <Card title="Add a researched prospect">
          <form onSubmit={(e) => { e.preventDefault(); go({ action: 'add-prospect', ...p }, 'Prospect added.').then((r) => r && setP({ business_name: '', website: '', contact_name: '', contact_route: '', source: '', fit_evidence: '' })) }}>
            {[['business_name', 'Business name', true], ['website', 'Website', false], ['contact_name', 'Contact name', false], ['contact_route', 'Published contact route', false], ['source', 'Where you found them (URL or list)', true], ['fit_evidence', 'Why they fit (evidence)', true]].map(([k, l, req]) => <Field key={k} label={l} id={`pr-${k}`}><input id={`pr-${k}`} className="ops-input" required={req} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></Field>)}
            <button className="ops-btn primary" disabled={act.busy}>Add prospect</button>
          </form>
        </Card>
      </div>
    </>
  )
}
