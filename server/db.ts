import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../shared/schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Prevent unhandled pool errors from crashing the process
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error (staying alive):', err.message)
})

export const db = drizzle(pool, { schema })
