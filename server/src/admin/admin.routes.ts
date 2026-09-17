import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireRole } from '../middleware/requireRole.js'

export const adminRouter = Router()

adminRouter.get('/ping', requireAuth, requireRole('admin'), (_req, res) => {
  res.json({ ok: true })
})
