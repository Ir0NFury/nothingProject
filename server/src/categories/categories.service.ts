import { asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { categories } from '../db/schema.js'

// Public list for the home page. Selects only the columns clients may see:
// position and createdAt are for sorting and auditing, not display.
export function listCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name))
}
