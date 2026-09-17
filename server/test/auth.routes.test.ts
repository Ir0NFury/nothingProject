import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { createUserWithToken, getRefreshCookie, TEST_PASSWORD } from './helpers.js'

const credentials = { email: 'Alice@Example.com ', password: 'password123' }

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
