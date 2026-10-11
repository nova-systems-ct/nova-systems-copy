// Nova Operations UI kit — brand black #0A0A0A / white #FAFAFA / gold #C9A84C. Plain, readable, accessible.
import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from '../../../lib/apiAuth'

export const C = { bg: '#0A0A0A', panel: '#111111', line: 'rgba(250,250,250,0.10)', text: '#FAFAFA', dim: 'rgba(250,250,250,0.62)', faint: 'rgba(250,250,250,0.40)', gold: '#C9A84C', red: '#F07167', green: '#7BD389', amber: '#E9B44C', blue: '#8AB4F8' }

export const css = `
.ops-wrap { padding: 24px; max-width: 1200px; margin: 0 auto; }
.ops-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.ops-two { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.ops-side { display: grid; gap: 16px; grid-template-columns: 320px minmax(0, 1fr); }
.ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ops-table th { text-align: left; color: rgba(250,250,250,0.55); font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding: 8px 10px; border-bottom: 1px solid rgba(250,250,250,0.10); }
.ops-table td { padding: 10px; border-bottom: 1px solid rgba(250,250,250,0.06); vertical-align: top; }
.ops-table tr.clickable:hover td { background: rgba(201,168,76,0.06); cursor: pointer; }
.ops-scroll { overflow-x: auto; }
.ops-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid rgba(250,250,250,0.10); margin-bottom: 20px; }
.ops-tab { padding: 10px 14px; font-size: 13px; color: rgba(250,250,250,0.6); text-decoration: none; border-bottom: 2px solid transparent; }
.ops-tab.active { color: #FAFAFA; border-bottom-color: #C9A84C; }
.ops-input, .ops-select, .ops-textarea { width: 100%; box-sizing: border-box; background: #0A0A0A; color: #FAFAFA; border: 1px solid rgba(250,250,250,0.18); border-radius: 8px; padding: 9px 11px; font-size: 14px; font-family: inherit; }
.ops-input:focus, .ops-select:focus, .ops-textarea:focus, .ops-btn:focus-visible, .ops-tab:focus-visible { outline: 2px solid #C9A84C; outline-offset: 2px; }
.ops-btn { border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(201,168,76,0.5); background: transparent; color: #C9A84C; font-family: inherit; }
.ops-btn.primary { background: #C9A84C; color: #0A0A0A; border-color: #C9A84C; }
.ops-btn.danger { color: #F07167; border-color: rgba(240,113,103,0.5); }
.ops-btn:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 820px) { .ops-two, .ops-side { grid-template-columns: minmax(0, 1fr); } .ops-wrap { padding: 16px; } }
`

export function api(op, { org, method = 'GET', body, query = {} } = {}) {
  const qs = new URLSearchParams({ resource: 'ops', op, ...(method === 'GET' && org ? { organization_id: org } : {}), ...query })
  return authedFetch(`/api/client?${qs}`, {
    method, headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify({ ...(org ? { organization_id: org } : {}), ...(body || {}) }),
  }).then(async (r) => {
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status, body: j })
    return j
  })
}

export function useLoad(fn, deps) {
  const [state, set] = useState({ loading: true, error: null, data: null })
  const run = useCallback(async () => {
    set((s) => ({ ...s, loading: true, error: null }))
    try { set({ loading: false, error: null, data: await fn() }) } catch (e) { set({ loading: false, error: e, data: null }) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

export const money = (c, cur = 'usd') => (c == null ? '—' : `${String(cur).toLowerCase() === 'usd' ? '$' : `${String(cur).toUpperCase()} `}${(c / 100).toFixed(2)}`)
export const when = (iso, tz) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—')

const TONE = {
  good: ['confirmed', 'paid', 'signed', 'completed', 'ready', 'healthy', 'provider_accepted', 'delivered', 'approved', 'resolved', 'running', 'eligible'],
  warn: ['held', 'quoted', 'booking', 'awaiting_agreement', 'awaiting_deposit', 'checkout_open', 'sent', 'scheduled', 'degraded', 'draft', 'acknowledged', 'paused', 'in_progress', 'partial', 'owner_quote_required', 'pending', 'dry_run'],
  bad: ['escalated', 'failed', 'failing', 'blocked', 'cancelled', 'lost', 'expired', 'void', 'open', 'no_show', 'refunded', 'stopped', 'blocked_at_send', 'ambiguous'],
}
export function Badge({ value, label }) {
  const v = String(value || 'unknown')
  const color = TONE.good.includes(v) ? C.green : TONE.warn.includes(v) ? C.amber : TONE.bad.includes(v) ? C.red : C.dim
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}55`, background: `${color}14`, whiteSpace: 'nowrap' }}>{label || v.replace(/_/g, ' ')}</span>
}
export function TestBadge() { return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: C.bg, background: C.amber }}>TEST</span> }

export function Card({ title, actions, children, style }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, ...style }}>
      {(title || actions) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {title && <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{title}</h2>}
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>}
      {children}
    </section>
  )
}
export function Field({ label, hint, children, id }) {
  return (
    <label htmlFor={id} style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: C.faint, marginTop: 4 }}>{hint}</span>}
    </label>
  )
}
export const Loading = ({ what = 'Loading' }) => <p role="status" style={{ color: C.faint, fontSize: 13 }}>{what}…</p>
export const Empty = ({ children }) => <p style={{ color: C.faint, fontSize: 13, margin: '8px 0' }}>{children}</p>
export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  const denied = error.status === 403
  return (
    <div role="alert" style={{ border: `1px solid ${C.red}55`, background: `${C.red}12`, color: C.text, borderRadius: 8, padding: 12, fontSize: 13, margin: '8px 0' }}>
      <strong style={{ color: C.red }}>{denied ? 'No access. ' : 'Problem. '}</strong>{error.message}
      {onRetry && !denied && <button className="ops-btn" style={{ marginLeft: 12 }} onClick={onRetry}>Try again</button>}
    </div>
  )
}
export function Notice({ tone = 'info', children }) {
  const color = tone === 'ok' ? C.green : tone === 'warn' ? C.amber : tone === 'bad' ? C.red : C.blue
  return <div role="status" style={{ border: `1px solid ${color}44`, background: `${color}10`, borderRadius: 8, padding: 10, fontSize: 13, color: C.text, margin: '8px 0' }}>{children}</div>
}
export function PageHeader({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{title}</h1>
        {sub && <p style={{ margin: '6px 0 0', color: C.dim, fontSize: 13 }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}
// Runs an action, shows its result or error inline. Never claims success the server did not return.
export function useAction() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null)
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try { const r = await fn(); setMsg({ tone: 'ok', text: typeof okText === 'function' ? okText(r) : okText || 'Saved.' }); return r }
    catch (e) { setMsg({ tone: 'bad', text: e.message }); return null }
    finally { setBusy(false) }
  }
  const view = msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null
  return { busy, run, view, clear: () => setMsg(null) }
}
