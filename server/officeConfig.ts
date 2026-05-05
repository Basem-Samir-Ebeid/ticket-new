import fs from 'fs'
import path from 'path'

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

export function getOfficeConfig(): OfficeConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveOfficeConfig(config: OfficeConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to write office-config.json:', err)
    return false
  }
}
