import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'smtp-config.json')

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

export function getSmtpConfig(): SmtpConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveSmtpConfig(config: Partial<SmtpConfig>): SmtpConfig {
  const existing = getSmtpConfig()
  const merged: SmtpConfig = { ...existing, ...config }
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8')
  } catch (err) {
    console.error('[smtpConfig] Failed to save config:', err)
  }
  return merged
}
