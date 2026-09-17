import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { onAuthLost } from '../api/client'
import type { User } from '../api/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'

type AuthState = { user: User | null; status: AuthStatus }

const GUEST: AuthState = { user: null, status: 'guest' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading' })

  // On page load the in-memory access token is gone; the refresh cookie may still be valid.
  useEffect(() => {
    let active = true
    authApi
      .refresh()
      .then((user) => active && setState({ user, status: 'authed' }))
      .catch(() => active && setState(GUEST))
    return () => {
      active = false
    }
  }, [])

  // apiFetch reports when the session can't be refreshed anymore.
  useEffect(() => onAuthLost(() => setState(GUEST)), [])

  const login = useCallback(async (email: string, password: string) => {
    const user = await authApi.login(email, password)
    setState({ user, status: 'authed' })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const user = await authApi.register(email, password)
    setState({ user, status: 'authed' })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setState(GUEST)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
