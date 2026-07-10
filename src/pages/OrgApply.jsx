import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

const TRANSLATIONS = {
  en: {
    badge: 'For organizations',
    heading: 'Bring your mission to more people.',
    subheading:
      'Tell us a little about your organization. We review every partner personally and reach out within 2 business days. No commitments, no pressure.',
    card1Heading: 'About your organization',
    orgName: 'Organization name *',
    orgNamePlaceholder: 'Links of Love Inc.',
    contactName: 'Your name *',
    contactNamePlaceholder: 'Jane Smith',
    contactTitle: 'Title / Role *',
    contactTitlePlaceholder: 'Executive Director',
    email: 'Email *',
    emailPlaceholder: 'you@yourorg.org',
    phone: 'Phone *',
    phonePlaceholder: '(914) 555-0100',
    website: 'Website (if you have one)',
    websitePlaceholder: 'https://yourorg.org',
    ein: 'EIN (for 501c3 orgs)',
    einPlaceholder: 'XX-XXXXXXX',
    einHelper:
      "If you're a registered nonprofit, your EIN helps us confirm your status and may qualify you for a community rate.",
    card2Heading: 'Your mission',
    card2Sub: 'Help us get to know you before we connect.',
    missionLabel: 'What does your organization do?',
    missionPlaceholder:
      'Share a little about your work, who you serve, and what you stand for.',
    eventsLabel: 'What kinds of events do you typically run?',
    eventsPlaceholder:
      'Community cleanups, food drives, youth workshops, seasonal celebrations…',
    submit: 'Send your interest',
    submitting: 'Sending…',
    followUp: "We'll be in touch within 2 business days.",
    signUpCopy: 'Ready to set up your account and choose a plan?',
    signUpLink: 'Sign up here',
    errorRequired:
      'Organization name, your name, title, phone, and email are all required.',
    successHeading: "You're in!",
    successBody:
      "We'll review your interest and be in touch within 2 business days. We can't wait to learn more about",
    successBrowse: 'Browse opportunities',
    successHome: 'Back to home',
    demoNote: 'Demo mode: connect Supabase to store real applications.',
  },
  es: {
    badge: 'Para organizaciones',
    heading: 'Lleva tu misión a más personas.',
    subheading:
      'Cuéntanos un poco sobre tu organización. Revisamos a cada socio de forma personal y nos ponemos en contacto en 2 días hábiles. Sin compromisos, sin presión.',
    card1Heading: 'Tu organización',
    orgName: 'Nombre de la organización *',
    orgNamePlaceholder: 'Links of Love Inc.',
    contactName: 'Tu nombre *',
    contactNamePlaceholder: 'Jane Smith',
    contactTitle: 'Título / Cargo *',
    contactTitlePlaceholder: 'Directora Ejecutiva',
    email: 'Correo electrónico *',
    emailPlaceholder: 'tu@tuorg.org',
    phone: 'Teléfono *',
    phonePlaceholder: '(914) 555-0100',
    website: 'Sitio web (si tienes uno)',
    websitePlaceholder: 'https://tuorg.org',
    ein: 'EIN (para organizaciones sin fines de lucro)',
    einPlaceholder: 'XX-XXXXXXX',
    einHelper:
      'Si eres una organización sin fines de lucro registrada, tu EIN nos ayuda a confirmar tu estado y puede darte acceso a una tarifa comunitaria.',
    card2Heading: 'Tu misión',
    card2Sub: 'Cuéntanos un poco antes de que nos conectemos.',
    missionLabel: '¿Qué hace tu organización?',
    missionPlaceholder:
      'Cuéntanos un poco sobre tu trabajo, a quiénes sirves y lo que representas.',
    eventsLabel: '¿Qué tipo de eventos organizas normalmente?',
    eventsPlaceholder:
      'Limpiezas comunitarias, colectas de alimentos, talleres juveniles, celebraciones de temporada…',
    submit: 'Enviar mi interés',
    submitting: 'Enviando…',
    followUp: 'Nos pondremos en contacto en 2 días hábiles.',
    signUpCopy: '¿Listo para crear tu cuenta y elegir un plan?',
    signUpLink: 'Regístrate aquí',
    errorRequired:
      'El nombre de la organización, tu nombre, cargo, teléfono y correo son obligatorios.',
    successHeading: '¡Listo!',
    successBody:
      'Revisaremos tu información y nos pondremos en contacto en 2 días hábiles. Estamos ansiosos por conocer más sobre',
    successBrowse: 'Ver oportunidades',
    successHome: 'Volver al inicio',
    demoNote: 'Modo demo: conecta Supabase para guardar solicitudes reales.',
  },
}

