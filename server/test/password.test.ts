import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/password.js'

describe('password hashing', () => {
  it('verifies the correct password', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true)
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(await verifyPassword('wrong password', stored)).toBe(false)
  })

  it('produces different hashes for the same password', async () => {
    const a = await hashPassword('same password')
    const b = await hashPassword('same password')
    expect(a).not.toBe(b)
  })

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
  })
})
