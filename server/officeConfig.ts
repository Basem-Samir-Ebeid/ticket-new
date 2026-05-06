import fs from 'fs'
import path from 'path'
import { db } from './db'
import { officeSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'office-config.json')

export interface OfficeConfig {
  latitude: number
  longitude: number
  radius_meters: number
}

const DEFAULT_CONFIG: OfficeConfig = {
  latitude: 30.0803897,
  longitude: 31.3524335,
  radius_meters: 100,
}

function isValidConfig(cfg: any): cfg is OfficeConfig {
  return (
    cfg !== null &&
    typeof cfg === 'object' &&
    typeof cfg.latitude === 'number' && isFinite(cfg.latitude) && cfg.latitude !== 0 &&
    typeof cfg.longitude === 'number' && isFinite(cfg.longitude) && cfg.longitude !== 0 &&
    typeof cfg.radius_meters === 'number' && isFinite(cfg.radius_meters) && cfg.radius_meters > 0
  )
}

function readFileConfig(): OfficeConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      const cfg = { ...DEFAULT_CONFIG, ...parsed }
      if (isValidConfig(cfg)) return cfg
    }
  } catch {}
  return null
}

export async function getOfficeConfig(): Promise<OfficeConfig> {
  try {
    const [row] = await db.select().from(officeSettings).where(eq(officeSettings.id, 'main')).limit(1)
    if (row) {
      const cfg: OfficeConfig = {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        radius_meters: Number(row.radius_meters),
      }
      if (isValidConfig(cfg)) return cfg
    }
  } catch (err) {
    console.error('[officeConfig] Failed to read from DB:', err)
  }

  const fileCfg = readFileConfig()
  if (fileCfg) return fileCfg

  return { ...DEFAULT_CONFIG }
}

export async function saveOfficeConfig(config: OfficeConfig): Promise<void> {
  await db
    .insert(officeSettings)
    .values({ id: 'main', ...config })
    .onConflictDoUpdate({
      target: officeSettings.id,
      set: {
        latitude: config.latitude,
        longitude: config.longitude,
        radius_meters: config.radius_meters,
        updated_at: new Date(),
      },
    })

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {}
}

export function saveOfficeConfigToFile(config: OfficeConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {}
}
