import { createClient } from '@supabase/supabase-js'

// 'same-origin' is used only by local staging's Wi-Fi mode (`staging.mjs serve --lan`): sign-in and reads go through the
// app's own address, which forwards just those paths, so a tablet never needs to reach Supabase itself.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseUrl = configuredUrl === 'same-origin' && typeof window !== 'undefined' ? window.location.origin : configuredUrl
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
