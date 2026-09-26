import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Thin client for the Sales Team platform API (api/client.js?resource=&op= and api/academy.js?action=).
// The browser only ever sends the caller's real Supabase session token; every permission, ownership and business rule is enforced
// on the server. Nothing returned here is trusted for authorization — hiding a button is UX, not security.
async function token() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

async function send(url, { method = 'GET', body } = {}) {
  const t = await token()
  const headers = {}
  if (t) headers.Authorization = `Bearer ${t}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try { res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection and try again.' } } }
  const type = res.headers.get('content-type') || ''
  const data = type.includes('application/json') ? await res.json().catch(() => ({})) : type.includes('text/csv') || type.includes('pdf') ? await res.blob() : await res.text()
  return { ok: res.ok, status: res.status, data }
}

const qs = (o = {}) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

// api('leads', 'home')  ·  api('leads', 'move', { body })  ·  api('leads', 'get', { query: { id } })
export function api(resource, op, { method, body, query } = {}) {
  const m = method || (body !== undefined ? 'POST' : 'GET')
  return send(`/api/client?resource=${resource}&op=${op}${query ? `&${qs(query)}` : ''}`, { method: m, body })
}
export function academy(action, { method, body, query } = {}) {
  const m = method || (body !== undefined ? 'POST' : 'GET')
  return send(`/api/academy?action=${action}${query ? `&${qs(query)}` : ''}`, { method: m, body })
}
// Downloads a PDF/CSV response the caller is authorised for (uses the session token, so no public link exists).
export async function download(url, filename) {
  const r = await send(url)
  if (!r.ok || !(r.data instanceof Blob)) return r
  const href = URL.createObjectURL(r.data)
  const a = document.createElement('a'); a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 5000)
  return r
}
export const downloadApi = (resource, op, query, filename) => download(`/api/client?resource=${resource}&op=${op}&${qs(query)}`, filename)

// Loads data on mount / when deps change. `reload()` refetches. `data` stays as the last good value while reloading.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null, status: null })
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    const r = await fn()
    if (r.ok) setState({ loading: false, error: null, data: r.data, status: r.status })
    else setState((s) => ({ loading: false, error: r.data?.error || 'Something went wrong.', data: s.data, status: r.status }))
  }, deps)
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

export const money = (cents, currency = 'USD') => (cents == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100))
export const dt = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const day = (v) => (v ? new Date(v).toLocaleDateString([], { dateStyle: 'medium' }) : '—')
export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
