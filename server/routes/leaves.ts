import { Router } from 'express'
import { db } from '../db'
import { leaveRequests, profiles, notifications } from '../../shared/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  let rows
  if (req.profile.role === 'admin') {
    rows = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.created_at))
  } else {
    rows = await db.select().from(leaveRequests)
      .where(eq(leaveRequests.user_id, req.user.id))
      .orderBy(desc(leaveRequests.created_at))
  }

  const allProfiles = await db.select({
    id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
  }).from(profiles)
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))

  res.json(rows.map(r => ({
    ...r,
    user: profileMap.get(r.user_id) || null,
  })))
})

router.post('/', requireAuth as any, async (req: any, res) => {
  const { start_date, end_date, reason } = req.body
  if (!start_date || !end_date) return res.status(400).json({ error: 'Dates required' })

  const [leave] = await db.insert(leaveRequests).values({
    user_id: req.user.id,
    start_date,
    end_date,
    reason: reason || null,
    status: 'pending',
  }).returning()

  // Notify admins
  const admins = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, 'admin'))
  const senderName = req.profile.full_name || req.profile.email
  for (const admin of admins) {
    const [notif] = await db.insert(notifications).values({
      user_id: admin.id,
      message: `🌴 New leave request from ${senderName} (${start_date} → ${end_date})`,
    }).returning()
    broadcast(admin.id, 'notification', notif)
  }

  broadcastAll('leave_update', { action: 'created', leave_id: leave.id })
  res.json(leave)
})

router.patch('/:id/approve', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const [leave] = await db.update(leaveRequests).set({
    status: 'approved',
    admin_note: null,
    decided_by: req.user.id,
    decided_at: new Date(),
  }).where(eq(leaveRequests.id, req.params.id)).returning()

  if (leave) {
    const [notif] = await db.insert(notifications).values({
      user_id: leave.user_id,
      message: `✅ Your leave request (${leave.start_date} → ${leave.end_date}) was approved`,
    }).returning()
    broadcast(leave.user_id, 'notification', notif)
    broadcastAll('leave_update', { action: 'approved', leave_id: leave.id })
  }

  res.json(leave)
})

router.patch('/:id/reject', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { note } = req.body

  const [leave] = await db.update(leaveRequests).set({
    status: 'rejected',
    admin_note: note || null,
    decided_by: req.user.id,
    decided_at: new Date(),
  }).where(eq(leaveRequests.id, req.params.id)).returning()

  if (leave) {
    const [notif] = await db.insert(notifications).values({
      user_id: leave.user_id,
      message: `❌ Your leave request (${leave.start_date} → ${leave.end_date}) was rejected${note ? ' — ' + note : ''}`,
    }).returning()
    broadcast(leave.user_id, 'notification', notif)
    broadcastAll('leave_update', { action: 'rejected', leave_id: leave.id })
  }

  res.json(leave)
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  await db.delete(leaveRequests).where(eq(leaveRequests.id, req.params.id))
  broadcastAll('leave_update', { action: 'deleted' })
  res.json({ success: true })
})

export default router
