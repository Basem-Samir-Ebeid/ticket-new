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
  latitude: 30.0726,
  longitude: 31.3211,
  radius_meters: 30,
}

export async function getOfficeConfig(): Promise<OfficeConfig> {
  try {
    const [latest] = await db
      .select()
      .from(settingsLog)
      .orderBy(desc(settingsLog.created_at))
      .limit(1)
    if (latest) {
      return {
        latitude: latest.to_lat,
        longitude: latest.to_lng,
        radius_meters: latest.to_radius,
      }
    }
  } catch {}
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveOfficeConfigToFile(config: OfficeConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {}
}
