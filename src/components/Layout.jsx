import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Logo, { LogoMark } from './Logo.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const navLinks = [
  { to: '/opportunities', label: 'Browse opportunities' },
  { to: '/organizations', label: 'For organizations' },
  { to: '/support', label: 'Support us' },
  { to: '/dashboard', label: 'My dashboard' },
]

// Internal admin tools — only surfaced to signed-in users with role 'admin'.
const adminLinks = [
  { to: '/admin', label: 'ID Review' },
  { to: '/admin/hours', label: 'Hours Review' },
  { to: '/admin/org-applications', label: 'Org Applications' },
]

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { session, user, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrg, setIsOrg] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Check whether the signed-in user has the 'admin' role on their profile so we
  // can conditionally reveal the internal admin tools in the nav. Demo mode has
  // no backend, so there is never an admin session there.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      // Reset BOTH flags so role-gated nav links disappear on sign-out.
      setIsAdmin(false)
      setIsOrg(false)
      return
    }

    let active = true
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) {
          setIsAdmin(!error && data?.role === 'admin')
          setIsOrg(!error && data?.role === 'org')
        }
      })

    return () => {
      active = false
    }
  }, [user])

  async function handleSignOut() {
    setMenuOpen(false)
    // Leave any protected page first so clearing the session doesn't bounce the
    // student through the sign-in redirect on the way to the home page.
    navigate('/')
    await signOut()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" onClick={() => setMenuOpen(false)} aria-label="ShowUp home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${
                    isActive ? 'text-primary-600' : 'text-ink-700 hover:text-primary-600'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {isAdmin &&
              adminLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `text-sm font-semibold transition-colors ${
                      isActive ? 'text-primary-600' : 'text-ink-700 hover:text-primary-600'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            {isOrg && (
              <NavLink
                to="/org/post"
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${
                    isActive ? 'text-primary-600' : 'text-ink-700 hover:text-primary-600'
                  }`
                }
              >
                Post opportunity
              </NavLink>
            )}
            {session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-ink-200 px-5 py-2.5 text-sm font-bold text-ink-700 transition hover:border-primary-300 hover:text-primary-700"
              >
                Sign out
              </button>
            ) : (
              <>
                <NavLink
                  to="/signin"
                  className={({ isActive }) =>
                    `text-sm font-semibold transition-colors ${
                      isActive ? 'text-primary-600' : 'text-ink-700 hover:text-primary-600'
                    }`
                  }
                >
                  Log in
                </NavLink>
                <Link
                  to="/signup"
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
                >
                  Sign up free
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-ink-700 hover:bg-ink-50 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-ink-100 bg-surface px-4 pb-4 pt-2 md:hidden">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-3 text-base font-semibold ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700 hover:bg-ink-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {isAdmin &&
              adminLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-base font-semibold ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700 hover:bg-ink-50'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            {isOrg && (
              <NavLink
                to="/org/post"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-3 text-base font-semibold ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700 hover:bg-ink-50'
                  }`
                }
              >
                Post opportunity
              </NavLink>
            )}
            {session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-2 block w-full rounded-full border border-ink-200 px-5 py-3 text-center text-base font-bold text-ink-700"
              >
                Sign out
              </button>
            ) : (
              <>
                <NavLink
                  to="/signin"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-base font-semibold ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700 hover:bg-ink-50'
                    }`
                  }
                >
                  Log in
                </NavLink>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 block rounded-full bg-primary-600 px-5 py-3 text-center text-base font-bold text-white"
                >
                  Sign up free
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="border-t border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8" />
              <div>
                <p className="font-extrabold tracking-tight text-ink-900">
                  Show<span className="text-primary-600">Up</span>
                </p>
                <p className="text-xs text-ink-500">A Links of Love Inc. initiative · Mahopac, NY</p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-700">
              <Link to="/opportunities" className="hover:text-primary-600">Opportunities</Link>
              <Link to="/organizations" className="hover:text-primary-600">Organizations</Link>
              <Link to="/signup" className="hover:text-primary-600">Volunteer signup</Link>
              <Link to="/support" className="hover:text-primary-600">Support us</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs text-ink-500">
            © 2026 Links of Love Inc., a 501(c)(3) nonprofit. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
