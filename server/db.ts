import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../shared/schema'

const connectionString = process.env.NEON_DATABASE_URL

if (!connectionString) {
  throw new Error(
    '[DB] NEON_DATABASE_URL is not set. Please add it to your Replit Secrets.\n' +
    '     You can find it in your Neon dashboard under Connection Details.'
  )
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error (staying alive):', err.message)
})

pool.on('connect', () => {
  console.log('[DB] Connected to Neon database')
})

export const db = drizzle(pool, { schema })
