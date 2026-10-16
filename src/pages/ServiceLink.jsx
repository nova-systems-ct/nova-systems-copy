import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSEO } from '@/hooks/useSEO'

const C = { bg: '#0A0A0A', panel: '#111111', line: 'rgba(250,250,250,0.12)', text: '#FAFAFA', dim: 'rgba(250,250,250,0.65)', gold: '#C9A84C', red: '#F07167', green: '#7BD389', amber: '#E9B44C' }
const money = (c, cur = 'usd') => (c == null ? '—' : `${String(cur).toLowerCase() === 'usd' ? '$' : ''}${(c / 100).toFixed(2)}`)
const when = (iso, tz) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)) : '—')
const call = (op, { method = 'GET', token, body } = {}) => fetch(`/api/client?resource=ops&op=${op}${method === 'GET' ? `&token=${encodeURIComponent(token)}` : ''}`, { method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify({ token, ...body }) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j })

// Customer page for one request: review the exact agreement, sign it, pay the deposit through Stripe's hosted page.
export default function ServiceLink() {
  useSEO({ title: 'Your booking — Nova Systems', robots: 'noindex, nofollow' })
  const { token } = useParams(); const [sp] = useSearchParams()
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null)
  const [name, setName] = useState(''); const [consent, setConsent] = useState(false)
  const load = useCallback(() => call('customer-view', { token }).then(setD, (e) => setErr(e.message)), [token])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (sp.get('deposit') === 'returned') { setMsg({ tone: 'info', text: 'Thanks. Your payment is being confirmed with Stripe — this page updates once Stripe confirms it. Leaving checkout does not by itself mean a payment went through.' }); const t = setInterval(load, 4000); return () => clearInterval(t) } return undefined }, [sp, load])
  const sign = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { await call('customer-sign', { method: 'POST', token, body: { signer_name: name, consent, content_sha256: d.agreement.content_sha256 } }); setMsg({ tone: 'ok', text: 'Signed. A copy is available to download below.' }); await load() }
    catch (x) { setMsg({ tone: 'bad', text: x.message }) } finally { setBusy(false) }
  }
  const pay = async () => { setBusy(true); setMsg(null); try { const r = await call('customer-deposit', { method: 'POST', token }); window.location.assign(r.url) } catch (x) { setMsg({ tone: 'bad', text: x.message }); setBusy(false) } }
  const download = async () => { try { const r = await call('customer-agreement-pdf', { token }); window.open(r.url, '_blank', 'noopener') } catch (x) { setMsg({ tone: 'bad', text: x.message }) } }
  const box = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 16 }
  const btn = (primary) => ({ borderRadius: 8, padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: `1px solid ${C.gold}`, background: primary ? C.gold : 'transparent', color: primary ? C.bg : C.gold, fontFamily: 'inherit' })
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif", padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {err && <div role="alert" style={{ ...box, borderColor: `${C.red}66` }}>{err}</div>}
        {!d && !err && <p role="status" style={{ color: C.dim }}>Loading…</p>}
        {d && (
          <>
            {d.is_test && <div role="note" style={{ ...box, borderColor: `${C.amber}66`, color: C.amber, fontWeight: 700 }}>TEST — this is a Nova test business. No real service is booked and no real money moves.</div>}
            <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', margin: 0 }}>{d.business}</p>
            <h1 style={{ fontSize: 24, margin: '8px 0 16px' }}>{d.request.service_name || 'Your request'}</h1>
            {msg && <div role="status" style={{ ...box, borderColor: msg.tone === 'bad' ? `${C.red}66` : msg.tone === 'ok' ? `${C.green}66` : C.line }}>{msg.text}</div>}
            <section style={box} aria-label="Summary">
              <div>Total: <strong>{money(d.request.total_cents, d.request.currency)}</strong>{d.request.deposit_cents ? <> · Deposit: <strong>{money(d.request.deposit_cents, d.request.currency)}</strong> (applied to the total)</> : null}</div>
              {d.booking && <div style={{ marginTop: 8 }}>Time: <strong>{when(d.booking.start_at, d.timezone)}</strong> — {d.booking.status === 'held' ? <span style={{ color: C.amber }}>held for you until {when(d.booking.hold_expires_at, d.timezone)}</span> : d.booking.status === 'confirmed' ? <span style={{ color: C.green }}>confirmed</span> : <span style={{ color: C.red }}>{d.booking.status} — reply to the business to choose a new time</span>}</div>}
            </section>
            {d.agreement && (
              <section style={box} aria-label="Agreement">
                <h2 style={{ fontSize: 16, marginTop: 0 }}>{d.agreement.title}</h2>
                <div tabIndex={0} style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55, maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 8, padding: 12 }}>{d.agreement.text}</div>
                <p style={{ fontSize: 11, color: C.dim, wordBreak: 'break-all' }}>Document fingerprint (SHA-256): {d.agreement.content_sha256}</p>
                {d.agreement.status === 'signed' ? (
                  <><p style={{ color: C.green }}>Signed by {d.agreement.signer_name} on {when(d.agreement.signed_at, d.timezone)}.</p><button style={btn(false)} onClick={download}>Download signed copy</button></>
                ) : (
                  <form onSubmit={sign}>
                    <label htmlFor="sig-name" style={{ display: 'block', fontSize: 13, color: C.dim, marginBottom: 6 }}>Type your full legal name to sign</label>
                    <input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} autoComplete="name" style={{ width: '100%', boxSizing: 'border-box', padding: 11, borderRadius: 8, border: `1px solid ${C.line}`, background: C.bg, color: C.text, fontSize: 15 }} />
                    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.dim, margin: '12px 0' }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} /> <span>{d.agreement.consent_text}</span></label>
                    <button type="submit" style={btn(true)} disabled={busy || !consent || name.trim().length < 3}>Sign agreement</button>
                  </form>
                )}
              </section>
            )}
            {d.request.deposit_cents > 0 && d.agreement?.status === 'signed' && (
              <section style={box} aria-label="Deposit">
                {d.deposit?.status === 'paid' ? <p style={{ color: C.green, margin: 0 }}>Deposit of {money(d.deposit.amount_cents)} confirmed by Stripe{d.deposit.test_mode ? ' (test mode)' : ''}.</p> : d.payments.available ? (
                  <>
                    <p style={{ marginTop: 0 }}>Pay the {money(d.request.deposit_cents)} deposit on Stripe's secure page. {d.payments.funds_recipient && <span style={{ color: C.dim }}>Recipient: {d.payments.funds_recipient}.</span>}</p>
                    <button style={btn(true)} onClick={pay} disabled={busy}>Pay deposit securely</button>
                    <p style={{ fontSize: 12, color: C.dim }}>Card details are entered on Stripe's page, never here or by phone.</p>
                  </>
                ) : <p style={{ margin: 0 }}>Online deposits are not available for this business yet. The business will contact you about payment.</p>}
              </section>
            )}
            {d.request.state === 'confirmed' && <p style={{ color: C.green }}>Your booking is confirmed. You can reply to the business's text with any questions.</p>}
          </>
        )}
      </div>
    </main>
  )
}
