/*
 * ShowUp — Admin identity review (internal tool)
 * ----------------------------------------------
 * Admins (role 'admin') review adults who have submitted an ID photo and are
 * still 'pending'. For each: view the ID (via a short-lived signed URL), check
 * the NY Sex Offender Registry, then Approve (→ 'verified') or Flag (→ 'rejected').
 *
 * This is a deliberately plain internal tool, not a polished page.
 *
 * ── Migration ──────────────────────────────────────────────────────────────
 * The `id_photo_url` column, `volunteer-id-photos` bucket, and storage RLS are
 * all created by the migration in VerifyIdentity.jsx. Admins additionally need
 * to read every pending profile and flip verification_status.
 *
 * NOTE: an admin policy must NOT `select ... from public.profiles` inline — that
 * re-triggers the same policy and Postgres raises "infinite recursion detected".
 * Instead, check the admin role through a SECURITY DEFINER helper, which runs as
 * its owner and bypasses RLS. Run this in the Supabase SQL editor:
 *
 *   -- Helper function to check admin role without RLS recursion
 *   create or replace function public.is_admin()
 *   returns boolean
 *   language sql
 *   security definer
 *   stable
 *   set search_path = public
 *   as $$
 *     select exists (
 *       select 1 from public.profiles
 *       where id = auth.uid() and role = 'admin'
 *     );
 *   $$;
 *
 *   -- Admins can read all profiles (using helper to avoid recursion)
 *   drop policy if exists "admins read all profiles" on public.profiles;
 *   create policy "admins read all profiles" on public.profiles
 *     for select using (public.is_admin());
 *
 *   -- Admins can update verification_status on any profile
 *   drop policy if exists "admins update verification" on public.profiles;
 *   create policy "admins update verification" on public.profiles
 *     for update using (public.is_admin());
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { ID_PHOTO_BUCKET } from './VerifyIdentity.jsx'

// Demo rows so the tool is previewable before Supabase is connected.
const demoPending = [
  {
    id: 'demo-a1',
    first_name: 'Daniel',
    last_name: 'Okafor',
    email: 'daniel.okafor@example.com',
    created_at: '2026-07-07T14:12:00Z',
    id_photo_url: 'demo-a1/license.jpg',
  },
  {
    id: 'demo-a2',
    first_name: 'Priya',
    last_name: 'Menon',
    email: 'priya.menon@example.com',
    created_at: '2026-07-08T09:40:00Z',
    id_photo_url: 'demo-a2/passport.jpg',
  },
]

function formatSubmitted(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Pre-fill the NY registry search with the applicant's name where the form
// accepts it via query params; if it ignores them, the page still opens.
function registryUrl(first, last) {
  const base = 'https://www.criminaljustice.ny.gov/SomsSUBDirectory/search.jsp'
  const params = new URLSearchParams()
  if (first) params.set('firstName', first)
  if (last) params.set('lastName', last)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export default function AdminReview() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const demoMode = !isSupabaseConfigured
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  // Gate: only admins may see this tool. Demo mode previews it directly.
  const [allowed, setAllowed] = useState(demoMode)
  const [gateChecked, setGateChecked] = useState(demoMode)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, created_at, id_photo_url')
        .eq('verification_status', 'pending')
        .not('id_photo_url', 'is', null)
        .order('created_at', { ascending: true })
      if (queryError) throw queryError
      setRows(data ?? [])
    } catch (err) {
      setError(err.message || 'Could not load pending reviews.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Confirm the signed-in user is an admin before loading anything.
  useEffect(() => {
    if (demoMode) {
      setRows(demoPending)
      return
    }
    if (!user) return

    let active = true
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: gateError }) => {
        if (!active) return
        const isAdmin = !gateError && data?.role === 'admin'
        setAllowed(isAdmin)
        setGateChecked(true)
        if (!isAdmin) {
          navigate('/dashboard', { replace: true })
        } else {
          load()
        }
      })

    return () => {
      active = false
    }
  }, [demoMode, user, navigate, load])

  // Open the ID photo in a new tab via a short-lived signed URL (private bucket).
  async function viewPhoto(path) {
    if (demoMode) {
      window.alert('Demo mode: connect Supabase to view the uploaded ID photo.')
      return
    }
    const { data, error: signError } = await supabase.storage
      .from(ID_PHOTO_BUCKET)
      .createSignedUrl(path, 60)
    if (signError || !data?.signedUrl) {
      window.alert('Could not open that photo. It may have been removed.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function setStatus(id, status) {
    if (demoMode) {
      setRows((rs) => rs.filter((r) => r.id !== id))
      return
    }
    setBusyId(id)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ verification_status: status })
        .eq('id', id)
      if (updateError) throw updateError
      // Drop the row — it no longer matches the pending filter.
      setRows((rs) => rs.filter((r) => r.id !== id))
    } catch (err) {
      window.alert(err.message || 'Could not update that account. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (!gateChecked) return null
  if (!allowed) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Identity review
        </h1>
        {!demoMode && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-ink-200 px-4 py-1.5 text-xs font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700"
          >
            Refresh
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-500">
        Adults awaiting approval. Review their ID and the registry, then approve or flag.
      </p>

      {demoMode && (
        <p className="mt-5 rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo data — connect Supabase to review real submissions.
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-ink-500">Loading…</p>
      ) : error ? (
        <p className="mt-8 text-sm font-semibold text-coral-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">Nothing to review right now. 🎉</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => {
            const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '(no name)'
            const busy = busyId === row.id
            return (
              <li key={row.id} className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">{name}</p>
                    <p className="truncate text-sm text-ink-500">{row.email ?? '—'}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Submitted {formatSubmitted(row.created_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
                      <button
                        type="button"
                        onClick={() => viewPhoto(row.id_photo_url)}
                        className="text-primary-600 hover:underline"
                      >
                        View ID photo →
                      </button>
                      <a
                        href={registryUrl(row.first_name, row.last_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        Check NY Sex Offender Registry →
                      </a>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(row.id, 'verified')}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                    >
                      {busy ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(row.id, 'rejected')}
                      className="rounded-full border border-coral-300 px-5 py-2.5 text-sm font-bold text-coral-600 transition hover:bg-coral-50 disabled:opacity-60"
                    >
                      Flag
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
