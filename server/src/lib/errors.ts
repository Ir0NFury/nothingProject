// Every error code the API can return. New features add their codes here.
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'INVALID_REFRESH_TOKEN'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

// An expected error. errorHandler turns it into { error: { code, message } }.
export class AppError extends Error {
  readonly status: number
  readonly code: ErrorCode

  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}

// Postgres error 23505 = unique constraint violated.
// Drizzle may wrap the driver error, so also look at `cause`.
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  while (current instanceof Error || (typeof current === 'object' && current !== null)) {
    if ('code' in current && current.code === '23505') return true
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}
