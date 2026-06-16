import { Router } from 'express'
import { db } from '../db'
import { employeeEvaluations, profiles, notifications } from '../../shared/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast } from '../ws'
import { sendEmail } from '../email'

const router = Router()

function calcOverall(body: any): number | null {
  const fields = ['technical_skills', 'communication', 'punctuality', 'task_completion', 'initiative', 'work_quality']
  const vals = fields.map(f => body[f]).filter((v: any) => v !== null && v !== undefined && !isNaN(Number(v)))
  if (!vals.length) return null
  const avg = vals.reduce((s: number, v: any) => s + Number(v), 0) / vals.length
  return Math.round(avg * 100) / 100
}

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(employeeEvaluations).orderBy(desc(employeeEvaluations.created_at))
    } else {
      rows = await db.select().from(employeeEvaluations)
        .where(and(
          eq(employeeEvaluations.employee_id, req.user.id),
          eq(employeeEvaluations.status, 'employee_notified')
        ))
        .orderBy(desc(employeeEvaluations.created_at))
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email,
      role: profiles.role, department: profiles.department, job_title: profiles.job_title,
      profile_picture_url: profiles.profile_picture_url,
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      employee: profileMap.get(r.employee_id) || null,
      evaluator: r.evaluated_by ? (profileMap.get(r.evaluated_by) || null) : null,
    })))
  } catch (err: any) {
    console.error('GET /evaluations error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get evaluations' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Super admin only' })

    const { employee_id, month, year, technical_skills, communication, punctuality,
      task_completion, initiative, work_quality, notes, strengths, areas_for_improvement } = req.body

    if (!employee_id || !month || !year)
      return res.status(400).json({ error: 'employee_id, month, year are required' })

    const overall_score = calcOverall(req.body)

    const [ev] = await db.insert(employeeEvaluations).values({
      employee_id,
      evaluated_by: req.user.id,
      month: Number(month),
      year: Number(year),
      technical_skills: technical_skills ? Number(technical_skills) : null,
      communication: communication ? Number(communication) : null,
      punctuality: punctuality ? Number(punctuality) : null,
      task_completion: task_completion ? Number(task_completion) : null,
      initiative: initiative ? Number(initiative) : null,
      work_quality: work_quality ? Number(work_quality) : null,
      overall_score,
      notes: notes || null,
      strengths: strengths || null,
      areas_for_improvement: areas_for_improvement || null,
      status: 'draft',
    }).returning()

    res.json(ev)
  } catch (err: any) {
    console.error('POST /evaluations error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create evaluation' })
  }
})

router.put('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Super admin only' })

    const [existing] = await db.select().from(employeeEvaluations).where(eq(employeeEvaluations.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status === 'employee_notified')
      return res.status(400).json({ error: 'Cannot edit after employee has been notified' })

    const { technical_skills, communication, punctuality, task_completion,
      initiative, work_quality, notes, strengths, areas_for_improvement } = req.body

    const overall_score = calcOverall(req.body)

    const [updated] = await db.update(employeeEvaluations).set({
      technical_skills: technical_skills !== undefined ? (technical_skills ? Number(technical_skills) : null) : existing.technical_skills,
      communication: communication !== undefined ? (communication ? Number(communication) : null) : existing.communication,
      punctuality: punctuality !== undefined ? (punctuality ? Number(punctuality) : null) : existing.punctuality,
      task_completion: task_completion !== undefined ? (task_completion ? Number(task_completion) : null) : existing.task_completion,
      initiative: initiative !== undefined ? (initiative ? Number(initiative) : null) : existing.initiative,
      work_quality: work_quality !== undefined ? (work_quality ? Number(work_quality) : null) : existing.work_quality,
      overall_score: overall_score ?? existing.overall_score,
      notes: notes !== undefined ? (notes || null) : existing.notes,
      strengths: strengths !== undefined ? (strengths || null) : existing.strengths,
      areas_for_improvement: areas_for_improvement !== undefined ? (areas_for_improvement || null) : existing.areas_for_improvement,
      updated_at: new Date(),
    }).where(eq(employeeEvaluations.id, req.params.id)).returning()

    res.json(updated)
  } catch (err: any) {
    console.error('PUT /evaluations/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update evaluation' })
  }
})

