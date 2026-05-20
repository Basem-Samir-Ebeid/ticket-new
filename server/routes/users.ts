import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { profiles, sessionRevocations, tickets, loginTimes, leaveRequests, assets, penalties } from '../../shared/schema'
import { eq, desc, and, gte } from 'drizzle-orm'
import { requireAuth, requireAdmin, checkPermission } from '../auth'
import { broadcast } from '../ws'
import { sendWhatsAppToPhone } from '../whatsappConfig'
import { logAudit } from './audit-logs'

const router = Router()

router.get('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const isSuperAdmin = req.profile?.role === 'super_admin'
    const rows = await db.select().from(profiles).orderBy(desc(profiles.created_at))
    const users = rows.map(u => {
      const { password_hash, ...rest } = u
      return rest
    })
    res.json(users)
  } catch (err: any) {
    console.error('GET /users error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get users' })
  }
})

router.post('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const {
      email, password, full_name, role, can_view_attendance, can_view_assets, can_view_whatsapp_contacts,
      department, job_title, phone, national_id, hire_date, birth_date,
      gender, address, employment_type, employee_code, direct_manager, notes,
    } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const existing = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase()))
    if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' })

    const password_hash = await bcrypt.hash(password, 10)
    const [user] = await db.insert(profiles).values({
      email: email.toLowerCase(),
      password_hash,
      full_name: full_name || null,
      role: role || 'employee',
      can_view_attendance: can_view_attendance || false,
      can_view_assets: can_view_assets || false,
      can_view_whatsapp_contacts: (can_view_whatsapp_contacts === true || can_view_whatsapp_contacts === 'true'),
      must_change_password: true,
      department: department || null,
      job_title: job_title || null,
      phone: phone || null,
      national_id: national_id || null,
      hire_date: hire_date || null,
      birth_date: birth_date || null,
      gender: gender || null,
      address: address || null,
      employment_type: employment_type || 'full_time',
      employee_code: employee_code || null,
      direct_manager: direct_manager || null,
      notes: notes || null,
    }).returning()

    logAudit({
      user_id: req.user.id,
      user_name: req.profile?.full_name,
      action_type: 'user_created',
      entity_type: 'user',
      entity_id: user.id,
      description: `User created: ${email}`,
    }).catch(() => {})

    const { password_hash: _, ...safeUser } = user
    res.json(safeUser)
  } catch (err: any) {
    console.error('POST /users error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create user' })
  }
})

router.patch('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const {
      full_name, role, can_view_attendance, can_view_assets, can_view_whatsapp_contacts, profile_picture_url,
      leave_balance, sick_leave_balance, emergency_leave_balance, work_start_hour,
      department, job_title, phone, national_id, hire_date, birth_date,
      gender, address, employment_type, employee_code, direct_manager, notes,
      whatsapp_phone, permissions,
    } = req.body

    console.log('[PATCH /users/:id] body:', { can_view_whatsapp_contacts, can_view_attendance, can_view_assets, role })

    const updateData: Record<string, any> = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (role !== undefined) updateData.role = role
    if (can_view_attendance !== undefined) updateData.can_view_attendance = Boolean(can_view_attendance)
    if (can_view_assets !== undefined) updateData.can_view_assets = Boolean(can_view_assets)
    if (can_view_whatsapp_contacts !== undefined) updateData.can_view_whatsapp_contacts = (can_view_whatsapp_contacts === true || can_view_whatsapp_contacts === 'true')
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url
    if (leave_balance !== undefined) updateData.leave_balance = Number(leave_balance)
    if (sick_leave_balance !== undefined) updateData.sick_leave_balance = Number(sick_leave_balance)
    if (emergency_leave_balance !== undefined) updateData.emergency_leave_balance = Number(emergency_leave_balance)
    if (work_start_hour !== undefined) updateData.work_start_hour = Number(work_start_hour)

    // HR fields — allow explicit null/empty to clear them
    const hrFields = { department, job_title, phone, national_id, hire_date, birth_date, gender, address, employment_type, employee_code, direct_manager, notes }
    for (const [k, v] of Object.entries(hrFields)) {
      if (v !== undefined) updateData[k] = v || null
    }

    // WhatsApp fields
    if (whatsapp_phone !== undefined) updateData.whatsapp_phone = whatsapp_phone?.trim() || null

    // Fine-grained JSONB permissions
    if (permissions !== undefined && typeof permissions === 'object' && permissions !== null) {
      updateData.permissions = permissions
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No fields to update' })

    console.log('[PATCH] can_view_whatsapp_contacts final value:', updateData.can_view_whatsapp_contacts, typeof updateData.can_view_whatsapp_contacts)

    const [user] = await db.update(profiles)
      .set(updateData)
      .where(eq(profiles.id, req.params.id))
      .returning()

    if (!user) return res.status(404).json({ error: 'User not found' })
    console.log('[PATCH /users/:id] saved can_view_whatsapp_contacts:', user.can_view_whatsapp_contacts)

    logAudit({
      user_id: req.user.id,
      user_name: req.profile?.full_name,
      action_type: 'user_updated',
      entity_type: 'user',
      entity_id: user.id,
      description: `User updated: ${user.email}`,
      before: { role: updateData.role !== undefined ? undefined : user.role, permissions: updateData.permissions !== undefined ? undefined : user.permissions },
      after: { role: updateData.role, permissions: updateData.permissions },
    }).catch(() => {})

    const { password_hash, ...safeUser } = user
    res.json(safeUser)
  } catch (err: any) {
    console.error('PATCH /users/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update user' })
  }
})

