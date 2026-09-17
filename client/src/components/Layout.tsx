import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'

export function Layout() {
  const { user, status, logout } = useAuth()

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
              <button type="button" onClick={() => void logout()}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
