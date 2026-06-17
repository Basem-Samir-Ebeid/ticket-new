import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  factoryRotationSchedule,
  overtimeRotationSchedule,
  rotationSwapRequests,
  rotationAttendanceLogs,
  profiles,
  notifications,
} from '../../shared/schema'
import { eq, and, desc, gte, lte, or } from 'drizzle-orm'
import { broadcast } from '../ws'
import { sendEmail } from '../email'
import { sendWhatsAppToUser } from '../whatsappConfig'

const router = Router()

const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'
const isSuperAdmin = (role: string) => role === 'super_admin'

// ── Helper: Log attendance action ──────────────────────────────────────────
async function logAttendanceAction(
  scheduleId: string,
  module: 'factory' | 'overtime',
  action: string,
  performedBy: string,
  details?: any
) {
  await db.insert(rotationAttendanceLogs).values({
    schedule_id: scheduleId,
    module,
    action,
    performed_by: performedBy,
    details: JSON.stringify(details || {}),
    created_at: new Date(),
  })
}

// ── POST /mark-present: Employee marks themselves as present ──────────────
router.post('/mark-present', requireAuth as any, async (req: any, res) => {
  try {
    const { scheduleId, module } = req.body
    if (!scheduleId || !module) {
      return res.status(400).json({ error: 'scheduleId and module are required' })
    }

    const table = module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    // Verify this schedule belongs to the current user
    const schedule = await db
      .select()
      .from(table)
      .where(eq(table.id, scheduleId))
      .limit(1)

    if (!schedule.length || schedule[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this schedule' })
    }

    // Update: Mark as present by user
    await db
      .update(table)
      .set({
        user_status: 'present',
        marked_by_user_at: new Date(),
        attended_at: new Date(),
      })
      .where(eq(table.id, scheduleId))

    await logAttendanceAction(scheduleId, module, 'user_marked_present', req.user.id)

    // Notify admins
    const adminProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    for (const admin of adminProfiles) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message: `${req.profile.full_name} marked themselves as present for ${module} rotation on ${schedule[0].scheduled_date}`,
        read: false,
        created_at: new Date(),
      })
    }

    broadcast({
      type: 'attendance_update',
      module,
      scheduleId,
      status: 'user_present',
    })

    res.json({ success: true, message: 'Marked as present' })
  } catch (err: any) {
    console.error('mark-present error:', err)
    res.status(500).json({ error: err?.message || 'Failed to mark present' })
  }
})

// ── POST /mark-absent: Employee marks themselves as absent ──────────────
router.post('/mark-absent', requireAuth as any, async (req: any, res) => {
  try {
    const { scheduleId, module, reason } = req.body
    if (!scheduleId || !module) {
      return res.status(400).json({ error: 'scheduleId and module are required' })
    }

    const table = module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    // Verify this schedule belongs to the current user
    const schedule = await db
      .select()
      .from(table)
      .where(eq(table.id, scheduleId))
      .limit(1)

    if (!schedule.length || schedule[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this schedule' })
    }

    // Update: Mark as absent by user
    await db
      .update(table)
      .set({
        user_status: 'absent',
        is_absent: true,
        marked_by_user_at: new Date(),
      })
      .where(eq(table.id, scheduleId))

    await logAttendanceAction(scheduleId, module, 'user_marked_absent', req.user.id, { reason })

    // Create swap request instead - let another employee take their place
    // (or notify admin to assign replacement)
    const adminProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    for (const admin of adminProfiles) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message: `${req.profile.full_name} marked as absent for ${module} rotation. Reason: ${reason || 'No reason provided'}`,
        read: false,
        created_at: new Date(),
      })
    }

    broadcast({
      type: 'attendance_update',
      module,
      scheduleId,
      status: 'user_absent',
    })

    res.json({ success: true, message: 'Marked as absent' })
  } catch (err: any) {
    console.error('mark-absent error:', err)
    res.status(500).json({ error: err?.message || 'Failed to mark absent' })
  }
})

