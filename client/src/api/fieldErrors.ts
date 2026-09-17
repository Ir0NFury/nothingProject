import { ApiError } from './client'

// Turns a VALIDATION_ERROR into { field: firstMessage }. Anything else → {}.
export function getFieldErrors<F extends string>(err: unknown): Partial<Record<F, string>> {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_ERROR' || !err.details) return {}
  const result: Partial<Record<F, string>> = {}
  for (const [field, messages] of Object.entries(err.details)) {
    if (messages[0]) result[field as F] = messages[0]
  }
  return result
}
