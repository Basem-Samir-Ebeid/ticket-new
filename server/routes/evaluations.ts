import { Router } from 'express'
import { db } from '../db'
import { employeeEvaluations, profiles, notifications, evaluationReports } from '../../shared/schema'
import { eq, desc, and, inArray, avg, count } from 'drizzle-orm'
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
      sendEmail(admin.email, `تقييم مو��ف — ${emp?.full_name || ''}`, `<p>${message}</p><p>يرجى مراجعة تقييم الموظف في لوحة التحكم.</p>`).catch(() => {})
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

// ── GET /monthly-report — get monthly aggregated report ───────────────────────
router.get('/monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    const { month, year } = req.query
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' })

    const [report] = await db
      .select()
      .from(evaluationReports)
      .where(and(
        eq(evaluationReports.month, parseInt(month)),
        eq(evaluationReports.year, parseInt(year))
      ))
      .limit(1)

    if (!report) {
      return res.json({
        exists: false,
        message: 'No report generated for this month yet'
      })
    }

    // Get all evaluations for this month
    const evaluations = await db
      .select()
      .from(employeeEvaluations)
      .where(and(
        eq(employeeEvaluations.month, parseInt(month)),
        eq(employeeEvaluations.year, parseInt(year)),
        eq(employeeEvaluations.status, 'employee_notified')
      ))

    // Enrich with employee data
    const empIds = [...new Set(evaluations.map(e => e.employee_id))]
    const empProfiles = empIds.length > 0
      ? await db
          .select({
            id: profiles.id,
            full_name: profiles.full_name,
            email: profiles.email,
            department: profiles.department,
          })
          .from(profiles)
          .where(inArray(profiles.id, empIds))
      : []
    const empMap = new Map(empProfiles.map(p => [p.id, p]))

    const enriched = evaluations.map(e => ({
      ...e,
      employee: empMap.get(e.employee_id) || null
    }))

    // Sort by overall score
    enriched.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))

    res.json({
      ...report,
      evaluations: enriched,
      top_performers: enriched.slice(0, 5),
      bottom_performers: enriched.slice(-5).reverse(),
    })
  } catch (err: any) {
    console.error('GET /monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get monthly report' })
  }
})

// ── POST /generate-monthly-report — generate and save monthly report ─────────────
router.post('/generate-monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { month, year } = req.body
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' })

    // Get all submitted evaluations for this month
    const evaluations = await db
      .select()
      .from(employeeEvaluations)
      .where(and(
        eq(employeeEvaluations.month, month),
        eq(employeeEvaluations.year, year),
        eq(employeeEvaluations.status, 'employee_notified')
      ))

    if (evaluations.length === 0) {
      return res.status(400).json({ error: 'No evaluations submitted for this month' })
    }

    // Calculate averages
    const calcAvg = (field: keyof typeof evaluations[0]) => {
      const vals = evaluations
        .map(e => e[field])
        .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      return vals.length > 0 ? vals.reduce((s: any, v: any) => s + Number(v), 0) / vals.length : null
    }

    const report = {
      month,
      year,
      total_employees_evaluated: evaluations.length,
      avg_technical_skills: calcAvg('technical_skills'),
      avg_communication: calcAvg('communication'),
      avg_punctuality: calcAvg('punctuality'),
      avg_task_completion: calcAvg('task_completion'),
      avg_initiative: calcAvg('initiative'),
      avg_work_quality: calcAvg('work_quality'),
      avg_overall_score: calcAvg('overall_score'),
      generated_by: req.user.id,
    }

    // Try to update existing or insert new
    const existing = await db
      .select()
      .from(evaluationReports)
      .where(and(
        eq(evaluationReports.month, month),
        eq(evaluationReports.year, year)
      ))
      .limit(1)

    let result
    if (existing.length > 0) {
      const updated = await db
        .update(evaluationReports)
        .set({
          ...report,
          generated_at: new Date(),
        })
        .where(eq(evaluationReports.id, existing[0].id))
        .returning()
      result = updated[0]
    } else {
      const inserted = await db
        .insert(evaluationReports)
        .values(report)
        .returning()
      result = inserted[0]
    }

    res.json({ success: true, report: result })
  } catch (err: any) {
    console.error('POST /generate-monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

// ── GET /employee/:employee_id/history — get evaluation history for employee ─────
router.get('/employee/:employee_id/history', requireAuth as any, async (req: any, res) => {
  try {
    const { employee_id } = req.params

    // Check authorization: employee can only view their own, admin can view all
    if (req.profile.role !== 'super_admin' && req.profile.role !== 'admin' && req.user.id !== employee_id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Get last 12 months of evaluations
    const evaluations = await db
      .select()
      .from(employeeEvaluations)
      .where(and(
        eq(employeeEvaluations.employee_id, employee_id),
        eq(employeeEvaluations.status, 'employee_notified')
      ))
      .orderBy(desc(employeeEvaluations.created_at))
      .limit(12)

    // Get employee profile
    const [emp] = await db
      .select({
        id: profiles.id,
        full_name: profiles.full_name,
        email: profiles.email,
        department: profiles.department,
        job_title: profiles.job_title,
      })
      .from(profiles)
      .where(eq(profiles.id, employee_id))
      .limit(1)

    res.json({
      employee: emp,
      history: evaluations,
      trend: evaluations.length > 0 ? {
        latest_score: evaluations[0].overall_score,
        oldest_score: evaluations[evaluations.length - 1].overall_score,
        average_score: evaluations.reduce((s, e) => s + (e.overall_score || 0), 0) / evaluations.length,
      } : null
    })
  } catch (err: any) {
    console.error('GET /employee/:employee_id/history error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get history' })
  }
})

// ── GET /monthly-report (التقرير الشهري الموحد) ──────────────────────────────────
router.get('/monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const { month, year } = req.query
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' })

    // Get the report
    const report = await db
      .select()
      .from(evaluationReports)
      .where(
        and(
          eq(evaluationReports.month, Number(month)),
          eq(evaluationReports.year, Number(year))
        )
      )
      .limit(1)

    // Get all evaluations for this month
    const evaluations = await db
      .select({
        id: employeeEvaluations.id,
        employee_id: employeeEvaluations.employee_id,
        full_name: profiles.full_name,
        email: profiles.email,
        department: profiles.department,
        job_title: profiles.job_title,
        technical_skills: employeeEvaluations.technical_skills,
        communication: employeeEvaluations.communication,
        punctuality: employeeEvaluations.punctuality,
        task_completion: employeeEvaluations.task_completion,
        initiative: employeeEvaluations.initiative,
        work_quality: employeeEvaluations.work_quality,
        overall_score: employeeEvaluations.overall_score,
      })
      .from(employeeEvaluations)
      .leftJoin(profiles, eq(employeeEvaluations.employee_id, profiles.id))
      .where(
        and(
          eq(employeeEvaluations.month, Number(month)),
          eq(employeeEvaluations.year, Number(year))
        )
      )

    res.json({
      report: report[0] || null,
      evaluations,
    })
  } catch (err: any) {
    console.error('GET /monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load report' })
  }
})

