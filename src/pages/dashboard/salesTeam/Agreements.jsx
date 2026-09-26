import { useState } from 'react'
import { api, downloadApi, useLoad, dt, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Modal, Table, Tabs, Check, Loading, useNotice } from '../../../components/sales/kit'

const TONE = { signed: 'good', sent: 'warn', viewed: 'warn', declined: 'bad', expired: 'bad', void: 'muted', superseded: 'muted' }

export default function Agreements() {
  const [tab, setTab] = useState('templates')
  const tpl = useLoad(() => api('documents', 'templates', { method: 'GET' }), [])
  const reqs = useLoad(() => api('documents', 'requests', { method: 'GET' }), [])
  const reps = useLoad(() => api('salesteam', 'reps', { method: 'GET' }), [])
  const [edit, setEdit] = useState(null)
  const [send, setSend] = useState(null)
  const { notice, show } = useNotice()
  const reload = () => { tpl.reload(); reqs.reload() }
  const act = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); return r }
  const needCs = (reqs.data || []).filter((r) => r.status === 'signed' && r.sales_document_templates?.requires_countersign && !r.countersigned_at)
  return (
    <Page eyebrow="Sales Team" title="Agreements & signatures" subtitle="Nova supplies the text; the platform records consent, timestamps and a tamper-evident trail. It does not decide whether any text is legally sufficient — you must review each version, and an unreviewed template can never be sent." wide>
      {notice}
      <Banner tone="warn">Templates start <strong>empty</strong>. Paste your reviewed agreement text, approve the version, then send it. Approved versions are immutable; a change is a new version and can require everyone to sign again.</Banner>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'templates', label: 'Templates' }, { key: 'requests', label: 'Requests', count: reqs.data?.length }, { key: 'counter', label: 'To countersign', count: needCs.length }]} />
      {tab === 'templates' && (tpl.loading && !tpl.data ? <Loading /> : (tpl.data?.templates || []).map((t) => {
        const approved = t.versions.find((v) => v.status === 'approved'); const draft = t.versions.find((v) => v.status === 'draft')
        return (
          <Card key={t.id} title={t.title} right={<div style={{ display: 'flex', gap: 8 }}>{approved && <Btn small kind="primary" onClick={() => setSend(t)}>Send…</Btn>}<Btn small onClick={() => setEdit({ tpl: t, version: draft || null, body: draft?.body || approved?.body || '', material: true })}>{draft ? 'Edit draft' : 'New version'}</Btn></div>}>
            <Muted style={{ marginBottom: 8 }}>{t.description}{t.requires_countersign ? ' Requires Nova countersignature.' : ''}</Muted>
            <Table rows={t.versions} empty="No versions yet — nothing can be sent." columns={[{ key: 'v', label: 'Version', render: (v) => `v${v.version}` }, { key: 's', label: 'Status', render: (v) => <Badge tone={v.status === 'approved' ? 'good' : v.status === 'draft' ? 'warn' : 'muted'}>{label(v.status)}</Badge> }, { key: 'm', label: 'Change', render: (v) => (v.material_change ? 'Material (re-sign)' : 'Minor') }, { key: 'a', label: 'Approved', render: (v) => dt(v.approved_at) }, { key: 'h', label: 'Fingerprint', render: (v) => (v.content_hash ? v.content_hash.slice(0, 12) : '') }, { key: 'x', label: '', render: (v) => v.status === 'draft' && <Btn small onClick={() => { if (window.confirm('Approve this exact text? It cannot be edited afterwards.')) act(() => api('documents', 'approve-version', { body: { version_id: v.id, confirm_reviewed: window.confirm('Do you confirm you have reviewed this text (and had it legally reviewed if you require that)?') } }), 'Approved.') }}>Approve…</Btn> }]} />
          </Card>
        )
      }))}
      {tab === 'requests' && <Card><Table rows={reqs.data || []} empty="No requests yet." columns={[{ key: 'n', label: 'Signer', render: (r) => r.signer_name }, { key: 't', label: 'Document', render: (r) => `${r.sales_document_templates?.title} v${r.sales_document_versions?.version}` }, { key: 's', label: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{label(r.status)}</Badge> }, { key: 'at', label: 'Sent', render: (r) => dt(r.sent_at) }, { key: 'sg', label: 'Signed', render: (r) => dt(r.signed_at) }, { key: 'ac', label: '', render: (r) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.status === 'signed' && <Btn small kind="quiet" onClick={async () => { const x = await api('documents', 'verify', { method: 'GET', query: { id: r.id } }); show({ ok: x.ok, data: x.data }, x.ok ? (x.data.intact ? 'Integrity verified: the event chain, document text and signature record all match.' : `NOT INTACT: ${x.data.chain?.reason || 'text or signature record does not match'}`) : undefined) }}>Verify integrity</Btn>}
          {r.status === 'signed' && <Btn small kind="quiet" onClick={() => downloadApi('documents', 'download', { id: r.id }, `signed-${r.id}.pdf`)}>PDF</Btn>}
          {['sent', 'viewed', 'signed'].includes(r.status) && <Btn small kind="danger" onClick={() => { const why = window.prompt('Reason for voiding:'); if (why) act(() => api('documents', 'void', { body: { request_id: r.id, reason: why } }), 'Voided.') }}>Void</Btn>}
        </div>) }]} /></Card>}
      {tab === 'counter' && (needCs.length === 0 ? <Muted>Nothing waiting for your countersignature.</Muted> : needCs.map((r) => <Card key={r.id} title={`${r.signer_name} — ${r.sales_document_templates?.title}`}><Muted>Signed {dt(r.signed_at)}</Muted><Btn kind="primary" onClick={() => { const n = window.prompt('Type your full name to countersign:'); if (n) act(() => api('documents', 'countersign', { body: { request_id: r.id, typed_name: n } }), 'Countersigned.') }}>Countersign</Btn></Card>))}
      {edit && <EditModal e={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload() }} />}
      {send && <SendModal t={send} reps={reps.data || []} onClose={() => setSend(null)} onDone={(msg) => { setSend(null); show({ ok: true }, msg); reload() }} />}
    </Page>
  )
}

