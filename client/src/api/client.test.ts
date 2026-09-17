import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, getAccessToken, onAuthLost, setAccessToken } from './client'

const user = { id: 'u1', email: 'a@example.com', role: 'user', createdAt: '2026-01-01T00:00:00Z' }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function unauthenticated() {
  return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired access token' } })
}

function authHeader(init: RequestInit | undefined) {
  return new Headers(init?.headers).get('Authorization')
}

beforeEach(() => {
  setAccessToken('old-token')
})

afterEach(() => {
  setAccessToken(null)
})

describe('apiFetch', () => {
  it('sends the bearer token and returns parsed JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: true }))

    await expect(apiFetch('/api/admin/ping')).resolves.toEqual({ ok: true })
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe('Bearer old-token')
  })

  it('throws ApiError with the server error fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: { email: ['Bad'] } },
      }),
    )

    const error = await apiFetch('/api/things').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: { email: ['Bad'] },
    })
  })

  it('shares one refresh between concurrent 401s and retries each request', async () => {
    let refreshCalls = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === '/api/auth/refresh') {
        refreshCalls += 1
        // Resolve later, so all three 401s arrive while the refresh is in flight.
        await new Promise((resolve) => setTimeout(resolve, 10))
        return json(200, { accessToken: 'new-token', user })
      }
      return authHeader(init) === 'Bearer new-token' ? json(200, { url }) : unauthenticated()
    })

    const results = await Promise.all([apiFetch('/api/a'), apiFetch('/api/b'), apiFetch('/api/c')])

    expect(refreshCalls).toBe(1)
    expect(results).toEqual([{ url: '/api/a' }, { url: '/api/b' }, { url: '/api/c' }])
    expect(getAccessToken()).toBe('new-token')
    // 3 failed + 1 refresh + 3 retries
    expect(fetchMock).toHaveBeenCalledTimes(7)
  })

  it('emits authLost and rejects all callers when the refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/auth/refresh') {
        return json(401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired' } })
      }
      return unauthenticated()
    })
    const listener = vi.fn()
    const unsubscribe = onAuthLost(listener)

    const outcomes = await Promise.allSettled([apiFetch('/api/a'), apiFetch('/api/b')])
    unsubscribe()

    expect(outcomes.map((o) => o.status)).toEqual(['rejected', 'rejected'])
    expect(listener).toHaveBeenCalled()
    expect(getAccessToken()).toBeNull()
  })

  it('does not refresh when an auth endpoint returns 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    )

    await expect(
      apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({}) }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries only once if the retried request still returns 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input) === '/api/auth/refresh'
        ? json(200, { accessToken: 'new-token', user })
        : unauthenticated(),
    )

    await expect(apiFetch('/api/a')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
