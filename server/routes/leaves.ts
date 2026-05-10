import { Router } from 'express'
import { db } from '../db'
import { leaveRequests, profiles, notifications } from '../../shared/schema'
import { eq, desc, or, and, gte, lte } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'
import { sendWhatsAppToUser } from '../whatsappConfig'

const router = Router()

function calcWorkingDays(startDate: string, endDate: string): number {
  let count = 0
  const cur = new Date(startDate)
  const end = new Date(endDate)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(1, count)
}

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    let rows
    if (req.profile.role === 'admin' || req.profile.role === 'super_admin') {
      rows = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.created_at))
    } else {
      rows = await db.select().from(leaveRequests)
        .where(eq(leaveRequests.user_id, req.user.id))
        .orderBy(desc(leaveRequests.created_at))
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role,
      leave_balance: profiles.leave_balance, sick_leave_balance: profiles.sick_leave_balance,
      emergency_leave_balance: profiles.emergency_leave_balance
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      user: profileMap.get(r.user_id) || null,
    })))
  } catch (err: any) {
    console.error('GET /leaves error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get leave requests' })
  }
})

router.get('/calendar', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(leaveRequests)
        .where(eq(leaveRequests.status, 'approved'))
        .orderBy(leaveRequests.start_date)
    } else {
      rows = await db.select().from(leaveRequests)
        .where(and(eq(leaveRequests.user_id, req.user.id), eq(leaveRequests.status, 'approved')))
        .orderBy(leaveRequests.start_date)
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      user: profileMap.get(r.user_id) || null,
    })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get leave calendar' })
  }
})

router.get('/monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' })

    const now = new Date()
    const year = parseInt(req.query.year as string) || now.getFullYear()
    const month = parseInt(req.query.month as string) || now.getMonth() + 1

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

    const rows = await db.select().from(leaveRequests)
      .where(and(gte(leaveRequests.start_date, firstDay), lte(leaveRequests.start_date, lastDay)))

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role,
      leave_balance: profiles.leave_balance, sick_leave_balance: profiles.sick_leave_balance,
      emergency_leave_balance: profiles.emergency_leave_balance
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    const stats = {
      total: rows.length,
      approved: rows.filter(r => r.status === 'approved').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
      pending: rows.filter(r => r.status === 'pending').length,
      byType: {} as Record<string, number>,
      topUsers: [] as any[],
    }

    for (const r of rows) {
      if (!stats.byType[r.leave_type]) stats.byType[r.leave_type] = 0
      stats.byType[r.leave_type]++
    }

    const userLeaveMap = new Map<string, number>()
    for (const r of rows.filter(x => x.status === 'approved')) {
      const days = r.days_count || 1
      userLeaveMap.set(r.user_id, (userLeaveMap.get(r.user_id) || 0) + days)
    }
    stats.topUsers = Array.from(userLeaveMap.entries())
      .map(([id, days]) => ({ user: profileMap.get(id), days }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10)

    res.json({ year, month, stats, leaves: rows.map(r => ({ ...r, user: profileMap.get(r.user_id) || null })) })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate leave report' })
  }
})

