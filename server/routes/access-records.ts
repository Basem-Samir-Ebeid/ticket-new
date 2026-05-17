import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { accessRecords } from '../../shared/schema'
import { eq, isNull } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const rows = await db.select().from(accessRecords).orderBy(accessRecords.granted_at)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load access records' })
  }
})

router.get('/user/:userId', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role) && req.user.id !== req.params.userId) return res.status(403).json({ error: 'Forbidden' })
    const rows = await db.select().from(accessRecords).where(eq(accessRecords.user_id, req.params.userId))
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load records' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { user_id, system_name, access_level, notes } = req.body
    if (!user_id || !system_name) return res.status(400).json({ error: 'user_id, system_name required' })

    const [row] = await db.insert(accessRecords).values({
      user_id,
      system_name: String(system_name).trim(),
      access_level: access_level || 'read',
      granted_by: req.user.id,
      notes: notes || null,
    }).returning()
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create access record' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { revoked, access_level, notes } = req.body
    const updates: any = {}
    if (revoked !== undefined) updates.revoked_at = revoked ? new Date() : null
    if (access_level !== undefined) updates.access_level = access_level
    if (notes !== undefined) updates.notes = notes

    const [row] = await db.update(accessRecords).set(updates).where(eq(accessRecords.id, req.params.id)).returning()
    if (!row) return res.status(404).json({ error: 'Record not found' })
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update access record' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(accessRecords).where(eq(accessRecords.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete record' })
  }
})

export default router
