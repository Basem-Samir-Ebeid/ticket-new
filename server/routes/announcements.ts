import { Router } from 'express'
import { db } from '../db'
import { announcements, announcementReads, profiles } from '../../shared/schema'
import { requireAuth, requireAdmin } from '../auth'
import { eq, desc, and, or, isNull, gt, inArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

const router = Router()

router.get('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role

    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        type: announcements.type,
        target_roles: announcements.target_roles,
        is_active: announcements.is_active,
        expires_at: announcements.expires_at,
        created_by: announcements.created_by,
        created_at: announcements.created_at,
        created_by_name: profiles.full_name,
      })
      .from(announcements)
      .leftJoin(profiles, eq(profiles.id, announcements.created_by))
      .where(eq(announcements.is_active, true))
      .orderBy(desc(announcements.created_at))

    const reads = await db
      .select({ announcement_id: announcementReads.announcement_id })
      .from(announcementReads)
      .where(eq(announcementReads.user_id, userId))

    const readSet = new Set(reads.map(r => r.announcement_id))

    const visible = rows.filter(a => {
      if (a.expires_at && new Date(a.expires_at) < new Date()) return false
      if (!a.target_roles || a.target_roles.length === 0) return true
      return a.target_roles.includes(userRole)
    }).map(a => ({ ...a, is_read: readSet.has(a.id) }))

    res.json(visible)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { title, content, type = 'info', target_roles = [], expires_at } = req.body
    if (!title || !content) return res.status(400).json({ error: 'title and content required' })

    const [item] = await db.insert(announcements).values({
      title,
      content,
      type,
      target_roles,
      expires_at: expires_at ? new Date(expires_at) : null,
      created_by: req.user.id,
    }).returning()

    res.json(item)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/read', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    await db.insert(announcementReads)
      .values({ announcement_id: id, user_id: req.user.id })
      .onConflictDoNothing()
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    await db.delete(announcements).where(eq(announcements.id, req.params.id))
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
