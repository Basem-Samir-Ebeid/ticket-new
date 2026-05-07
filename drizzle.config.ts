import { defineConfig } from 'drizzle-kit'

const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: url?.includes('localhost') ? false : { rejectUnauthorized: false },
  },
})
