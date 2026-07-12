/*
 * ShowUp — Admin: self-logged hours review (internal tool)
 * --------------------------------------------------------
 * Admins review the external hours students log on /log-hours. Each entry
 * carries a photo of the supervisor-signed sheet and the student's written
 * reflection. Approve (→ 'approved', hours count toward the student's total)
 * or Reject (→ 'rejected').
 *
 * Requires the admin policies on external_hour_logs and the admin storage
 * read policy on the 'hour-verification-photos' bucket — both created by
 * supabase/migrations/2026-07-12_security_and_hours.sql.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { PHOTO_BUCKET } from './LogHours.jsx'

// Demo rows so the tool is previewable before Supabase is connected.
const demoPending = [
  {
    id: 'demo-h1',
    studentName: 'Maya Rodriguez',
    studentGrade: '11th',
    org_name: 'St. John’s Soup Kitchen',
    service_date: '2026-07-04',
    hours: 4,
    supervisor_name: 'Deacon Ruiz',
    reflection:
      'I helped serve lunch to about 60 people. It made me realize how many families in our own town rely on the kitchen every week.',
    photo_url: 'demo/signed-sheet.jpg',
    created_at: '2026-07-05T10:00:00Z',
  },
  {
    id: 'demo-h2',
    studentName: 'Ethan Park',
    studentGrade: '10th',
    org_name: 'Carmel Animal Shelter',
    service_date: '2026-06-21',
    hours: 2.5,
    supervisor_name: 'K. Byrne',
    reflection:
      'I walked dogs and cleaned kennels. The staff taught me how much daily work goes into caring for surrendered animals.',
    photo_url: 'demo/signed-sheet-2.jpg',
    created_at: '2026-06-22T15:30:00Z',
  },
]

function formatServiceDate(iso) {
  if (!iso) return '—'
  // 'YYYY-MM-DD' parsed as local time so the date never shifts a day.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AdminHoursReview() {
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
        .from('external_hour_logs')
        .select('id, user_id, org_name, service_date, hours, supervisor_name, reflection, photo_url, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (queryError) throw queryError

      const logs = data ?? []

      // external_hour_logs points at auth.users, not profiles, so PostgREST
      // can't join the student's name — fetch the matching profiles separately
      // and merge. Failing that (e.g. policy missing), show entries anonymously
      // rather than showing nothing.
      const userIds = [...new Set(logs.map((l) => l.user_id))]
      let profileById = new Map()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, grade, school')
          .in('id', userIds)
        profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
      }

      setRows(
        logs.map((log) => {
          const p = profileById.get(log.user_id)
          return {
            ...log,
            studentName: p ? `${p.first_name} ${p.last_name}`.trim() : '(name unavailable)',
            studentGrade: p?.grade ?? '',
          }
        }),
      )
    } catch (err) {
      setError(err.message || 'Could not load pending hours.')
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

  // Open the signed-sheet photo in a new tab via a short-lived signed URL.
  async function viewPhoto(path) {
    if (demoMode) {
      window.alert('Demo mode: connect Supabase to view the uploaded photo.')
      return
    }
    const { data, error: signError } = await supabase.storage
      .from(PHOTO_BUCKET)
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
        .from('external_hour_logs')
        .update({ status })
        .eq('id', id)
      if (updateError) throw updateError
      // Drop the row — it no longer matches the pending filter.
      setRows((rs) => rs.filter((r) => r.id !== id))
    } catch (err) {
      window.alert(err.message || 'Could not update that entry. Please try again.')
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
          Hours review
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
        Hours students logged themselves. Check the signed sheet and reflection, then approve or
        reject. Approved hours count toward the student&apos;s total right away.
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
            const busy = busyId === row.id
            return (
              <li key={row.id} className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-900">
                      {row.studentName}
                      {row.studentGrade && (
                        <span className="ml-2 text-sm font-semibold text-ink-500">
                          {row.studentGrade} grade
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">
                      <span className="font-semibold">{row.org_name}</span>
                      {' · '}
                      {formatServiceDate(row.service_date)}
                      {' · '}
                      <span className="font-semibold">{row.hours} hrs</span>
                      {' · '}
                      Supv. {row.supervisor_name}
                    </p>

                    {row.reflection && (
                      <blockquote className="mt-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
                        “{row.reflection}”
                      </blockquote>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
                      {row.photo_url ? (
                        <button
                          type="button"
                          onClick={() => viewPhoto(row.photo_url)}
                          className="text-primary-600 hover:underline"
                        >
                          View signed sheet →
                        </button>
                      ) : (
                        <span className="font-semibold text-coral-600">No photo attached</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(row.id, 'approved')}
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
                      Reject
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