// ── POST /request-swap: Employee requests to swap with another employee ───
router.post('/request-swap', requireAuth as any, async (req: any, res) => {
  try {
    const { module, scheduleId, targetUserId, note } = req.body

    if (!module || !scheduleId || !targetUserId) {
      return res.status(400).json({ error: 'module, scheduleId, and targetUserId are required' })
    }

    const table = module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    // Get requester's schedule
    const requesterSchedule = await db
      .select()
      .from(table)
      .where(eq(table.id, scheduleId))
      .limit(1)

    if (!requesterSchedule.length || requesterSchedule[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this schedule' })
    }

    // Get target user's schedule (same date in same module)
    const targetSchedule = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.user_id, targetUserId),
          eq(table.scheduled_date, requesterSchedule[0].scheduled_date)
        )
      )
      .limit(1)

    if (!targetSchedule.length) {
      return res.status(400).json({ error: 'Target user has no schedule for this date' })
    }

    // Create swap request
    const [swapRequest] = await db
      .insert(rotationSwapRequests)
      .values({
        module,
        requester_id: req.user.id,
        target_id: targetUserId,
        requester_schedule_id: scheduleId,
        requester_date: requesterSchedule[0].scheduled_date,
        target_schedule_id: targetSchedule[0].id,
        target_date: targetSchedule[0].scheduled_date,
        note: note || null,
        status: 'pending',
        user_approval_status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning()

    // Notify target user
    const targetUser = await db.select().from(profiles).where(eq(profiles.id, targetUserId))
    if (targetUser.length) {
      await db.insert(notifications).values({
        user_id: targetUserId,
        message: `${req.profile.full_name} requested to swap ${module} rotation with you on ${requesterSchedule[0].scheduled_date}`,
        read: false,
        created_at: new Date(),
      })
    }

    await logAttendanceAction(scheduleId, module, 'swap_requested', req.user.id, { targetUserId })

    broadcast({
      type: 'swap_request',
      module,
      swapId: swapRequest.id,
      from: req.user.id,
      to: targetUserId,
    })

    res.json({ success: true, swapRequest })
  } catch (err: any) {
    console.error('request-swap error:', err)
    res.status(500).json({ error: err?.message || 'Failed to request swap' })
  }
})

// ── POST /approve-swap: Target user approves swap ──────────────────────────
router.post('/approve-swap/:swapId', requireAuth as any, async (req: any, res) => {
  try {
    const { swapId } = req.params
    const { note } = req.body

    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, swapId))
      .limit(1)

    if (!swapRequest.length) {
      return res.status(404).json({ error: 'Swap request not found' })
    }

    if (swapRequest[0].target_id !== req.user.id) {
      return res.status(403).json({ error: 'Only target user can approve' })
    }

    // Update swap request
    await db
      .update(rotationSwapRequests)
      .set({
        user_approval_status: 'approved',
        user_approved_at: new Date(),
        user_approval_note: note || null,
        status: 'pending_admin', // Awaiting super admin approval
        updated_at: new Date(),
      })
      .where(eq(rotationSwapRequests.id, swapId))

    // Notify super admins for final approval
    const adminProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    const requester = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, swapRequest[0].requester_id))

    for (const admin of adminProfiles) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message: `Swap request from ${requester[0]?.full_name} approved by ${req.profile.full_name}. Awaiting your approval.`,
        read: false,
        created_at: new Date(),
      })
    }

    await logAttendanceAction(swapRequest[0].requester_schedule_id, swapRequest[0].module, 'swap_approved_by_user', req.user.id)

    broadcast({
      type: 'swap_approved_by_user',
      swapId,
    })

    res.json({ success: true, message: 'Swap approved' })
  } catch (err: any) {
    console.error('approve-swap error:', err)
    res.status(500).json({ error: err?.message || 'Failed to approve swap' })
  }
})

// ── POST /reject-swap: Target user rejects swap ────────────────────────────
router.post('/reject-swap/:swapId', requireAuth as any, async (req: any, res) => {
  try {
    const { swapId } = req.params
    const { reason } = req.body

    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, swapId))
      .limit(1)

    if (!swapRequest.length) {
      return res.status(404).json({ error: 'Swap request not found' })
    }

    if (swapRequest[0].target_id !== req.user.id) {
      return res.status(403).json({ error: 'Only target user can reject' })
    }

    // Update swap request
    await db
      .update(rotationSwapRequests)
      .set({
        user_approval_status: 'rejected',
        user_approval_note: reason || null,
        status: 'rejected',
        updated_at: new Date(),
      })
      .where(eq(rotationSwapRequests.id, swapId))

    // Notify requester
    const requester = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, swapRequest[0].requester_id))

    if (requester.length) {
      await db.insert(notifications).values({
        user_id: swapRequest[0].requester_id,
        message: `${req.profile.full_name} rejected your swap request. Reason: ${reason || 'No reason provided'}`,
        read: false,
        created_at: new Date(),
      })
    }

    await logAttendanceAction(swapRequest[0].requester_schedule_id, swapRequest[0].module, 'swap_rejected_by_user', req.user.id)

    broadcast({
      type: 'swap_rejected_by_user',
      swapId,
    })

    res.json({ success: true, message: 'Swap rejected' })
  } catch (err: any) {
    console.error('reject-swap error:', err)
    res.status(500).json({ error: err?.message || 'Failed to reject swap' })
  }
})

