import type { ErrorRequestHandler } from 'express'
import { z, ZodError } from 'zod'
import { AppError } from '../lib/errors.js'

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
  // express.json() reports malformed JSON as a 400 with this type.
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}
