import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Demo profile shown in demo mode (no Supabase configured) so the dashboard
// stays previewable before the backend is connected. Signed-in students see
// their own live data instead — see loadDashboard() below.
const demoProfile = {
  name: 'Maya Rodriguez',
  role: 'youth',
  school: 'Mahopac High School',
  grade: '11th',
  totalHours: 127.5,
  hoursByYear: [
    { year: '9th grade (2024–25)', hours: 32, max: 60 },
    { year: '10th grade (2025–26)', hours: 41.5, max: 60 },
    { year: '11th grade (2026–27)', hours: 54, max: 60 },
    { year: '12th grade (2027–28)', hours: 0, max: 60 },
  ],
  upcoming: [
    { id: 'demo-u1', title: 'Lake Mahopac Shoreline Cleanup', org: 'Friends of Lake Mahopac', date: 'Sat, Jul 18 · 8:30 AM' },
    { id: 'demo-u2', title: 'Water Station — Community 5K', org: 'Links of Love Inc.', date: 'Sun, Aug 2 · 7:00 AM' },
  ],
  recent: [
    { id: 'demo-r1', title: 'Food Pantry Shelf Stocking', org: 'Putnam Community Food Pantry', date: 'Jun 28, 2026', hours: 3 },
    { id: 'demo-r2', title: 'Bingo Afternoon', org: 'Mahopac Senior Center', date: 'Jun 15, 2026', hours: 3 },
    { id: 'demo-r3', title: 'Reading Buddies (K–2)', org: 'Mahopac Public Library', date: 'Jun 9, 2026', hours: 1.5 },
  ],
  allVerified: [
    { id: 'demo-r1', title: 'Food Pantry Shelf Stocking', org: 'Putnam Community Food Pantry', date: 'Jun 28, 2026', hours: 3 },
    { id: 'demo-r2', title: 'Bingo Afternoon', org: 'Mahopac Senior Center', date: 'Jun 15, 2026', hours: 3 },
    { id: 'demo-r3', title: 'Reading Buddies (K–2)', org: 'Mahopac Public Library', date: 'Jun 9, 2026', hours: 1.5 },
  ],
  external: [
    { id: 'demo-e1', org: 'St. John’s Soup Kitchen', date: 'Jul 4, 2026', hours: 4, supervisor: 'Deacon Ruiz', status: 'pending' },
    { id: 'demo-e2', org: 'Carmel Animal Shelter', date: 'Jun 21, 2026', hours: 2.5, supervisor: 'K. Byrne', status: 'pending' },
  ],
  demo: true,
}

const barGradients = [
  'from-primary-400 to-primary-600',
  'from-magenta-500 to-magenta-600',
  'from-coral-400 to-coral-500',
  'from-ink-200 to-ink-200',
]