// ── POST /approve-swap-admin: Super admin approves swap ─────────────────────
router.post('/approve-swap-admin/:swapId', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { swapId } = req.params

    const swapRequest = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, swapId))
      .limit(1)

    if (!swapRequest.length) {
      return res.status(404).json({ error: 'Swap request not found' })
    }

    const table = swapRequest[0].module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    // Swap the schedules
    const requesterSchedule = await db
      .select()
      .from(table)
      .where(eq(table.id, swapRequest[0].requester_schedule_id))
      .limit(1)

    const targetSchedule = await db
      .select()
      .from(table)
      .where(eq(table.id, swapRequest[0].target_schedule_id))
      .limit(1)

    if (requesterSchedule.length && targetSchedule.length) {
      // Swap the users
      await db
        .update(table)
        .set({ user_id: swapRequest[0].target_id, user_status: 'pending' })
        .where(eq(table.id, swapRequest[0].requester_schedule_id))

      await db
        .update(table)
        .set({ user_id: swapRequest[0].requester_id, user_status: 'pending' })
        .where(eq(table.id, swapRequest[0].target_schedule_id))
    }

    // Update swap request
    await db
      .update(rotationSwapRequests)
      .set({
        status: 'approved',
        updated_at: new Date(),
      })
      .where(eq(rotationSwapRequests.id, swapId))

    // Notify both users
    await db.insert(notifications).values({
      user_id: swapRequest[0].requester_id,
      message: `Your swap request has been approved by admin`,
      read: false,
      created_at: new Date(),
    })

    await db.insert(notifications).values({
      user_id: swapRequest[0].target_id,
      message: `Swap request has been approved by admin`,
      read: false,
      created_at: new Date(),
    })

    await logAttendanceAction(
      swapRequest[0].requester_schedule_id,
      swapRequest[0].module,
      'swap_approved_by_admin',
      req.user.id
    )

    broadcast({
      type: 'swap_approved_by_admin',
      swapId,
    })

    res.json({ success: true, message: 'Swap approved and applied' })
  } catch (err: any) {
    console.error('approve-swap-admin error:', err)
    res.status(500).json({ error: err?.message || 'Failed to approve swap' })
  }
})

// ── POST /mark-absent-admin: Super admin marks user as absent ───────────────
router.post('/mark-absent-admin/:scheduleId', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { scheduleId } = req.params
    const { module, reason } = req.body

    if (!module) {
      return res.status(400).json({ error: 'module is required' })
    }

    const table = module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule

    const schedule = await db
      .select()
      .from(table)
      .where(eq(table.id, scheduleId))
      .limit(1)

    if (!schedule.length) {
      return res.status(404).json({ error: 'Schedule not found' })
    }

    // Mark as absent by admin
    await db
      .update(table)
      .set({
        user_status: 'absent',
        is_absent: true,
        marked_by_admin_at: new Date(),
      })
      .where(eq(table.id, scheduleId))

    // Notify user
    await db.insert(notifications).values({
      user_id: schedule[0].user_id,
      message: `You have been marked as absent for ${module} rotation on ${schedule[0].scheduled_date}. Reason: ${reason || 'No reason provided'}`,
      read: false,
      created_at: new Date(),
    })

    await logAttendanceAction(scheduleId, module, 'admin_marked_absent', req.user.id, { reason })

    broadcast({
      type: 'attendance_update',
      module,
      scheduleId,
      status: 'admin_marked_absent',
    })

    res.json({ success: true, message: 'User marked as absent' })
  } catch (err: any) {
    console.error('mark-absent-admin error:', err)
    res.status(500).json({ error: err?.message || 'Failed to mark absent' })
  }
})

// ── GET /swaps: Get all swap requests ──────────────────────────────────────
router.get('/swaps', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'

    let swaps
    if (isAdmin) {
      swaps = await db.select().from(rotationSwapRequests).orderBy(desc(rotationSwapRequests.created_at))
    } else {
      swaps = await db
        .select()
        .from(rotationSwapRequests)
        .where(
          or(
            eq(rotationSwapRequests.requester_id, req.user.id),
            eq(rotationSwapRequests.target_id, req.user.id)
          )
        )
        .orderBy(desc(rotationSwapRequests.created_at))
    }

    res.json(swaps)
  } catch (err: any) {
    console.error('get swaps error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get swaps' })
  }
})

// ── GET /logs: Get attendance logs ─────────────────────────────────────────
router.get('/logs', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Admin only' })
    }

    const { module, scheduleId } = req.query

    let query = db.select().from(rotationAttendanceLogs)

    if (module) {
      query = query.where(eq(rotationAttendanceLogs.module, module as string))
    }
    if (scheduleId) {
      query = query.where(eq(rotationAttendanceLogs.schedule_id, scheduleId as string))
    }

    const logs = await query.orderBy(desc(rotationAttendanceLogs.created_at))

    res.json(logs)
  } catch (err: any) {
    console.error('get logs error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get logs' })
  }
})

export default router
