import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { opportunities as mockOpps, OPPORTUNITY_TYPES } from '../lib/mockData.js'

// ── Date / time helpers ─────────────────────────────────────────────────────

function formatDate(iso) {
  // Handles both 'YYYY-MM-DD' (mock) and full ISO timestamps (Supabase)
  const d = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function calcHours(startsAt, endsAt) {
  const diff = (new Date(endsAt) - new Date(startsAt)) / (1000 * 60 * 60)
  return Math.round(diff * 10) / 10
}

// ── Normalize a Supabase row → card shape ───────────────────────────────────

function normalize(row) {
  return {
    id: row.id,
    title: row.title,
    org: row.organizations?.name ?? 'Links of Love Inc.',
    type: row.type,
    date: row.starts_at,
    time: `${formatTime(row.starts_at)} – ${formatTime(row.ends_at)}`,
    location: row.location,
    spots: row.spots,
    hours: calcHours(row.starts_at, row.ends_at),
    youthEligible: row.youth_eligible,
    youthContact: row.youth_contact,
    description: row.description ?? '',
    isReal: true,
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Browse() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const demoMode = !isSupabaseConfigured

  const [opps, setOpps] = useState([])
  const [mySignups, setMySignups] = useState(new Set()) // set of opportunity_ids
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [type, setType] = useState('All')
  const [location, setLocation] = useState('All')
  const [when, setWhen] = useState('all')

  // Load opportunities — real Supabase data, or fall back to mock
  const load = useCallback(async () => {
    if (demoMode) {
      setOpps(mockOpps.map((o) => ({ ...o, isReal: false })))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('opportunities')
        .select(
          'id, title, description, type, location, starts_at, ends_at, spots, youth_eligible, youth_contact, organizations (name)',
        )
        .eq('status', 'open')
        .order('starts_at', { ascending: true })
      if (err) throw err
      if (!data || data.length === 0) {
        // No real opportunities yet — show mock cards
        setOpps(mockOpps.map((o) => ({ ...o, isReal: false })))
      } else {
        setOpps(data.map(normalize))
      }
    } catch (e) {
      setError(e.message)
      setOpps(mockOpps.map((o) => ({ ...o, isReal: false })))
    } finally {
      setLoading(false)
    }
  }, [demoMode])

  // Load current user's signups so Apply buttons show the right state
  const loadMySignups = useCallback(async () => {
    if (!user || demoMode) return
    const { data } = await supabase
      .from('signups')
      .select('opportunity_id')
      .eq('volunteer_id', user.id)
      .in('status', ['applied', 'accepted'])
    if (data) setMySignups(new Set(data.map((s) => s.opportunity_id)))
  }, [user, demoMode])

  useEffect(() => {
    load()
    loadMySignups()
  }, [load, loadMySignups])

  // Derived lists for filters
  const locations = useMemo(
    () => ['All', ...new Set(opps.map((o) => o.location))],
    [opps],
  )

  const filtered = useMemo(() => {
    return opps.filter((opp) => {
      if (type !== 'All' && opp.type !== type) return false
      if (location !== 'All' && opp.location !== location) return false
      if (when !== 'all') {
        const date = new Date(opp.date)
        const now = new Date()
        const daysOut = (date - now) / (1000 * 60 * 60 * 24)
        if (when === 'week' && daysOut > 7) return false
        if (when === 'month' && daysOut > 31) return false
      }
      return true
    })
  }, [opps, type, location, when])

  // Apply to a real opportunity — creates a signup row in Supabase
  async function apply(opp) {
    if (!opp.isReal || demoMode) {
      // Mock mode: just flip the button locally
      setMySignups((prev) => new Set([...prev, opp.id]))
      return
    }
    if (!user) {
      navigate('/signin')
      return
    }
    setBusyId(opp.id)
    try {
      const { error: err } = await supabase
        .from('signups')
        .insert({ opportunity_id: opp.id, volunteer_id: user.id, status: 'applied' })
      if (err) throw err
      setMySignups((prev) => new Set([...prev, opp.id]))
    } catch (e) {
      window.alert(e.message || 'Could not apply. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        Opportunities near you
      </h1>
      <p className="mt-2 text-ink-700">
        Apply with one tap. Your hours are verified automatically when you check in and out.
      </p>

      {/* Filters */}
      <div className="mt-6 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', ...OPPORTUNITY_TYPES].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                type === t
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-ink-50 text-ink-700 hover:bg-primary-100 hover:text-primary-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-primary-500 focus:outline-none"
            aria-label="Filter by date"
          >
            <option value="all">Any date</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-primary-500 focus:outline-none"
            aria-label="Filter by location"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'All' ? 'All locations' : loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <p className="mt-12 text-sm text-ink-500">Loading opportunities…</p>
      ) : error ? (
        <p className="mt-12 text-sm font-semibold text-coral-600">{error}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((opp) => {
            const applied = mySignups.has(opp.id)
            const busy = busyId === opp.id
            return (
              <article
                key={opp.id}
                className="flex flex-col rounded-3xl border border-ink-100 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                    {opp.type}
                  </span>
                  <span className="text-xs font-semibold text-ink-500">{opp.hours} hrs</span>
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug text-ink-900">{opp.title}</h2>
                <p className="mt-0.5 text-sm font-semibold text-ink-500">{opp.org}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">{opp.description}</p>
                <dl className="mt-4 space-y-1 text-sm text-ink-700">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M8 2v4m8-4v4M3 9h18M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                    </svg>
                    {formatDate(opp.date)} · {opp.time}
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {opp.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 8a3 3 0 0 0-2-2.8M5 19a3 3 0 0 1 2-2.8" />
                    </svg>
                    {opp.spots} spots left
                  </div>
                </dl>
                {opp.youthContact && (
                  <p className="mt-3 rounded-lg bg-peach-100 px-3 py-2 text-xs font-semibold text-ink-700">
                    Adults need Tier 2 (youth-contact) clearance
                  </p>
                )}
                <button
                  type="button"
                  disabled={applied || busy}
                  onClick={() => apply(opp)}
                  className={`mt-4 rounded-full py-3 text-sm font-bold transition ${
                    applied
                      ? 'bg-primary-50 text-primary-700'
                      : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60'
                  }`}
                >
                  {busy ? '…' : applied ? '✓ Applied — see you there!' : 'Apply to volunteer'}
                </button>
              </article>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="mt-12 rounded-3xl border border-dashed border-ink-200 p-12 text-center">
          <p className="font-semibold text-ink-700">No opportunities match those filters yet.</p>
          <p className="mt-1 text-sm text-ink-500">
            Try widening your search — new opportunities post every week.
          </p>
        </div>
      )}
    </div>
  )
}
