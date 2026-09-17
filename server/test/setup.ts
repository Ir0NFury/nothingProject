import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { db, pool } from '../src/db/client.js'

// Refuses to run against anything but a database named *_test, so a
// misconfigured DATABASE_URL can't truncate real data.
beforeAll(async () => {
  const [row] = (await db.execute<{ current_database: string }>(sql`select current_database()`)).rows
  if (!row?.current_database.endsWith('_test')) {
    throw new Error(`Refusing to truncate database "${row?.current_database}": its name must end in "_test"`)
  }
})

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
