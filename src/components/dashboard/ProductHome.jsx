import { Link } from 'react-router-dom'
import { ArrowRight, Inbox, CalendarCheck, CircleDollarSign, AlertTriangle, ListChecks, Activity, Network, ClipboardCheck, Plug, LineChart } from 'lucide-react'
import { useOrg } from '../../lib/OrgContext'
import { api, useLoad } from '../../pages/dashboard/ops/ui'

// Owner home (2026-10-25 design). Every figure comes from GET ops/home — the business's own records. A figure that is
// not measured is shown as not measured; test records are counted apart; booked value and collected money are separate.
const GOLD = '#C9A84C'; const TEXT = '#FAFAFA'; const DIM = 'rgba(250,250,250,0.62)'; const FAINT = 'rgba(250,250,250,0.40)'
const LINE = 'rgba(250,250,250,0.09)'; const PANEL = '#0F0F0F'
const STATE = { connected: ['Connected', '#7BD389'], recorded_only: ['Recorded, not sent', '#E9B44C'], test_only: ['Test mode only', '#E9B44C'], setup_needed: ['Setup needed', 'rgba(250,250,250,0.55)'] }
const LEVEL = { high: ['Action needed', '#F07167'], medium: ['Decision', GOLD], low: ['FYI', 'rgba(250,250,250,0.55)'] }
const money = (c) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const time = (iso, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }

const css = `
.nh{color:${TEXT};font-family:Inter,system-ui,sans-serif}
.nh-eyebrow{color:${GOLD};font-size:11px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;margin:0}
.nh-panel{background:${PANEL};border:1px solid ${LINE};border-radius:16px;padding:20px}
.nh-panel h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
.nh-grid4{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr))}
.nh-grid2{display:grid;gap:14px;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
.nh-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid ${LINE};color:inherit;text-decoration:none}
.nh-row:first-child{border-top:0}
a.nh-row:hover .nh-row-title{color:${GOLD}}
.nh-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;background:linear-gradient(135deg,#B8933F,${GOLD} 45%,#E0C476);color:#0A0A0A;white-space:nowrap}
.nh-link{color:${GOLD};font-size:13px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.nh-chip{font-size:11px;font-weight:600;border-radius:999px;padding:3px 10px;border:1px solid currentColor;white-space:nowrap}
.nh a:focus-visible,.nh summary:focus-visible{outline:2px solid ${GOLD};outline-offset:2px;border-radius:8px}
.nh-table{width:100%;border-collapse:collapse;font-size:13px}
.nh-table th{color:${FAINT};font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-align:left;padding:8px 10px;border-bottom:1px solid ${LINE}}
.nh-table td{padding:12px 10px;border-bottom:1px solid ${LINE};vertical-align:middle}
@media (max-width:1180px){.nh-grid4{grid-template-columns:repeat(2,minmax(0,1fr))}.nh-grid2{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){.nh-grid4{grid-template-columns:minmax(0,1fr)}.nh-hide-sm{display:none}.nh-hero{font-size:34px!important}}
`

function Tile({ Icon, label, value, sub, to, tone }) {
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: DIM, fontSize: 13 }}><Icon size={18} color={GOLD} />{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.02em', margin: '10px 0 4px', color: tone || TEXT }}>{value}</div>
      <div style={{ color: FAINT, fontSize: 12, lineHeight: 1.4 }}>{sub}</div>
    </>
  )
  return to ? <Link to={to} className="nh-panel" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{body}</Link> : <div className="nh-panel">{body}</div>
}

function Spark({ series }) {
  const max = Math.max(1, ...series.map((d) => d.real + d.test))
  const w = 600; const h = 120; const step = w / series.length
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label="Inquiries per day, last 30 days" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {series.map((d, i) => {
        const rh = (d.real / max) * h; const th = (d.test / max) * h
        return (
          <g key={d.day}>
            <rect x={i * step + 2} y={h - rh - th} width={step - 4} height={th} fill="rgba(250,250,250,0.14)" rx="2"><title>{d.day}: {d.test} test</title></rect>
            <rect x={i * step + 2} y={h - rh} width={step - 4} height={rh} fill={GOLD} rx="2"><title>{d.day}: {d.real} real</title></rect>
          </g>
        )
      })}
      <text x="0" y={h + 14} fill={FAINT} fontSize="11">{series[0]?.day.slice(5)}</text>
      <text x={w} y={h + 14} fill={FAINT} fontSize="11" textAnchor="end">today</text>
    </svg>
  )
}

