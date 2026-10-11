import { supabase } from './supabaseClient'

// Attaches the caller's real Supabase session token to requests against api/client.js resources
// that now require staff auth server-side (see api/_auth.js) — a plain fetch() with no
// Authorization header gets a 401 from those resources. Same call signature as fetch(); merges
// onto any headers/options already passed rather than replacing them.
export async function authedFetch(url, options = {}) {
  let token = null
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    token = data?.session?.access_token || null
  }
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}
