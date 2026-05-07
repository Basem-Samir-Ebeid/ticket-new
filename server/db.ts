import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../shared/schema'

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL or NEON_DATABASE_URL is required')
}

const isExternalDb =
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.com') ||
  connectionString.includes('railway.app') ||
  connectionString.includes('render.com') ||
  connectionString.includes('planetscale') ||
  connectionString.includes('cockroachdb') ||
  connectionString.includes('vercel-storage') ||
  connectionString.includes('aiven.io') ||
  connectionString.includes('timescale') ||
  process.env.DB_SSL === 'true'

export const pool = new Pool({
  connectionString,
  ...(isExternalDb ? { ssl: { rejectUnauthorized: false } } : {}),
})

// Prevent unhandled pool errors from crashing the process
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error (staying alive):', err.message)
})

export const db = drizzle(pool, { schema })