router.get('/balance', requireAuth as any, async (req: any, res) => {
  try {
    const targetId = (req.query.user_id as string) || req.user.id
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    if (targetId !== req.user.id && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    const [prof] = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email,
      leave_balance: profiles.leave_balance, sick_leave_balance: profiles.sick_leave_balance,
      emergency_leave_balance: profiles.emergency_leave_balance
    }).from(profiles).where(eq(profiles.id, targetId))

    if (!prof) return res.status(404).json({ error: 'User not found' })

    const approvedLeaves = await db.select().from(leaveRequests)
      .where(and(eq(leaveRequests.user_id, targetId), eq(leaveRequests.status, 'approved')))

    const usedByType: Record<string, number> = { annual: 0, sick: 0, emergency: 0, unpaid: 0 }
    for (const l of approvedLeaves) {
      const t = l.leave_type || 'annual'
      if (!usedByType[t]) usedByType[t] = 0
      usedByType[t] += l.days_count || 1
    }

    res.json({
      user: prof,
      balance: {
        annual: { total: prof.leave_balance, used: usedByType.annual, remaining: Math.max(0, prof.leave_balance - usedByType.annual) },
        sick: { total: prof.sick_leave_balance, used: usedByType.sick, remaining: Math.max(0, prof.sick_leave_balance - usedByType.sick) },
        emergency: { total: prof.emergency_leave_balance, used: usedByType.emergency, remaining: Math.max(0, prof.emergency_leave_balance - usedByType.emergency) },
        unpaid: { total: 999, used: usedByType.unpaid, remaining: 999 },
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get leave balance' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    const { start_date, end_date, reason, leave_type } = req.body
    if (!start_date || !end_date) return res.status(400).json({ error: 'Dates required' })

    const ltype = leave_type || 'annual'
    const days = calcWorkingDays(start_date, end_date)

    const [prof] = await db.select({
      leave_balance: profiles.leave_balance, sick_leave_balance: profiles.sick_leave_balance,
      emergency_leave_balance: profiles.emergency_leave_balance
    }).from(profiles).where(eq(profiles.id, req.user.id))

    const balanceMap: Record<string, number> = {
      annual: prof?.leave_balance || 0,
      sick: prof?.sick_leave_balance || 0,
      emergency: prof?.emergency_leave_balance || 0,
      unpaid: 999,
    }

    const pendingLeaves = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.user_id, req.user.id),
        eq(leaveRequests.leave_type, ltype),
        eq(leaveRequests.status, 'pending')
      ))
    const pendingDays = pendingLeaves.reduce((sum, l) => sum + (l.days_count || 1), 0)
    const available = (balanceMap[ltype] ?? 0) - pendingDays

    if (ltype !== 'unpaid' && days > available) {
      return res.status(400).json({ error: `رصيد الإجازة غير كافٍ. المتاح: ${available} يوم، المطلوب: ${days} يوم.` })
    }

    const conflicting = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.user_id, req.user.id),
        eq(leaveRequests.status, 'approved'),
        lte(leaveRequests.start_date, end_date),
        gte(leaveRequests.end_date, start_date)
      ))

    const [leave] = await db.insert(leaveRequests).values({
      user_id: req.user.id,
      start_date,
      end_date,
      reason: reason || null,
      leave_type: ltype,
      days_count: days,
      status: 'pending',
    }).returning()

    const admins = await db.select({ id: profiles.id }).from(profiles)
      .where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'super_admin')))
    const senderName = req.profile.full_name || req.profile.email
    const conflictNote = conflicting.length > 0 ? ` ⚠️ تعارض مع ${conflicting.length} إجازة أخرى!` : ''
    const typeLabel: Record<string, string> = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }
    for (const admin of admins) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        message: `🌴 طلب إجازة ${typeLabel[ltype] || ltype} من ${senderName} (${start_date} → ${end_date} | ${days} أيام)${conflictNote}`,
      }).returning()
      broadcast(admin.id, 'notification', notif)
    }

    broadcastAll('leave_update', { action: 'created', leave_id: leave.id })
    res.json({ ...leave, conflict_count: conflicting.length })
  } catch (err: any) {
    console.error('POST /leaves error:', err)
    res.status(500).json({ error: err?.message || 'Failed to submit leave request' })
  }
})

