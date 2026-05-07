import { Router } from 'express'
import { db } from '../db'
import { notifications } from '../../shared/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../auth'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.user_id, req.user.id), eq(notifications.read, false)))
      .orderBy(desc(notifications.created_at))
      .limit(30)
    res.json(rows)
  } catch (err: any) {
    console.error('GET /notifications error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get notifications' })
  }
})

router.patch('/mark-all-read', requireAuth as any, async (req: any, res) => {
  try {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.user_id, req.user.id), eq(notifications.read, false)))
    res.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /notifications/mark-all-read error:', err)
    res.status(500).json({ error: err?.message || 'Failed to mark all as read' })
  }
})

router.patch('/:id/read', requireAuth as any, async (req: any, res) => {
  try {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /notifications/:id/read error:', err)
    res.status(500).json({ error: err?.message || 'Failed to mark notification as read' })
  }
})

export default router
