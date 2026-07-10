import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

export default function SignIn() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Where to send the student after a successful sign-in — the page they were
  // trying to reach, or their dashboard by default.
  const from = location.state?.from?.pathname || '/dashboard'

  const [mode, setMode] = useState('signin') // 'signin' | 'reset' | 'set-password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  // Detect Supabase PASSWORD_RECOVERY event — fires when the user lands on this
  // page after clicking their reset-password email link.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('set-password')
        setError('')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Already signed in (and NOT in recovery mode)? Skip the form.
  useEffect(() => {
    if (session && mode !== 'set-password') navigate(from, { replace: true })
  }, [session, mode, from, navigate])

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
        // The auth listener updates the session; redirect the student onward.
        navigate(from, { replace: true })
      } else {
        // Demo mode: no backend to authenticate against — simulate so the flow
        // stays exercisable, matching the demo behaviour of the signup screen.
        await new Promise((resolve) => setTimeout(resolve, 600))
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Could not sign you in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter the email on your account.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/signin` },
        )
        if (resetError) throw resetError
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the reset email. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setPasswordUpdated(true)
      // Sign out so they log back in fresh with the new password.
      await supabase.auth.signOut()
    } catch (err) {
      setError(err.message || 'Could not update your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Avoid flashing the form while we restore a persisted session.
  if (authLoading || (session && mode !== 'set-password')) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-primary-600" />
      </div>
    )
  }

  // Password successfully updated — show confirmation and let them sign back in.
  if (mode === 'set-password' && passwordUpdated) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="mt-4 text-xl font-extrabold text-ink-900">Password updated</p>
          <p className="mt-2 text-sm text-ink-700">You're all set. Sign in with your new password.</p>
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setPasswordUpdated(false)
              setNewPassword('')
              setConfirmPassword('')
              setError('')
            }}
            className="mt-6 w-full rounded-full bg-primary-600 py-3 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {mode === 'set-password'
            ? 'Set a new password'
            : mode === 'reset'
            ? 'Reset your password'
            : 'Welcome back'}
        </h1>
        <p className="mt-2 text-ink-700">
          {mode === 'set-password'
            ? 'Choose a new password for your account.'
            : mode === 'reset'
            ? "We'll email you a link to set a new password."
            : 'Sign in to track your verified service hours.'}
        </p>
      </div>

      {!isSupabaseConfigured && (
        <p className="mt-6 rounded-xl bg-peach-100 px-4 py-3 text-center text-sm text-ink-700">
          Demo mode — connect Supabase to sign in with a real account.
        </p>
      )}

      {mode === 'set-password' && (
        <form onSubmit={handleSetPassword} className="mt-8 space-y-4">
          <Field label="New password">
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError('') }}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
              autoComplete="new-password"
            />
          </Field>
          {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? 'Updating...' : 'Set new password'}
          </button>
        </form>
      )}

      {mode !== 'set-password' && (
        <>
          {mode === 'reset' && resetSent ? (
            <div className="mt-8 rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
              </div>
              <p className="mt-4 font-bold text-ink-900">Check your email</p>
              <p className="mt-1 text-sm text-ink-700">
                If an account exists for <span className="font-semibold">{email.trim()}</span>, a
                password reset link is on its way.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setResetSent(false)
                  setError('')
                }}
                className="mt-6 text-sm font-bold text-primary-600 hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <form
              onSubmit={mode === 'reset' ? handleReset : handleSignIn}
              className="mt-8 space-y-4"
            >
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  autoComplete="email"
                  placeholder="you@email.com"
                />
              </Field>

              {mode === 'signin' && (
                <Field label="Password">
                  <input
                    type="password"
                    className={inputClass}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    autoComplete="current-password"
                  />
                </Field>
              )}

              {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting
                  ? mode === 'reset'
                    ? 'Sending...'
                    : 'Signing you in...'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Sign in'}
              </button>

              {mode === 'signin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset')
                    setError('')
                  }}
                  className="w-full py-1 text-center text-sm font-semibold text-ink-500 hover:text-ink-700"
                >
                  Forgot password?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError('')
                  }}
                  className="w-full py-1 text-center text-sm font-semibold text-ink-500 hover:text-ink-700"
                >
                  ← Back to sign in
                </button>
              )}
            </form>
          )}

          {mode === 'signin' && (
            <p className="mt-8 text-center text-sm text-ink-500">
              New to ShowUp?{' '}
              <Link to="/signup" className="font-semibold text-primary-600 hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}
