import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { casemindPool?: Pool }

export const pool =
  globalForDb.casemindPool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') globalForDb.casemindPool = pool

export const db = drizzle(pool, { schema })
