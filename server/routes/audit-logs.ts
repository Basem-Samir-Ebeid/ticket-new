import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { auditLogs } from '../../shared/schema'
import { desc, gte, lte, and, eq } from 'drizzle-orm'

const router = Router()

export async function logAudit(params: {
  user_id?: string
  user_name?: string
  action_type: string
  entity_type?: string
  entity_id?: string
  description: string
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  ip_address?: string
}) {
  try {
    await db.insert(auditLogs).values(params)
  } catch {}
}

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const { limit = '200', offset = '0', action_type, entity_type, user_id, from, to } = req.query

    const conditions: any[] = []
    if (from) conditions.push(gte(auditLogs.created_at, new Date(String(from))))
    if (to) conditions.push(lte(auditLogs.created_at, new Date(String(to))))
    if (action_type) conditions.push(eq(auditLogs.action_type, String(action_type)))
    if (entity_type) conditions.push(eq(auditLogs.entity_type, String(entity_type)))
    if (user_id) conditions.push(eq(auditLogs.user_id, String(user_id)))

    const rows = await db.select().from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.created_at))
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset))

    res.json(rows)
  } catch (err: any) {
    console.error('GET /audit-logs error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load audit logs' })
  }
})

export default router
