import { supabase } from './supabaseClient'
import {withTimeout} from './sessionTimeout'

// Attaches the caller's real Supabase session token to requests against api/client.js resources
// that now require staff auth server-side (see api/_auth.js) — a plain fetch() with no
// Authorization header gets a 401 from those resources. Same call signature as fetch(); merges
// onto any headers/options already passed rather than replacing them.
export async function authedFetch(url, options = {}) {
  let token = null
  if (supabase) {
    const { data } = await withTimeout(supabase.auth.getSession())
    token = data?.session?.access_token || null
  }
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const timeout=AbortSignal.timeout(45000)
  return fetch(url, { ...options, headers,signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout })
}
