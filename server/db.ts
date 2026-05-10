import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../shared/schema'

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    '[DB] No database URL found. Please set NEON_DATABASE_URL or DATABASE_URL in your Replit Secrets.'
  )
}

const isNeon = connectionString.includes('neon.tech')
const requiresSsl = isNeon || connectionString.includes('sslmode=require')

export const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error (staying alive):', err.message)
})

pool.on('connect', () => {
  console.log('[DB] Connected to database')
})

export const db = drizzle(pool, { schema })
