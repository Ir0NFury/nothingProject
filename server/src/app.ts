import cookieParser from 'cookie-parser'
import express from 'express'
import { authRouter } from './auth/auth.routes.js'
import { AppError } from './lib/errors.js'
import { errorHandler } from './middleware/errorHandler.js'

// The app is created separately from index.ts (which starts listening),
// so tests can import it without opening a real port.
export const app = express()

app.use(express.json())
app.use(cookieParser())

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello world from Express!' })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)

// Any other /api path is a 404 in the standard error format.
app.use('/api', () => {
  throw new AppError(404, 'NOT_FOUND', 'Route not found')
})

// Must be registered last.
app.use(errorHandler)
