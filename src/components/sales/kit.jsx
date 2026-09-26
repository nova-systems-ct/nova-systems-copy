import { useEffect, useRef, useState } from 'react'

// Shared building blocks for the Sales Team screens (black / white / gold only).
export const GOLD = '#C9A84C'
export const BG = '#0A0A0A'
export const PANEL = 'rgba(255,255,255,0.03)'
export const LINE = 'rgba(255,255,255,0.08)'
export const MUTED = 'rgba(255,255,255,0.55)'
export const FAINT = 'rgba(255,255,255,0.35)'
export const GOOD = '#4ade80'
export const WARN = '#fbbf24'
export const BAD = '#f87171'
const GRAD = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

export function Page({ eyebrow, title, subtitle, actions, children, wide }) {
  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px)', paddingBottom: 80, maxWidth: wide ? 1400 : 1100, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</p>}
          <h1 style={{ fontSize: 'clamp(22px, 3.4vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ color: MUTED, fontSize: 13, marginTop: 6, maxWidth: 680, lineHeight: 1.6 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export const Card = ({ title, right, children, style, tone }) => (
  <section style={{ background: tone === 'warn' ? 'rgba(251,191,36,0.06)' : tone === 'bad' ? 'rgba(248,113,113,0.06)' : PANEL, border: `1px solid ${tone === 'warn' ? 'rgba(251,191,36,0.3)' : tone === 'bad' ? 'rgba(248,113,113,0.3)' : LINE}`, borderRadius: 12, padding: 18, marginBottom: 16, ...style }}>
    {(title || right) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff', margin: 0 }}>{title}</h2>
        {right}
      </div>
    )}
    {children}
  </section>
)

export const Muted = ({ children, style }) => <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0, ...style }}>{children}</p>

export function Btn({ children, onClick, kind = 'ghost', disabled, type = 'button', small, style, title }) {
  const base = { fontFamily: 'inherit', fontWeight: 700, fontSize: small ? 11 : 12, letterSpacing: '0.08em', textTransform: 'uppercase', padding: small ? '6px 12px' : '10px 18px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'opacity .15s', whiteSpace: 'nowrap' }
  const kinds = {
    primary: { background: GRAD, color: '#0A0A0A', border: 'none' },
    ghost: { background: 'transparent', color: GOLD, border: `1px solid ${GOLD}55` },
    danger: { background: 'transparent', color: BAD, border: '1px solid rgba(248,113,113,0.45)' },
    quiet: { background: 'rgba(255,255,255,0.05)', color: '#fff', border: `1px solid ${LINE}` },
  }
  return <button type={type} onClick={onClick} disabled={disabled} title={title} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>
}

const TONES = { good: [GOOD, 'rgba(74,222,128,0.1)'], warn: [WARN, 'rgba(251,191,36,0.1)'], bad: [BAD, 'rgba(248,113,113,0.1)'], gold: [GOLD, 'rgba(201,168,76,0.1)'], muted: [MUTED, 'rgba(255,255,255,0.05)'] }
export const Badge = ({ children, tone = 'muted' }) => (
  <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, color: TONES[tone][0], background: TONES[tone][1], whiteSpace: 'nowrap' }}>{children}</span>
)

