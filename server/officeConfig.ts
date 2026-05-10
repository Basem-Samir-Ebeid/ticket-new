import { db } from './db'
import { officeSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

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
}
