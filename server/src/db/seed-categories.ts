import { db, pool } from './client.js'
import { categories } from './schema.js'

type NewCategory = typeof categories.$inferInsert

const starterCategories: NewCategory[] = [
  { position: 1, slug: 'react-theory', name: 'React theory', description: 'Hooks, rendering, reconciliation, state and effects' },
  { position: 2, slug: 'js-theory', name: 'JavaScript theory', description: 'Closures, the event loop, prototypes, `this`, async' },
  { position: 3, slug: 'react-coding', name: 'React coding', description: 'Build components and hooks, fix bugs in live code' },
  { position: 4, slug: 'js-coding', name: 'JavaScript coding', description: 'Algorithms and utility functions in plain JS' },
  { position: 5, slug: 'general', name: 'General questions', description: 'Experience, architecture, behavioral questions' },
]

// Inserts the starter categories that don't exist yet.
// Never updates: once the admin panel exists these rows are admin-owned,
// and an upsert would revert the admin's edits on every run.
async function main() {
  // ON CONFLICT DO NOTHING + RETURNING gives back only the rows actually inserted.
  const inserted = await db
    .insert(categories)
    .values(starterCategories)
    .onConflictDoNothing({ target: categories.slug })
    .returning({ slug: categories.slug })

  const insertedSlugs = new Set(inserted.map((row) => row.slug))
  for (const { slug } of starterCategories) {
    console.log(insertedSlugs.has(slug) ? `Created ${slug}` : `Skipped ${slug} (already exists)`)
  }
}

try {
  await main()
} finally {
  await pool.end()
}