export const Banner = ({ tone = 'warn', children, onClose }) => (
  <div role={tone === 'bad' ? 'alert' : 'status'} style={{ background: TONES[tone][1], border: `1px solid ${TONES[tone][0]}55`, color: TONES[tone][0] === MUTED ? '#fff' : TONES[tone][0], borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.55, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <div>{children}</div>
    {onClose && <button onClick={onClose} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>}
  </div>
)

const fieldBase = { width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
export function Field({ label, hint, error, children, style }) {
  return (
    <label style={{ display: 'block', marginBottom: 14, ...style }}>
      {label && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{label}</span>}
      {children}
      {hint && !error && <span style={{ display: 'block', fontSize: 11.5, color: FAINT, marginTop: 4 }}>{hint}</span>}
      {error && <span role="alert" style={{ display: 'block', fontSize: 12, color: BAD, marginTop: 4 }}>{error}</span>}
    </label>
  )
}
export const Input = (p) => <input {...p} style={{ ...fieldBase, ...p.style }} />
export const Textarea = ({ rows = 4, ...p }) => <textarea rows={rows} {...p} style={{ ...fieldBase, resize: 'vertical', lineHeight: 1.5, ...p.style }} />
export const Select = ({ children, ...p }) => <select {...p} style={{ ...fieldBase, ...p.style }}>{children}</select>
export const Check = ({ checked, onChange, children, disabled }) => (
  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#fff', lineHeight: 1.5, marginBottom: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, accentColor: GOLD }} />
    <span>{children}</span>
  </label>
)

export function Table({ columns, rows, empty = 'Nothing here yet.', onRow }) {
  if (!rows?.length) return <Muted>{empty}</Muted>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.right ? 'right' : 'left', padding: '8px 10px', color: FAINT, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `1px solid ${LINE}`, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : 'default', borderBottom: `1px solid ${LINE}` }}>
              {columns.map((c) => <td key={c.key} style={{ padding: '10px', verticalAlign: 'top', textAlign: c.right ? 'right' : 'left', color: '#fff' }}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Stat = ({ label, value, note, tone }) => (
  <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px', minWidth: 140, flex: '1 1 140px' }}>
    <div style={{ color: FAINT, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: tone ? TONES[tone][0] : '#fff' }}>{value}</div>
    {note && <div style={{ color: FAINT, fontSize: 11.5, marginTop: 2 }}>{note}</div>}
  </div>
)
export const Stats = ({ children }) => <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>{children}</div>

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null)
  useEffect(() => { const onKey = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', onKey); ref.current?.focus(); return () => document.removeEventListener('keydown', onKey) }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} style={{ background: '#111', border: `1px solid ${GOLD}40`, borderRadius: 14, padding: 22, width: '100%', maxWidth: wide ? 860 : 560, outline: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: MUTED, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: `1px solid ${LINE}`, marginBottom: 18 }}>
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)} style={{ background: 'none', border: 'none', borderBottom: `2px solid ${value === t.key ? GOLD : 'transparent'}`, color: value === t.key ? GOLD : MUTED, padding: '10px 14px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t.label}{t.count != null ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  )
}

export const Loading = ({ text = 'Loading…' }) => <p style={{ color: FAINT, fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '40px 0', textAlign: 'center' }}>{text}</p>

// Result of an action: shows the server's own message (never a made-up success).
export function useNotice() {
  const [n, setN] = useState(null)
  const show = (r, okText) => { if (!r) return; setN(r.ok ? { tone: 'good', text: okText || 'Done.' } : { tone: 'bad', text: r.data?.error || 'That did not work.' }); return r }
  const node = n ? <Banner tone={n.tone} onClose={() => setN(null)}>{n.text}</Banner> : null
  return { notice: node, show, set: setN }
}

// Signature pad: optional drawn signature as a small PNG data URI. Typed name remains the legally-recorded signature.
export function SignaturePad({ onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const [has, setHas] = useState(false)
  const pos = (e) => { const c = ref.current; const r = c.getBoundingClientRect(); const t = e.touches?.[0] || e; return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) } }
  const start = (e) => { drawing.current = true; const ctx = ref.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault() }
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0A0A0A'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke(); e.preventDefault() }
  const end = () => { if (!drawing.current) return; drawing.current = false; setHas(true); onChange(ref.current.toDataURL('image/png')) }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setHas(false); onChange(null) }
  return (
    <div>
      <canvas ref={ref} width={520} height={140} aria-label="Optional drawn signature" style={{ width: '100%', maxWidth: 520, height: 140, background: '#FAFAFA', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <div style={{ marginTop: 6 }}><Btn small kind="quiet" onClick={clear} disabled={!has}>Clear drawing</Btn> <span style={{ color: FAINT, fontSize: 11.5, marginLeft: 8 }}>Optional — your typed name is your signature.</span></div>
    </div>
  )
}

export function PublicShell({ children, narrow }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
      <header style={{ padding: '18px clamp(16px, 4vw, 40px)', borderBottom: `1px solid ${LINE}` }}>
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, letterSpacing: '0.14em', fontSize: 14 }}>NOVA <span style={{ color: GOLD }}>SYSTEMS</span></a>
      </header>
      <main style={{ maxWidth: narrow ? 560 : 760, margin: '0 auto', padding: 'clamp(20px, 5vw, 48px) 16px 80px' }}>{children}</main>
    </div>
  )
}
