import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const steps = [
  {
    title: 'Sign up free',
    body: 'Students, adults, families — create your volunteer profile in under two minutes. Youth accounts include parental consent built in.',
    color: 'bg-primary-100 text-primary-700',
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    ),
  },
  {
    title: 'Show up & check in',
    body: 'Browse local opportunities, apply with one tap, and check in on-site. Organizations verify every hour you serve.',
    color: 'bg-coral-100 text-coral-600',
    icon: <path d="M9 12.5l2 2 4.5-5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
  },
  {
    title: 'Watch your hours grow',
    body: 'Every verified hour lands in your portfolio automatically — organized by school year for college apps, scholarships, and service awards.',
    color: 'bg-peach-100 text-magenta-600',
    icon: <path d="M4 19V10m5.5 9V5m5.5 14v-7m5 7V8" />,
  },
]

const safetyTiers = [
  {
    label: 'Youth volunteers',
    detail: 'Parental consent required at signup. Parents stay in the loop on every application.',
  },
  {
    label: 'Tier 1 · General adults',
    detail: 'ID verification for opportunities with no direct child contact.',
  },
  {
    label: 'Tier 2 · Youth-contact adults',
    detail: 'Full background check required before working alongside minors. No exceptions.',
  },
]

// The three-beat pitch shown as dark tiles in the hero's right column.
const heroSteps = [
  {
    number: '01',
    label: 'Find it',
    description: 'Browse local opportunities and apply with one tap.',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    number: '02',
    label: 'Show up',
    description: 'Check in on-site — your time is tracked for you.',
    icon: <path d="M9 12.5l2 2 4.5-5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
  },
  {
    number: '03',
    label: 'Get credit',
    description: 'Verified hours land in your portfolio automatically.',
    icon: (
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8L12 3Z" />
    ),
  },
]

/**
 * Community impact counters for the hero. Reads the public_stats() database
 * function (aggregate counts only — it exposes no personal data). Anything
 * short of a clean answer — demo mode, function not created yet, network
 * error — resolves to zeros so the hero never breaks.
 */
function useCommunityStats() {
  const [stats, setStats] = useState(null) // null = still loading

  useEffect(() => {
    let active = true
    const zeros = { hours: 0, students: 0, orgs: 0 }

    if (!isSupabaseConfigured) {
      setStats(zeros)
      return
    }

    supabase
      .rpc('public_stats')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setStats(zeros)
          return
        }
        const row = Array.isArray(data) ? data[0] : data
        setStats({
          hours: Math.round(Number(row?.hours_logged ?? 0)),
          students: Number(row?.student_volunteers ?? 0),
          orgs: Number(row?.organizations ?? 0),
        })
      })

    return () => {
      active = false
    }
  }, [])

  return stats
}

