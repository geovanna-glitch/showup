import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured, STORAGE_KEY } from './supabase.js'

/**
 * Shares the current Supabase auth session across the app.
 *
 * Supabase's JS client persists the session in localStorage and refreshes the
 * access token automatically, so a signed-in student stays signed in across
 * page refreshes. This provider surfaces that session to React and keeps it in
 * sync via onAuthStateChange (sign-in, sign-out, token refresh).
 *
 * In demo mode (no VITE_SUPABASE_* env vars) there is no backend, so there is
 * never a session — loading resolves immediately and everything treats the
 * visitor as a guest.
 */
const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Only block on an initial session lookup when Supabase is actually wired up.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true

    // Restore any persisted session on first load (handles page refresh).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    // Keep in sync with future auth changes across tabs and token refreshes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.signOut()
          // If the network revoke fails (offline / server unreachable), Supabase
          // leaves the token in storage — which would silently sign the student
          // back in on the next refresh. Force-clear it so sign-out always sticks,
          // which matters on shared school computers.
          if (error) {
            try {
              window.localStorage.removeItem(STORAGE_KEY)
            } catch {
              // Ignore storage access errors (e.g. private mode); state is cleared below.
            }
          }
        }
        setSession(null)
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
