import { authedFetch } from '../../lib/apiAuth'

export const GOLD = '#C9A84C'
export const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
export const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 22, marginBottom: 18 }
export const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
export const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }

// GET/POST against api/client.js. Returns { ok, status, data } and never throws, so a page can show
// the server's real refusal reason (e.g. "Go-live blocked: 3 checks not passed") instead of a generic failure.
export async function api(resource, op, { method = 'GET', query = {}, body } = {}) {
  const qs = new URLSearchParams({ resource, op, ...Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')) })
  try {
    const r = await authedFetch(`/api/client?${qs}`, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    const ct = r.headers.get('content-type') || ''
    const data = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text()
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e.message || 'Network error' } }
  }
}

export function Banner({ kind = 'error', children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null
  const c = kind === 'ok' ? ['#4ade80', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.25)'] : kind === 'warn' ? [GOLD, 'rgba(201,168,76,0.07)', 'rgba(201,168,76,0.25)'] : ['#f87171', 'rgba(248,113,113,0.07)', 'rgba(248,113,113,0.25)']
  return <div style={{ padding: '11px 15px', background: c[1], border: `1px solid ${c[2]}`, borderRadius: 10, marginBottom: 14, color: c[0], fontSize: 12, lineHeight: 1.6 }}>{children}</div>
}

export function Btn({ children, onClick, disabled, kind = 'primary', small, type = 'button' }) {
  const primary = kind === 'primary'
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: small ? '5px 11px' : '9px 16px', background: primary ? (disabled ? '#161410' : G) : 'transparent', border: primary ? 'none' : `1px solid ${kind === 'danger' ? 'rgba(248,113,113,0.4)' : 'rgba(201,168,76,0.4)'}`, borderRadius: 7, color: primary ? (disabled ? 'rgba(255,255,255,0.25)' : '#0a0800') : kind === 'danger' ? '#f87171' : GOLD, fontSize: small ? 11 : 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={lbl}>{label}</label>{children}</div>
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${value === key ? GOLD : 'transparent'}`, color: value === key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>
      ))}
    </div>
  )
}

export const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')

export function Pill({ text, tone = 'neutral' }) {
  const col = { good: '#4ade80', bad: '#f87171', warn: GOLD, neutral: 'rgba(255,255,255,0.45)' }[tone]
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: col }}>{text}</span>
}
