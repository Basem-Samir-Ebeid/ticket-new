import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { maintenanceSchedules, assets, profiles } from '../../shared/schema'
import { eq } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const rows = await db.select().from(maintenanceSchedules).orderBy(maintenanceSchedules.next_due_date)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load maintenance schedules' })
  }
})

router.get('/asset/:assetId', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(maintenanceSchedules)
      .where(eq(maintenanceSchedules.asset_id, req.params.assetId))
      .orderBy(maintenanceSchedules.next_due_date)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load schedules' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { asset_id, title, description, frequency, next_due_date, assigned_to } = req.body
    if (!asset_id || !title || !next_due_date) return res.status(400).json({ error: 'asset_id, title, next_due_date required' })

    const [row] = await db.insert(maintenanceSchedules).values({
      asset_id,
      title: String(title).trim(),
      description: description || null,
      frequency: frequency || 'monthly',
      next_due_date,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
    }).returning()

    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create schedule' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { title, description, frequency, next_due_date, last_completed_date, assigned_to } = req.body
    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (frequency !== undefined) updates.frequency = frequency
    if (next_due_date !== undefined) updates.next_due_date = next_due_date
    if (last_completed_date !== undefined) updates.last_completed_date = last_completed_date
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null

    const [row] = await db.update(maintenanceSchedules).set(updates).where(eq(maintenanceSchedules.id, req.params.id)).returning()
    if (!row) return res.status(404).json({ error: 'Schedule not found' })
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update schedule' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete schedule' })
  }
})

export default router
