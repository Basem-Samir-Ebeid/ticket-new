import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  employeeEvaluations,
  profiles,
  evaluationReports,
} from '../../shared/schema'
import { eq, and, desc, sql, avg, count } from 'drizzle-orm'

const router = Router()

const isSuperAdmin = (role: string) => role === 'super_admin'

// Helper: Get month name in Arabic
function getMonthName(month: number): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]
  return months[month - 1] || ''
}

// ── GET /monthly-reports: Get all monthly evaluation reports ────────────────
router.get('/monthly-reports', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'

    let query = db.select().from(evaluationReports)

    if (!isAdmin) {
      query = query.where(eq(evaluationReports.employee_id, req.user.id))
    }

    const reports = await query.orderBy(desc(evaluationReports.created_at))

    // Enrich with profile data
    const profileIds = [...new Set(reports.map(r => r.employee_id))]
    const profilesData = await db
      .select()
      .from(profiles)
      .where(sql`${profiles.id} = ANY(${profileIds})`)

    const profileMap = new Map(profilesData.map(p => [p.id, p]))

    const enriched = reports.map(r => ({
      ...r,
      employee: profileMap.get(r.employee_id),
    }))

    res.json(enriched)
  } catch (err: any) {
    console.error('GET /monthly-reports error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get reports' })
  }
})

// ── GET /monthly-reports/:employeeId: Get employee's evaluation history ────
router.get('/monthly-reports/:employeeId', requireAuth as any, async (req: any, res) => {
  try {
    const { employeeId } = req.params
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'

    if (!isAdmin && req.user.id !== employeeId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Get all evaluations for this employee (last 12 months)
    const reports = await db
      .select()
      .from(evaluationReports)
      .where(eq(evaluationReports.employee_id, employeeId))
      .orderBy(desc(evaluationReports.year), desc(evaluationReports.month))

    // Get the employee profile
    const employee = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, employeeId))
      .limit(1)

    if (!employee.length) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    res.json({
      employee: employee[0],
      evaluations: reports,
      totalCount: reports.length,
    })
  } catch (err: any) {
    console.error('GET /monthly-reports/:employeeId error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get employee history' })
  }
})

// ── POST /generate-monthly-report: Generate monthly aggregated report ──────
router.post('/generate-monthly-report', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { month, year } = req.body

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' })
    }

    // Get all evaluations for this month/year
    const evals = await db
      .select()
      .from(employeeEvaluations)
      .where(and(
        eq(employeeEvaluations.month, Number(month)),
        eq(employeeEvaluations.year, Number(year))
      ))

    if (!evals.length) {
      return res.status(400).json({ error: 'No evaluations found for this month' })
    }

    // Group by employee and calculate aggregates
    const byEmployee = new Map<string, any[]>()
    for (const ev of evals) {
      if (!byEmployee.has(ev.employee_id)) {
        byEmployee.set(ev.employee_id, [])
      }
      byEmployee.get(ev.employee_id)!.push(ev)
    }

    // Generate reports
    const reports = []
    for (const [employeeId, evaluations] of byEmployee.entries()) {
      const avgTechnical = evaluations.reduce((s, e) => s + (e.technical_skills || 0), 0) / evaluations.length
      const avgCommunication = evaluations.reduce((s, e) => s + (e.communication || 0), 0) / evaluations.length
      const avgPunctuality = evaluations.reduce((s, e) => s + (e.punctuality || 0), 0) / evaluations.length
      const avgTaskCompletion = evaluations.reduce((s, e) => s + (e.task_completion || 0), 0) / evaluations.length
      const avgInitiative = evaluations.reduce((s, e) => s + (e.initiative || 0), 0) / evaluations.length
      const avgWorkQuality = evaluations.reduce((s, e) => s + (e.work_quality || 0), 0) / evaluations.length

      const overallScore = (avgTechnical + avgCommunication + avgPunctuality + avgTaskCompletion + avgInitiative + avgWorkQuality) / 6

      const report = await db
        .insert(evaluationReports)
        .values({
          employee_id: employeeId,
          month: Number(month),
          year: Number(year),
          technical_skills_avg: Math.round(avgTechnical * 100) / 100,
          communication_avg: Math.round(avgCommunication * 100) / 100,
          punctuality_avg: Math.round(avgPunctuality * 100) / 100,
          task_completion_avg: Math.round(avgTaskCompletion * 100) / 100,
          initiative_avg: Math.round(avgInitiative * 100) / 100,
          work_quality_avg: Math.round(avgWorkQuality * 100) / 100,
          overall_score_avg: Math.round(overallScore * 100) / 100,
          evaluation_count: evaluations.length,
          created_by: req.user.id,
          created_at: new Date(),
        })
        .returning()

      reports.push(report[0])
    }

    res.json({
      success: true,
      message: `Generated ${reports.length} monthly reports`,
      reports,
      month: getMonthName(Number(month)),
      year,
    })
  } catch (err: any) {
    console.error('POST /generate-monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

// ── GET /department-stats: Get department evaluation statistics ────────────
router.get('/department-stats', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { month, year } = req.query

    let query = db
      .select({
        department: profiles.department,
        count: count(),
        avgTechnicalSkills: avg(employeeEvaluations.technical_skills),
        avgCommunication: avg(employeeEvaluations.communication),
        avgPunctuality: avg(employeeEvaluations.punctuality),
        avgTaskCompletion: avg(employeeEvaluations.task_completion),
        avgInitiative: avg(employeeEvaluations.initiative),
        avgWorkQuality: avg(employeeEvaluations.work_quality),
        avgOverall: avg(employeeEvaluations.overall_score),
      })
      .from(employeeEvaluations)
      .innerJoin(profiles, eq(employeeEvaluations.employee_id, profiles.id))

    if (month && year) {
      query = query.where(
        and(
          eq(employeeEvaluations.month, Number(month)),
          eq(employeeEvaluations.year, Number(year))
        )
      )
    }

    const stats = await query.groupBy(profiles.department)

    res.json(stats)
  } catch (err: any) {
    console.error('GET /department-stats error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get stats' })
  }
})

// ── GET /top-performers: Get top performing employees ──────────────────────
router.get('/top-performers', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Super admin only' })
    }

    const { month, year, limit = '10' } = req.query

    let query = db
      .select({
        employee_id: employeeEvaluations.employee_id,
        overall_score: employeeEvaluations.overall_score,
        month: employeeEvaluations.month,
        year: employeeEvaluations.year,
        full_name: profiles.full_name,
        department: profiles.department,
        job_title: profiles.job_title,
      })
      .from(employeeEvaluations)
      .innerJoin(profiles, eq(employeeEvaluations.employee_id, profiles.id))

    if (month && year) {
      query = query.where(
        and(
          eq(employeeEvaluations.month, Number(month)),
          eq(employeeEvaluations.year, Number(year))
        )
      )
    }

    const performers = await query
      .orderBy(desc(employeeEvaluations.overall_score))
      .limit(Number(limit))

    res.json(performers)
  } catch (err: any) {
    console.error('GET /top-performers error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get performers' })
  }
})

export default router
