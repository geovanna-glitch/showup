import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

/**
 * Guards routes that require a signed-in student. Unauthenticated visitors are
 * redirected to the sign-in screen, with the page they were trying to reach
 * remembered so we can send them back after they log in.
 *
 * In demo mode (no Supabase configured) there is no auth backend, so protected
 * pages stay reachable — this keeps the existing demo dashboard previewable.
 */
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return children

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="flex items-center gap-3 text-ink-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-primary-600" />
          <span className="text-sm font-semibold">Loading…</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  return children
}
