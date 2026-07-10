/*
 * ShowUp — Adult volunteer identity verification
 * ----------------------------------------------
 * Adults sign up through the normal auth flow but land as `pending`. Before they
 * can browse or sign up for events, an admin approves them. This page collects a
 * photo of their government-issued ID and stores it privately; the admin reviews
 * it from /admin and flips verification_status to 'verified'.
 *
 * Students (role 'youth') never see this — their flow is unchanged.
 *
 * ── Run this migration once in the Supabase SQL editor ──────────────────────
 * It is idempotent, so re-running it is safe.
 *
 *   -- 1. Column: where the uploaded ID photo lives (a private Storage path).
 *   alter table public.profiles
 *     add column if not exists id_photo_url text;
 *
 *   -- 2. Private Storage bucket for the ID photos.
 *   insert into storage.buckets (id, name, public)
 *   values ('volunteer-id-photos', 'volunteer-id-photos', false)
 *   on conflict (id) do nothing;
 *
 *   -- Each adult uploads into a folder named after their own uid and can only
 *   -- read back what they uploaded. Admins use the service role (or a signed
 *   -- URL minted server-side) to view any photo during review.
 *   drop policy if exists "upload own id photo" on storage.objects;
 *   create policy "upload own id photo" on storage.objects
 *     for insert to authenticated
 *     with check (
 *       bucket_id = 'volunteer-id-photos'
 *       and (storage.foldername(name))[1] = auth.uid()::text
 *     );
 *
 *   drop policy if exists "read own id photo" on storage.objects;
 *   create policy "read own id photo" on storage.objects
 *     for select to authenticated
 *     using (
 *       bucket_id = 'volunteer-id-photos'
 *       and (storage.foldername(name))[1] = auth.uid()::text
 *     );
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

export const ID_PHOTO_BUCKET = 'volunteer-id-photos'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10 MB

// Pull a lowercase file extension so uploaded objects keep a sensible suffix.
function extensionOf(fileName) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName || '')
  return match ? match[1].toLowerCase() : 'jpg'
}

export default function VerifyIdentity() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const demoMode = !isSupabaseConfigured
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Identity verification is an adult-only step. Students (role 'youth') and any
  // adult who is already verified/cleared are sent back to their dashboard. In
  // demo mode there's no profile to read, so the previewable flow stays open.
  const [gateChecked, setGateChecked] = useState(demoMode)

  useEffect(() => {
    if (demoMode || !user) return

    let active = true
    supabase
      .from('profiles')
      .select('role, verification_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: gateError }) => {
        if (!active) return
        const role = data?.role ?? user.user_metadata?.role
        const status = data?.verification_status
        // Redirect students and anyone already past 'pending'. On a lookup
        // error, fail open so a transient glitch doesn't strand a legitimate
        // adult — the upload/update below still requires a real session.
        if (!gateError && ((role && role === 'youth') || (status && status !== 'pending'))) {
          navigate('/dashboard', { replace: true })
          return
        }
        setGateChecked(true)
      })

    return () => {
      active = false
    }
  }, [demoMode, user, navigate])

  function onPhotoChange(e) {
    const file = e.target.files?.[0] ?? null
    setError('')
    if (file && !file.type.startsWith('image/')) {
      setPhoto(null)
      setError('Please choose an image file (a photo of your ID).')
      return
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setPhoto(null)
      setError('That image is over 10 MB. Please choose a smaller photo.')
      return
    }
    setPhoto(file)
  }

  async function submit(e) {
    e.preventDefault()
    if (!photo) {
      setError('Please attach a photo of your government-issued ID.')
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

      // 1. Upload the ID photo into the adult's own folder. RLS on
      //    storage.objects keys the folder to auth.uid(), so the path prefix
      //    MUST be the user id or the insert is rejected.
      const path = `${user.id}/${crypto.randomUUID()}.${extensionOf(photo.name)}`
      const { error: uploadError } = await supabase.storage
        .from(ID_PHOTO_BUCKET)
        .upload(path, photo, { contentType: photo.type, upsert: false })
      if (uploadError) throw uploadError

      // 2. Record the object PATH on the profile (bucket is private; admins mint
      //    short-lived signed URLs to view it). We also re-assert 'pending' to
      //    confirm the submission landed — status is flipped by an admin later.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ id_photo_url: path, verification_status: 'pending' })
        .eq('id', user.id)
      if (updateError) {
        // Best-effort: don't leave an orphaned photo if the update failed.
        await supabase.storage.from(ID_PHOTO_BUCKET).remove([path]).catch(() => {})
        throw updateError
      }

      setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong submitting your ID. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Hold rendering until we've confirmed this adult still needs to verify, to
  // avoid flashing the form before the redirect fires.
  if (!gateChecked) return null

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4 10-11" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          You&apos;re on the list 🎉
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          We&apos;ll review your ID and activate your account within 24 hours. You&apos;ll
          get an email when you&apos;re ready to go.
        </p>
        {demoMode && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            Demo mode: connect Supabase to save real submissions.
          </p>
        )}
        <Link
          to="/dashboard"
          className="mt-8 inline-block rounded-full bg-primary-600 px-8 py-4 font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
        >
          Back to my dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        One quick step before you get started
      </h1>
      <p className="mt-3 leading-relaxed text-ink-700">
        We keep every volunteer event safe and welcoming. Upload a photo of your
        government-issued ID so our team can confirm your identity. This stays
        private and secure.
      </p>

      {demoMode && (
        <p className="mt-5 rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo mode — submissions are simulated until Supabase is connected.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-semibold text-ink-900">Photo of your government-issued ID</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="mt-1.5 block w-full text-sm text-ink-700 file:mr-4 file:rounded-full file:border-0 file:bg-primary-50 file:px-5 file:py-2.5 file:text-sm file:font-bold file:text-primary-700 hover:file:bg-primary-100"
          />
          <span className="mt-1 block text-xs text-ink-500">
            A driver&apos;s license, passport, or state ID. Image only, max 10 MB.
          </span>
          {photo && (
            <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4 10-11" />
              </svg>
              {photo.name}
            </span>
          )}
        </label>

        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
    </div>
  )
}