function EditModal({ e, onClose, onDone }) {
  const [body, setBody] = useState(e.body)
  const [material, setMaterial] = useState(e.material)
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)
  const save = async () => { const r = await api('documents', 'save-version', { body: { template_key: e.tpl.key, version_id: e.version?.id, body, material_change: material, change_note: note } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return (
    <Modal title={`${e.tpl.title} — ${e.version ? `edit draft v${e.version.version}` : 'new version'}`} onClose={onClose} wide>
      <Field label="Agreement text" hint="Plain text. Replace any [OWNER TO COMPLETE] placeholders — a version with placeholders cannot be approved."><Textarea rows={16} value={body} onChange={(x) => setBody(x.target.value)} /></Field>
      <Check checked={material} onChange={setMaterial}>Material change — everyone who signed an earlier version must sign this one again.</Check>
      <Field label="What changed (internal)"><Input value={note} onChange={(x) => setNote(x.target.value)} /></Field>
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind="primary" onClick={save} disabled={body.trim().length < 10}>Save draft</Btn>
    </Modal>
  )
}

function SendModal({ t, reps, onClose, onDone }) {
  const [ids, setIds] = useState([]); const [days, setDays] = useState(14); const [err, setErr] = useState(null)
  const toggle = (id) => setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))
  const send = async () => { const r = await api('documents', 'send', { body: { template_key: t.key, user_ids: ids, expires_days: days } }); if (r.ok) onDone(`Sent to ${r.data.results.filter((x) => x.ok).length} of ${ids.length}. Email is recorded as dry-run unless email mode is live.`); else setErr(r.data?.error) }
  return (
    <Modal title={`Send: ${t.title}`} onClose={onClose}>
      <Field group label="Who should sign?">{reps.filter((r) => r.status !== 'inactive').map((r) => <Check key={r.id} checked={ids.includes(r.user_id)} onChange={() => toggle(r.user_id)}>{r.display_name || r.email} <Badge>{label(r.status)}</Badge></Check>)}</Field>
      <Field label="Expires after (days)"><Input type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
      {err && <Banner tone="bad">{err}</Banner>}
      <Btn kind="primary" onClick={send} disabled={!ids.length}>Send</Btn>
    </Modal>
  )
}
