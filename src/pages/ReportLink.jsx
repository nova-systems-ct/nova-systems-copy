import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const C = { bg: '#0A0A0A', panel: '#111111', line: 'rgba(250,250,250,0.12)', text: '#FAFAFA', dim: 'rgba(250,250,250,0.65)', gold: '#C9A84C', red: '#F07167' }
const NAMES = { executive_summary: 'Executive summary', business_identity: 'Business', findings: 'Findings', recommendations: 'Prioritized installation recommendation', estimates_and_assumptions: 'Financial scenarios and assumptions', scope_and_method: 'Scope, method and tests', competitor_benchmarks: 'Competitor benchmarks', software_review: 'Software review', evidence_reviewed: 'Evidence appendix', limitations: 'Limitations', next_steps: 'Next steps' }
const ORDER = Object.keys(NAMES)
function Value({ v }) {
  if (v == null || v === '') return null
  if (typeof v !== 'object') return <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{String(v)}</p>
  if (Array.isArray(v)) return <ol style={{ paddingLeft: 18 }}>{v.map((x, i) => <li key={i} style={{ marginBottom: 8 }}><Value v={x} /></li>)}</ol>
  return <dl style={{ margin: 0 }}>{Object.entries(v).filter(([, x]) => x != null && x !== '').map(([k, x]) => <div key={k} style={{ marginBottom: 4 }}><dt style={{ color: C.dim, fontSize: 12, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</dt><dd style={{ margin: 0 }}><Value v={x} /></dd></div>)}</dl>
}

// Client view of the exact approved audit report, through Nova's secure delivery link.
export default function ReportLink() {
  const { token } = useParams()
  const [d, setD] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => { fetch(`/api/client?resource=audit&op=report-view&token=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Unavailable'); setD(j) }).catch((e) => setErr(e.message)) }, [token])
  const pdf = async () => { const r = await fetch(`/api/client?resource=audit&op=report-view-pdf&token=${encodeURIComponent(token)}`); const j = await r.json(); if (j.pdf_base64) { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${j.pdf_base64}`; a.download = j.filename; a.click() } }
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif", padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <p style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>Nova Systems</p>
        {err && <div role="alert" style={{ border: `1px solid ${C.red}66`, borderRadius: 10, padding: 16 }}>{err}</div>}
        {!d && !err && <p role="status" style={{ color: C.dim }}>Loading…</p>}
        {d && (
          <>
            <h1 style={{ fontSize: 26, margin: '6px 0' }}>{d.title}</h1>
            <p style={{ color: C.dim, fontSize: 13 }}>Version {d.version} · approved {new Date(d.approved_at).toLocaleDateString()} · link valid until {new Date(d.expires_at).toLocaleDateString()}</p>
            <button onClick={pdf} style={{ borderRadius: 8, padding: '10px 16px', fontWeight: 700, background: C.gold, color: C.bg, border: 'none', cursor: 'pointer', margin: '8px 0 20px' }}>Download PDF</button>
            {ORDER.filter((k) => d.content[k] != null).map((k) => (
              <section key={k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, marginTop: 0 }}>{NAMES[k]}</h2>
                <Value v={d.content[k]} />
              </section>
            ))}
            <p style={{ color: C.dim, fontSize: 12 }}>Document fingerprint (SHA-256): <span style={{ wordBreak: 'break-all' }}>{d.content_sha256}</span>. An operational review — not a CPA financial audit.</p>
          </>
        )}
      </div>
    </main>
  )
}
