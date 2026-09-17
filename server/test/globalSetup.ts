import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { testEnv } from './testEnv.js'

// Runs once before all test files: bring the test DB schema up to date.
export default async function setup() {
  const pool = new pg.Pool({ connectionString: testEnv.DATABASE_URL })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}
