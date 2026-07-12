/*
 * ShowUp — Organization account creation
 * --------------------------------------
 * The last step of org onboarding: an organization applies (OrgApply/OrgSignup)
 * → an admin approves it (which creates the organizations row) → the org
 * contact creates their login HERE using the same email they applied with.
 * On their first visit to /org/post, claim_my_organization() links the login
 * to the approved organization automatically.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

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

export default function OrgAccountSignup() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!form.email.trim() || form.password.length < 8) {
      setError('Enter your email and a password of at least 8 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              role: 'org',
              first_name: form.firstName.trim(),
              last_name: form.lastName.trim(),
            },
          },
        })
        if (signUpError) throw signUpError
      } else {
        // Demo mode: no backend connected yet, simulate account creation.
        await new Promise((resolve) => setTimeout(resolve, 700))
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4 10-11" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          Account created!
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          Sign in and head to <span className="font-semibold">Post opportunity</span> — if your
          organization has been approved, it links to this account automatically.
        </p>
        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            Demo mode: connect Supabase to create real accounts.
          </p>
        )}
        <Link
          to="/signin"
          className="mt-8 inline-block rounded-full bg-primary-600 px-8 py-4 font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Create your organization account
      </h1>
      <p className="mt-3 leading-relaxed text-ink-700">
        For organizations that have been <span className="font-semibold">approved to join ShowUp</span>.
        Use the same email address you applied with so we can connect your account to your
        organization.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Haven&apos;t applied yet?{' '}
        <Link to="/organizations" className="font-semibold text-primary-600 hover:underline">
          Start here
        </Link>
        .
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name">
            <input className={inputClass} value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
          </Field>
          <Field label="Last name">
            <input className={inputClass} value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Email" hint="The email address on your organization's application.">
          <input type="email" className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input type="password" className={inputClass} value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
