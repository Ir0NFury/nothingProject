import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { hashRefreshToken } from '../src/auth/tokens.js'
import { db } from '../src/db/client.js'
import { refreshTokens } from '../src/db/schema.js'
import { createUserWithToken, getRefreshCookie, TEST_PASSWORD } from './helpers.js'

const credentials = { email: 'Alice@Example.com ', password: 'password123' }

// Reuse detection (Task 5) logs a console.warn by design. Keep test output clean.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/auth/register', () => {
  it('creates a user, returns 201 and sets the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials)

    expect(res.status).toBe(201)
    expect(typeof res.body.accessToken).toBe('string')
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'alice@example.com',
      role: 'user',
      createdAt: expect.any(String),
    })
    const setCookie = res.headers['set-cookie']?.[0] ?? ''
    expect(setCookie).toMatch(/^ip_refresh=[^;]+/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/api/auth')
  })

  it('returns 409 for an existing email', async () => {
    await request(app).post('/api/auth/register').send(credentials)
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'alice@example.com' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('returns 400 with field errors for an invalid body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'password'])
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 413 for an oversized JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', password: 'x'.repeat(200_000) })

    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/auth/login', () => {
  it('returns 200 with a token and cookie for valid credentials', async () => {
    const { user } = await createUserWithToken()
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(user.id)
    expect(getRefreshCookie(res)).toBeDefined()
  })

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const { user } = await createUserWithToken()
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: TEST_PASSWORD })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 with a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')
    expect(res.status).toBe(401)
  })

  it('returns the user with a valid token and never the password hash', async () => {
    const { user, accessToken } = await createUserWithToken()
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(user.id)
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })
})

describe('unknown API routes', () => {
  it('return 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

async function registerAndGetCookie(email = 'bob@example.com') {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' })
  const cookie = getRefreshCookie(res)
  if (!cookie) throw new Error('register did not set the refresh cookie')
  return cookie
}

function rawValue(cookie: string) {
  return cookie.slice('ip_refresh='.length)
}

describe('POST /api/auth/refresh', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('returns 401 for an unknown token', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'ip_refresh=unknown')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('rotates the cookie and revokes the old token', async () => {
    const oldCookie = await registerAndGetCookie()
    const res = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie)

    expect(res.status).toBe(200)
    expect(typeof res.body.accessToken).toBe('string')
    expect(res.body.user.email).toBe('bob@example.com')
    const newCookie = getRefreshCookie(res)
    expect(newCookie).toBeDefined()
    expect(newCookie).not.toBe(oldCookie)

    const [oldRow] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawValue(oldCookie))))
    const [newRow] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawValue(newCookie!))))
    expect(oldRow.revokedAt).not.toBeNull()
    expect(oldRow.replacedBy).toBe(newRow.id)
    expect(newRow.familyId).toBe(oldRow.familyId)
    expect(newRow.revokedAt).toBeNull()
  })

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const oldCookie = await registerAndGetCookie()
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie)
    const newCookie = getRefreshCookie(rotated)!

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie)
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('reuse'))

    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', newCookie)
    expect(afterReuse.status).toBe(401)
  })

  it('does not affect other sessions of the same user', async () => {
    const first = await registerAndGetCookie()
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'password123' })
    const second = getRefreshCookie(login)!

    await request(app).post('/api/auth/refresh').set('Cookie', first)
    await request(app).post('/api/auth/refresh').set('Cookie', first) // reuse → revokes family 1

    const res = await request(app).post('/api/auth/refresh').set('Cookie', second)
    expect(res.status).toBe(200)
  })

  it('returns 401 for an expired token', async () => {
    const cookie = await registerAndGetCookie()
    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawValue(cookie))))

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 204, clears the cookie, and the token no longer refreshes', async () => {
    const cookie = await registerAndGetCookie()
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie)

    expect(res.status).toBe(204)
    expect(res.headers['set-cookie']?.[0]).toMatch(/^ip_refresh=;/)

    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refresh.status).toBe(401)
  })

  it('returns 204 without a cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(204)
  })
})

describe('GET /api/admin/ping', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/admin/ping')
    expect(res.status).toBe(401)
  })

  it('returns 403 for a user', async () => {
    const { accessToken } = await createUserWithToken({ role: 'user' })
    const res = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 for an admin', async () => {
    const { accessToken } = await createUserWithToken({ role: 'admin' })
    const res = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('security headers', () => {
  it('sets helmet headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