router.post('/bulk-reset-leave', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const { leave_balance, sick_leave_balance, emergency_leave_balance, roles } = req.body
    if (leave_balance === undefined && sick_leave_balance === undefined && emergency_leave_balance === undefined) {
      return res.status(400).json({ error: 'At least one balance field is required' })
    }
    const updateData: Record<string, any> = {}
    if (leave_balance !== undefined) updateData.leave_balance = Number(leave_balance)
    if (sick_leave_balance !== undefined) updateData.sick_leave_balance = Number(sick_leave_balance)
    if (emergency_leave_balance !== undefined) updateData.emergency_leave_balance = Number(emergency_leave_balance)

    let allUsers = await db.select().from(profiles)
    if (roles && Array.isArray(roles) && roles.length > 0) {
      allUsers = allUsers.filter(u => roles.includes(u.role))
    }

    let updated = 0
    for (const u of allUsers) {
      await db.update(profiles).set(updateData).where(eq(profiles.id, u.id))
      updated++
    }

    res.json({ success: true, updated })
  } catch (err: any) {
    console.error('POST /users/bulk-reset-leave error:', err)
    res.status(500).json({ error: err?.message || 'Failed to bulk reset leave balances' })
  }
})

router.post('/:id/reset-password', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const password_hash = await bcrypt.hash(newPassword, 10)
    const [user] = await db.update(profiles).set({ password_hash, must_change_password: true }).where(eq(profiles.id, req.params.id)).returning()
    if (!user) return res.status(404).json({ error: 'User not found' })
    logAudit({
      user_id: req.user.id,
      user_name: req.profile?.full_name,
      action_type: 'password_reset_by_admin',
      entity_type: 'user',
      entity_id: req.params.id,
      description: `Admin reset password for user: ${req.params.id}`,
    }).catch(() => {})
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /users/:id/reset-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to reset password' })
  }
})

router.post('/:id/test-whatsapp', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const [user] = await db.select({
      whatsapp_phone: profiles.whatsapp_phone,
      full_name: profiles.full_name,
      email: profiles.email,
    }).from(profiles).where(eq(profiles.id, req.params.id)).limit(1)

    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!user.whatsapp_phone) {
      return res.status(400).json({ error: 'هذا المستخدم لا يملك رقم واتساب محفوظ — أضف رقمه أولاً' })
    }

    const name = user.full_name || user.email
    await sendWhatsAppToPhone(
      user.whatsapp_phone,
      '',
      `✅ Finest IT — اختبار ناجح!\nمرحباً ${name}، ستصلك إشعارات التيكتات والحضور والإجازات هنا.`
    )
    res.json({ ok: true, message: 'تم إرسال رسالة اختبار! تحقق من واتساب.' })
  } catch (err: any) {
    console.error('POST /users/:id/test-whatsapp error:', err)
    res.status(500).json({ error: err?.message || 'فشل إرسال رسالة الاختبار — تأكد من إعدادات Green API في الإعدادات العامة' })
  }
})

router.delete('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const userId = req.params.id
    await db.insert(sessionRevocations).values({ user_id: userId, reason: 'account_deleted' })
    broadcast(userId, 'session_revoked', { reason: 'account_deleted' })
    await new Promise(r => setTimeout(r, 700))
    await db.delete(profiles).where(eq(profiles.id, userId))
    logAudit({
      user_id: req.user.id,
      user_name: req.profile?.full_name,
      action_type: 'user_deleted',
      entity_type: 'user',
      entity_id: userId,
      description: `User deleted: ${userId}`,
    }).catch(() => {})
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /users/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete user' })
  }
})

