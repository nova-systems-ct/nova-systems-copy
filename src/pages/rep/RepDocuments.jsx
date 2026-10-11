import { useState } from 'react'
import { api, downloadApi, useLoad, dt, label } from '../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Modal, Check, SignaturePad, Table, Loading, useNotice } from '../../components/sales/kit'

const TONE = { signed: 'good', sent: 'warn', viewed: 'warn', needs_resign: 'bad', expired: 'bad', declined: 'bad', awaiting_countersign: 'gold', not_sent: 'muted', no_approved_version: 'muted', void: 'muted', superseded: 'muted' }
const TEXT = { signed: 'Signed', sent: 'Waiting for you', viewed: 'Opened — waiting for your signature', needs_resign: 'Changed — please sign again', expired: 'Expired — ask Nova to resend', declined: 'Declined', awaiting_countersign: 'Signed — Nova still needs to countersign', not_sent: 'Not sent yet', no_approved_version: 'Nova has not published this yet' }

export default function RepDocuments() {
  const { data, loading, error, reload } = useLoad(() => api('documents', 'my-documents', { method: 'GET' }), [])
  const [open, setOpen] = useState(null)
  const { notice, show } = useNotice()
  if (loading && !data) return <Loading />
  const signedReqs = (data?.requests || []).filter((r) => r.status === 'signed')
  return (
    <Page eyebrow="Documents" title="Agreements & documents" subtitle="You sign electronically after reading each document. Every signature records the exact version, the time and a fingerprint of the text, and you can download a signed copy. If Nova changes a document in a material way you will be asked to sign again.">
      {error && <Banner tone="bad">{error}</Banner>}
      {notice}
      <Card title="Required documents">
        {Object.entries(data?.states || {}).map(([key, s]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div><strong>{s.title}</strong><div style={{ marginTop: 4 }}><Badge tone={TONE[s.state]}>{TEXT[s.state] || label(s.state)}</Badge></div></div>
            {s.request_id && ['sent', 'viewed', 'needs_resign'].includes(s.state) && <Btn kind="primary" onClick={() => setOpen(s.request_id)}>Review & sign</Btn>}
          </div>
        ))}
      </Card>
      <Card title="Signed copies"><Table rows={signedReqs} empty="Nothing signed yet." columns={[{ key: 't', label: 'Document', render: (r) => r.sales_document_templates?.title }, { key: 'v', label: 'Version', render: (r) => r.sales_document_versions?.version }, { key: 'at', label: 'Signed', render: (r) => dt(r.signed_at) }, { key: 'cs', label: 'Countersigned', render: (r) => (r.countersigned_at ? dt(r.countersigned_at) : r.sales_document_templates?.requires_countersign ? 'Pending' : 'Not required') }, { key: 'dl', label: '', render: (r) => <Btn small kind="quiet" onClick={async () => { const x = await downloadApi('documents', 'download', { id: r.id }, `signed-${r.id}.pdf`); if (!x.ok) show(x) }}>Download PDF</Btn> }]} /></Card>
      {open && <Sign id={open} consent={data.consent} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />}
    </Page>
  )
}

function Sign({ id, consent, onClose, onDone }) {
  const { data, error, loading } = useLoad(() => api('documents', 'view', { method: 'GET', query: { id } }), [id])
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [sig, setSig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const sign = async () => { setBusy(true); setErr(null); const r = await api('documents', 'sign', { body: { request_id: id, typed_name: name, consent: agree, content_hash: data.content_hash, signature_image: sig || undefined } }); setBusy(false); if (r.ok) onDone(); else setErr(r.data?.error || 'Could not sign.') }
  const decline = async () => { const reason = window.prompt('Why are you declining? (optional)') ; if (reason === null) return; const r = await api('documents', 'decline', { body: { request_id: id, reason } }); if (r.ok) onDone(); else setErr(r.data?.error) }
  return (
    <Modal title={data?.title || 'Document'} onClose={onClose} wide>
      {loading && <Loading />}
      {error && <Banner tone="bad">{error}</Banner>}
      {data && (
        <>
          <Muted style={{ marginBottom: 10 }}>Version {data.version} · expires {dt(data.expires_at)}</Muted>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.65, maxHeight: '42vh', overflowY: 'auto', background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 8 }}>{data.body}</pre>
          <Field label="Type your full legal name to sign" style={{ marginTop: 14 }}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="Drawn signature (optional)"><SignaturePad onChange={setSig} /></Field>
          <Check checked={agree} onChange={setAgree}>{consent.text}</Check>
          {err && <Banner tone="bad">{err}</Banner>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Btn kind="primary" onClick={sign} disabled={busy || !agree || name.trim().length < 3}>{busy ? 'Signing…' : 'Sign document'}</Btn><Btn kind="danger" onClick={decline}>Decline</Btn></div>
        </>
      )}
    </Modal>
  )
}
