import { db } from './db'
import { systemSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

const GITHUB_KEY = 'github_sync_config'

export interface GitHubSyncConfig {
  repo_url: string
  branch: string
  token: string
}

const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = {
  repo_url: '',
  branch: 'main',
  token: '',
}

export async function getGitHubSyncConfig(): Promise<GitHubSyncConfig> {
  try {
    const [row] = await db.select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, GITHUB_KEY))
      .limit(1)
    if (row?.value) return { ...DEFAULT_GITHUB_CONFIG, ...JSON.parse(row.value) }
  } catch {}
  return { ...DEFAULT_GITHUB_CONFIG }
}

export async function saveGitHubSyncConfig(config: GitHubSyncConfig): Promise<void> {
  const existing = await getGitHubSyncConfig()
  const merged = { ...existing, ...config }
  await db.insert(systemSettings)
    .values({ key: GITHUB_KEY, value: JSON.stringify(merged) })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(merged), updated_at: new Date() } })
}
