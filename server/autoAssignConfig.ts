import { db } from './db'
import { autoAssignRules } from '../shared/schema'
import { eq } from 'drizzle-orm'

export interface AutoAssignRule {
  category: string
  user_id: string
  user_name?: string
}

export interface AutoAssignConfig {
  rules: AutoAssignRule[]
}

export async function getAutoAssignConfig(): Promise<AutoAssignConfig> {
  try {
    const rows = await db.select().from(autoAssignRules)
    return {
      rules: rows.map(r => ({ category: r.category, user_id: r.user_id, user_name: r.user_name || '' })),
    }
  } catch (err: any) {
    console.error('[autoAssign] getAutoAssignConfig error:', err?.message)
    return { rules: [] }
  }
}

export async function saveAutoAssignConfig(config: AutoAssignConfig): Promise<AutoAssignConfig> {
  try {
    await db.delete(autoAssignRules)
    if (config.rules.length > 0) {
      await db.insert(autoAssignRules).values(
        config.rules.map(r => ({
          category: r.category.trim(),
          user_id: r.user_id.trim(),
          user_name: r.user_name || '',
        }))
      )
    }
    return getAutoAssignConfig()
  } catch (err: any) {
    console.error('[autoAssign] saveAutoAssignConfig error:', err?.message)
    return { rules: [] }
  }
}

export async function findAutoAssignUser(category: string | null | undefined): Promise<string | null> {
  if (!category) return null
  try {
    const [rule] = await db.select().from(autoAssignRules)
      .where(eq(autoAssignRules.category, category.trim().toLowerCase()))
    return rule?.user_id || null
  } catch (err: any) {
    console.error('[autoAssign] findAutoAssignUser error:', err?.message)
    return null
  }
}
