import type { AuthResponse } from './types'

// The single place that knows about the access token.
// It lives only in memory: a page reload loses it, and AuthProvider gets a new one via refresh.
let accessToken: string | null = null

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, string[]>

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// --- "auth lost" event: the refresh token is gone, the user must log in again ---
const authLostListeners = new Set<() => void>()

export function onAuthLost(listener: () => void) {
  authLostListeners.add(listener)
  return () => {
    authLostListeners.delete(listener)
  }
}

// Auth endpoints return 401 for their own reasons; refreshing wouldn't help.
const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']

async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null)
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { code, message, details } = body.error as {
      code: string
      message: string
      details?: Record<string, string[]>
    }
    return new ApiError(res.status, code, message, details)
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', `Request failed (${res.status})`)
}

async function parseBody<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function send(path: string, init: RequestInit) {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(path, { ...init, headers })
}

// --- Refresh: at most one request at a time ---
let refreshInFlight: Promise<AuthResponse> | null = null

async function requestRefresh(): Promise<AuthResponse> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' })
  return parseBody<AuthResponse>(res)
}

// All callers that arrive while a refresh is running share its promise.
// navigator.locks also serializes refreshes across browser tabs, so each tab
// sends the newest cookie instead of a token another tab just rotated.
export function refreshAccessToken(): Promise<AuthResponse> {
  if (!refreshInFlight) {
    const run = navigator.locks
      ? navigator.locks.request('auth-refresh', requestRefresh)
      : requestRefresh()
    refreshInFlight = run
      .then((result) => {
        setAccessToken(result.accessToken)
        return result
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init)
  if (res.status !== 401 || NO_REFRESH_PATHS.includes(path)) {
    return parseBody<T>(res)
  }

  const originalError = await toApiError(res)
  try {
    await refreshAccessToken()
  } catch {
    setAccessToken(null)
    authLostListeners.forEach((listener) => listener())
    throw originalError
  }
  // Retry once with the new token. A second 401 is returned as an error, not retried.
  return parseBody<T>(await send(path, init))
}
