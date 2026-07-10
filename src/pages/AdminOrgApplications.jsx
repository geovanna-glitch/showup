/*
 * ShowUp — Admin: Org Applications
 * ----------------------------------
 * Lets Geovanna review intake form submissions from organizations who want to
 * join ShowUp. Pulls from the `org_applications` table, shows each as a card,
 * and lets her approve or decline with a single click.
 *
 * Role gate: only users with role = 'admin' in the profiles table may access
 * this page. Everyone else is redirected to /dashboard.
 *
 * ── Supabase RLS ──────────────────────────────────────────────────────────────
 * Admins need read + update access to org_applications. Add these policies in
 * the Supabase SQL editor (uses the is_admin() helper from AdminReview.jsx):
 *
 *   drop policy if exists "admins read org_applications" on public.org_applications;
 *   create policy "admins read org_applications" on public.org_applications
 *     for select using (public.is_admin());
 *
 *   drop policy if exists "admins update org_applications" on public.org_applications;
 *   create policy "admins update org_applications" on public.org_applications
 *     for update using (public.is_admin());
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Demo rows so the page is previewable before Supabase is connected.
const demoApps = [
  {
    id: 'demo-org-1',
    org_name: 'Mahopac Community Garden',
    contact_name: 'Rosa Kim',
    email: 'rosa@mahopacgarden.org',
    phone: '914-555-0101',
    website: 'mahopacgarden.org',
    ein: '12-3456789',
    plan: 'starter',
    mission: 'Title / Role: Executive Director\n\nWe grow food and community together.',
    status: 'new',
    created_at: '2026-07-06T10:00:00Z',
  },
  {
    id: 'demo-org-2',
    org_name: 'Carmel Youth Soccer',
    contact_name: 'James Patel',
    email: 'james@carmelsoccer.org',
    phone: '845-555-0202',
    website: 'carmelsoccer.org',
    ein: '98-7654321',
    plan: 'growth',
    mission: 'Title / Role: Program Director\n\nBuilding teamwork and confidence on the field.',
    status: 'approved',
    created_at: '2026-07-05T14:30:00Z',
  },
  {
    id: 'demo-org-3',
    org_name: 'Lake Carmel Arts Collective',
    contact_name: 'Diane Torres',
    email: 'diane@lcarts.org',
    phone: '',
    website: '',
    ein: '',
    plan: 'starter',
    mission: 'We bring art programs to kids across the county.',
    status: 'declined',
    created_at: '2026-07-04T08:15:00Z',
  },
]

/** Parse "Title / Role: Foo\n\nMission text" and return { titleRole, missionText }. */
function parseMission(raw) {
  if (!raw) return { titleRole: '', missionText: '' }
  const match = raw.match(/^Title\s*\/\s*Role:\s*(.+?)(?:\n\n([\s\S]*))?$/)
  if (match) {
    return {
      titleRole: match[1]?.trim() ?? '',
      missionText: match[2]?.trim() ?? '',
    }
  }
  return { titleRole: '', missionText: raw.trim() }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_STYLES = {
  new: 'bg-primary-100 text-primary-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-coral-100 text-coral-600',
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? 'bg-ink-100 text-ink-600'
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold capitalize ${cls}`}>
      {status ?? 'unknown'}
    </span>
  )
}

export default function AdminOrgApplications() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const demoMode = !isSupabaseConfigured
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [allowed, setAllowed] = useState(demoMode)
  const [gateChecked, setGateChecked] = useState(demoMode)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('org_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setRows(data ?? [])
    } catch (err) {
      setError(err.message || 'Could not load applications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (demoMode) {
      setRows(demoApps)
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

  async function setStatus(id, status) {
    if (demoMode) {
      setRows((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status } : r))
      )
      return
    }
    setBusyId(id)
    try {
      const { error: updateError } = await supabase
        .from('org_applications')
        .update({ status })
        .eq('id', id)
      if (updateError) throw updateError
      setRows((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status } : r))
      )
    } catch (err) {
      window.alert(err.message || 'Could not update that application. Please try again.')
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
          Org applications
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
        Organizations who submitted an intake form through ShowUp. Approve or decline each one.
      </p>

      {demoMode && (
        <p className="mt-5 rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo data — connect Supabase to review real submissions.
        </p>
      )}

      {loading ? (
        <div className="mt-10 flex justify-center">
          <svg
            className="h-8 w-8 animate-spin text-primary-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      ) : error ? (
        <p className="mt-8 text-sm font-semibold text-coral-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">No applications yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => {
            const { titleRole, missionText } = parseMission(row.mission)
            const busy = busyId === row.id
            return (
              <li
                key={row.id}
                className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink-900">{row.org_name || '(no org name)'}</p>
                      <StatusBadge status={row.status} />
                    </div>

                    <p className="mt-0.5 text-sm text-ink-600">
                      {row.contact_name || '—'}
                      {titleRole ? ` · ${titleRole}` : ''}
                    </p>

                    <div className="mt-2 space-y-0.5 text-sm text-ink-500">
                      {row.email && (
                        <p>
                          <a
                            href={`mailto:${row.email}`}
                            className="text-primary-600 hover:underline"
                          >
                            {row.email}
                          </a>
                        </p>
                      )}
                      {row.phone && <p>{row.phone}</p>}
                      {row.website && (
                        <p>
                          <a
                            href={
                              row.website.startsWith('http')
                                ? row.website
                                : `https://${row.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            {row.website}
                          </a>
                        </p>
                      )}
                      {row.ein && <p>EIN: {row.ein}</p>}
                      {row.plan && (
                        <p>
                          Plan:{' '}
                          <span className="font-semibold capitalize text-ink-700">{row.plan}</span>
                        </p>
                      )}
                    </div>

                    {missionText && (
                      <p className="mt-3 text-sm text-ink-500 line-clamp-3">{missionText}</p>
                    )}

                    <p className="mt-3 text-xs text-ink-400">
                      Submitted {formatDate(row.created_at)}
                    </p>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                    <button
                      type="button"
                      disabled={busy || row.status === 'approved'}
                      onClick={() => setStatus(row.id, 'approved')}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-40"
                    >
                      {busy ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || row.status === 'declined'}
                      onClick={() => setStatus(row.id, 'declined')}
                      className="rounded-full border border-coral-300 px-5 py-2.5 text-sm font-bold text-coral-600 transition hover:bg-coral-50 disabled:opacity-40"
                    >
                      Decline
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
