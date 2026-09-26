import { useState } from 'react'
import { api, useLoad, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Table, Stats, Stat, Loading, useNotice } from '../../../components/sales/kit'

export default function SalesSettings() {
  const policy = useLoad(() => api('salesteam', 'policy', { method: 'GET' }), [])
  const delivery = useLoad(() => api('notifications', 'delivery-report', { method: 'GET' }), [])
  const { notice, show } = useNotice()
  const [f, setF] = useState(null)
  const cur = policy.data?.current?.policy
  const edit = f || (cur && { programs: cur.required_program_slugs === 'all' ? '' : cur.required_program_slugs.join(', '), docs: cur.required_documents.join(', '), comp: cur.compensation_document, items: cur.operational_items.map((i) => `${i.key}: ${i.label}`).join('\n'), note: '' })
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) { policy.reload(); delivery.reload() } return r }
  const save = () => act(() => api('salesteam', 'save-policy', { body: { change_note: edit.note, policy: { required_program_slugs: edit.programs.trim() ? edit.programs.split(',').map((x) => x.trim()) : 'all', required_documents: edit.docs.split(',').map((x) => x.trim()).filter(Boolean), compensation_document: edit.comp, operational_items: edit.items.split('\n').map((l) => { const [k, ...r] = l.split(':'); return { key: k.trim(), label: r.join(':').trim() } }).filter((i) => i.key && i.label) } } }), 'Saved as a pending version.')
  return (
    <Page eyebrow="Sales Team" title="Settings & health" subtitle="The activation policy decides what must be true before you may activate a representative. Email delivery shows honest states: dry-run means deliberately not sent; sent means the provider accepted it, not that it was delivered." wide>
      {notice}
      <Card title="Activation policy" right={policy.data && <Badge tone={policy.data.current.provisional ? 'warn' : 'good'}>{policy.data.current.provisional ? 'Provisional (strict default) — not approved' : `Approved v${policy.data.current.version}`}</Badge>}>
        {policy.loading && !policy.data ? <Loading /> : edit && (
          <>
            <Field label="Required programs (comma-separated slugs; empty = all ten)"><Input value={edit.programs} onChange={(e) => setF({ ...edit, programs: e.target.value })} /></Field>
            <Field label="Required documents (template keys)"><Input value={edit.docs} onChange={(e) => setF({ ...edit, docs: e.target.value })} /></Field>
            <Field label="Compensation document key"><Input value={edit.comp} onChange={(e) => setF({ ...edit, comp: e.target.value })} /></Field>
            <Field label="Operational setup items (one per line — key: label)"><Textarea rows={4} value={edit.items} onChange={(e) => setF({ ...edit, items: e.target.value })} /></Field>
            <Field label="Note"><Input value={edit.note} onChange={(e) => setF({ ...edit, note: e.target.value })} /></Field>
            <Btn kind="primary" onClick={save}>Save as new version</Btn>
          </>
        )}
      </Card>
      <Card title="Policy versions"><Table rows={policy.data?.versions || []} columns={[{ key: 'v', label: 'Version', render: (v) => `v${v.version}` }, { key: 's', label: 'Status', render: (v) => <Badge tone={v.status === 'approved' ? 'good' : 'warn'}>{label(v.status)}</Badge> }, { key: 'n', label: 'Note', render: (v) => v.change_note || '' }, { key: 'a', label: '', render: (v) => v.status === 'pending_approval' && <Btn small onClick={() => { if (window.confirm('Approve this activation policy?')) act(() => api('salesteam', 'approve-policy', { body: { config_id: v.id } }), 'Approved.') }}>Approve</Btn> }]} empty="No versions saved — the strict default applies." /></Card>
      <Card title="Email delivery" right={<Btn small onClick={() => act(() => api('notifications', 'run-maintenance', { body: {} }), 'Maintenance sweep completed (expiries, retries, reminders).')}>Run maintenance now</Btn>}>
        {delivery.data && <>
          <Stats>{Object.entries(delivery.data.counts).map(([s, c]) => <Stat key={s} label={label(s)} value={c} tone={['failed', 'bounced'].includes(s) ? 'bad' : s === 'blocked' ? 'warn' : undefined} />)}</Stats>
          <Muted style={{ marginBottom: 10 }}>{delivery.data.note}</Muted>
          <Table rows={delivery.data.problems} empty="No delivery problems." columns={[{ key: 'e', label: 'To', render: (p) => p.email }, { key: 'k', label: 'Kind', render: (p) => label(p.kind) }, { key: 's', label: 'State', render: (p) => <Badge tone="bad">{label(p.status)}</Badge> }, { key: 'x', label: 'Reason', render: (p) => p.last_error || '' }, { key: 'at', label: 'When', render: (p) => dt(p.created_at) }, { key: 'r', label: '', render: (p) => p.status === 'failed' && <Btn small onClick={() => act(() => api('notifications', 'retry', { body: { id: p.id } }), 'Retried.')}>Retry</Btn> }]} />
        </>}
      </Card>
      <Banner tone="warn">Environment switches (set in hosting, never in the browser): SALES_EMAIL_MODE (dry_run | live) with SALES_EMAIL_ALLOWLIST, SALES_PAYOUTS_MODE (provider), SALES_ALLOW_LIVE_STRIPE. Until you set them, nothing is emailed to real people, no live charge is possible and no transfer can be sent.</Banner>
    </Page>
  )
}