// ── POST /generate-monthly-report (إنشاء التقرير الشهري) ──────────────────────────
router.post('/generate-monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const { month, year } = req.body
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' })

    // Get all evaluations for this month
    const evaluations = await db
      .select()
      .from(employeeEvaluations)
      .where(
        and(
          eq(employeeEvaluations.month, Number(month)),
          eq(employeeEvaluations.year, Number(year))
        )
      )

    if (evaluations.length === 0) {
      return res.status(400).json({ error: 'No evaluations found for this month' })
    }

    // Calculate averages
    const fields = ['technical_skills', 'communication', 'punctuality', 'task_completion', 'initiative', 'work_quality']
    const averages: any = {}

    for (const field of fields) {
      const values = evaluations
        .map((e: any) => e[field])
        .filter((v: any) => v !== null && !isNaN(v))
      averages[field] = values.length > 0 ? Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 100) / 100 : null
    }

    // Calculate overall average
    const overallScores = evaluations
      .map((e: any) => e.overall_score)
      .filter((v: any) => v !== null && !isNaN(v))
    const avgOverall = overallScores.length > 0 ? Math.round((overallScores.reduce((a: number, b: number) => a + b, 0) / overallScores.length) * 100) / 100 : null

    // Delete existing report if any
    await db
      .delete(evaluationReports)
      .where(
        and(
          eq(evaluationReports.month, Number(month)),
          eq(evaluationReports.year, Number(year))
        )
      )

    // Insert new report
    const [report] = await db
      .insert(evaluationReports)
      .values({
        month: Number(month),
        year: Number(year),
        total_employees_evaluated: evaluations.length,
        avg_technical_skills: averages.technical_skills,
        avg_communication: averages.communication,
        avg_punctuality: averages.punctuality,
        avg_task_completion: averages.task_completion,
        avg_initiative: averages.initiative,
        avg_work_quality: averages.work_quality,
        avg_overall_score: avgOverall,
        generated_by: req.user.id,
      })
      .returning()

    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    const monthLabel = monthNames[(Number(month) || 1) - 1]
    const message = `📊 تم إنشاء التقرير الشهري لـ ${monthLabel} ${year} — ${evaluations.length} موظف/ة`

    // Notify admins
    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    for (const admin of admins) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message,
      })
      broadcast(admin.id, 'notification', { message })
    }

    res.json(report)
  } catch (err: any) {
    console.error('POST /generate-monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

export default router
