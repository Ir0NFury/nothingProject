import type { Request, RequestHandler } from 'express'
import { verifyAccessToken } from '../auth/tokens.js'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/express.js'

// Checks `Authorization: Bearer <jwt>` and sets req.user.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
  try {
    req.user = await verifyAccessToken(token)
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired access token')
  }
  next()
}

// For handlers behind requireAuth: returns req.user with a non-optional type.
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
  return req.user
}
