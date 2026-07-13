import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const PLANS = [
  {
    id: 'community',
    name: 'Community',
    price: '$29',
    cadence: '/month',
    blurb: 'For small nonprofits and community groups.',
    features: ['Up to 5 active opportunities', 'Volunteer check-in & check-out', 'Hour reports (CSV export)'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$79',
    cadence: '/month',
    blurb: 'For organizations running programs year-round.',
    features: ['Unlimited opportunities', 'Multiple staff accounts', 'Priority placement in browse', 'Everything in Community'],
    highlight: true,
  },
]

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export default function OrgSignup() {
  const [form, setForm] = useState({
    orgName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    ein: '',
    plan: 'community',
    mission: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.orgName.trim() || !form.contactName.trim() || !form.email.trim()) {
      setError('Organization name, contact name, and email are required.')
      return
    }
    setSubmitting(true)
    try {
      if (isSupabaseConfigured) {
        const { error: insertError } = await supabase.from('org_applications').insert({
          org_name: form.orgName,
          contact_name: form.contactName,
          email: form.email,
          phone: form.phone || null,
          website: form.website || null,
          ein: form.ein || null,
          plan: form.plan,
          mission: form.mission || null,
        })
        if (insertError) throw insertError
      } else {
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
          Application received!
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          Thanks, {form.contactName}. Our team reviews every organization before activation —
          we&apos;ll reach out to <span className="font-semibold">{form.email}</span> within 2
          business days to finish setup. No charges until your account is approved.
        </p>
        <p className="mt-3 text-sm text-ink-500">
          Once you&apos;re approved,{' '}
          <Link to="/organizations/create-account" className="font-semibold text-primary-600 hover:underline">
            create your account
          </Link>{' '}
          with this same email to start posting opportunities.
        </p>
        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            Demo mode: connect Supabase to store real applications.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {/* Interest form CTA */}
      <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4">
        <p className="text-sm font-semibold text-ink-700">
          Just want to let us know you're here?{' '}
          <Link to="/organizations/apply" className="text-primary-600 underline underline-offset-2 hover:text-primary-700">
            Share your info
          </Link>{' '}
          and we'll reach out with no pressure.
        </p>
      </div>

      <div className="max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Bring volunteers to your door.
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          Post opportunities, manage signups, check volunteers in and out on-site, and export
          verified hour reports. Every organization is reviewed before going live.
        </p>
      </div>

      {/* Plans */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setForm((f) => ({ ...f, plan: plan.id }))}
            className={`rounded-3xl border-2 p-6 text-left transition ${
              form.plan === plan.id
                ? 'border-primary-600 bg-primary-50 shadow-md'
                : 'border-ink-100 bg-white hover:border-primary-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-ink-900">{plan.name}</p>
              {plan.highlight && (
                <span className="rounded-full bg-coral-100 px-3 py-1 text-xs font-bold text-coral-600">
                  Most popular
                </span>
              )}
            </div>
            <p className="mt-2 text-3xl font-extrabold text-ink-900">
              {plan.price}
              <span className="text-sm font-semibold text-ink-500">{plan.cadence}</span>
            </p>
            <p className="mt-1 text-sm text-ink-700">{plan.blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-primary-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4 10-11" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-500">
        Mahopac-area organizations get their first 3 months free.
      </p>

      {/* Application form */}
      <form onSubmit={submit} className="mt-10 space-y-4">
        <h2 className="text-xl font-bold text-ink-900">Tell us about your organization</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">Organization name *</span>
            <input className={inputClass} value={form.orgName} onChange={set('orgName')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">Contact name *</span>
            <input className={inputClass} value={form.contactName} onChange={set('contactName')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">Email *</span>
            <input type="email" className={inputClass} value={form.email} onChange={set('email')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">Phone</span>
            <input type="tel" className={inputClass} value={form.phone} onChange={set('phone')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">Website</span>
            <input className={inputClass} value={form.website} onChange={set('website')} placeholder="https://" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-900">EIN (if 501c3)</span>
            <input className={inputClass} value={form.ein} onChange={set('ein')} placeholder="XX-XXXXXXX" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-ink-900">What does your organization do?</span>
          <textarea rows={3} className={inputClass} value={form.mission} onChange={set('mission')} />
        </label>
        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60 sm:w-auto sm:px-10"
        >
          {submitting ? 'Submitting…' : 'Apply to join ShowUp'}
        </button>
      </form>
    </div>
  )
}
