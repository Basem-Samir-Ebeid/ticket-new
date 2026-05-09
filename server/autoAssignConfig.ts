import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'server', 'auto-assign-config.json')

export interface AutoAssignRule {
  category: string
  user_id: string
  user_name?: string
}

export interface AutoAssignConfig {
  rules: AutoAssignRule[]
}

export function getAutoAssignConfig(): AutoAssignConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch {}
  return { rules: [] }
}

export function saveAutoAssignConfig(config: AutoAssignConfig): AutoAssignConfig {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  return config
}

export function findAutoAssignUser(category: string | null | undefined): string | null {
  if (!category) return null
  const config = getAutoAssignConfig()
  const rule = config.rules.find(
    r => r.category.trim().toLowerCase() === category.trim().toLowerCase()
  )
  return rule?.user_id || null
}
