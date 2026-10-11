import { useState } from 'react'
import { api, useLoad, money, label } from '../../lib/salesApi'
import { Page, Card, Muted, Badge, Banner, Tabs, Modal, Loading, Btn, GOLD, FAINT, LINE } from '../../components/sales/kit'

// Everything here is owner-approved: toolkit items appear only after the owner approved them, and every offering shows the readiness
// label that decides whether it may be proposed. If no price or audit turnaround is approved, the page says so — it never guesses.
export default function RepToolkit() {
  const [tab, setTab] = useState('toolkit')
  const kit = useLoad(() => api('catalog', 'toolkit', { method: 'GET' }), [])
  const prods = useLoad(() => api('catalog', 'products', { method: 'GET' }), [])
  const terms = useLoad(() => api('catalog', 'audit-terms', { method: 'GET' }), [])
  const [open, setOpen] = useState(null)
  const [kind, setKind] = useState('all')
  const items = (kit.data || []).filter((i) => kind === 'all' || i.kind === kind)
  const kinds = [...new Set((kit.data || []).map((i) => i.kind))]
  const copy = async (t) => { try { await navigator.clipboard.writeText(t) } catch { /* clipboard unavailable */ } }
  return (
    <Page eyebrow="Sales toolkit" title="Toolkit & products" subtitle="Scripts, templates and product information approved by Nova. Use them as written; if you need different wording that makes a claim, ask your manager first." wide>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'toolkit', label: 'Toolkit', count: kit.data?.length }, { key: 'products', label: 'Products & readiness' }, { key: 'audit', label: 'Audit terms' }]} />
      {tab === 'toolkit' && (
        <>
          {kit.loading && !kit.data ? <Loading /> : (kit.data || []).length === 0 ? <Banner tone="warn">Nova has not approved any toolkit items yet. Ask your manager.</Banner> : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>{['all', ...kinds].map((k) => <Btn key={k} small kind={kind === k ? 'primary' : 'quiet'} onClick={() => setKind(k)}>{label(k)}</Btn>)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {items.map((i) => (
                  <button key={i.id} onClick={() => setOpen(i)} style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}>
                    <Badge tone="gold">{label(i.kind)}</Badge><div style={{ fontWeight: 700, margin: '8px 0 4px' }}>{i.title}</div><div style={{ color: FAINT, fontSize: 12 }}>{i.body.slice(0, 90)}…</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === 'products' && (prods.loading && !prods.data ? <Loading /> : (prods.data?.products || []).map((p) => (
        <Card key={p.id} title={p.name} right={<Badge tone={p.readiness === 'available_for_sale' ? 'good' : p.readiness === 'pilot_approved' ? 'warn' : 'muted'}>{p.readiness_label}</Badge>}>
          <Muted>{p.description}</Muted>
          {p.pilot_terms && <Banner tone="warn"><strong>Pilot terms (use exactly):</strong> {p.pilot_terms}</Banner>}
          <p style={{ margin: '10px 0 4px', fontSize: 13 }}><strong>Price:</strong> {p.price ? `${money(p.price.unit_price_cents)}${p.price.billing === 'monthly' ? ' per month' : ''}` : <span style={{ color: '#fbbf24' }}>{p.price_note}</span>}</p>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}><strong>Can be proposed:</strong> {p.can_propose ? 'Yes' : `No — ${p.propose_blocked_reason}`}</p>
          {p.info ? <div style={{ fontSize: 13, lineHeight: 1.6 }}>{Object.entries(p.info).map(([k, v]) => <div key={k} style={{ marginTop: 6 }}><strong style={{ color: GOLD, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label(k)}</strong><div>{Array.isArray(v) ? <ul style={{ margin: '2px 0 0 18px', padding: 0 }}>{v.map((x) => <li key={x}>{x}</li>)}</ul> : v}</div></div>)}</div> : <Muted style={{ fontSize: 12 }}>Sales information for this offering has not been reviewed by Nova yet.</Muted>}
        </Card>
      )))}
      {tab === 'audit' && (
        <Card title="Nova Audit — turnaround">
          {terms.data?.approved ? <><p style={{ fontSize: 16, lineHeight: 1.6 }}>{terms.data.approved.statement}</p><Muted>Use exactly this wording. Do not offer any other timeline.</Muted></> : <Banner tone="warn">{terms.data?.note || 'Loading…'}</Banner>}
        </Card>
      )}
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <Badge tone="gold">{label(open.kind)}</Badge>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.65, margin: '12px 0', background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 8 }}>{open.body}</pre>
          {open.compliance_note && <Muted style={{ marginBottom: 12 }}>Compliance: {open.compliance_note}</Muted>}
          <Btn onClick={() => copy(open.body)}>Copy text</Btn>
        </Modal>
      )}
    </Page>
  )
}
