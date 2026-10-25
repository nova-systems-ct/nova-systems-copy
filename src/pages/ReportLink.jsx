import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Download, MessageSquare, ArrowRight, FileSearch, ListOrdered, BarChart3, Building2, Info } from 'lucide-react'
import { useSEO } from '@/hooks/useSEO'

// Client view of the exact approved audit report, through Nova's secure delivery link (2026-10-25 design).
// Everything shown comes from the approved, hash-checked content. Counts are counts of what the report contains; a
// financial figure appears only when the report itself contains a scenario, labelled as a scenario with its inputs.
const C = { bg: '#0A0A0A', panel: '#0F0F0F', line: 'rgba(250,250,250,0.09)', text: '#FAFAFA', dim: 'rgba(250,250,250,0.64)', faint: 'rgba(250,250,250,0.42)', gold: '#C9A84C' }
const NAMES = { executive_summary: 'Executive summary', business_identity: 'Business', findings: 'Findings', recommendations: 'Prioritized installation recommendation', estimates_and_assumptions: 'Financial scenarios and assumptions', scope_and_method: 'Scope, method and tests', competitor_benchmarks: 'Competitor benchmarks', software_review: 'Software review', evidence_reviewed: 'Evidence appendix', limitations: 'Limitations', next_steps: 'Next steps' }
const ORDER = Object.keys(NAMES)
const TABS = [['summary', 'Executive summary'], ['findings', 'Findings'], ['next', 'Next steps'], ['evidence', 'Evidence'], ['full', 'Full report']]
const IMPACT = { verified: 'Measured from records', scenario: 'Scenario — depends on stated inputs', unknown: 'Impact not yet measurable', none: 'No financial impact claimed' }

