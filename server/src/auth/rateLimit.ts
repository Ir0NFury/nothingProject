import { rateLimit } from 'express-rate-limit'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

// 10 login/register attempts per 15 minutes per IP. Off in tests.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, please try again later'))
  },
})
