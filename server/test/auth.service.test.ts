import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as authService from '../src/auth/auth.service.js'
import { generateRefreshToken, hashRefreshToken } from '../src/auth/tokens.js'
import { db, pool } from '../src/db/client.js'
import { refreshTokens } from '../src/db/schema.js'

// Reuse detection logs a console.warn by design (see auth.routes.test.ts). Keep test output clean.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Polls pg_stat_activity until some backend is blocked on a lock — i.e. our
// "victim" refresh() call is stuck behind the user-row lock this test is
// holding open — or fails after ~2s if that never happens (well under
// Vitest's 5s test timeout, so this error message is the one that surfaces).
async function waitForLockWait() {
  const start = Date.now()
  while (Date.now() - start < 2000) {
    const { rows } = await pool.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
    )
    if ((rows[0]?.n ?? 0) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for a backend to block on a lock')
}

describe('refresh (concurrency)', () => {
  it('revokes a token that a concurrent rotation is still inserting', async () => {
    const email = `race-${randomUUID()}@example.com`
    const t1 = await authService.register(email, 'password123')
    const t2 = await authService.refresh(t1.refreshToken)

    const [t2Row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(t2.refreshToken)))
    if (!t2Row) throw new Error('t2 row not found')

    const t3Raw = generateRefreshToken()
    const t3Hash = hashRefreshToken(t3Raw)

    const client = await pool.connect()
    let outcome: Promise<unknown> | undefined
    try {
      await client.query('BEGIN')
      // Simulates a concurrent rotation of T2, following the same lock
      // order refresh() uses: the user row first, then the token row.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [t2Row.userId])
      await client.query('SELECT id FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [t2Row.tokenHash])
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '7 days')
         RETURNING id`,
        [t2Row.userId, t2Row.familyId, t3Hash],
      )
      await client.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE token_hash = $2', [
        inserted.rows[0]!.id,
        t2Row.tokenHash,
      ])
      // The transaction stays open here: T3 exists but isn't committed yet.

      // Fire the "victim" refresh of T1 without awaiting it yet. Attach the
      // rejection handler immediately so there's no unhandled rejection
      // while we wait below; the actual assertion happens after commit.
      const victim = authService.refresh(t1.refreshToken)
      outcome = victim.then(
        () => 'resolved',
        (err: unknown) => err,
      )

      await waitForLockWait()
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    const result = await outcome
    expect(result).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })

    const familyRows = await db.select().from(refreshTokens).where(eq(refreshTokens.familyId, t2Row.familyId))
    expect(familyRows.length).toBeGreaterThan(0)
    for (const row of familyRows) {
      expect(row.revokedAt).not.toBeNull()
    }

    await expect(authService.refresh(t3Raw)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })
  })
})
