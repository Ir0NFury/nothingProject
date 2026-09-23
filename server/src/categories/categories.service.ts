import { asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { categories } from '../db/schema.js'

export type PublicCategory = { id: string; slug: string; name: string; description: string }

// Public list for the home page. Selects only the columns clients may see:
// position and createdAt are for sorting and auditing, not display.
export async function listCategories(): Promise<PublicCategory[]> {
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
