/*
 * ShowUp — External hours logging
 * -------------------------------
 * Students self-log volunteer hours served with ANY organization (not just
 * Links of Love). Each submission carries a photo of the supervisor-signed
 * paper plus a written reflection (Mahopac CSD requires one with logged
 * hours), and lands as `pending` until an admin approves it on /admin/hours.
 *
 * Database objects live in supabase/schema.sql; the reflection column and
 * admin review policies are added by
 * supabase/migrations/2026-07-12_security_and_hours.sql.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

export const PHOTO_BUCKET = 'hour-verification-photos'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10 MB

const initialForm = {
  orgName: '',
  serviceDate: '',
  hours: '',
  supervisorName: '',
  reflection: '',
}

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

// today (local) as YYYY-MM-DD, used as the max selectable service date.
function todayISO() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

// Pull a lowercase file extension so uploaded objects keep a sensible suffix.
function extensionOf(fileName) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName || '')
  return match ? match[1].toLowerCase() : 'jpg'
}

export default function LogHours() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const demoMode = !isSupabaseConfigured
  const [form, setForm] = useState(initialForm)
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Self-logging external hours is a student-only feature. Adults and orgs who
  // reach this route directly are sent back to their dashboard. In demo mode
  // there's no profile to read, so the previewable student flow stays open.
  const [roleChecked, setRoleChecked] = useState(demoMode)

  useEffect(() => {
    if (demoMode || !user) return

    let active = true
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: roleError }) => {
        if (!active) return
        const role = data?.role ?? user.user_metadata?.role
        // Redirect non-students. On a lookup error, fail open so a transient
        // glitch doesn't strand a legitimate student on a blank screen — the
        // DB's RLS insert policy is the real guard on who can write hours.
        if (!roleError && role && role !== 'youth') {
          navigate('/dashboard', { replace: true })
          return
        }
        setRoleChecked(true)
      })

    return () => {
      active = false
    }
  }, [demoMode, user, navigate])

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError('')
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0] ?? null
    setError('')
    if (file && !file.type.startsWith('image/')) {
      setPhoto(null)
      setError('Please choose an image file (a photo or scan of the signed sheet).')
      return
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setPhoto(null)
      setError('That image is over 10 MB. Please choose a smaller photo.')
      return
    }
    setPhoto(file)
  }

  function validate() {
    if (!form.orgName.trim()) return 'Please enter the organization you volunteered with.'
    if (!form.serviceDate) return 'Please enter the date you served.'
    if (form.serviceDate > todayISO()) return "The service date can't be in the future."
    const hours = Number(form.hours)
    if (!form.hours || Number.isNaN(hours) || hours <= 0) return 'Please enter how many hours you served.'
    if (hours > 24) return 'Hours must be 24 or fewer for a single entry.'
    if (!form.supervisorName.trim()) return 'Please enter your supervisor’s name.'
    if (!form.reflection.trim()) return 'Please write a short reflection about your service.'
    if (!photo) return 'Please attach a photo of your supervisor-signed sheet.'
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (demoMode) {
        // Demo mode: no backend connected — simulate the round-trip so the
        // whole flow stays previewable before Supabase is wired up.
        await new Promise((resolve) => setTimeout(resolve, 700))
        setDone(true)
        return
      }

      // 1. Upload the signed-sheet photo into the student's own folder. RLS on
      //    storage.objects keys the folder to auth.uid(), so the path prefix
      //    MUST be the user id or the insert is rejected.
      const path = `${user.id}/${crypto.randomUUID()}.${extensionOf(photo.name)}`
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo, { contentType: photo.type, upsert: false })
      if (uploadError) throw uploadError

      // 2. Record the submission. We store the object PATH (bucket is private);
      //    verifiers mint short-lived signed URLs to view it.
      const { error: insertError } = await supabase.from('external_hour_logs').insert({
        user_id: user.id,
        org_name: form.orgName.trim(),
        service_date: form.serviceDate,
        hours: Number(form.hours),
        supervisor_name: form.supervisorName.trim(),
        reflection: form.reflection.trim(),
        photo_url: path,
        // status defaults to 'pending' in the DB.
      })
      if (insertError) {
        // Best-effort: don't leave an orphaned photo if the row insert failed.
        await supabase.storage.from(PHOTO_BUCKET).remove([path]).catch(() => {})
        throw insertError
      }

      setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong submitting your hours. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Hold rendering until we've confirmed this is a student, to avoid flashing
  // the form to an adult before the redirect fires.
  if (!roleChecked) return null

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4 10-11" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          Hours submitted 🎉
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          Your hours have been submitted. They&apos;ll show as pending until verified.
        </p>
        {demoMode && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            Demo mode: connect Supabase to save real submissions.
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-block rounded-full bg-primary-600 px-8 py-4 font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
          >
            Back to my dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm(initialForm)
              setPhoto(null)
              setDone(false)
            }}
            className="text-sm font-semibold text-ink-500 hover:text-ink-700"
          >
            Log another entry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-primary-600"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to dashboard
      </button>

      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Log volunteer hours
      </h1>
      <p className="mt-2 leading-relaxed text-ink-700">
        Served somewhere outside ShowUp? Log it here. Snap a photo of your
        supervisor-signed sheet and we&apos;ll verify it — your hours count once approved.
      </p>

      {demoMode && (
        <p className="mt-5 rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo mode — submissions are simulated until Supabase is connected.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Organization" hint="The group you volunteered with.">
          <input
            className={inputClass}
            value={form.orgName}
            onChange={set('orgName')}
            placeholder="Putnam Community Food Pantry"
            autoComplete="organization"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of service">
            <input
              type="date"
              className={inputClass}
              value={form.serviceDate}
              onChange={set('serviceDate')}
              max={todayISO()}
            />
          </Field>
          <Field label="Hours served">
            <input
              type="number"
              className={inputClass}
              value={form.hours}
              onChange={set('hours')}
              placeholder="3"
              min="0.25"
              max="24"
              step="0.25"
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="Supervisor name" hint="Who signed off on your hours?">
          <input
            className={inputClass}
            value={form.supervisorName}
            onChange={set('supervisorName')}
            placeholder="Ms. Rivera"
            autoComplete="name"
          />
        </Field>

        <Field
          label="Your reflection"
          hint="A few sentences about what you did and what you took away from it. Mahopac CSD asks for a reflection with every service entry."
        >
          <textarea
            className={`${inputClass} min-h-[110px] resize-y`}
            value={form.reflection}
            onChange={set('reflection')}
            placeholder="What did you do? Who did it help? What did you learn?"
          />
        </Field>

        <Field label="Signed sheet photo" hint="A clear photo or scan of the supervisor-signed paper. Max 10 MB.">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="mt-1.5 block w-full text-sm text-ink-700 file:mr-4 file:rounded-full file:border-0 file:bg-primary-50 file:px-5 file:py-2.5 file:text-sm file:font-bold file:text-primary-700 hover:file:bg-primary-100"
          />
          {photo && (
            <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4 10-11" />
              </svg>
              {photo.name}
            </span>
          )}
        </Field>

        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit hours for verification'}
        </button>
      </form>
    </div>
  )
}