router.patch('/:id/approve', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })

    const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Leave request not found' })

    const [leave] = await db.update(leaveRequests).set({
      status: 'approved',
      admin_note: null,
      decided_by: req.user.id,
      decided_at: new Date(),
    }).where(eq(leaveRequests.id, req.params.id)).returning()

    if (leave && existing.status !== 'approved') {
      const days = leave.days_count || 1
      const ltype = leave.leave_type || 'annual'
      if (ltype === 'annual') {
        await db.update(profiles).set({ leave_balance: Math.max(0, (await db.select({ lb: profiles.leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id)))[0]?.lb - days || 0) }).where(eq(profiles.id, leave.user_id))
      } else if (ltype === 'sick') {
        await db.update(profiles).set({ sick_leave_balance: Math.max(0, (await db.select({ lb: profiles.sick_leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id)))[0]?.lb - days || 0) }).where(eq(profiles.id, leave.user_id))
      } else if (ltype === 'emergency') {
        await db.update(profiles).set({ emergency_leave_balance: Math.max(0, (await db.select({ lb: profiles.emergency_leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id)))[0]?.lb - days || 0) }).where(eq(profiles.id, leave.user_id))
      }

      const typeLabel: Record<string, string> = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }
      const [notif] = await db.insert(notifications).values({
        user_id: leave.user_id,
        message: `✅ تمت الموافقة على إجازتك ${typeLabel[ltype] || ltype} (${leave.start_date} → ${leave.end_date} | ${days} أيام)`,
      }).returning()
      broadcast(leave.user_id, 'notification', notif)
      const waMsg = `✅ تمت الموافقة على إجازتك\n\nنوع الإجازة: ${typeLabel[ltype] || ltype}\nمن: ${leave.start_date}\nإلى: ${leave.end_date}\nعدد الأيام: ${days}\n\nنتمنى لك إجازة سعيدة! 🌴`
      sendWhatsAppToUser(leave.user_id, waMsg).catch(() => {})
      broadcastAll('leave_update', { action: 'approved', leave_id: leave.id })
    }

    res.json(leave)
  } catch (err: any) {
    console.error('PATCH /leaves/:id/approve error:', err)
    res.status(500).json({ error: err?.message || 'Failed to approve leave request' })
  }
})

router.patch('/:id/reject', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })
    const { note } = req.body

    const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Leave request not found' })

    const [leave] = await db.update(leaveRequests).set({
      status: 'rejected',
      admin_note: note || null,
      decided_by: req.user.id,
      decided_at: new Date(),
    }).where(eq(leaveRequests.id, req.params.id)).returning()

    if (leave) {
      // If the leave was previously approved, restore the balance
      if (existing.status === 'approved') {
        const days = leave.days_count || 1
        const ltype = leave.leave_type || 'annual'
        if (ltype === 'annual') {
          const [prof] = await db.select({ lb: profiles.leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id))
          await db.update(profiles).set({ leave_balance: (prof?.lb || 0) + days }).where(eq(profiles.id, leave.user_id))
        } else if (ltype === 'sick') {
          const [prof] = await db.select({ lb: profiles.sick_leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id))
          await db.update(profiles).set({ sick_leave_balance: (prof?.lb || 0) + days }).where(eq(profiles.id, leave.user_id))
        } else if (ltype === 'emergency') {
          const [prof] = await db.select({ lb: profiles.emergency_leave_balance }).from(profiles).where(eq(profiles.id, leave.user_id))
          await db.update(profiles).set({ emergency_leave_balance: (prof?.lb || 0) + days }).where(eq(profiles.id, leave.user_id))
        }
      }

      const [notif] = await db.insert(notifications).values({
        user_id: leave.user_id,
        message: `❌ تم رفض طلب إجازتك (${leave.start_date} → ${leave.end_date})${note ? ' — ' + note : ''}`,
      }).returning()
      broadcast(leave.user_id, 'notification', notif)
      sendWhatsAppToUser(leave.user_id, `❌ تم رفض طلب إجازتك\nمن ${leave.start_date} إلى ${leave.end_date}${note ? '\nالسبب: ' + note : ''}`).catch(() => {})
      broadcastAll('leave_update', { action: 'rejected', leave_id: leave.id })
    }

    res.json(leave)
  } catch (err: any) {
    console.error('PATCH /leaves/:id/reject error:', err)
    res.status(500).json({ error: err?.message || 'Failed to reject leave request' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })
    await db.delete(leaveRequests).where(eq(leaveRequests.id, req.params.id))
    broadcastAll('leave_update', { action: 'deleted' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /leaves/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete leave request' })
  }
})

export default router
