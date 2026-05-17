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
  ip_address?: string
}) {
  try {
    await db.insert(auditLogs).values(params)
  } catch {}
}

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const { limit = '100', offset = '0', action_type, entity_type } = req.query
    let rows = await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.created_at))
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset))

    if (action_type) rows = rows.filter(r => r.action_type === action_type)
    if (entity_type) rows = rows.filter(r => r.entity_type === entity_type)

    res.json(rows)
  } catch (err: any) {
    console.error('GET /audit-logs error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load audit logs' })
  }
})

export default router
