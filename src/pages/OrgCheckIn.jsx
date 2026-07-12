/*
 * ShowUp — On-site check-in / check-out (org tool)
 * ------------------------------------------------
 * Org staff open this page during their event to check volunteers in and out.
 * Check-in creates an hour_logs row and check-out completes it — both through
 * database functions (org_roster / org_check_in / org_check_out in
 * supabase/schema.sql) that stamp SERVER time and verify the org owns the
 * event, so verified hours can't be faked from a browser.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Demo roster so the tool is previewable before Supabase is connected.
const demoRoster = [
  { signup_id: 'demo-s1', first_name: 'Maya', last_name: 'Rodriguez', role: 'youth', grade: '11th', checked_in_at: null, checked_out_at: null, hours: null },
  { signup_id: 'demo-s2', first_name: 'Ethan', last_name: 'Park', role: 'youth', grade: '10th', checked_in_at: '2026-07-12T09:02:00Z', checked_out_at: null, hours: null },
  { signup_id: 'demo-s3', first_name: 'Daniel', last_name: 'Okafor', role: 'adult', grade: null, checked_in_at: '2026-07-12T08:58:00Z', checked_out_at: '2026-07-12T12:01:00Z', hours: 3.05 },
]

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function OrgCheckIn() {
  const { id: opportunityId } = useParams()
  const { user } = useAuth()

  const demoMode = !isSupabaseConfigured
  const [opp, setOpp] = useState(demoMode ? { title: 'Saturday Morning Trail Cleanup', starts_at: '2026-07-12T13:00:00Z', location: 'Mahopac, NY' } : null)
  const [roster, setRoster] = useState(demoMode ? demoRoster : [])
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // "orgs read own opportunities" RLS means this returns nothing unless
      // the signed-in user owns the event — which doubles as the page's guard.
      const [{ data: oppRow, error: oppError }, { data: rosterRows, error: rosterError }] =
        await Promise.all([
          supabase
            .from('opportunities')
            .select('id, title, location, starts_at, ends_at, status')
            .eq('id', opportunityId)
            .maybeSingle(),
          supabase.rpc('org_roster', { opp: opportunityId }),
        ])
      if (oppError) throw oppError
      if (rosterError) throw rosterError
      if (!oppRow) {
        setError('We couldn’t find that opportunity on your account.')
        return
      }
      setOpp(oppRow)
      setRoster(rosterRows ?? [])
    } catch (err) {
      setError(err.message || 'Could not load the volunteer roster.')
    } finally {
      setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => {
    if (demoMode || !user) return
    load()
  }, [demoMode, user, load])

  async function checkIn(signupId) {
    if (demoMode) {
      setRoster((rs) =>
        rs.map((r) => (r.signup_id === signupId ? { ...r, checked_in_at: new Date().toISOString() } : r)),
      )
      return
    }
    setBusyId(signupId)
    try {
      const { error: rpcError } = await supabase.rpc('org_check_in', { signup: signupId })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      window.alert(err.message || 'Could not check that volunteer in. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function checkOut(signupId) {
    if (demoMode) {
      setRoster((rs) =>
        rs.map((r) =>
          r.signup_id === signupId
            ? { ...r, checked_out_at: new Date().toISOString(), hours: 3 }
            : r,
        ),
      )
      return
    }
    setBusyId(signupId)
    try {
      const { error: rpcError } = await supabase.rpc('org_check_out', { signup: signupId })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      window.alert(err.message || 'Could not check that volunteer out. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link
        to="/org/post"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-primary-600"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to your opportunities
      </Link>

      <div className="mt-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Check-in
          </h1>
          {opp && (
            <p className="mt-1 font-semibold text-ink-700">
              {opp.title}
              {opp.starts_at && (
                <span className="font-normal text-ink-500"> · {formatDateTime(opp.starts_at)}</span>
              )}
            </p>
          )}
        </div>
        {!demoMode && (
          <button
            type="button"
            onClick={load}
            className="shrink-0 rounded-full border border-ink-200 px-4 py-1.5 text-xs font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700"
          >
            Refresh
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-500">
        Check volunteers in when they arrive and out when they leave. Their verified hours are
        recorded automatically.
      </p>

      {demoMode && (
        <p className="mt-5 rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo roster — connect Supabase to check in real volunteers.
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-ink-500">Loading roster…</p>
      ) : error ? (
        <p className="mt-8 text-sm font-semibold text-coral-600">{error}</p>
      ) : roster.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">
          No volunteers have signed up yet. Signups appear here as they come in.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {roster.map((row) => {
            const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '(no name)'
            const busy = busyId === row.signup_id
            const checkedIn = Boolean(row.checked_in_at) && !row.checked_out_at
            const done = Boolean(row.checked_out_at)
            return (
              <li
                key={row.signup_id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white px-4 py-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink-900">{name}</p>
                  <p className="text-sm text-ink-500">
                    {row.role === 'youth'
                      ? `Student${row.grade ? ` · ${row.grade} grade` : ''}`
                      : 'Adult volunteer'}
                  </p>
                  {checkedIn && (
                    <p className="mt-0.5 text-xs font-semibold text-primary-700">
                      Checked in at {formatTime(row.checked_in_at)}
                    </p>
                  )}
                  {done && (
                    <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                      Done · {formatTime(row.checked_in_at)}–{formatTime(row.checked_out_at)}
                      {row.hours != null && ` · ${Number(row.hours)} hrs verified`}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4 10-11" />
                      </svg>
                      Verified
                    </span>
                  ) : checkedIn ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => checkOut(row.signup_id)}
                      className="rounded-full bg-coral-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-coral-600 disabled:opacity-60"
                    >
                      {busy ? '…' : 'Check out'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => checkIn(row.signup_id)}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                    >
                      {busy ? '…' : 'Check in'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