// School year runs July–June: summer hours count toward the coming grade, which
// matches how the platform frames a student's yearly service total. Returns a
// label like "2026–27".
function academicYear(dateStr) {
  const d = new Date(dateStr)
  const start = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}–${String((start + 1) % 100).padStart(2, '0')}`
}

function formatShiftDate(iso) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

function formatLogDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Turn a numeric like 127.5 into a clean display value (drops trailing zeros).
function round(n, places = 1) {
  return Number(Number(n || 0).toFixed(places))
}

// Escape a single CSV field: wrap in quotes and double any embedded quotes so
// commas, quotes, and newlines in org names survive a spreadsheet import.
function csvField(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Build a CSV of the student's hours: verified shifts plus self-logged external
// hours, one row each. Columns: Date, Organization, Hours, Type, Status.
function buildHoursCsv(profile) {
  const header = ['Date', 'Organization', 'Hours', 'Type', 'Status']
  const verifiedRows = (profile.allVerified ?? profile.recent ?? []).map((r) => [
    r.date,
    r.org || r.title || '',
    r.hours,
    'Verified',
    'Verified',
  ])
  const externalRows = (profile.external ?? []).map((r) => [
    r.date,
    r.org || '',
    r.hours,
    'Self-Reported',
    r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Pending',
  ])
  return [header, ...verifiedRows, ...externalRows]
    .map((row) => row.map(csvField).join(','))
    .join('\r\n')
}

// Trigger a browser download of the given text as a file, using a Blob object
// URL. Revoked after the click so we don't leak the URL.
function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Visual treatment for a self-logged entry's verification status.
const statusStyles = {
  pending: { label: 'Pending', className: 'bg-peach-100 text-coral-600' },
  approved: { label: 'Approved', className: 'bg-primary-50 text-primary-700' },
  rejected: { label: 'Rejected', className: 'bg-ink-100 text-ink-500' },
}

/**
 * Fetches the signed-in student's profile, upcoming shifts, and verified hours
 * and shapes them into the same structure the presentational view expects.
 *
 * Three reads, run together:
 *   - profiles: name / school / grade (own-row via RLS)
 *   - signups → opportunities → organizations: upcoming shifts
 *   - hour_logs → signups → opportunities → organizations: verified hours
 */
async function loadDashboard(user) {
  const [profileRes, signupsRes, hoursRes, externalRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, school, grade, role, verification_status, id_photo_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('signups')
      .select('id, status, opportunities ( id, title, starts_at, organizations ( name ) )')
      .eq('volunteer_id', user.id)
      .in('status', ['applied', 'accepted']),
    supabase
      .from('hour_logs')
      .select(
        'id, hours, checked_in_at, checked_out_at, signups!inner ( volunteer_id, opportunities ( title, organizations ( name ) ) )',
      )
      .eq('signups.volunteer_id', user.id)
      .not('checked_out_at', 'is', null)
      .order('checked_in_at', { ascending: false }),
    supabase
      .from('external_hour_logs')
      .select('id, org_name, service_date, hours, supervisor_name, status, created_at')
      .eq('user_id', user.id)
      .order('service_date', { ascending: false }),
  ])

  if (profileRes.error) throw profileRes.error
  if (signupsRes.error) throw signupsRes.error
  if (hoursRes.error) throw hoursRes.error
  // External hours are a non-critical, additive section. If the query fails
  // (e.g. the external_hour_logs migration hasn't been applied yet), degrade to
  // an empty list rather than taking down the whole dashboard.
  if (externalRes.error) {
    console.warn('Could not load external hour logs:', externalRes.error.message)
  }

  const profile = profileRes.data
  const meta = user.user_metadata ?? {}

  // Be defensive: the DB trigger auto-creates the profile row on signup, but if
  // it hasn't propagated yet fall back to the sign-up metadata, then email.
  const first = profile?.first_name || meta.first_name || ''
  const last = profile?.last_name || meta.last_name || ''
  const name = `${first} ${last}`.trim() || user.email || 'Volunteer'

  // Upcoming shifts: future, still-active signups, soonest first.
  const now = Date.now()
  const upcoming = (signupsRes.data ?? [])
    .filter((s) => s.opportunities?.starts_at && new Date(s.opportunities.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.opportunities.starts_at) - new Date(b.opportunities.starts_at))
    .map((s) => ({
      id: s.id,
      title: s.opportunities.title,
      org: s.opportunities.organizations?.name ?? '',
      date: formatShiftDate(s.opportunities.starts_at),
    }))

  // Verified hours: total, grouped by school year, plus the most recent few.
  const logs = hoursRes.data ?? []
  const totalHours = round(
    logs.reduce((sum, l) => sum + Number(l.hours || 0), 0),
  )

  const byYear = new Map()
  for (const log of logs) {
    const label = academicYear(log.checked_in_at)
    byYear.set(label, (byYear.get(label) ?? 0) + Number(log.hours || 0))
  }
  const hoursByYear = [...byYear.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([year, hours]) => ({ year: `${year} school year`, hours: round(hours), max: 60 }))

  const allVerified = logs.map((l) => ({
    id: l.id,
    title: l.signups?.opportunities?.title ?? 'Volunteer shift',
    org: l.signups?.opportunities?.organizations?.name ?? '',
    date: formatLogDate(l.checked_in_at),
    hours: round(l.hours, 2),
  }))
  // The card only shows the five most recent; export uses the full list.
  const recent = allVerified.slice(0, 5)

  // Self-logged external hours (any organization), newest first.
  const external = (externalRes.data ?? []).map((row) => ({
    id: row.id,
    org: row.org_name,
    date: formatLogDate(row.service_date),
    hours: round(row.hours, 2),
    supervisor: row.supervisor_name,
    status: row.status,
  }))

  return {
    name,
    school: profile?.school ?? '',
    grade: profile?.grade ?? '',
    role: profile?.role ?? meta.role ?? '',
    verificationStatus: profile?.verification_status ?? meta.verification_status ?? '',
    idPhotoUrl: profile?.id_photo_url ?? null,
    profileMissing: !profile,
    totalHours,
    hoursByYear,
    upcoming,
    recent,
    allVerified,
    external,
  }
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14" aria-busy="true" aria-label="Loading your dashboard">
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-ink-100" />
          <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
        </div>
        <div className="h-20 w-40 animate-pulse rounded-2xl bg-ink-100" />
      </div>
      <div className="mt-8 h-56 animate-pulse rounded-3xl bg-ink-50" />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-ink-50" />
        <div className="h-48 animate-pulse rounded-3xl bg-ink-50" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  // Demo mode (no Supabase): keep the previewable demo profile and its banner.
  const demoMode = !isSupabaseConfigured
  const [profile, setProfile] = useState(demoMode ? demoProfile : null)
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (demoMode || !user) return

    let active = true
    setLoading(true)
    setError(null)

    loadDashboard(user)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [demoMode, user])

  if (loading) return <Skeleton />

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-ink-900">We couldn&apos;t load your dashboard</p>
          <p className="mt-2 text-sm text-ink-500">
            Something went wrong reaching our servers. Please refresh to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  // Only students (role 'youth') self-log hours and track a service total.
  // Adults and orgs get a simpler dashboard: who they are, what's coming up,
  // and where they've volunteered — no hour count, no self-logging.
  const isYouth = profile.role === 'youth'

  // Adults (anyone who isn't a student) must clear identity verification before
  // using the app. Students are never gated. Two banner states while 'pending':
  // not-yet-submitted (prompt to verify) and submitted-and-under-review.
  // 'verified' / 'cleared' show nothing.
  const needsVerification = !isYouth && profile.verificationStatus === 'pending'
  const awaitingReview = needsVerification && Boolean(profile.idPhotoUrl)

  const roleLabel =
    profile.role === 'org'
      ? 'Organization'
      : profile.role === 'adult'
        ? 'Adult volunteer'
        : 'Volunteer'
  const subtitle =
    [profile.grade && `${profile.grade} grade`, profile.school].filter(Boolean).join(' · ') ||
    roleLabel

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {profile.demo && (
        <div className="rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          Demo dashboard — sign in with Supabase connected to see your own live data.
        </div>
      )}

      {profile.profileMissing && (
        <div className="rounded-xl bg-peach-100 px-4 py-3 text-sm font-medium text-ink-700">
          We&apos;re still finishing setting up your profile. Some details may appear shortly.
        </div>
      )}

      {needsVerification && (
        awaitingReview ? (
          <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <p className="text-sm font-medium leading-relaxed text-primary-900">
              Your ID is under review. We&apos;ll activate your account within 24 hours.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-peach-200 bg-peach-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium leading-relaxed text-ink-700">
              Your account is pending identity verification.
            </p>
            <Link
              to="/verify-identity"
              className="shrink-0 self-start rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 sm:self-auto"
            >
              Complete verification →
            </Link>
          </div>
        )
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">{profile.name}</h1>
          <p className="mt-1 font-semibold text-ink-500">{subtitle}</p>
        </div>
        {isYouth && (
          <div className="flex items-center gap-3">
            <Link
              to="/log-hours"
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Log hours
            </Link>
            <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-magenta-600 px-6 py-4 text-white shadow-lg shadow-primary-600/20">
              <p className="text-xs font-bold uppercase tracking-wide text-white/75">Verified hours</p>
              <p className="text-3xl font-extrabold">{profile.totalHours}</p>
            </div>
          </div>
        )}
      </div>

      {isYouth && (
        <>
      {/* Hours by school year */}
      <section className="mt-8 rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Hours by school year</h2>
          <button
            type="button"
            onClick={() => {
              const slug = (profile.name || 'volunteer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
              downloadCsv(`showup-hours-${slug || 'volunteer'}.csv`, buildHoursCsv(profile))
            }}
            className="rounded-full border border-ink-200 px-4 py-1.5 text-xs font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700"
          >
            Export report
          </button>
        </div>
        {profile.hoursByYear.length > 0 ? (
          <div className="mt-5 space-y-4">
            {profile.hoursByYear.map((row, i) => (
              <div key={row.year}>
                <div className="flex justify-between text-sm font-semibold text-ink-700">
                  <span>{row.year}</span>
                  <span>{row.hours} hrs</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-ink-50">
                  <div
                    className={`h-3 rounded-full bg-gradient-to-r ${barGradients[i % barGradients.length]}`}
                    style={{ width: `${Math.min(Math.max((row.hours / row.max) * 100, 2), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink-500">
            No verified hours yet. Check in and out of a shift and they&apos;ll show up here.
          </p>
        )}
      </section>

      {/* Self-logged external hours awaiting verification */}
      <section className="mt-6 rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Pending verification</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Hours you logged yourself — they count once a reviewer approves them.
            </p>
          </div>
          <Link
            to="/log-hours"
            className="shrink-0 rounded-full border border-ink-200 px-4 py-1.5 text-xs font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700"
          >
            Log hours
          </Link>
        </div>
        {profile.external?.length > 0 ? (
          <ul className="mt-5 divide-y divide-ink-100">
            {profile.external.map((entry) => {
              const badge = statusStyles[entry.status] ?? statusStyles.pending
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{entry.org}</p>
                    <p className="text-sm text-ink-500">
                      {[entry.date, `${entry.hours} hrs`, entry.supervisor && `Supv. ${entry.supervisor}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-ink-500">
            Volunteered somewhere outside ShowUp?{' '}
            <Link to="/log-hours" className="font-bold text-primary-600 hover:underline">
              Log those hours
            </Link>{' '}
            and we&apos;ll verify them.
          </p>
        )}
      </section>
        </>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Upcoming */}
        <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">Upcoming shifts</h2>
          {profile.upcoming.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {profile.upcoming.map((shift) => (
                <li key={shift.id} className="rounded-2xl bg-primary-50 p-4">
                  <p className="font-bold text-ink-900">{shift.title}</p>
                  <p className="text-sm text-ink-700">{shift.org}</p>
                  <p className="mt-1 text-sm font-semibold text-primary-700">{shift.date}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-500">No upcoming shifts yet.</p>
          )}
          <Link
            to="/opportunities"
            className="mt-4 inline-block text-sm font-bold text-primary-600 hover:underline"
          >
            Find more opportunities →
          </Link>
        </section>

        {/* Recent verified */}
        <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">
            {isYouth ? 'Recently verified' : 'Past volunteering'}
          </h2>
          {profile.recent.length > 0 ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {profile.recent.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold text-ink-900">{entry.title}</p>
                    <p className="text-sm text-ink-500">
                      {[entry.org, entry.date].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700">
                    +{entry.hours}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-500">
              {isYouth
                ? 'Nothing verified yet — your completed shifts will appear here.'
                : 'No past shifts yet — events you volunteer at will appear here.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
