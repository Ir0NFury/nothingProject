import { Router, type CookieOptions, type Request, type Response } from 'express'
import { config } from '../config.js'
import { getAuthUser, requireAuth } from '../middleware/requireAuth.js'
import { credentialsSchema } from './auth.schemas.js'
import * as authService from './auth.service.js'
import { authRateLimit } from './rateLimit.js'
import { REFRESH_TOKEN_TTL_MS } from './tokens.js'

export const REFRESH_COOKIE = 'ip_refresh'

const refreshCookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the page can't read it
  sameSite: 'strict', // not sent on cross-site requests (CSRF protection)
  secure: config.NODE_ENV === 'production', // HTTPS only in production
  path: '/api/auth', // only sent to auth endpoints
}

function sendSession(res: Response, status: number, result: authService.AuthResult) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  })
  res.set('Cache-Control', 'no-store') // this response carries tokens
  res.status(status).json({ accessToken: result.accessToken, user: result.user })
}

// req.cookies is untyped (any), so narrow it to a string.
function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const authRouter = Router()

authRouter.post('/register', authRateLimit, async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  sendSession(res, 201, await authService.register(email, password))
})

authRouter.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  sendSession(res, 200, await authService.login(email, password))
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await authService.getUserById(getAuthUser(req).id)
  res.json({ user })
})

authRouter.post('/refresh', async (req, res) => {
  sendSession(res, 200, await authService.refresh(readRefreshCookie(req)))
})

authRouter.post('/logout', async (req, res) => {
  await authService.logout(readRefreshCookie(req))
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions)
  res.status(204).end()
})
