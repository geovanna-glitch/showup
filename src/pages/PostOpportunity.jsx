/*
 * ShowUp — Post a volunteer opportunity (Org dashboard)
 * -------------------------------------------------------
 * Only org users with an active organizations row can reach this page. They
 * post opportunities, close them, and open each one's check-in screen.
 *
 * If the signed-in org user has no organization yet, we try to claim one:
 * approving an application creates an unowned organizations row, and
 * claim_my_organization() links it to the login whose email matches. All
 * database objects live in supabase/schema.sql.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { OPPORTUNITY_TYPES } from '../lib/mockData.js'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

const selectClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

function StatusBadge({ status }) {
  const styles = {
    open: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-ink-100 text-ink-500',
    cancelled: 'bg-coral-100 text-coral-700',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${styles[status] ?? styles.closed}`}>
      {status}
    </span>
  )
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const blankForm = {
  title: '',
  description: '',
  type: OPPORTUNITY_TYPES[0],
  location: '',
  starts_at: '',
  ends_at: '',
  spots: 10,
  youth_eligible: true,
  youth_contact: false,
}

export default function PostOpportunity() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [orgError, setOrgError] = useState('')

  const [form, setForm] = useState(blankForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [posted, setPosted] = useState(null) // the newly-posted opportunity row

  const [myOpps, setMyOpps] = useState([])
  const [loadingOpps, setLoadingOpps] = useState(false)
  const [closingId, setClosingId] = useState(null)

  // ── Guard & load org ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    let active = true
    setLoadingOrg(true)

    ;(async () => {
      // 1. Confirm role is 'org'
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (!prof || prof.role !== 'org') {
        // Not an org — send them to their dashboard
        navigate('/dashboard', { replace: true })
        return
      }

      // 2. Load the organizations row owned by this user
      const { data: orgRow, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        setOrgError('Could not load your organization. Please try again.')
      } else if (!orgRow) {
        // No org yet — maybe their application was just approved. Claiming
        // links the approved (unowned) organization whose email matches this
        // login; the email check happens server-side against the verified JWT.
        const { data: claimedId } = await supabase.rpc('claim_my_organization')
        if (!active) return
        if (claimedId) {
          const { data: claimedOrg } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', claimedId)
            .maybeSingle()
          if (!active) return
          if (claimedOrg) {
            setOrg(claimedOrg)
            setLoadingOrg(false)
            return
          }
        }
        setOrgError('no-org')
      } else {
        setOrg(orgRow)
      }
      setLoadingOrg(false)
    })()

    return () => { active = false }
  }, [user, navigate])

  // ── Load this org's existing opportunities ────────────────────────────────

  useEffect(() => {
    if (!org) return
    let active = true
    setLoadingOpps(true)

    supabase
      .from('opportunities')
      .select('*')
      .eq('org_id', org.id)
      .order('starts_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setMyOpps(data ?? [])
          setLoadingOpps(false)
        }
      })

    return () => { active = false }
  }, [org, posted])

  // ── Form helpers ──────────────────────────────────────────────────────────

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setFormError('')
  }

  function validate() {
    if (!form.title.trim()) return 'Add a title for this opportunity.'
    if (!form.location.trim()) return 'Add a location.'
    if (!form.starts_at) return 'Set a start date and time.'
    if (!form.ends_at) return 'Set an end date and time.'
    if (new Date(form.ends_at) <= new Date(form.starts_at))
      return 'End time must be after start time.'
    if (!form.spots || form.spots < 1) return 'Spots must be at least 1.'
    return null
  }

  async function handlePost(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setFormError(err); return }
    if (!org) return

    setSubmitting(true)
    setFormError('')

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        org_id: org.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        location: form.location.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        spots: Number(form.spots),
        youth_eligible: form.youth_eligible,
        youth_contact: form.youth_contact,
        status: 'open',
      })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      setFormError(error.message || 'Could not post this opportunity. Please try again.')
      return
    }

    setPosted(data)
    setForm(blankForm)
  }

  async function handleClose(oppId) {
    setClosingId(oppId)
    await supabase
      .from('opportunities')
      .update({ status: 'closed' })
      .eq('id', oppId)
    setMyOpps((prev) => prev.map((o) => o.id === oppId ? { ...o, status: 'closed' } : o))
    setClosingId(null)
  }

  // ── Loading / guard states ────────────────────────────────────────────────

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
          Demo mode — connect Supabase to post real opportunities.
        </p>
      </div>
    )
  }

  if (loadingOrg) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-primary-600" />
      </div>
    )
  }

  if (orgError === 'no-org') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-2xl font-extrabold text-ink-900">No organization found</p>
        <p className="mt-3 text-ink-700">
          Your account is set up, but we don't have an approved organization linked to it yet.
          If your application was approved, make sure this account uses the{' '}
          <span className="font-semibold">same email address</span> you applied with. Otherwise,
          contact us at{' '}
          <a href="mailto:hello@showup.community" className="font-semibold text-primary-600 hover:underline">
            hello@showup.community
          </a>{' '}
          and we'll get you set up.
        </p>
      </div>
    )
  }

  if (orgError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm font-semibold text-coral-600">{orgError}</p>
      </div>
    )
  }

  if (org && org.status !== 'active') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peach-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-peach-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="mt-4 text-xl font-extrabold text-ink-900">Application under review</p>
          <p className="mt-2 text-sm text-ink-700">
            <span className="font-semibold">{org.name}</span> is being reviewed by our team.
            You'll be able to post opportunities once your account is approved.
          </p>
        </div>
      </div>
    )
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
          {org?.name}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">
          Post an opportunity
        </h1>
        <p className="mt-2 text-ink-700">
          Volunteers on ShowUp will be able to browse and sign up for this shift.
        </p>
      </div>

      {/* Success banner */}
      {posted && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <p className="font-bold text-emerald-900">
              "{posted.title}" is live.
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Volunteers can find it on the{' '}
              <Link to="/opportunities" className="font-semibold underline">
                Browse page
              </Link>{' '}
              right now.
            </p>
          </div>
        </div>
      )}

      {/* Post form */}
      <form onSubmit={handlePost} className="mt-8 space-y-5">
        <Field label="Title" hint="Be specific — 'Food Pantry Shelf Stocking' beats 'Volunteer needed'">
          <input
            type="text"
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Saturday Morning Trail Cleanup"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            className={`${inputClass} min-h-[96px] resize-y`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="What will volunteers be doing? What should they bring or know?"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Type">
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
            >
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Location">
            <input
              type="text"
              className={inputClass}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Mahopac, NY"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Start date & time">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
            />
          </Field>

          <Field label="End date & time">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.ends_at}
              onChange={(e) => set('ends_at', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Open spots" hint="How many volunteers can sign up?">
          <input
            type="number"
            min="1"
            max="500"
            className={inputClass}
            value={form.spots}
            onChange={(e) => set('spots', e.target.value)}
          />
        </Field>

        <div className="space-y-3 rounded-2xl border border-ink-100 bg-ink-50/60 px-4 py-4">
          <p className="text-sm font-bold text-ink-900">Eligibility</p>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-ink-300 accent-primary-600"
              checked={form.youth_eligible}
              onChange={(e) => set('youth_eligible', e.target.checked)}
            />
            <span className="text-sm text-ink-700">
              Open to youth volunteers (students grades 9–12)
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-ink-300 accent-primary-600"
              checked={form.youth_contact}
              onChange={(e) => set('youth_contact', e.target.checked)}
            />
            <span className="text-sm text-ink-700">
              Adult volunteers must have Tier 2 youth-contact clearance
            </span>
          </label>
        </div>

        {formError && (
          <p className="text-sm font-semibold text-coral-600">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? 'Posting…' : 'Post opportunity'}
        </button>
      </form>

      {/* Existing opportunities */}
      <section className="mt-14">
        <h2 className="text-xl font-extrabold text-ink-900">Your opportunities</h2>

        {loadingOpps && (
          <div className="mt-6 flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-primary-600" />
          </div>
        )}

        {!loadingOpps && myOpps.length === 0 && (
          <p className="mt-4 text-sm text-ink-500">
            Nothing posted yet. Your first opportunity will show up here.
          </p>
        )}

        {!loadingOpps && myOpps.length > 0 && (
          <ul className="mt-4 space-y-3">
            {myOpps.map((opp) => (
              <li
                key={opp.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-ink-100 bg-white px-4 py-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={opp.status} />
                    <span className="text-xs text-ink-400">{opp.type}</span>
                  </div>
                  <p className="mt-1 font-bold text-ink-900">{opp.title}</p>
                  <p className="mt-0.5 text-sm text-ink-600">{opp.location}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDateTime(opp.starts_at)} — {formatDateTime(opp.ends_at)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{opp.spots} spots</p>
                </div>
                {opp.status === 'open' && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Link
                      to={`/org/opportunities/${opp.id}/checkin`}
                      className="rounded-full bg-primary-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700"
                    >
                      Check-in →
                    </Link>
                    <button
                      type="button"
                      disabled={closingId === opp.id}
                      onClick={() => handleClose(opp.id)}
                      className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-600 transition hover:border-coral-300 hover:text-coral-600 disabled:opacity-50"
                    >
                      {closingId === opp.id ? 'Closing…' : 'Close'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
