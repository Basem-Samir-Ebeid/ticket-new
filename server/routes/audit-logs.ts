import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { auditLogs } from '../../shared/schema'
import { desc, gte, lte, and, like, sql } from 'drizzle-orm'

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
    let query = db.select().from(auditLogs).orderBy(desc(auditLogs.created_at))

    const conditions = []
    if (from) conditions.push(gte(auditLogs.created_at, new Date(String(from))))
    if (to) conditions.push(lte(auditLogs.created_at, new Date(String(to))))
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    let rows = await (query as any)
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset))

    if (action_type) rows = rows.filter((r: any) => r.action_type === action_type)
    if (entity_type) rows = rows.filter((r: any) => r.entity_type === entity_type)
    if (user_id) rows = rows.filter((r: any) => r.user_id === user_id)

    res.json(rows)
  } catch (err: any) {
    console.error('GET /audit-logs error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load audit logs' })
  }
})

export default router
