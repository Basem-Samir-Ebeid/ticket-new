import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  rotationSwapRequests,
  factoryRotationSchedule,
  overtimeRotationSchedule,
  profiles,
  notifications,
  rotationAttendanceLogs,
} from '../../shared/schema'
import { eq, and, asc } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()

function toDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

// ── GET /pending (الموظف: طلبات التبديل المعلقة له) ──────────────────────────
router.get('/pending', requireAuth as any, async (req: any, res) => {
  try {
    const requests = await db
      .select({
        id: rotationSwapRequests.id,
        module: rotationSwapRequests.module,
        requester_id: rotationSwapRequests.requester_id,
        requester_name: profiles.full_name,
        requester_email: profiles.email,
        requester_date: rotationSwapRequests.requester_date,
        note: rotationSwapRequests.note,
        status: rotationSwapRequests.status,
        user_approval_status: rotationSwapRequests.user_approval_status,
        created_at: rotationSwapRequests.created_at,
      })
      .from(rotationSwapRequests)
      .leftJoin(profiles, eq(rotationSwapRequests.requester_id, profiles.id))
      .where(
        and(
          eq(rotationSwapRequests.target_id, req.user.id),
          eq(rotationSwapRequests.user_approval_status, 'pending')
        )
      )
      .orderBy(asc(rotationSwapRequests.created_at))

    res.json(requests)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load pending requests' })
  }
})

// ── GET /my-requests (الموظف: طلبات التبديل التي أنشأها) ───────────────────────
router.get('/my-requests', requireAuth as any, async (req: any, res) => {
  try {
    const requests = await db
      .select({
        id: rotationSwapRequests.id,
        module: rotationSwapRequests.module,
        target_id: rotationSwapRequests.target_id,
        target_name: profiles.full_name,
        target_email: profiles.email,
        requester_date: rotationSwapRequests.requester_date,
        note: rotationSwapRequests.note,
        status: rotationSwapRequests.status,
        user_approval_status: rotationSwapRequests.user_approval_status,
        created_at: rotationSwapRequests.created_at,
      })
      .from(rotationSwapRequests)
      .leftJoin(profiles, eq(rotationSwapRequests.target_id, profiles.id))
      .where(eq(rotationSwapRequests.requester_id, req.user.id))
      .orderBy(asc(rotationSwapRequests.created_at))

    res.json(requests)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load requests' })
  }
})

// ── POST /:id/approve-user (الموظف الآخر: يوافق على التبديل) ───────────────────
router.post('/:id/approve-user', requireAuth as any, async (req: any, res) => {
  try {
    const { note } = req.body
    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)

    if (!swapRequest.length) return res.status(404).json({ error: 'Request not found' })
    const request = swapRequest[0]

    // Only the target user can approve
    if (request.target_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' })

    // Update swap request status
    const [updated] = await db
      .update(rotationSwapRequests)
      .set({
        user_approval_status: 'approved',
        user_approved_at: new Date(),
        user_approval_note: note,
        status: 'pending_admin',
      })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    // Notify requester and admins
    const [requester] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, request.requester_id))
    const requesterName = requester?.full_name || 'موظف'

    const [target] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, request.target_id))
    const targetName = target?.full_name || 'موظف'

    // Notify requester
    await db.insert(notifications).values({
      user_id: request.requester_id,
      message: `✅ ${targetName} وافق على تبديل دورك في ${request.requester_date}. جاري انتظار موافقة الإدارة.`,
    })
    broadcast(request.requester_id, 'notification', {
      message: `✅ ${targetName} وافق على تبديل دورك في ${request.requester_date}. جاري انتظار موافقة الإدارة.`,
    })

    // Notify super admins
    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    const adminMsg = `📋 طلب تبديل معلق من ${requesterName} و${targetName} في ${request.requester_date}`
    for (const admin of admins) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message: adminMsg,
      })
      broadcast(admin.id, 'notification', { message: adminMsg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to approve request' })
  }
})

// ── POST /:id/reject-user (الموظف الآخر: يرفض التبديل) ────────────────────────
router.post('/:id/reject-user', requireAuth as any, async (req: any, res) => {
  try {
    const { note } = req.body
    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)

    if (!swapRequest.length) return res.status(404).json({ error: 'Request not found' })
    const request = swapRequest[0]

    // Only the target user can reject
    if (request.target_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' })

    // Update swap request status
    const [updated] = await db
      .update(rotationSwapRequests)
      .set({
        user_approval_status: 'rejected',
        user_approved_at: new Date(),
        user_approval_note: note,
        status: 'rejected_by_user',
      })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    // Reset schedule status
    if (request.requester_schedule_id) {
      await db
        .update(factoryRotationSchedule)
        .set({ user_status: 'pending' })
        .where(eq(factoryRotationSchedule.id, request.requester_schedule_id))
        .catch(() => {})
      await db
        .update(overtimeRotationSchedule)
        .set({ user_status: 'pending' })
        .where(eq(overtimeRotationSchedule.id, request.requester_schedule_id))
        .catch(() => {})
    }

    // Notify requester
    const [target] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, request.target_id))
    const targetName = target?.full_name || 'موظف'

    await db.insert(notifications).values({
      user_id: request.requester_id,
      message: `❌ ${targetName} رفض تبديل دورك في ${request.requester_date}.`,
    })
    broadcast(request.requester_id, 'notification', {
      message: `❌ ${targetName} رفض تبديل دورك في ${request.requester_date}.`,
    })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject request' })
  }
})

