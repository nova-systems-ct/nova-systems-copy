import { useEffect, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { api, useLoad, C, Card, Loading, Badge, PageHeader, Notice } from './ui'
import { authedFetch } from '../../../lib/apiAuth'
import { supabase } from '../../../lib/supabaseClient'

// One place for an owner to set up and prove the product: channel readiness with the exact blocker for each item,
// a real test inquiry through the business's own form, and the conditions for a real test call.
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export default function OpsTestCenter() {
  const { orgId, business } = useOutletContext()
  const { hash } = useLocation()
  const r = useLoad(() => api('readiness', { org: orgId }), [orgId])
  useEffect(() => { if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200) }, [hash, r.loading])
  const items = r.data?.items || []
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]))
  const callNeeds = ['phone_number', 'twilio', 'webhooks', 'voice', 'escalation'].map((k) => byKey[k]).filter(Boolean)
  return (
    <>
      <PageHeader title="Test center" sub="Set up the channels, then prove each workflow end to end. Results are saved like any other request and marked TEST." />
      <div id="setup"><Card title="Agents and connected channels">
        {r.loading ? <Loading /> : (
          <table className="ops-table"><tbody>
            {items.map((i) => <tr key={i.key}><td style={{ width: '38%' }}>{i.label}</td><td><Badge value={i.status} /></td><td style={{ color: C.dim, fontSize: 12 }}>{i.detail}</td></tr>)}
          </tbody></table>
        )}
        <p style={{ fontSize: 12, color: C.dim }}>Business hours, prices, agreement, escalation contact and review link are set in <Link to="/dashboard/ops/settings" style={{ color: C.gold }}>Settings</Link>. Phone, texting and payment credentials are set by Nova in the hosting environment, never in this screen.</p>
      </Card></div>
      <div id="inquiry" style={{ marginTop: 16 }}><InquiryTest orgId={orgId} business={business} onDone={r.reload} /></div>
      <div id="call" style={{ marginTop: 16 }}><Card title="Test a call">
        {r.loading ? <Loading /> : callNeeds.every((i) => i.status === 'ready') ? (
          <p>Call <strong>{byKey.phone_number.detail}</strong> from your own phone. The call, what the receptionist did, and any booking appear under <Link to="/dashboard/ops/requests" style={{ color: C.gold }}>Requests</Link>.</p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>A real test call is not possible in this environment yet. Each of these must be ready:</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{callNeeds.map((i) => <li key={i.key} style={{ marginBottom: 4 }}><strong>{i.label}</strong> — <span style={{ color: i.status === 'ready' ? C.text : '#F07167' }}>{i.status === 'ready' ? 'ready' : i.detail}</span></li>)}</ul>
            <p style={{ fontSize: 12, color: C.dim }}>Nova does not simulate calls here. Until these are ready, test the same receptionist logic only in Nova's automated tests.</p>
          </>
        )}
      </Card></div>
    </>
  )
}

function InquiryTest({ orgId, business, onDone }) {
  const [msg, setMsg] = useState("I'd like to book a time this week.")
  const [busy, setBusy] = useState(false); const [out, setOut] = useState(null); const [err, setErr] = useState(null)
  // The test customer's contact is the owner's own address (owner-controlled), so a live environment would email the owner.
  const [email, setEmail] = useState('')
  useEffect(() => { supabase?.auth.getUser().then(({ data }) => { if (data?.user?.email) setEmail((e) => e || data.user.email) }) }, [])
  const w = useLoad(() => authedFetch(`/api/client?resource=wave1&op=settings&organization_id=${encodeURIComponent(orgId)}`).then((x) => x.json()), [orgId])
  const token = w.data?.form_token
  const send = async () => {
    setBusy(true); setErr(null); setOut(null)
    try {
      const r = await fetch(`/api/client?resource=ops&op=web-inquiry&form=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form: token, is_test: true, continue_on_web: true, submission_id: newId(), rendered_at: Date.now() - 5000, fields: { name: 'TEST Inquiry (owner test)', email, phone: '', message: msg } }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || j.reason || 'The test inquiry was not accepted.')
      setOut(j); onDone?.()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Card title="Test inquiry-to-booking">
      <p style={{ marginTop: 0, color: C.dim, fontSize: 13 }}>Sends an inquiry through {business?.name || 'this business'}'s real web form. The worker saves it, qualifies it against the approved services, and opens the customer's private page where you choose a real open time and sign. Marked TEST.</p>
      {w.loading ? <Loading /> : !token ? <Notice tone="warn">This business has no web form yet. Turn it on in Settings (form link) first.</Notice> : (
        <>
          <label htmlFor="ti-msg" style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>What the test customer writes</label>
          <input id="ti-msg" className="ops-input" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <label htmlFor="ti-email" style={{ display: 'block', fontSize: 12, color: C.dim, margin: '10px 0 4px' }}>Test customer's email (yours — the private link is sent here when email is live)</label>
          <input id="ti-email" type="email" className="ops-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="ops-btn primary" style={{ marginTop: 10 }} disabled={busy || !msg.trim() || !email.includes('@')} onClick={send}>{busy ? 'Sending…' : 'Send test inquiry'}</button>
        </>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
      {out && (
        <Notice tone="ok">
          Saved. Worker result: <strong>{out.outcome === 'quoted' ? 'qualified and quoted from an approved price' : out.outcome === 'escalated' ? 'sent to a person (it should not be handled automatically)' : 'needs the customer to choose a service'}</strong>.{' '}
          <a href={out.next_url} target="_blank" rel="noreferrer" style={{ color: C.gold }}>Open the customer's page</a> to choose a time and sign, then check <Link to="/dashboard/ops/requests" style={{ color: C.gold }}>Requests</Link>.
        </Notice>
      )}
    </Card>
  )
}
