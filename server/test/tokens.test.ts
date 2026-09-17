import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/auth/tokens.js'

const payload = { id: '6f1c1f0e-3f5e-4c43-9a3e-0d1f1b2a3c4d', role: 'admin' as const }

afterEach(() => {
  vi.useRealTimers()
})

describe('access tokens', () => {
  it('round-trips sign and verify', async () => {
    const token = await signAccessToken(payload)
    expect(await verifyAccessToken(token)).toEqual(payload)
  })

  it('rejects a tampered token', async () => {
    const token = await signAccessToken(payload)
    const [header, body, signature] = token.split('.')
    const forgedBody = Buffer.from(JSON.stringify({ sub: payload.id, role: 'admin', exp: 9999999999 }))
      .toString('base64url')
    await expect(verifyAccessToken(`${header}.${forgedBody}.${signature}`)).rejects.toThrow()
    await expect(verifyAccessToken(`${header}.${body}.x${signature}`)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = await signAccessToken(payload)
    vi.setSystemTime(new Date('2026-01-01T00:16:00Z'))
    await expect(verifyAccessToken(token)).rejects.toThrow()
  })
})

describe('refresh tokens', () => {
  it('generates unique url-safe tokens and hashes them deterministically', () => {
    const a = generateRefreshToken()
    const b = generateRefreshToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a))
    expect(hashRefreshToken(a)).toMatch(/^[0-9a-f]{64}$/)
  })
})
