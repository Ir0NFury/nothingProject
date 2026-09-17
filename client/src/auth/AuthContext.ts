import { createContext } from 'react'
import type { User } from '../api/types'

export type AuthStatus = 'loading' | 'authed' | 'guest'

export type AuthContextValue = {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
