import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db, type Db, type Tx } from '../db/client.js'
import { refreshTokens, users, type Role, type UserRow } from '../db/schema.js'
import { AppError, isUniqueViolation } from '../lib/errors.js'
import { hashPassword, verifyDummyPassword, verifyPassword } from './password.js'
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
} from './tokens.js'

export type PublicUser = { id: string; email: string; role: Role; createdAt: Date }

export type AuthResult = { accessToken: string; refreshToken: string; user: PublicUser }

// Never send password_hash to the client.
function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt }
}

// Stores the hash of a new refresh token and returns the raw value (for the cookie).
async function insertRefreshToken(executor: Db | Tx, userId: string, familyId: string) {
  const rawToken = generateRefreshToken()
  const [row] = await executor
    .insert(refreshTokens)
    .values({
      userId,
      familyId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })
    .returning({ id: refreshTokens.id })
  return { id: row.id, rawToken }
}

// A login (or register) starts a new token family.
async function startSession(user: UserRow): Promise<AuthResult> {
  const { rawToken } = await insertRefreshToken(db, user.id, randomUUID())
  const accessToken = await signAccessToken({ id: user.id, role: user.role })
  return { accessToken, refreshToken: rawToken, user: toPublicUser(user) }
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const passwordHash = await hashPassword(password)
  let user: UserRow
  try {
    ;[user] = await db.insert(users).values({ email, passwordHash }).returning()
  } catch (err) {
    // Rely on the unique constraint instead of "check, then insert" (which races).
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists')
    }
    throw err
  }
  return startSession(user)
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) {
    await verifyDummyPassword(password)
    throw invalidCredentials()
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw invalidCredentials()
  }
  return startSession(user)
}

export async function getUserById(id: string): Promise<PublicUser> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists')
  return toPublicUser(user)
}

// Same message for "no such email" and "wrong password".
function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
}

function invalidRefreshToken() {
  return new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please log in again')
}

async function revokeFamily(familyId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
}

// Exchanges a valid refresh token for a new access token and a new refresh token.
// The old refresh token is revoked (rotation). Presenting an already-revoked token
// means it was probably stolen, so the whole family is revoked (reuse detection).
export async function refresh(rawToken: string | undefined): Promise<AuthResult> {
  if (!rawToken) throw invalidRefreshToken()
  const tokenHash = hashRefreshToken(rawToken)

  const outcome = await db.transaction(async (tx) => {
    // FOR UPDATE locks the row until the transaction ends, so two concurrent
    // refreshes with the same token run one after another, not in parallel.
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update')

    if (!row) return { kind: 'invalid' } as const
    if (row.revokedAt) return { kind: 'reused', familyId: row.familyId } as const
    if (row.expiresAt <= new Date()) return { kind: 'invalid' } as const

    const next = await insertRefreshToken(tx, row.userId, row.familyId)
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedBy: next.id })
      .where(eq(refreshTokens.id, row.id))
    const [user] = await tx.select().from(users).where(eq(users.id, row.userId))
    return { kind: 'ok', user, rawToken: next.rawToken } as const
  })

  if (outcome.kind === 'reused') {
    // Done after the transaction: throwing inside it would roll this back.
    await revokeFamily(outcome.familyId)
    console.warn(`Refresh token reuse detected, revoked family ${outcome.familyId}`)
    throw invalidRefreshToken()
  }
  if (outcome.kind === 'invalid') throw invalidRefreshToken()

  const accessToken = await signAccessToken({ id: outcome.user.id, role: outcome.user.role })
  return { accessToken, refreshToken: outcome.rawToken, user: toPublicUser(outcome.user) }
}

// Revokes every token from this login. Unknown or missing tokens are ignored.
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return
  const [row] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)))
  if (row) await revokeFamily(row.familyId)
}
