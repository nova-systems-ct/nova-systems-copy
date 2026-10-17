import { Link } from 'react-router-dom'
import { ClipboardCheck, Workflow, PhoneCall, CalendarCheck, Activity, ArrowRight } from 'lucide-react'
import { useOrg } from '../../lib/OrgContext'
import { api, useLoad } from '../../pages/dashboard/ops/ui'

const GOLD = '#C9A84C'; const DIM = 'rgba(250,250,250,0.62)'; const LINE = 'rgba(250,250,250,0.10)'
const tone = { ready: '#7BD389', partial: '#E9B44C', blocked: '#F07167' }

// The owner's first screen: the product, not the back office. Every number here comes from the live readiness check
// and the business's own records; nothing is estimated.
export default function ProductHome() {
  const { currentOrg } = useOrg()
  const org = currentOrg?.id
  const r = useLoad(() => (org ? api('readiness', { org }) : Promise.resolve(null)), [org])
  const items = r.data?.items || []
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]))
  const channelKeys = ['timezone_hours', 'prices', 'agreement', 'phone_number', 'twilio', 'webhooks', 'sms', 'voice', 'payments', 'escalation', 'worker']
  const channels = channelKeys.map((k) => byKey[k]).filter(Boolean)
  const blocked = channels.filter((i) => i.status !== 'ready')
  const callBlockers = ['phone_number', 'twilio', 'webhooks', 'voice'].map((k) => byKey[k]).filter((i) => i && i.status !== 'ready')
  const c = r.data?.counts || {}
  const card = { background: '#111111', border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 170 }
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', background: GOLD, color: '#0A0A0A', width: 'fit-content' }
  const ghost = { ...btn, background: 'transparent', color: GOLD, border: `1px solid ${GOLD}` }
  const Head = ({ Icon, title }) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon size={18} color={GOLD} /><h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h2></div>
  return (
    <section aria-labelledby="product-home" style={{ marginBottom: 32 }}>
      <p style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', margin: '0 0 6px' }}>Nova</p>
      <h1 id="product-home" style={{ fontSize: 28, fontWeight: 900, margin: '0 0 6px' }}>Run your business on Nova</h1>
      <p style={{ color: DIM, margin: '0 0 18px', fontSize: 14 }}>Audit how customers reach you, set up the agents that act on it, test them, and see what happened.</p>
      {r.error && <p role="alert" style={{ color: tone.blocked, fontSize: 13 }}>Status could not load: {String(r.error)}</p>}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div style={card}>
          <Head Icon={ClipboardCheck} title="Run an audit" />
          <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Inspect a business's real inquiry paths and records. Every finding carries its evidence, source and time.</p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link to="/dashboard/audit?new=1" style={btn}>Start an audit <ArrowRight size={14} /></Link><Link to="/dashboard/audit" style={ghost}>All audits</Link></div>
        </div>
        <div style={card}>
          <Head Icon={Workflow} title="Agents and connected channels" />
          {r.loading ? <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Checking…</p> : <p style={{ color: DIM, fontSize: 13, margin: 0 }}>{channels.length - blocked.length} of {channels.length} ready.{blocked.length ? <> Next: <span style={{ color: '#FAFAFA' }}>{blocked.slice(0, 3).map((i) => i.label).join(', ')}</span>.</> : ' Everything required is connected.'}</p>}
          <div style={{ marginTop: 'auto' }}><Link to="/dashboard/ops/test#setup" style={btn}>Set up channels <ArrowRight size={14} /></Link></div>
        </div>
        <div style={card}>
          <Head Icon={PhoneCall} title="Test a call" />
          {r.loading ? <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Checking…</p> : callBlockers.length ? <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Not possible yet: <span style={{ color: tone.blocked }}>{callBlockers.map((i) => i.label).join(', ')}</span>.</p> : <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Call <strong style={{ color: '#FAFAFA' }}>{byKey.phone_number?.detail}</strong> to test the receptionist.</p>}
          <div style={{ marginTop: 'auto' }}><Link to="/dashboard/ops/test#call" style={btn}>Open call test <ArrowRight size={14} /></Link></div>
        </div>
        <div style={card}>
          <Head Icon={CalendarCheck} title="Test inquiry-to-booking" />
          <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Send a test inquiry through the real form and follow it to a confirmed booking.</p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link to="/dashboard/ops/test#inquiry" style={btn}>Send a test inquiry <ArrowRight size={14} /></Link><a href="/book" target="_blank" rel="noreferrer" style={ghost}>Open public form</a></div>
        </div>
        <div style={card}>
          <Head Icon={Activity} title="Outcomes and failures" />
          {r.loading ? <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Checking…</p> : (
            <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Open requests <strong style={{ color: '#FAFAFA' }}>{c.open_requests ?? 0}</strong> · need a person <strong style={{ color: c.needs_person ? tone.partial : '#FAFAFA' }}>{c.needs_person ?? 0}</strong> · ready for work <strong style={{ color: '#FAFAFA' }}>{c.ready_for_work ?? 0}</strong> · open alerts <strong style={{ color: r.data?.open_incidents ? tone.blocked : '#FAFAFA' }}>{r.data?.open_incidents ?? 0}</strong></p>
          )}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link to="/dashboard/ops/requests" style={btn}>Requests <ArrowRight size={14} /></Link><Link to="/dashboard/ops/monitoring" style={ghost}>Alerts</Link><Link to="/dashboard/ops/reports" style={ghost}>Weekly report</Link></div>
        </div>
      </div>
    </section>
  )
}
