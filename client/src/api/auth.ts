import { apiFetch, refreshAccessToken, setAccessToken } from './client'
import type { AuthResponse, User } from './types'

async function startSession(path: string, email: string, password: string): Promise<User> {
  const { accessToken, user } = await apiFetch<AuthResponse>(path, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAccessToken(accessToken)
  return user
}

export function login(email: string, password: string) {
  return startSession('/api/auth/login', email, password)
}

export function register(email: string, password: string) {
  return startSession('/api/auth/register', email, password)
}

// Uses the shared single-flight refresh (also used by apiFetch on 401).
export async function refresh(): Promise<User> {
  const { user } = await refreshAccessToken()
  return user
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}

export async function getMe(signal?: AbortSignal): Promise<User> {
  const { user } = await apiFetch<{ user: User }>('/api/auth/me', { signal })
  return user
}
