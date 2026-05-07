import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../shared/schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const isExternalDb =
  process.env.DATABASE_URL.includes('neon.tech') ||
  process.env.DATABASE_URL.includes('supabase.com') ||
  process.env.DATABASE_URL.includes('railway.app') ||
  process.env.DATABASE_URL.includes('render.com') ||
  process.env.DATABASE_URL.includes('planetscale') ||
  process.env.DATABASE_URL.includes('cockroachdb') ||
  process.env.DATABASE_URL.includes('vercel-storage') ||
  process.env.DATABASE_URL.includes('aiven.io') ||
  process.env.DATABASE_URL.includes('timescale') ||
  process.env.DB_SSL === 'true'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isExternalDb ? { ssl: { rejectUnauthorized: false } } : {}),
})

// Prevent unhandled pool errors from crashing the process
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error (staying alive):', err.message)
})

export const db = drizzle(pool, { schema })