function Value({ v }) {
  if (v == null || v === '') return null
  if (typeof v !== 'object') return <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{String(v)}</p>
  if (Array.isArray(v)) return <ol style={{ paddingLeft: 18 }}>{v.map((x, i) => <li key={i} style={{ marginBottom: 8 }}><Value v={x} /></li>)}</ol>
  return <dl style={{ margin: 0 }}>{Object.entries(v).filter(([, x]) => x != null && x !== '').map(([k, x]) => <div key={k} style={{ marginBottom: 6 }}><dt style={{ color: C.faint, fontSize: 12, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</dt><dd style={{ margin: 0 }}><Value v={x} /></dd></div>)}</dl>
}
const Panel = ({ title, Icon, children, right }) => (
  <section className="rl-panel">
    {(title || right) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      {title && <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center' }}>{Icon && <Icon size={19} color={C.gold} />}{title}</h2>}{right}
    </div>}
    {children}
  </section>
)

export default function ReportLink() {
  useSEO({ title: 'Your Nova report — Nova Systems', robots: 'noindex, nofollow' })
  const { token } = useParams()
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [tab, setTab] = useState('summary')
  useEffect(() => { fetch(`/api/client?resource=audit&op=report-view&token=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Unavailable'); setD(j) }).catch((e) => setErr(e.message)) }, [token])
  const pdf = async () => { const r = await fetch(`/api/client?resource=audit&op=report-view-pdf&token=${encodeURIComponent(token)}`); const j = await r.json(); if (j.pdf_base64) { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${j.pdf_base64}`; a.download = j.filename; a.click() } }
  const c = d?.content || {}
  const biz = c.business_identity || {}
  const findings = Array.isArray(c.findings) ? c.findings : []
  const recs = Array.isArray(c.recommendations) ? c.recommendations : []
  const evidence = Array.isArray(c.evidence_reviewed) ? c.evidence_reviewed : []
  const scen = c.estimates_and_assumptions
  const scenarioCents = scen?.total_monthly_gross_opportunity_cents
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif", padding: 'clamp(18px,4vw,44px) clamp(16px,4vw,48px)' }}>
      <style>{`
        .rl-panel{background:${C.panel};border:1px solid ${C.line};border-radius:16px;padding:20px;margin-bottom:14px}
        .rl-grid{display:grid;gap:14px;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
        .rl-tiles{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px}
        .rl-tile{border:1px solid ${C.line};border-radius:12px;padding:14px}
        .rl-btn{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:13px 18px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
        .rl-tab{background:none;border:0;border-bottom:2px solid transparent;color:${C.dim};padding:12px 2px;margin-right:26px;font-size:14px;cursor:pointer;white-space:nowrap}
        .rl-tab[aria-selected=true]{color:${C.gold};border-color:${C.gold};font-weight:600}
        .rl-row{border-top:1px solid ${C.line};padding:14px 0;display:flex;gap:14px}
        .rl-row:first-of-type{border-top:0}
        .rl-chip{font-size:11px;border:1px solid ${C.line};border-radius:999px;padding:3px 10px;color:${C.dim};white-space:nowrap}
        main button:focus-visible,main a:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
        @media (max-width:900px){.rl-grid{grid-template-columns:minmax(0,1fr)}}
        @media (max-width:520px){.rl-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.rl-hero{font-size:38px!important}}
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${C.line}`, paddingBottom: 14, marginBottom: 22 }}>
          <img src="/logo.png" alt="Nova Systems" width="64" height="64" style={{ width: 64, height: 64, mixBlendMode: 'lighten', marginLeft: -8 }} />
          <p style={{ margin: 0, color: C.faint, fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase' }}>Client report</p>
        </div>
        {err && <div role="alert" style={{ border: '1px solid rgba(240,113,103,0.4)', borderRadius: 12, padding: 16 }}>{err}</div>}
        {!d && !err && <p role="status" style={{ color: C.dim }}>Loading your report…</p>}
        {d && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <p className="rl-hero" style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.02, margin: 0 }}>Your Nova <span style={{ color: C.gold }}>Audit</span></p>
                <h1 style={{ fontSize: 15, fontWeight: 500, color: C.dim, margin: '10px 0 0' }}>{d.title}</h1>
                <p style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', color: C.dim, fontSize: 14, margin: '14px 0 0' }}>
                  <Building2 size={18} color={C.gold} /><strong style={{ color: C.text, fontSize: 18 }}>{biz.name || 'Your business'}</strong>
                  {biz.location && <span>· {biz.location}</span>}
                  <span>· Version {d.version}, approved {new Date(d.approved_at).toLocaleDateString()}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={pdf} className="rl-btn" style={{ background: 'transparent', color: C.text, border: `1px solid ${C.gold}` }}><Download size={17} />Download PDF</button>
                <Link to="/book" className="rl-btn" style={{ background: 'linear-gradient(135deg,#B8933F,#C9A84C 45%,#E0C476)', color: '#0A0A0A' }}><MessageSquare size={17} />Discuss findings<ArrowRight size={16} /></Link>
              </div>
            </div>

            <div role="tablist" aria-label="Report sections" style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.line}`, margin: '24px 0 18px' }}>
              {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="rl-tab" onClick={() => setTab(k)}>{l}</button>)}
            </div>

            {tab === 'summary' && (
              <div className="rl-grid">
                <div>
                  <Panel title="Executive summary" Icon={BarChart3}>
                    <Value v={c.executive_summary} />
                    <div className="rl-tiles">
                      <div className="rl-tile"><div style={{ fontSize: 30, fontWeight: 800 }}>{findings.length}</div><div style={{ color: C.dim, fontSize: 13 }}>Findings</div></div>
                      <div className="rl-tile"><div style={{ fontSize: 30, fontWeight: 800 }}>{recs.length}</div><div style={{ color: C.dim, fontSize: 13 }}>Recommended steps</div></div>
                      <div className="rl-tile"><div style={{ fontSize: 30, fontWeight: 800 }}>{evidence.length}</div><div style={{ color: C.dim, fontSize: 13 }}>Evidence records</div></div>
                    </div>
                  </Panel>
                  <Panel title="Evidence-backed findings" Icon={FileSearch} right={findings.length > 3 && <button className="rl-tab" style={{ margin: 0, color: C.gold }} onClick={() => setTab('findings')}>View all</button>}>
                    {!findings.length ? <p style={{ color: C.dim }}>This report records no findings.</p> : findings.slice(0, 3).map((f, i) => <Finding key={i} f={f} i={i} />)}
                  </Panel>
                </div>
                <div>
                  <Panel title="Financial impact" Icon={Info}>
                    {scenarioCents ? (
                      <>
                        <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>${Math.round(scenarioCents / 100).toLocaleString('en-US')}<span style={{ fontSize: 14, color: C.dim, fontWeight: 500 }}> / month</span></p>
                        <p style={{ color: C.gold, fontSize: 13, margin: '0 0 8px' }}>Scenario, not a measured loss</p>
                        <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>{scen.counting}</p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Estimate requires business inputs</p>
                        <p style={{ color: C.dim, fontSize: 14, margin: 0 }}>Public observations cannot establish lost revenue. With your inquiry volume, prices and conversion records, the impact can be modelled with you.</p>
                      </>
                    )}
                  </Panel>
                  <Panel title="Prioritized installation recommendation" Icon={ListOrdered} right={recs.length > 4 && <button className="rl-tab" style={{ margin: 0, color: C.gold }} onClick={() => setTab('next')}>View all</button>}>
                    {!recs.length ? <p style={{ color: C.dim }}>No installation steps are recommended in this version.</p> : recs.slice(0, 5).map((r, i) => (
                      <div key={i} className="rl-row" style={{ alignItems: 'baseline' }}>
                        <span style={{ color: C.gold, fontWeight: 700, width: 18 }}>{r.priority ?? i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{r.mechanism}{r.effort && <div style={{ color: C.faint, fontSize: 12, marginTop: 3 }}>Effort: {r.effort}</div>}</div>
                      </div>
                    ))}
                  </Panel>
                </div>
              </div>
            )}
            {tab === 'findings' && <Panel title="Findings" Icon={FileSearch}>{!findings.length ? <p style={{ color: C.dim }}>This report records no findings.</p> : findings.map((f, i) => <Finding key={i} f={f} i={i} full />)}</Panel>}
            {tab === 'next' && (
              <Panel title="Next steps" Icon={ListOrdered}>
                {recs.map((r, i) => (
                  <div key={i} className="rl-row" style={{ flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 600 }}><span style={{ color: C.gold, marginRight: 10 }}>{r.priority ?? i + 1}</span>{r.mechanism}</div>
                    {[['Effort', r.effort], ['Cost', r.cost], ['Depends on', r.dependencies], ['Uncertainty', r.uncertainty], ['How we will check it worked', r.verification_plan]].filter(([, v]) => v).map(([k, v]) => <div key={k} style={{ color: C.dim, fontSize: 13 }}><span style={{ color: C.faint }}>{k}:</span> {v}</div>)}
                  </div>
                ))}
                <Value v={c.next_steps} />
              </Panel>
            )}
            {tab === 'evidence' && (
              <Panel title="Evidence" Icon={FileSearch}>
                {!evidence.length ? <p style={{ color: C.dim }}>No evidence records are attached to this version.</p> : evidence.map((e, i) => (
                  <div key={i} className="rl-row" style={{ flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 14 }}>{e.observation}</div>
                    <div style={{ color: C.faint, fontSize: 12, wordBreak: 'break-word' }}>{[e.source, e.method, e.captured && `captured ${new Date(e.captured).toLocaleDateString()}`, e.confidence && `confidence ${e.confidence}`].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </Panel>
            )}
            {tab === 'full' && ORDER.filter((k) => c[k] != null).map((k) => <Panel key={k} title={NAMES[k]}><Value v={c[k]} /></Panel>)}

            <p style={{ color: C.faint, fontSize: 12, marginTop: 18, lineHeight: 1.6 }}>{c.limitations || ''} Document fingerprint (SHA-256): <span style={{ wordBreak: 'break-all' }}>{d.content_sha256}</span>.{/CPA/.test(c.limitations || '') ? '' : ' An operational review — not a CPA financial audit.'} Link valid until {new Date(d.expires_at).toLocaleDateString()}.</p>
          </>
        )}
      </div>
    </main>
  )
}

function Finding({ f, i, full = false }) {
  return (
    <div className="rl-row">
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 30, border: `1px solid ${C.gold}`, color: C.gold, display: 'grid', placeItems: 'center', fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{f.title}</div>
        {f.observed && <div style={{ color: C.dim, fontSize: 14, marginTop: 4, lineHeight: 1.55 }}>{full ? f.observed : String(f.observed).slice(0, 220)}{!full && String(f.observed).length > 220 ? '…' : ''}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {f.confidence && <span className="rl-chip">Confidence: {f.confidence}</span>}
          {f.financial_impact_status && <span className="rl-chip">{IMPACT[f.financial_impact_status] || f.financial_impact_status}</span>}
          {f.nova_can_implement && <span className="rl-chip">Nova can implement: {f.nova_can_implement}</span>}
        </div>
        {full && ['customer_impact', 'limitations', 'remedy', 'owner_decision'].filter((k) => f[k]).map((k) => <p key={k} style={{ color: C.dim, fontSize: 13, margin: '8px 0 0' }}><span style={{ color: C.faint, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</span> {f[k]}</p>)}
      </div>
    </div>
  )
}
