import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'github-sync-config.json')

export interface GitHubSyncConfig {
  repo_url: string
  branch: string
  token: string
}

const DEFAULT_CONFIG: GitHubSyncConfig = {
  repo_url: '',
  branch: 'main',
  token: '',
}

export function getGitHubSyncConfig(): GitHubSyncConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveGitHubSyncConfig(config: GitHubSyncConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 })
}
