import { defineConfig } from 'drizzle-kit'

const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

if (!url) {
  throw new Error(
    '[Drizzle] No database URL found. Set NEON_DATABASE_URL or DATABASE_URL in your Replit Secrets.'
  )
}

const isNeon = url.includes('neon.tech')

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: isNeon ? { rejectUnauthorized: false } : false,
  },
})
