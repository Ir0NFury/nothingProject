import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'

const navLink = 'hover:underline aria-[current=page]:font-semibold'

export function Layout() {
  const { user, status, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState<string | null>(null)

  // Never rejects: the button just does `void handleLogout()`.
  async function handleLogout() {
    setLogoutError(null)
    try {
      await logout()
      // Also stops the next login in this tab from being sent back to the previous user's page.
      navigate('/')
    } catch {
      setLogoutError('Logout failed. Please try again.')
    }
  }

  return (
    <>
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link to="/" className="text-lg font-bold">
          Interview Prep
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-4 text-sm">
          {status === 'guest' && (
            <>
              {/* NavLink marks the current page with aria-current, so the style follows the markup. */}
              <NavLink to="/login" className={navLink}>
                Login
              </NavLink>
              <NavLink to="/register" className={navLink}>
                Register
              </NavLink>
            </>
          )}
          {status === 'authed' && user && (
            <>
              {user.role === 'admin' && (
                <NavLink to="/admin" className={navLink}>
                  Admin
                </NavLink>
              )}
              <NavLink to="/profile" className={navLink}>
                Profile
              </NavLink>
              <span className="text-neutral-500 dark:text-neutral-400">{user.email}</span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Logout
              </button>
            </>
          )}
        </nav>
        {logoutError && (
          <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-400">
            {logoutError}
          </p>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <Outlet />
      </main>
    </>
  )
}