// ── POST /:id/approve-admin (السوبر أدمن: موافقة نهائية) ────────────────────────
router.post('/:id/approve-admin', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)

    if (!swapRequest.length) return res.status(404).json({ error: 'Request not found' })
    const request = swapRequest[0]

    if (request.user_approval_status !== 'approved')
      return res.status(400).json({ error: 'User must approve first' })

    // Get both schedule entries
    let requesterSchedule: any = null
    let targetSchedule: any = null

    if (request.module === 'factory') {
      const schedules = await db
        .select()
        .from(factoryRotationSchedule)
        .where(
          and(
            eq(factoryRotationSchedule.id, request.requester_schedule_id)
          )
        )
      requesterSchedule = schedules[0]

      // If target has a specific date, find their schedule
      if (request.target_date && request.target_schedule_id) {
        const targetSchedules = await db
          .select()
          .from(factoryRotationSchedule)
          .where(eq(factoryRotationSchedule.id, request.target_schedule_id))
        targetSchedule = targetSchedules[0]
      }
    } else if (request.module === 'overtime') {
      const schedules = await db
        .select()
        .from(overtimeRotationSchedule)
        .where(eq(overtimeRotationSchedule.id, request.requester_schedule_id))
      requesterSchedule = schedules[0]

      if (request.target_date && request.target_schedule_id) {
        const targetSchedules = await db
          .select()
          .from(overtimeRotationSchedule)
          .where(eq(overtimeRotationSchedule.id, request.target_schedule_id))
        targetSchedule = targetSchedules[0]
      }
    }

    if (!requesterSchedule) return res.status(400).json({ error: 'Requester schedule not found' })

    // Swap the users in schedules
    const swapScheduleTable = request.module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    // Update requester schedule with target
    await db
      .update(swapScheduleTable)
      .set({
        user_id: request.target_id,
        user_status: 'present',
        marked_by_admin_at: new Date(),
      })
      .where(eq(swapScheduleTable.id, request.requester_schedule_id))

    // Update target schedule with requester (if exists)
    if (targetSchedule) {
      await db
        .update(swapScheduleTable)
        .set({
          user_id: request.requester_id,
          user_status: 'present',
          marked_by_admin_at: new Date(),
        })
        .where(eq(swapScheduleTable.id, request.target_schedule_id))
    }

    // Update swap request
    const [updated] = await db
      .update(rotationSwapRequests)
      .set({
        status: 'approved',
      })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    // Log action
    await db.insert(rotationAttendanceLogs).values({
      schedule_id: request.requester_schedule_id,
      module: request.module,
      action: 'swap_approved',
      performed_by: req.user.id,
    })

    // Notify both users
    const [requester] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, request.requester_id))
    const requesterName = requester?.full_name || 'موظف'

    const [target] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, request.target_id))
    const targetName = target?.full_name || 'موظف'

    const baseMsg = `تم الموافقة على التبديل في ${request.requester_date}`
    await db.insert(notifications).values({
      user_id: request.requester_id,
      message: `✅ ${baseMsg}. أنت الآن مسؤول عن ${request.target_id === request.requester_id ? 'دورة جديدة' : 'دور جديد'}.`,
    })
    broadcast(request.requester_id, 'notification', {
      message: `✅ ${baseMsg}. أنت الآن مسؤول عن دور جديد.`,
    })

    await db.insert(notifications).values({
      user_id: request.target_id,
      message: `✅ ${baseMsg}. أنت الآن مسؤول عن دور جديد.`,
    })
    broadcast(request.target_id, 'notification', {
      message: `✅ ${baseMsg}. أنت الآن مسؤول عن دور جديد.`,
    })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to approve swap' })
  }
})

// ── GET /admin/all (السوبر أدمن: جميع الطلبات) ──────────────────────────────────
router.get('/admin/all', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const requests = await db
      .select({
        id: rotationSwapRequests.id,
        module: rotationSwapRequests.module,
        requester_id: rotationSwapRequests.requester_id,
        requester_name: profiles.full_name,
        target_id: rotationSwapRequests.target_id,
        requester_date: rotationSwapRequests.requester_date,
        status: rotationSwapRequests.status,
        user_approval_status: rotationSwapRequests.user_approval_status,
        created_at: rotationSwapRequests.created_at,
      })
      .from(rotationSwapRequests)
      .leftJoin(profiles, eq(rotationSwapRequests.requester_id, profiles.id))
      .orderBy(asc(rotationSwapRequests.created_at))

    res.json(requests)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load requests' })
  }
})

export default router
