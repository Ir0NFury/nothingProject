import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'

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
      <header className="site-header">
        <Link to="/" className="brand">
          Interview Prep
        </Link>
        <nav aria-label="Main">
          {status === 'guest' && (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
          {status === 'authed' && user && (
            <>
              {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
              <NavLink to="/profile">Profile</NavLink>
              <span className="user-email">{user.email}</span>
              <button type="button" onClick={() => void handleLogout()}>
                Logout
              </button>
            </>
          )}
        </nav>
        {logoutError && <p role="alert" className="form-error">{logoutError}</p>}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
