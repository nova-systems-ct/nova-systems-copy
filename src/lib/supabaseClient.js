import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Capture recovery before lazy route code mounts. This is only a routing hint;
// changing a password still requires the user's verified Supabase session.
supabase?.auth.onAuthStateChange((event)=>{
  try{
    if(event==='PASSWORD_RECOVERY')sessionStorage.setItem('nova_password_recovery','1')
    if(event==='SIGNED_OUT')sessionStorage.removeItem('nova_password_recovery')
  }catch{/* Storage can be unavailable in private browser sessions. */}
})
