import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../api/types'
import { useAuth } from './useAuth'

type Props = { roles?: Role[]; children: ReactNode }

// Hides pages from the wrong users. The server still checks every request.
export function RequireAuth({ roles, children }: Props) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p role="status">Loading…</p>
  }
  if (status === 'guest' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <section>
        <h1>Forbidden</h1>
        <p>You don't have access to this page.</p>
      </section>
    )
  }
  return children
}
