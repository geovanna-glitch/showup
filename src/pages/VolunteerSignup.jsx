import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const GRADES = ['9th', '10th', '11th', '12th']

const initialForm = {
  role: '', // 'youth' | 'adult'
  firstName: '',
  lastName: '',
  birthDate: '',
  school: '',
  grade: '',
  tier: '', // 'general' | 'youth-contact'
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  parentConsent: false,
  verificationConsent: false,
  email: '',
  password: '',
}

function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'w-8 bg-primary-600' : i < current ? 'w-2 bg-primary-400' : 'w-2 bg-ink-200'
          }`}
        />
      ))}
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export default function VolunteerSignup() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const totalSteps = 4 // role → details → consent/verification → account
  const isYouth = form.role === 'youth'

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  const choose = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  function validateStep() {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your full name.'
      if (!form.birthDate) return 'Please enter your date of birth.'
      if (isYouth && (!form.school.trim() || !form.grade)) {
        return 'Please enter your school and grade.'
      }
      if (!isYouth && !form.tier) return 'Please choose a volunteer tier.'
    }
    if (step === 2) {
      if (isYouth) {
        if (!form.parentName.trim() || !form.parentEmail.trim()) {
          return 'Please enter a parent or guardian name and email.'
        }
        if (!form.parentConsent) return 'A parent or guardian must consent to continue.'
      } else if (!form.verificationConsent) {
        return 'Please agree to the verification requirement to continue.'
      }
    }
    return ''
  }

  function next() {
    const problem = validateStep()
    if (problem) {
      setError(problem)
      return
    }
    setStep((s) => s + 1)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.email.trim() || form.password.length < 8) {
      setError('Enter your email and a password of at least 8 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isSupabaseConfigured) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              role: form.role,
              first_name: form.firstName,
              last_name: form.lastName,
              birth_date: form.birthDate,
              school: form.school || null,
              grade: form.grade || null,
              tier: form.tier || null,
              parent_name: form.parentName || null,
              parent_email: form.parentEmail || null,
              parent_phone: form.parentPhone || null,
              parent_consent: form.parentConsent,
            },
          },
        })
        if (signUpError) throw signUpError
      } else {
        // Demo mode: no backend connected yet, simulate account creation.
        await new Promise((resolve) => setTimeout(resolve, 800))
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
          You&apos;re in, {form.firstName}! 🎉
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          {isYouth
            ? `We've emailed ${form.parentEmail} to confirm parental consent. Meanwhile, start exploring opportunities near you.`
            : form.tier === 'youth-contact'
              ? 'Your background check is being processed — we’ll email you when you’re cleared for youth-contact opportunities. You can browse and apply to general opportunities right away.'
              : 'Your ID verification is pending. You can browse and apply to opportunities right away.'}
        </p>
        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            Demo mode: connect Supabase to create real accounts.
          </p>
        )}
        <Link
          to="/opportunities"
          className="mt-8 inline-block rounded-full bg-primary-600 px-8 py-4 font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
        >
          Browse opportunities
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Join ShowUp
        </h1>
        <StepDots current={step} total={totalSteps} />
      </div>

      {/* Step 0 — who's signing up */}
      {step === 0 && (
        <div>
          <p className="text-ink-700">Who&apos;s showing up? Volunteering is always free.</p>
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => {
                choose('role', 'youth')
                setStep(1)
              }}
              className="w-full rounded-2xl border-2 border-ink-100 bg-white p-5 text-left transition hover:border-primary-400 hover:shadow-md"
            >
              <p className="text-lg font-bold text-ink-900">I&apos;m a student (under 18)</p>
              <p className="mt-1 text-sm text-ink-700">
                Grades 9–12. Build a verified 4-year service portfolio. Requires a parent or
                guardian&apos;s consent.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                choose('role', 'adult')
                setStep(1)
              }}
              className="w-full rounded-2xl border-2 border-ink-100 bg-white p-5 text-left transition hover:border-primary-400 hover:shadow-md"
            >
              <p className="text-lg font-bold text-ink-900">I&apos;m an adult (18+)</p>
              <p className="mt-1 text-sm text-ink-700">
                Serve your community on your schedule. Quick ID verification — background check
                only if you&apos;ll work directly with kids.
              </p>
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-ink-500">
            Representing an organization?{' '}
            <Link to="/organizations" className="font-semibold text-primary-600 hover:underline">
              Start here
            </Link>
          </p>
        </div>
      )}

      {/* Step 1 — details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input className={inputClass} value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
            </Field>
            <Field label="Last name">
              <input className={inputClass} value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
            </Field>
          </div>
          <Field label="Date of birth" hint={isYouth ? 'Used to confirm eligibility and protect younger volunteers.' : undefined}>
            <input type="date" className={inputClass} value={form.birthDate} onChange={set('birthDate')} />
          </Field>

          {isYouth ? (
            <>
              <Field label="School">
                <input className={inputClass} value={form.school} onChange={set('school')} placeholder="Mahopac High School" />
              </Field>
              <Field label="Grade (this fall)">
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => choose('grade', g)}
                      className={`rounded-xl border-2 py-3 text-sm font-bold transition ${
                        form.grade === g
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-ink-100 bg-white text-ink-700 hover:border-primary-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <Field label="How do you want to volunteer?">
              <div className="mt-1.5 space-y-3">
                <button
                  type="button"
                  onClick={() => choose('tier', 'general')}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                    form.tier === 'general'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-ink-100 bg-white hover:border-primary-300'
                  }`}
                >
                  <p className="font-bold text-ink-900">Tier 1 · General volunteering</p>
                  <p className="mt-1 text-sm text-ink-700">
                    Events, food banks, cleanups — no direct child contact. Requires ID
                    verification only.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => choose('tier', 'youth-contact')}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                    form.tier === 'youth-contact'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-ink-100 bg-white hover:border-primary-300'
                  }`}
                >
                  <p className="font-bold text-ink-900">Tier 2 · Youth-contact volunteering</p>
                  <p className="mt-1 text-sm text-ink-700">
                    Tutoring, coaching, mentoring — working directly with minors. Requires a
                    background check before your first shift.
                  </p>
                </button>
              </div>
            </Field>
          )}
        </div>
      )}

      {/* Step 2 — consent / verification */}
      {step === 2 && isYouth && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-relaxed text-primary-900">
            Because you&apos;re under 18, a parent or guardian needs to approve your account.
            We&apos;ll email them a confirmation link.
          </div>
          <Field label="Parent or guardian name">
            <input className={inputClass} value={form.parentName} onChange={set('parentName')} />
          </Field>
          <Field label="Parent or guardian email">
            <input type="email" className={inputClass} value={form.parentEmail} onChange={set('parentEmail')} />
          </Field>
          <Field label="Parent or guardian phone (optional)">
            <input type="tel" className={inputClass} value={form.parentPhone} onChange={set('parentPhone')} />
          </Field>
          <label className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4">
            <input
              type="checkbox"
              checked={form.parentConsent}
              onChange={set('parentConsent')}
              className="mt-1 h-5 w-5 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm leading-relaxed text-ink-700">
              My parent or guardian is aware I&apos;m creating this account and consents to my
              participation in ShowUp volunteer opportunities.
            </span>
          </label>
        </div>
      )}

      {step === 2 && !isYouth && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-relaxed text-primary-900">
            {form.tier === 'youth-contact'
              ? 'Youth-contact volunteering requires a background check (processed securely through our screening partner). Your account activates for youth-contact opportunities once it clears — usually within a few business days.'
              : 'General volunteering requires a quick ID verification after signup. It takes about a minute.'}
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4">
            <input
              type="checkbox"
              checked={form.verificationConsent}
              onChange={set('verificationConsent')}
              className="mt-1 h-5 w-5 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm leading-relaxed text-ink-700">
              {form.tier === 'youth-contact'
                ? 'I consent to a background check and understand I cannot attend youth-contact opportunities until it clears.'
                : 'I agree to complete ID verification and understand my profile shows as “pending” until it’s done.'}
            </span>
          </label>
        </div>
      )}

      {/* Step 3 — account */}
      {step === 3 && (
        <form onSubmit={submit} className="space-y-4">
          <Field label={isYouth ? 'Your email' : 'Email'}>
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
            {submitting ? 'Creating your account…' : 'Create my account'}
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
          >
            Back
          </button>
        </form>
      )}

      {/* Nav buttons for steps 1–2 */}
      {(step === 1 || step === 2) && (
        <div className="mt-8">
          {error && <p className="mb-3 text-sm font-semibold text-coral-600">{error}</p>}
          <button
            type="button"
            onClick={next}
            className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="mt-2 w-full py-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
