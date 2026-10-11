import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Read the auth redirect type BEFORE supabase-js consumes and clears the URL (detectSessionInUrl runs during
// createClient). Without this, a password-recovery link's PASSWORD_RECOVERY event can fire before the callback
// page subscribes, and the recovery link would sign the person in without ever asking for a new password.
export const authRedirect = (() => {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return { type: hash.get('type') || query.get('type') || null, error: hash.get('error_code') || hash.get('error') || query.get('error_code') || null }
  } catch { return { type: null, error: null } }
})()

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
