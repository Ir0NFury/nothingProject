import { Router } from 'express'
import * as categoriesService from './categories.service.js'

export const categoriesRouter = Router()

// Public: the category list is shown to guests too.
categoriesRouter.get('/', async (_req, res) => {
  const categories = await categoriesService.listCategories()
  res.json({ categories })
})
