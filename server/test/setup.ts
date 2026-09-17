import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { db, pool } from '../src/db/client.js'

// Runs in every test file. Wipes all tables in `public` before each test.
// The table list comes from the DB, so new tables need no changes here.
beforeEach(async () => {
  const result = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  const names = result.rows.map((row) => `"${row.tablename}"`)
  if (names.length > 0) {
    await db.execute(sql.raw(`truncate table ${names.join(', ')} restart identity cascade`))
  }
})

afterAll(async () => {
  await pool.end()
})
