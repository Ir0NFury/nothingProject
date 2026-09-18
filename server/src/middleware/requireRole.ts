import type { RequestHandler } from 'express'
import type { Role } from '../db/schema.js'
import { AppError } from '../lib/errors.js'
import { getAuthUser } from './requireAuth.js'

// Use after requireAuth: requireAuth, requireRole('admin')
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuthUser(req).role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource')
    }
    next()
  }
}
