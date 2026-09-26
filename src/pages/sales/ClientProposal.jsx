import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, money, dt } from '../../lib/salesApi'
import { useSEO } from '../../hooks/useSEO'
import { PublicShell, Card, Muted, Btn, Field, Input, Textarea, Check, Banner, Badge, SignaturePad, GOLD, FAINT, LINE, Loading } from '../../components/sales/kit'

// Client-facing proposal. The client is not a Nova user: the personal link is the credential (stored server-side only as a hash).
// This page can show a signature and a payment link, but it can never mark anything paid — only a verified provider event or the
// owner can do that.
export default function ClientProposal() {
  useSEO({ title: 'Your proposal | Nova Systems', description: 'Review and sign your Nova Systems proposal.' })
  const { token } = useParams()
  const [sp] = useSearchParams()
  const [state, setState] = useState({ loading: true })
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [sig, setSig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  const load = async () => {
    const r = await api('clientproposal', 'view', { method: 'GET', query: { token } })
    setState(r.ok ? { data: r.data } : { gone: r.data?.error || 'This link is not valid.', status: r.data?.status })
  }
  useEffect(() => { load() }, [token])

  if (state.loading) return <PublicShell><Loading /></PublicShell>
  if (state.gone) return <PublicShell narrow><h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Proposal unavailable</h1><Banner tone="warn">{state.gone}</Banner></PublicShell>

  const { proposal: p, consent: c, payment: pay } = state.data
  const signed = state.data.status === 'signed' || state.data.status === 'accepted'
  const sign = async (e) => {
    e.preventDefault(); setBusy(true); setError(null)
    const r = await api('clientproposal', 'sign', { body: { token, typed_name: name, consent, content_hash: state.data.content_hash, signature_image: sig || undefined } })
    setBusy(false)
    if (r.ok) load(); else setError(r.data?.error || 'Could not sign.')
  }
  const payNow = async () => {
    setBusy(true); setError(null)
    const r = await api('clientproposal', 'pay', { body: { token } })
    setBusy(false)
    if (r.ok && r.data.checkout_url) window.location.href = r.data.checkout_url; else setError(r.data?.error || 'Payment is not available right now.')
  }
  const decline = async () => { setBusy(true); const r = await api('clientproposal', 'decline', { body: { token, reason } }); setBusy(false); if (r.ok) load(); else setError(r.data?.error || 'Could not decline.') }

  return (
    <PublicShell>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Proposal · version {p.version}</p>
      <h1 style={{ fontSize: 'clamp(24px,5vw,32px)', fontWeight: 800, margin: '6px 0 6px' }}>{p.title}</h1>
      <Muted style={{ marginBottom: 18 }}>Prepared for {p.prepared_for.contact}{p.prepared_for.business ? `, ${p.prepared_for.business}` : ''} by {p.prepared_by}. {state.data.expires_at && !signed ? `Valid until ${dt(state.data.expires_at)}.` : ''}</Muted>
      {sp.get('payment') === 'return' && <Banner tone="warn">Thanks — if you just paid, Nova's payment provider will confirm it shortly. This page cannot confirm a payment by itself.</Banner>}
      {sp.get('payment') === 'cancelled' && <Banner tone="warn">Payment was not completed. You can try again below whenever you are ready.</Banner>}

      <Card title="Scope"><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: 0, fontSize: 14 }}>{p.scope_summary}</p></Card>

      <Card title="What is included">
        {p.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap' }}>
            <div><strong>{it.name}</strong>{it.quantity > 1 ? ` × ${it.quantity}` : ''} {it.label && <Badge tone="warn">{it.label}</Badge>}<div style={{ color: FAINT, fontSize: 12, marginTop: 2 }}>{it.billing === 'monthly' ? 'billed monthly' : 'one-time'}</div></div>
            <div style={{ fontWeight: 700 }}>{money(it.line_total_cents, p.currency)}</div>
          </div>
        ))}
        <div style={{ paddingTop: 12, display: 'grid', gap: 4, justifyContent: 'end', textAlign: 'right' }}>
          <span style={{ color: FAINT, fontSize: 13 }}>Subtotal {money(p.subtotal_cents, p.currency)}</span>
          {p.discount_cents > 0 && <span style={{ color: FAINT, fontSize: 13 }}>Discount −{money(p.discount_cents, p.currency)}</span>}
          <span style={{ fontSize: 22, fontWeight: 800 }}>Total {money(p.total_cents, p.currency)}</span>
          <span style={{ color: FAINT, fontSize: 12 }}>{p.payment_terms || 'Payment is requested after you sign.'} Amount due: {money(p.payment_due_cents, p.currency)}</span>
        </div>
      </Card>
      <Muted style={{ fontSize: 12, marginBottom: 18 }}>This proposal describes what will be done. It does not promise any business result or revenue.</Muted>

      {error && <Banner tone="bad">{error}</Banner>}

      {!signed && state.data.status !== 'declined' && (
        <Card title="Sign electronically">
          <form onSubmit={sign}>
            <Field label="Type your full legal name to sign"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>
            <Field label="Draw your signature (optional)"><SignaturePad onChange={setSig} /></Field>
            <Check checked={consent} onChange={setConsent}>{c.text}</Check>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn kind="primary" type="submit" disabled={busy || !consent || name.trim().length < 3}>{busy ? 'Signing…' : 'Sign proposal'}</Btn>
              <Btn kind="quiet" onClick={() => setDeclining(true)}>Decline</Btn>
            </div>
          </form>
        </Card>
      )}
      {declining && (
        <Card title="Decline this proposal"><Field label="Reason (optional)"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Btn kind="danger" onClick={decline} disabled={busy}>Confirm decline</Btn> <Btn kind="quiet" onClick={() => setDeclining(false)}>Cancel</Btn></Card>
      )}
      {signed && (
        <>
          <Banner tone="good">Signed{state.data.signer_name ? ` by ${state.data.signer_name}` : ''} on {dt(state.data.signed_at)}. Thank you.</Banner>
          <Card title="Payment">
            {pay.status === 'paid' ? <Muted>Payment confirmed. Nova will be in touch about the next steps.</Muted>
              : pay.online_available ? <><Muted style={{ marginBottom: 12 }}>Pay securely on our payment provider's page. Nova never sees or stores your card details.</Muted><Btn kind="primary" onClick={payNow} disabled={busy}>{busy ? 'Opening…' : `Pay ${money(p.payment_due_cents, p.currency)}`}</Btn></>
                : <Muted>Online payment is not available yet. Nova will send you payment instructions.</Muted>}
          </Card>
          <Muted style={{ fontSize: 12 }}>Nova verifies every sale before work begins; you will hear from us once that is done.</Muted>
        </>
      )}
      {state.data.status === 'declined' && <Banner tone="warn">This proposal was declined.</Banner>}
    </PublicShell>
  )
}
