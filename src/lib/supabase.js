import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when Supabase credentials are present in the environment.
 * Without them the app runs in demo mode: signups succeed locally
 * so every flow can be exercised before the backend is connected.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Explicit key the session is persisted under. Fixing it (rather than relying
 * on the derived default) lets us force a local sign-out if the network token
 * revoke fails — see signOut() in AuthContext.
 */
export const STORAGE_KEY = 'showup-auth'

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Keep students signed in across refreshes and silently refresh tokens.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: STORAGE_KEY,
      },
    })
  : null
