import { Router } from 'express'
import { db } from '../db'
import { complaints, profiles, notifications } from '../../shared/schema'
import { eq, desc, or } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'
import { sendEmail } from '../email'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(complaints).orderBy(desc(complaints.created_at))
    } else {
      rows = await db.select().from(complaints)
        .where(or(
          eq(complaints.complainant_id, req.user.id),
          eq(complaints.against_user_id, req.user.id)
        ))
        .orderBy(desc(complaints.created_at))
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      complainant: r.is_anonymous ? null : (r.complainant_id ? profileMap.get(r.complainant_id) || null : null),
      against_user: r.against_user_id ? profileMap.get(r.against_user_id) || null : null,
      resolved_by_user: r.resolved_by ? profileMap.get(r.resolved_by) || null : null,
    })))
  } catch (err: any) {
    console.error('GET /complaints error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get complaints' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    const { against_user_id, subject, description, is_anonymous } = req.body
    if (!subject || !description) return res.status(400).json({ error: 'Subject and description are required' })

    const [complaint] = await db.insert(complaints).values({
      complainant_id: is_anonymous ? null : req.user.id,
      against_user_id: against_user_id || null,
      subject,
      description,
      is_anonymous: !!is_anonymous,
      status: 'pending',
    }).returning()

    const allAdmins = await db.select({ id: profiles.id }).from(profiles)
      .where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'super_admin')))

    const senderName = is_anonymous ? 'مجهول' : (req.profile.full_name || req.profile.email)
    for (const admin of allAdmins) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        message: `📣 شكوى جديدة من ${senderName}: ${subject}`,
      }).returning()
      broadcast(admin.id, 'notification', notif)
    }

    broadcastAll('complaint_update', { action: 'created', complaint_id: complaint.id })

    if (against_user_id && !is_anonymous) {
      ;(async () => {
        const [accused] = await db.select({ email: profiles.email, full_name: profiles.full_name }).from(profiles).where(eq(profiles.id, against_user_id))
        if (accused?.email) {
          await sendEmail(
            accused.email,
            '📢 تم تقديم شكوى',
            `<p>مرحباً ${accused.full_name || ''},</p>
             <p>تم تقديم شكوى في النظام. سيتم مراجعتها من قِبل الإدارة.</p>
             <p>الموضوع: <strong>${subject}</strong></p>`
          )
        }
      })().catch(() => {})
    }

    res.json(complaint)
  } catch (err: any) {
    console.error('POST /complaints error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create complaint' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    const { status, admin_response } = req.body
    const updateData: any = {}
    if (status) updateData.status = status
    if (admin_response !== undefined) updateData.admin_response = admin_response
    if (status === 'resolved' || status === 'rejected') {
      updateData.resolved_by = req.user.id
      updateData.resolved_at = new Date()
    }

    const [updated] = await db.update(complaints).set(updateData)
      .where(eq(complaints.id, req.params.id)).returning()

    if (updated && updated.complainant_id && !updated.is_anonymous) {
      const statusLabel: Record<string, string> = {
        under_review: '🔍 قيد الدراسة',
        resolved: '✅ محلولة',
        rejected: '❌ مرفوضة',
      }
      const [notif] = await db.insert(notifications).values({
        user_id: updated.complainant_id,
        message: `${statusLabel[updated.status] || updated.status}: شكواك "${updated.subject}" تم تحديث حالتها`,
      }).returning()
      broadcast(updated.complainant_id, 'notification', notif)
    }

    broadcastAll('complaint_update', { action: 'updated', complaint_id: updated.id })
    res.json(updated)
  } catch (err: any) {
    console.error('PATCH /complaints/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update complaint' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    await db.delete(complaints).where(eq(complaints.id, req.params.id))
    broadcastAll('complaint_update', { action: 'deleted' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /complaints/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete complaint' })
  }
})

export default router
