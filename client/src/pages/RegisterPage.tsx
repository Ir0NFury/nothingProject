import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { CredentialsForm } from '../components/CredentialsForm'
import { getRedirectTarget } from './redirectTarget'

export function RegisterPage() {
  const { status, register } = useAuth()
  const location = useLocation()

  if (status === 'authed') return <Navigate to={getRedirectTarget(location.state)} replace />

  return (
    <section>
      <h1>Create an account</h1>
      <CredentialsForm submitLabel="Register" passwordAutoComplete="new-password" onSubmit={register} />
      <p>
        Already registered? <Link to="/login" state={location.state}>Log in</Link>
      </p>
    </section>
  )
}
