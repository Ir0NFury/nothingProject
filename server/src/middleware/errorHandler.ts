import type { ErrorRequestHandler } from 'express'
import { z, ZodError } from 'zod'
import { AppError } from '../lib/errors.js'

// express.json() reports client mistakes (malformed JSON, oversized body, bad
// encoding, aborted request, ...) as plain objects with a `type` and a 4xx `status`,
// not as one specific error class.
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  )
}

// Express recognizes error handlers by their 4 parameters, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: z.flattenError(err).fieldErrors,
      },
    })
    return
  }
  if (isBodyParserError(err)) {
    const message = err.type === 'entity.parse.failed' ? 'Malformed JSON body' : 'Invalid request body'
    res.status(err.status).json({ error: { code: 'VALIDATION_ERROR', message } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}
