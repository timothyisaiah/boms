import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
)
export const isSelfRegistrationEnabled =
  import.meta.env.VITE_SUPABASE_ALLOW_SIGN_UP === 'true'

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null
