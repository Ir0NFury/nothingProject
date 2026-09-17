import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { config } from '../config.js'
import * as schema from './schema.js'

// A pool keeps a few open connections and hands them out per query.
export const pool = new pg.Pool({ connectionString: config.DATABASE_URL })

export const db = drizzle(pool, { schema })

export type Db = typeof db
// The `tx` object passed to db.transaction(async (tx) => ...)
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
