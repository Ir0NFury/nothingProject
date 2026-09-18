import type { Role } from '../db/schema.js'

export type AuthUser = { id: string; role: Role }

// Adds `req.user` to Express's Request type. requireAuth sets it.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
