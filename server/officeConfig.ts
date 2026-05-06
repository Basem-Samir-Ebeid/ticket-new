import fs from 'fs'
import path from 'path'
import { db } from './db'
import { settingsLog } from '../shared/schema'
import { desc } from 'drizzle-orm'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'office-config.json')

export interface OfficeConfig {
  latitude: number
  longitude: number
  radius_meters: number
}

const DEFAULT_CONFIG: OfficeConfig = {
  latitude: 30.0803897,
  longitude: 31.3524335,
  radius_meters: 20,
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

export async function getOfficeConfig(): Promise<OfficeConfig> {
  try {
    const [latest] = await db
      .select()
      .from(settingsLog)
      .orderBy(desc(settingsLog.created_at))
      .limit(1)
    if (latest) {
      const cfg = {
        latitude: Number(latest.to_lat),
        longitude: Number(latest.to_lng),
        radius_meters: Number(latest.to_radius),
      }
      if (isValidConfig(cfg)) return cfg
    }
  } catch {}

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      const cfg = { ...DEFAULT_CONFIG, ...parsed }
      if (isValidConfig(cfg)) return cfg
    }
  } catch {}

  return { ...DEFAULT_CONFIG }
}

export function saveOfficeConfigToFile(config: OfficeConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {}
}