router.post('/:id/submit', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Super admin only' })

    const [existing] = await db.select().from(employeeEvaluations).where(eq(employeeEvaluations.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Already submitted' })

    const [ev] = await db.update(employeeEvaluations).set({
      status: 'submitted',
      submitted_at: new Date(),
      updated_at: new Date(),
    }).where(eq(employeeEvaluations.id, req.params.id)).returning()

    const [emp] = await db.select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles).where(eq(profiles.id, existing.employee_id))

    const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    const monthLabel = monthNames[(existing.month || 1) - 1]
    const scoreLabel = existing.overall_score !== null ? ` — التقدير الإجمالي: ${existing.overall_score}/5` : ''
    const message = `📋 تقييم جديد: ${emp?.full_name || 'موظف'} — ${monthLabel} ${existing.year}${scoreLabel}`

    const hrAdmins = await db.select({ id: profiles.id, email: profiles.email, full_name: profiles.full_name })
      .from(profiles).where(inArray(profiles.role, ['admin', 'super_admin']))

    for (const admin of hrAdmins) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        message,
      }).returning()
      broadcast(admin.id, 'notification', notif)
      sendEmail(admin.email, `تقييم موظف — ${emp?.full_name || ''}`, `<p>${message}</p><p>يرجى مراجعة تقييم الموظف في لوحة التحكم.</p>`).catch(() => {})
    }

    res.json(ev)
  } catch (err: any) {
    console.error('POST /evaluations/:id/submit error:', err)
    res.status(500).json({ error: err?.message || 'Failed to submit evaluation' })
  }
})

router.post('/:id/notify-employee', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Super admin only' })

    const [existing] = await db.select().from(employeeEvaluations).where(eq(employeeEvaluations.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status === 'employee_notified')
      return res.status(400).json({ error: 'Already notified' })

    const [ev] = await db.update(employeeEvaluations).set({
      status: 'employee_notified',
      employee_notified_at: new Date(),
      updated_at: new Date(),
    }).where(eq(employeeEvaluations.id, req.params.id)).returning()

    const [emp] = await db.select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles).where(eq(profiles.id, existing.employee_id))

    const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    const monthLabel = monthNames[(existing.month || 1) - 1]
    const scoreStr = existing.overall_score !== null ? `${existing.overall_score}/5` : 'غير محدد'
    const message = `🌟 تقييمك الشهري لـ ${monthLabel} ${existing.year} — التقدير الإجمالي: ${scoreStr}. يمكنك الاطلاع عليه في تبويب "تقييمي".`

    const [notif] = await db.insert(notifications).values({
      user_id: existing.employee_id,
      message,
    }).returning()
    broadcast(existing.employee_id, 'notification', notif)

    sendEmail(
      emp?.email || '',
      `تقييمك الشهري — ${monthLabel} ${existing.year}`,
      `<p>عزيزي ${emp?.full_name || ''}،</p><p>تم إرسال تقييمك الشهري لشهر ${monthLabel} ${existing.year}.</p><p>التقدير الإجمالي: <strong>${scoreStr}</strong></p><p>يمكنك الاطلاع على التفاصيل من خلال نظام إدارة IT.</p>`
    ).catch(() => {})

    res.json(ev)
  } catch (err: any) {
    console.error('POST /evaluations/:id/notify-employee error:', err)
    res.status(500).json({ error: err?.message || 'Failed to notify employee' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Super admin only' })

    const [existing] = await db.select().from(employeeEvaluations).where(eq(employeeEvaluations.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Only draft evaluations can be deleted' })

    await db.delete(employeeEvaluations).where(eq(employeeEvaluations.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /evaluations/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete evaluation' })
  }
})

export default router
