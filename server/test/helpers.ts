import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import * as authService from '../src/auth/auth.service.js'
import { db } from '../src/db/client.js'
import { users, type Role } from '../src/db/schema.js'

export const TEST_PASSWORD = 'password123'

// Creates a user through the real service, sets the role, and logs in,
// so the access token carries that role.
export async function createUserWithToken({ role = 'user' }: { role?: Role } = {}) {
  const email = `user-${randomUUID()}@example.com`
  await authService.register(email, TEST_PASSWORD)
  await db.update(users).set({ role }).where(eq(users.email, email))
  const { user, accessToken, refreshToken } = await authService.login(email, TEST_PASSWORD)
  return { user, accessToken, refreshToken }
}

// Returns "ip_refresh=<value>" from a Set-Cookie response header, ready to send back.
export function getRefreshCookie(res: { headers: Record<string, unknown> }): string | undefined {
  const header = res.headers['set-cookie']
  const cookies = Array.isArray(header) ? header : []
  const match = cookies.find((c): c is string => typeof c === 'string' && c.startsWith('ip_refresh='))
  return match?.split(';')[0]
}
