import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { CredentialsForm } from '../components/CredentialsForm'
import { getRedirectTarget } from './redirectTarget'

export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()

  // Covers both "already logged in" and "just logged in".
  if (status === 'authed') return <Navigate to={getRedirectTarget(location.state)} replace />

  return (
    <section>
      <h1>Log in</h1>
      <CredentialsForm submitLabel="Log in" passwordAutoComplete="current-password" onSubmit={login} />
      <p>
        No account? <Link to="/register" state={location.state}>Register</Link>
      </p>
    </section>
  )
}