export default function OrgApply() {
  const [lang, setLang] = useState('en')
  const [form, setForm] = useState({
    orgName: '',
    contactName: '',
    contactTitle: '',
    email: '',
    phone: '',
    website: '',
    ein: '',
    mission: '',
    eventTypes: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const t = TRANSLATIONS[lang]

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (
      !form.orgName.trim() ||
      !form.contactName.trim() ||
      !form.contactTitle.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      setError(t.errorRequired)
      return
    }

    const missionText = [
      form.contactTitle.trim() ? `Title / Role: ${form.contactTitle.trim()}` : '',
      form.mission.trim(),
      form.eventTypes.trim() ? `Types of events: ${form.eventTypes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    setSubmitting(true)
    try {
      if (isSupabaseConfigured) {
        const { error: insertError } = await supabase.from('org_applications').insert({
          org_name: form.orgName.trim(),
          contact_name: form.contactName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          website: form.website.trim() || null,
          ein: form.ein.trim() || null,
          plan: 'community',
          mission: missionText || null,
        })
        if (insertError) throw insertError
      } else {
        await new Promise((resolve) => setTimeout(resolve, 700))
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-primary-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4 10-11" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
          {t.successHeading}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">
          {t.successBody}{' '}
          <span className="font-semibold">{form.orgName}</span>.
        </p>
        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-peach-100 px-4 py-3 text-sm text-ink-700">
            {t.demoNote}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/opportunities"
            className="rounded-full bg-primary-600 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-primary-700"
          >
            {t.successBrowse}
          </Link>
          <Link
            to="/"
            className="rounded-full border border-ink-200 px-7 py-3.5 text-sm font-bold text-ink-700 transition hover:border-primary-300 hover:text-primary-700"
          >
            {t.successHome}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      {/* Language toggle */}
      <div className="flex justify-end mb-6">
        <div className="inline-flex rounded-full border border-ink-200 bg-white p-0.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded-full px-4 py-1.5 transition ${
              lang === 'en'
                ? 'bg-primary-600 text-white'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('es')}
            className={`rounded-full px-4 py-1.5 transition ${
              lang === 'es'
                ? 'bg-primary-600 text-white'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            Español
          </button>
        </div>
      </div>

      {/* Header */}
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-700">
          {t.badge}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t.heading}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-700">{t.subheading}</p>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="mt-10 space-y-5">
        {/* Card 1: Org details */}
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-ink-900">{t.card1Heading}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Org name — full width */}
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-ink-900">{t.orgName}</span>
              <input
                className={inputClass}
                value={form.orgName}
                onChange={set('orgName')}
                placeholder={t.orgNamePlaceholder}
              />
            </label>

            {/* Contact name */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.contactName}</span>
              <input
                className={inputClass}
                value={form.contactName}
                onChange={set('contactName')}
                placeholder={t.contactNamePlaceholder}
              />
            </label>

            {/* Title / Role */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.contactTitle}</span>
              <input
                className={inputClass}
                value={form.contactTitle}
                onChange={set('contactTitle')}
                placeholder={t.contactTitlePlaceholder}
              />
            </label>

            {/* Email */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.email}</span>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={set('email')}
                placeholder={t.emailPlaceholder}
              />
            </label>

            {/* Phone — now required */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.phone}</span>
              <input
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={set('phone')}
                placeholder={t.phonePlaceholder}
              />
            </label>

            {/* Website — optional, encouraging copy */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.website}</span>
              <input
                className={inputClass}
                value={form.website}
                onChange={set('website')}
                placeholder={t.websitePlaceholder}
              />
            </label>

            {/* EIN — optional, with helper text */}
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.ein}</span>
              <input
                className={inputClass}
                value={form.ein}
                onChange={set('ein')}
                placeholder={t.einPlaceholder}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{t.einHelper}</p>
            </label>
          </div>
        </div>

        {/* Card 2: Mission */}
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-ink-900">{t.card2Heading}</h2>
          <p className="mt-1 text-sm text-ink-500">{t.card2Sub}</p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.missionLabel}</span>
              <textarea
                rows={3}
                className={inputClass}
                value={form.mission}
                onChange={set('mission')}
                placeholder={t.missionPlaceholder}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-900">{t.eventsLabel}</span>
              <textarea
                rows={3}
                className={inputClass}
                value={form.eventTypes}
                onChange={set('eventTypes')}
                placeholder={t.eventsPlaceholder}
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary-600 px-10 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? t.submitting : t.submit}
          </button>
          <p className="text-sm text-ink-500">{t.followUp}</p>
        </div>

        <p className="text-xs text-ink-500">
          {t.signUpCopy}{' '}
          <Link to="/organizations" className="font-semibold text-primary-600 hover:underline">
            {t.signUpLink}
          </Link>
        </p>
      </form>
    </div>
  )
}