router.post('/:id/revoke-session', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const userId = req.params.id
    const { reason } = req.body
    await db.insert(sessionRevocations).values({ user_id: userId, reason: reason || null })
    broadcast(userId, 'session_revoked', { reason })
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /users/:id/revoke-session error:', err)
    res.status(500).json({ error: err?.message || 'Failed to revoke session' })
  }
})

// ─── Employee full profile aggregation ───────────────────────────────────────

router.get('/:id/profile', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const userId = req.params.id
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
    if (!profile) return res.status(404).json({ error: 'User not found' })
    const { password_hash, ...safeProfile } = profile

    // This month attendance
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const allAttendance = await db.select().from(loginTimes).where(eq(loginTimes.user_id, userId))
    const thisMonthAttendance = allAttendance.filter(a => a.date >= monthStart)
    const totalDaysPresent = thisMonthAttendance.length
    const completedDays = thisMonthAttendance.filter(a => a.logout_time)
    const avgHours = completedDays.length > 0
      ? completedDays.reduce((sum, a) => {
          const diff = new Date(a.logout_time!).getTime() - new Date(a.login_time).getTime()
          return sum + diff / (1000 * 60 * 60)
        }, 0) / completedDays.length
      : 0

    // Tickets assigned to this user
    const userTickets = await db.select({
      id: tickets.id, title: tickets.title, status: tickets.status,
      priority: tickets.priority, created_at: tickets.created_at, category: tickets.category,
    }).from(tickets).where(eq(tickets.assigned_to, userId)).orderBy(desc(tickets.created_at))
    const ticketsCreatedBy = await db.select({
      id: tickets.id, title: tickets.title, status: tickets.status,
      priority: tickets.priority, created_at: tickets.created_at,
    }).from(tickets).where(eq(tickets.created_by, userId)).orderBy(desc(tickets.created_at))

    // Leaves
    const userLeaves = await db.select().from(leaveRequests)
      .where(eq(leaveRequests.user_id, userId))
      .orderBy(desc(leaveRequests.created_at))

    // Penalties
    const userPenalties = await db.select().from(penalties)
      .where(eq(penalties.user_id, userId))
      .orderBy(desc(penalties.created_at))

    // Assets
    const userAssets = await db.select().from(assets)
      .where(eq(assets.assigned_to, userId))

    const openTickets = userTickets.filter(t => t.status === 'opened').length
    const pendingTickets = userTickets.filter(t => t.status === 'pending').length
    const solvedTickets = userTickets.filter(t => t.status === 'solved').length
    const totalPenaltyAmount = userPenalties.reduce((s, p) => s + (p.amount || 0), 0)

    res.json({
      profile: safeProfile,
      attendance: {
        thisMonthDays: totalDaysPresent,
        avgHoursPerDay: Math.round(avgHours * 10) / 10,
        totalRecords: allAttendance.length,
        recentDays: thisMonthAttendance.slice(0, 5),
      },
      tickets: {
        assigned: userTickets.slice(0, 10),
        created: ticketsCreatedBy.slice(0, 5),
        stats: { open: openTickets, pending: pendingTickets, solved: solvedTickets, total: userTickets.length },
      },
      leaves: {
        list: userLeaves.slice(0, 10),
        stats: {
          approved: userLeaves.filter(l => l.status === 'approved').length,
          pending: userLeaves.filter(l => l.status === 'pending').length,
          rejected: userLeaves.filter(l => l.status === 'rejected').length,
          totalDays: userLeaves.filter(l => l.status === 'approved').reduce((s, l) => s + l.days_count, 0),
        },
        balance: {
          annual: safeProfile.leave_balance,
          sick: safeProfile.sick_leave_balance,
          emergency: safeProfile.emergency_leave_balance,
        },
      },
      penalties: {
        list: userPenalties.slice(0, 10),
        stats: {
          total: userPenalties.length,
          totalAmount: totalPenaltyAmount,
          warnings: userPenalties.filter(p => p.type === 'warning').length,
          deductions: userPenalties.filter(p => p.type === 'deduction').length,
        },
      },
      assets: userAssets,
    })
  } catch (err: any) {
    console.error('GET /users/:id/profile error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get profile' })
  }
})

export default router