export default function Landing() {
  const stats = useCommunityStats()
  const heroStats = [
    { label: 'Hours Logged', value: stats?.hours },
    { label: 'Student Volunteers', value: stats?.students },
    { label: 'Organizations', value: stats?.orgs },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-primary-50 via-surface to-coral-50"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 md:grid-cols-2 md:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-700">
              Mahopac, New York
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-6xl">
              Show up for your community.
              <span className="block bg-gradient-to-r from-primary-600 via-magenta-500 to-coral-400 bg-clip-text text-transparent">
                We&apos;ll keep the record.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-700">
              ShowUp connects volunteers with local organizations that need them — and turns
              every verified hour into a portfolio students can take to college and beyond.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="rounded-full bg-primary-600 px-8 py-4 text-center text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
              >
                I want to volunteer
              </Link>
              <Link
                to="/organizations"
                className="rounded-full border-2 border-ink-200 bg-white px-8 py-4 text-center text-base font-bold text-ink-900 transition hover:border-primary-300 hover:text-primary-700"
              >
                Post opportunities
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-500">
              Free for volunteers, always. Built for grades 9–12, open to everyone.
            </p>
          </div>

          {/* Right column: the three-beat pitch plus live community counters.
              min-w-0 lets the grid column shrink below its content's natural
              width on small screens instead of overflowing the viewport. */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-4">
              {heroSteps.map((step) => (
                <div
                  key={step.number}
                  className="bg-surface-dark rounded-xl p-4 flex items-center gap-4 border border-white/10 shadow-lg shadow-ink-900/10"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8553E]/15">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6 text-[#E8553E]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {step.icon}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      <span className="mr-2 text-sm font-extrabold text-[#E8553E]">{step.number}</span>
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-sm text-white/60">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-2">
              {heroStats.map((stat) => (
                <div key={stat.label} className="text-center">
                  {stats === null ? (
                    <div className="mx-auto h-9 w-16 animate-pulse rounded-lg bg-ink-100" />
                  ) : (
                    <p className="text-3xl font-extrabold text-[#E8553E]">
                      {Number(stat.value ?? 0).toLocaleString()}
                    </p>
                  )}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          How ShowUp works
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm"
            >
              <div className={`inline-flex rounded-2xl p-3 ${step.color}`}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {step.icon}
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built for students */}
      <section className="bg-ink-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-coral-300">
              Built for students
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Four years of service, one verified record.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-300">
              From freshman year to graduation, ShowUp tracks every hour — verified by the
              organization on-site, organized by school year, and ready to export for college
              applications, National Honor Society, and scholarship deadlines.
            </p>
            <Link
              to="/signup"
              className="mt-7 inline-block rounded-full bg-coral-400 px-7 py-3.5 text-sm font-bold text-ink-900 transition hover:bg-coral-300"
            >
              Start your portfolio
            </Link>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <p className="font-bold">Maya R. · Grade 11</p>
              <p className="text-sm text-ink-300">Mahopac High School</p>
            </div>
            <p className="mt-4 text-4xl font-extrabold">
              127.5 <span className="text-lg font-semibold text-ink-300">verified hours</span>
            </p>
            <div className="mt-5 space-y-3">
              {[
                ['9th grade', 32, 'from-primary-400 to-primary-500', 'w-[45%]'],
                ['10th grade', 41.5, 'from-magenta-500 to-magenta-600', 'w-[58%]'],
                ['11th grade', 54, 'from-coral-400 to-coral-500', 'w-[75%]'],
                ['12th grade', 0, 'from-ink-300 to-ink-300', 'w-[2%]'],
              ].map(([year, hours, gradient, width]) => (
                <div key={year}>
                  <div className="flex justify-between text-xs font-semibold text-ink-300">
                    <span>{year}</span>
                    <span>{hours} hrs</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-white/10">
                    <div className={`h-2.5 rounded-full bg-gradient-to-r ${gradient} ${width}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
              Safety first
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Every volunteer verified. Every kid protected.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-700">
              ShowUp uses a tiered verification system so families and organizations always know
              who&apos;s in the room. Adults never work directly with minors without a completed
              background check.
            </p>
          </div>
          <div className="space-y-4">
            {safetyTiers.map((tier) => (
              <div
                key={tier.label}
                className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" />
                    <path d="M9.5 12l2 2 3.5-4" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-ink-900">{tier.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700">{tier.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Org CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-magenta-600 to-coral-500 p-8 text-white sm:p-12">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <LogoMark className="h-10 w-10" />
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Run an organization? Fill every shift.
              </h2>
              <p className="mt-2 leading-relaxed text-white/85">
                Post opportunities, manage signups, check volunteers in and out, and export
                verified hour reports — all in one place.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                to="/organizations/apply"
                className="rounded-full bg-white px-8 py-4 text-center text-base font-bold text-primary-700 shadow-lg transition hover:bg-primary-50"
              >
                List your organization
              </Link>
              <Link
                to="/organizations"
                className="rounded-full border border-white/30 px-8 py-4 text-center text-base font-bold text-white transition hover:bg-white/10"
              >
                See plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