export default function ProductHome() {
  const { currentOrg, user } = useOrg()
  const org = currentOrg?.id
  const r = useLoad(() => (org ? api('home', { org }) : Promise.resolve(null)), [org])
  const d = r.data
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = (user?.user_metadata?.full_name || '').trim().split(' ')[0]
  const m = d?.metrics
  return (
    <section className="nh" aria-labelledby="owner-home" style={{ marginBottom: 32 }}>
      <style>{css}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', borderBottom: `1px solid ${LINE}`, paddingBottom: 22, marginBottom: 22 }}>
        <div>
          <p className="nh-eyebrow">Owner dashboard · {currentOrg?.name}</p>
          <h1 id="owner-home" className="nh-hero" style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, margin: '12px 0 10px' }}>
            {greet}{first ? <>, <span style={{ color: GOLD }}>{first}.</span></> : '.'}
          </h1>
          <p style={{ margin: 0, color: DIM, fontSize: 12, letterSpacing: '.38em', textTransform: 'uppercase' }}>Audit · Systemize · Scale</p>
        </div>
        <Link to="/dashboard/audit?new=1" className="nh-btn">Start an audit <ArrowRight size={16} /></Link>
      </div>
      <nav aria-label="Try the workers" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', margin: '-6px 0 22px', fontSize: 13 }}>
        <span style={{ color: FAINT, letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 11 }}>Try the workers</span>
        <Link to="/dashboard/ops/test#inquiry" className="nh-link">Send a test inquiry <ArrowRight size={13} /></Link>
        <Link to="/dashboard/ops/test#call" className="nh-link">Open call test <ArrowRight size={13} /></Link>
        <a href="/book" target="_blank" rel="noreferrer" className="nh-link">Public booking form <ArrowRight size={13} /></a>
      </nav>

      {r.error && <p role="alert" style={{ color: '#F07167', fontSize: 13 }}>The dashboard could not load: {String(r.error.message || r.error)}</p>}
      {r.loading && !d && <p style={{ color: DIM }}>Loading your business…</p>}
      {d && (
        <>
          <div className="nh-grid4" style={{ marginBottom: 14 }}>
            <Tile Icon={Inbox} label="Inquiries · 30 days" value={m.inquiries.real} sub={m.inquiries.test ? `+ ${m.inquiries.test} test inquiries not counted` : 'Real customer requests'} to="/dashboard/ops/requests" />
            <Tile Icon={CalendarCheck} label="Confirmed bookings · 30 days" value={m.bookings.real} sub={m.bookings.real ? `${money(m.booked_value_cents)} booked value${m.booked_value_cents === 0 ? ' (free audits)' : ''}` : m.bookings.test ? `+ ${m.bookings.test} test bookings not counted` : 'None yet'} to="/dashboard/ops/requests" />
            <Tile Icon={CircleDollarSign} label="Money collected · 30 days" value={m.collected_cents == null ? '—' : money(m.collected_cents)} sub={m.collected_note || 'Confirmed by the payment provider, minus refunds'} tone={m.collected_cents == null ? FAINT : undefined} />
            <Tile Icon={AlertTriangle} label="Needs attention" value={d.needs_attention} sub={d.needs_attention ? 'Open items below' : 'Nothing urgent'} tone={d.needs_attention ? '#F07167' : undefined} />
          </div>

          <div className="nh-grid2" style={{ marginBottom: 14 }}>
            <div className="nh-panel">
              <h2><ListChecks size={18} color={GOLD} />Today’s priorities</h2>
              <div style={{ marginTop: 8 }}>
                {!d.priorities.length ? <p style={{ color: DIM, fontSize: 14 }}>Nothing is waiting on you.</p> : d.priorities.map((p, i) => (
                  <Link key={i} to={p.to} className="nh-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nh-row-title" style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                      <div style={{ color: FAINT, fontSize: 12, marginTop: 2 }}>{p.detail}</div>
                    </div>
                    <span className="nh-chip" style={{ color: LEVEL[p.level][1] }}>{LEVEL[p.level][0]}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="nh-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2><Activity size={18} color={GOLD} />Recorded activity</h2>
                <Link to="/dashboard/ops/requests" className="nh-link">Requests <ArrowRight size={14} /></Link>
              </div>
              <div style={{ marginTop: 8 }}>
                {!d.activity.length ? <p style={{ color: DIM, fontSize: 14 }}>No worker activity recorded yet.</p> : d.activity.slice(0, 7).map((a, i) => (
                  <div key={i} className="nh-row" style={{ alignItems: 'flex-start' }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 9, marginTop: 6, background: a.kind === 'task' ? TEXT : GOLD, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 600 }}>{a.who}</strong> <span style={{ color: DIM }}>· {a.text}</span></div>
                    </div>
                    <span style={{ color: FAINT, fontSize: 12, whiteSpace: 'nowrap' }}>{ago(a.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="nh-grid2" style={{ marginBottom: 14 }}>
            <div className="nh-panel">
              <h2><CalendarCheck size={18} color={GOLD} />Today’s schedule</h2>
              <div style={{ marginTop: 8 }}>
                {!d.schedule.length ? <p style={{ color: DIM, fontSize: 14 }}>No appointments today ({d.timezone.replace('_', ' ')}).</p> : d.schedule.map((s) => (
                  <Link key={s.id} to={`/dashboard/ops/requests/${s.job_id}`} className="nh-row">
                    <div style={{ width: 74, color: GOLD, fontWeight: 700, fontSize: 14 }}>{time(s.start_at, d.timezone)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nh-row-title" style={{ fontWeight: 600, fontSize: 14 }}>{s.what}</div>
                      <div style={{ color: FAINT, fontSize: 12 }}>{s.who}{s.is_test ? ' · TEST' : ''}</div>
                    </div>
                    <span className="nh-chip" style={{ color: s.status === 'confirmed' ? '#7BD389' : '#E9B44C' }}>{s.status === 'confirmed' ? 'Confirmed' : 'Held'}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="nh-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2><Network size={18} color={GOLD} />Workers</h2>
                {d.roster && <Link to="/dashboard/command/workforce" className="nh-link">Workforce <ArrowRight size={14} /></Link>}
              </div>
              <div style={{ marginTop: 8 }}>
                {d.roster == null ? <p style={{ color: DIM, fontSize: 14 }}>The worker hierarchy belongs to Nova’s own organization.</p>
                  : !d.roster.length ? <p style={{ color: DIM, fontSize: 14 }}>No workers are registered in the hierarchy yet. Register them under Workers → Workforce; their tasks and handoffs then appear here.</p>
                  : d.roster.map((w) => (
                    <div key={w.id} className="nh-row">
                      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 34, border: `1px solid ${LINE}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{w.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name} <span style={{ color: FAINT, fontWeight: 400, fontSize: 12 }}>· {w.type}</span></div>
                        <div style={{ color: FAINT, fontSize: 12 }}>{w.current ? `Working on: ${w.current}` : `${w.open_tasks} open task${w.open_tasks === 1 ? '' : 's'}`}</div>
                      </div>
                      {w.overdue > 0 && <span className="nh-chip" style={{ color: '#F07167' }}>{w.overdue} overdue</span>}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="nh-panel" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2><ClipboardCheck size={18} color={GOLD} />Audit queue</h2>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {d.audit_fixtures_hidden > 0 && <span style={{ color: FAINT, fontSize: 12 }}>{d.audit_fixtures_hidden} test audits hidden</span>}
                <Link to="/dashboard/audit" className="nh-link">All audits <ArrowRight size={14} /></Link>
              </div>
            </div>
            {!d.audits.length ? <p style={{ color: DIM, fontSize: 14 }}>No audits yet.</p> : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table className="nh-table">
                  <thead><tr><th>Business</th><th className="nh-hide-sm">Type</th><th>Stage</th><th className="nh-hide-sm">Findings</th><th>Report</th><th className="nh-hide-sm">Due</th></tr></thead>
                  <tbody>{d.audits.map((a) => (
                    <tr key={a.id}>
                      <td><Link to={`/dashboard/audit/${a.id}`} style={{ color: TEXT, fontWeight: 600, textDecoration: 'none' }}>{a.business}</Link></td>
                      <td className="nh-hide-sm" style={{ color: DIM }}>{a.scope}</td>
                      <td style={{ minWidth: 150 }}>
                        <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>{a.status.replace(/_/g, ' ')} · {a.stage} of {a.stages}</div>
                        <div aria-hidden="true" style={{ height: 4, background: LINE, borderRadius: 4 }}><div style={{ width: `${(a.stage / a.stages) * 100}%`, height: 4, background: GOLD, borderRadius: 4 }} /></div>
                      </td>
                      <td className="nh-hide-sm">{a.findings}</td>
                      <td>{a.report ? <span className="nh-chip" style={{ color: a.report.status === 'approved' ? '#7BD389' : GOLD }}>v{a.report.version} {a.report.status}</span> : <span style={{ color: FAINT }}>none yet</span>}</td>
                      <td className="nh-hide-sm" style={{ color: DIM }}>{a.due_at ? new Date(a.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : a.clock_policy_approved ? 'clock not started' : 'no clock policy'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="nh-grid2">
            <div className="nh-panel">
              <h2><LineChart size={18} color={GOLD} />Inquiries · last 30 days</h2>
              <p style={{ color: FAINT, fontSize: 12, margin: '6px 0 12px' }}><span style={{ color: GOLD }}>■</span> real requests &nbsp; <span style={{ color: 'rgba(250,250,250,0.4)' }}>■</span> test requests</p>
              <Spark series={d.series} />
            </div>
            <div className="nh-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2><Plug size={18} color={GOLD} />Integrations</h2>
                <Link to="/dashboard/ops/install" className="nh-link">Install Systems <ArrowRight size={14} /></Link>
              </div>
              <div style={{ marginTop: 8 }}>
                {d.integrations.map((i) => (
                  <div key={i.key} className="nh-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                      <div style={{ color: FAINT, fontSize: 12 }}>{i.purpose}</div>
                    </div>
                    <span className="nh-chip" style={{ color: STATE[i.state][1] }} title={i.note}>{STATE[i.state][0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
