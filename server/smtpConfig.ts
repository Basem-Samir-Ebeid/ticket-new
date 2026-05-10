import { db } from './db'
import { systemSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

const SMTP_KEY = 'smtp_config'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_name: string
  from_email: string
  enabled: boolean
}

const DEFAULT_CONFIG: SmtpConfig = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  password: '',
  from_name: 'Finest IT',
  from_email: '',
  enabled: false,
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const [row] = await db.select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, SMTP_KEY))
      .limit(1)
    if (row?.value) return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export async function saveSmtpConfig(config: Partial<SmtpConfig>): Promise<SmtpConfig> {
  const existing = await getSmtpConfig()
  const merged: SmtpConfig = { ...existing, ...config }
  await db.insert(systemSettings)
    .values({ key: SMTP_KEY, value: JSON.stringify(merged) })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(merged), updated_at: new Date() } })
  return merged
}
