import { Router, type CookieOptions, type Response } from 'express'
import { config } from '../config.js'
import { getAuthUser, requireAuth } from '../middleware/requireAuth.js'
import { credentialsSchema } from './auth.schemas.js'
import * as authService from './auth.service.js'
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
  res.status(status).json({ accessToken: result.accessToken, user: result.user })
}

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  sendSession(res, 201, await authService.register(email, password))
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  sendSession(res, 200, await authService.login(email, password))
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await authService.getUserById(getAuthUser(req).id)
  res.json({ user })
})
