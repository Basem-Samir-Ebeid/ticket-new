import { defineConfig } from 'drizzle-kit'

const url = process.env.NEON_DATABASE_URL

if (!url) {
  throw new Error(
    '[Drizzle] NEON_DATABASE_URL is not set. Add it to your Replit Secrets.'
  )
}

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: { rejectUnauthorized: false },
  },
})
