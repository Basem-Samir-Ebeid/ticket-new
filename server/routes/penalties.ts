import { Router } from 'express'
import { db } from '../db'
import { penalties, profiles, notifications } from '../../shared/schema'
import { eq, desc, and } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(penalties).orderBy(desc(penalties.created_at))
    } else {
      rows = await db.select().from(penalties)
        .where(eq(penalties.user_id, req.user.id))
        .orderBy(desc(penalties.created_at))
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      user: profileMap.get(r.user_id) || null,
      issued_by_user: r.issued_by ? (profileMap.get(r.issued_by) || null) : null,
    })))
  } catch (err: any) {
    console.error('GET /penalties error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get penalties' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    const { user_id, type, reason, amount, notes } = req.body
    if (!user_id || !reason) return res.status(400).json({ error: 'user_id and reason are required' })

    const [penalty] = await db.insert(penalties).values({
      user_id,
      type: type || 'warning',
      reason,
      amount: amount ? Number(amount) : null,
      notes: notes || null,
      issued_by: req.user.id,
    }).returning()

    const typeLabel: Record<string, string> = {
      warning: '⚠️ إنذار',
      deduction: '💰 خصم راتب',
      reprimand: '📋 لفت نظر',
      suspension: '🚫 إيقاف',
    }
    const label = typeLabel[penalty.type] || penalty.type

    const [notif] = await db.insert(notifications).values({
      user_id,
      message: `${label}: ${reason}`,
    }).returning()
    broadcast(user_id, 'notification', notif)
    broadcastAll('penalty_update', { action: 'created', penalty_id: penalty.id })

    res.json(penalty)
  } catch (err: any) {
    console.error('POST /penalties error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create penalty' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    const { type, reason, amount, notes } = req.body
    const [updated] = await db.update(penalties).set({
      type: type !== undefined && type !== '' ? type : undefined,
      reason: reason !== undefined && reason !== '' ? reason : undefined,
      amount: amount !== undefined ? Number(amount) : undefined,
      notes: notes !== undefined ? notes : undefined,
    }).where(eq(penalties.id, req.params.id)).returning()

    broadcastAll('penalty_update', { action: 'updated', penalty_id: updated.id })
    res.json(updated)
  } catch (err: any) {
    console.error('PATCH /penalties/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update penalty' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    await db.delete(penalties).where(eq(penalties.id, req.params.id))
    broadcastAll('penalty_update', { action: 'deleted' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /penalties/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete penalty' })
  }
})

export default router
