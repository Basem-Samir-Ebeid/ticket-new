import { Router } from 'express'
import { db } from '../db'
import { notifications } from '../../shared/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../auth'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  const rows = await db.select().from(notifications)
    .where(and(eq(notifications.user_id, req.user.id), eq(notifications.read, false)))
    .orderBy(desc(notifications.created_at))
  res.json(rows)
})

router.patch('/:id/read', requireAuth as any, async (req: any, res) => {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, req.params.id))
  res.json({ success: true })
})

export default router
