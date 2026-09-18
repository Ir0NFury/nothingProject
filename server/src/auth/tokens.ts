import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'
import { config } from '../config.js'
import type { Role } from '../db/schema.js'

export const ACCESS_TOKEN_TTL = '15m'
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AccessTokenPayload = { id: string; role: Role }

const secret = new TextEncoder().encode(config.JWT_ACCESS_SECRET)

// Access token: a signed JWT. The server can check it without a DB lookup.
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret)
}

// Throws if the signature, algorithm, expiry or claims are wrong.
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
  const { sub, role } = payload
  if (typeof sub !== 'string' || (role !== 'user' && role !== 'admin')) {
    throw new Error('Invalid access token claims')
  }
  return { id: sub, role }
}

// Refresh token: an opaque random string. Only its hash is stored in the DB.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
