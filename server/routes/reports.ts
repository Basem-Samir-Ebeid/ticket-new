import { Router } from 'express'
import { requireAuth, checkPermission } from '../auth'
import { db } from '../db'
import { tickets, profiles, loginTimes, assets } from '../../shared/schema'
import { sql, gte, lte, and, isNotNull, eq } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

function dateRange(range: string): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  let from = new Date(now)

  switch (range) {
    case 'week':
      from.setDate(now.getDate() - 7)
      break
    case 'month':
      from.setMonth(now.getMonth() - 1)
      break
    case '3months':
      from.setMonth(now.getMonth() - 3)
      break
    case 'year':
      from.setFullYear(now.getFullYear() - 1)
      break
    default:
      from.setMonth(now.getMonth() - 1)
  }
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

router.get('/tickets', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role) && !checkPermission(req.profile, 'can_view_reports')) return res.status(403).json({ error: 'Admin only' })
    const range = String(req.query.range || 'month')
    const { from, to } = dateRange(range)

    const [allTickets, allProfiles] = await Promise.all([
      db.select().from(tickets).where(
        and(gte(tickets.created_at, from), lte(tickets.created_at, to))
      ),
      db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email }).from(profiles),
    ])

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name || p.email]))

    // Status counts
    const byStatus = { opened: 0, pending: 0, solved: 0 }
    for (const t of allTickets) {
      if (t.status === 'opened') byStatus.opened++
      else if (t.status === 'pending') byStatus.pending++
      else if (t.status === 'solved') byStatus.solved++
    }

    // Category counts
    const categoryMap: Record<string, number> = {}
    for (const t of allTickets) {
      if (t.category) categoryMap[t.category] = (categoryMap[t.category] || 0) + 1
    }
    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    // Priority breakdown
    const priorityMap: Record<string, number> = {}
    for (const t of allTickets) {
      priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1
    }
    const byPriority = Object.entries(priorityMap).map(([name, value]) => ({ name, value }))

    // Tickets per day
    const dayMap: Record<string, number> = {}
    for (const t of allTickets) {
      const day = new Date(t.created_at).toISOString().slice(0, 10)
      dayMap[day] = (dayMap[day] || 0) + 1
    }
    const perDay = Object.entries(dayMap).sort().map(([date, count]) => ({ date, count }))

    // SLA compliance (solved within due_date)
    const solvedWithDue = allTickets.filter(t => t.status === 'solved' && t.due_date && t.solved_at)
    const slaCompliant = solvedWithDue.filter(t => {
      if (!t.solved_at || !t.due_date) return false
      return new Date(t.solved_at) <= new Date(t.due_date)
    })
    const slaRate = solvedWithDue.length > 0
      ? Math.round((slaCompliant.length / solvedWithDue.length) * 100)
      : null

    // Average resolution time (hours)
    const solvedTickets = allTickets.filter(t => t.status === 'solved' && t.solved_at && t.created_at)
    const avgResolutionHours = solvedTickets.length > 0
      ? Math.round(solvedTickets.reduce((sum, t) => {
          const hours = (new Date(t.solved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000
          return sum + hours
        }, 0) / solvedTickets.length)
      : 0

    // Per-technician performance
    const techMap: Record<string, { assigned: number; solved: number; resHours: number[]; ratings: number[] }> = {}
    for (const t of allTickets) {
      if (!t.assigned_to) continue
      if (!techMap[t.assigned_to]) techMap[t.assigned_to] = { assigned: 0, solved: 0, resHours: [], ratings: [] }
      techMap[t.assigned_to].assigned++
      if (t.status === 'solved') {
        techMap[t.assigned_to].solved++
        if (t.solved_at) {
          techMap[t.assigned_to].resHours.push(
            (new Date(t.solved_at).getTime() - new Date(t.created_at).getTime()) / 3600000
          )
        }
        if (t.rating) techMap[t.assigned_to].ratings.push(t.rating)
      }
    }
    const techPerformance = Object.entries(techMap).map(([id, data]) => ({
      id,
      name: profileMap[id] || id,
      assigned: data.assigned,
      solved: data.solved,
      avgResolutionHours: data.resHours.length > 0
        ? Math.round(data.resHours.reduce((a, b) => a + b, 0) / data.resHours.length)
        : 0,
      avgRating: data.ratings.length > 0
        ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10
        : null,
    })).sort((a, b) => b.solved - a.solved)

    // Rating distribution
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const ratedTickets = allTickets.filter(t => t.rating)
    for (const t of ratedTickets) {
      if (t.rating && t.rating >= 1 && t.rating <= 5) ratingDist[t.rating]++
    }
    const ratingDistribution = Object.entries(ratingDist).map(([star, count]) => ({ star: Number(star), count }))

    const avgSatisfaction = ratedTickets.length > 0
      ? Math.round((ratedTickets.reduce((s, t) => s + (t.rating || 0), 0) / ratedTickets.length) * 10) / 10
      : null

    // Low ratings
    const lowRatings = allTickets
      .filter(t => t.rating && t.rating <= 2 && t.rating_comment)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        title: t.title,
        rating: t.rating,
        comment: t.rating_comment,
        techName: t.assigned_to ? profileMap[t.assigned_to] : 'Unassigned',
      }))

    // Top tags
    const tagMap: Record<string, number> = {}
    for (const t of allTickets) {
      if (Array.isArray(t.tags)) {
        for (const tag of t.tags) tagMap[tag] = (tagMap[tag] || 0) + 1
      }
    }
    const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }))

    res.json({
      total: allTickets.length,
      byStatus,
      topCategories,
      byPriority,
      perDay,
      slaRate,
      avgResolutionHours,
      techPerformance,
      ratingDistribution,
      avgSatisfaction,
      lowRatings,
      topTags,
    })
  } catch (err: any) {
    console.error('GET /reports/tickets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load ticket reports' })
  }
})

router.get('/assets', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const allAssets = await db.select().from(assets)
    const now = new Date()

    const byType: Record<string, number> = {}
    const byCondition: Record<string, number> = {}
    let exp30 = 0, exp60 = 0, exp90 = 0
    const expiringSoon: any[] = []

    for (const a of allAssets) {
      byType[a.type] = (byType[a.type] || 0) + 1
      byCondition[a.condition] = (byCondition[a.condition] || 0) + 1
      if (a.warranty_expires) {
        const daysLeft = Math.ceil((new Date(a.warranty_expires).getTime() - now.getTime()) / 86400000)
        if (daysLeft > 0 && daysLeft <= 90) {
          if (daysLeft <= 30) exp30++
          if (daysLeft <= 60) exp60++
          exp90++
          expiringSoon.push({ id: a.id, name: a.name, warranty_expires: a.warranty_expires, daysLeft })
        }
      }
    }

    res.json({
      total: allAssets.length,
      byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
      byCondition: Object.entries(byCondition).map(([name, value]) => ({ name, value })),
      warrantyExpiring: { in30: exp30, in60: exp60, in90: exp90 },
      expiringSoon: expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 20),
    })
  } catch (err: any) {
    console.error('GET /reports/assets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load asset reports' })
  }
})

router.get('/attendance', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const range = String(req.query.range || 'month')
    const { from, to } = dateRange(range)

    const [records, allProfiles, workStartHours] = await Promise.all([
      db.select().from(loginTimes).where(
        and(gte(loginTimes.login_time, from), lte(loginTimes.login_time, to))
      ),
      db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email, work_start_hour: profiles.work_start_hour }).from(profiles),
      db.select({ id: profiles.id, work_start_hour: profiles.work_start_hour }).from(profiles),
    ])

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, { name: p.full_name || p.email, workStart: p.work_start_hour || 9 }]))

    let officeCount = 0, remoteCount = 0
    const lateMap: Record<string, number> = {}
    const hoursMap: Record<string, number[]> = {}

    for (const r of records) {
      if (r.attendance_type === 'remote') remoteCount++
      else officeCount++

      const profile = profileMap[r.user_id]
      const workStart = profile?.workStart || 9
      const loginHour = new Date(r.login_time).getHours()
      const loginMin = new Date(r.login_time).getMinutes()
      const lateMinutes = (loginHour - workStart) * 60 + loginMin
      if (lateMinutes > 15) {
        lateMap[r.user_id] = (lateMap[r.user_id] || 0) + 1
      }

      if (r.logout_time) {
        const hours = (new Date(r.logout_time).getTime() - new Date(r.login_time).getTime()) / 3600000
        if (!hoursMap[r.user_id]) hoursMap[r.user_id] = []
        hoursMap[r.user_id].push(hours)
      }
    }

    const lateArrivals = Object.entries(lateMap)
      .map(([id, count]) => ({ id, name: profileMap[id]?.name || id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const avgHoursPerEmployee = Object.entries(hoursMap)
      .map(([id, hours]) => ({
        id,
        name: profileMap[id]?.name || id,
        avgHours: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10,
      }))
      .sort((a, b) => b.avgHours - a.avgHours)

    res.json({
      total: records.length,
      officeCount,
      remoteCount,
      lateArrivals,
      avgHoursPerEmployee,
    })
  } catch (err: any) {
    console.error('GET /reports/attendance error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load attendance reports' })
  }
})

// ─── Analytics Endpoint ────────────────────────────────────────────────────────
router.get('/analytics', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role) && !checkPermission(req.profile, 'can_view_reports')) {
      return res.status(403).json({ error: 'Admin only' })
    }
    const range = String(req.query.range || 'month')
    const { from, to } = dateRange(range)

    const [allTickets, allProfiles] = await Promise.all([
      db.select().from(tickets).where(and(gte(tickets.created_at, from), lte(tickets.created_at, to))),
      db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email }).from(profiles),
    ])

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.full_name || p.email]))

    // Status counts
    const byStatus = { opened: 0, pending: 0, solved: 0 }
    for (const t of allTickets) {
      if (t.status === 'opened') byStatus.opened++
      else if (t.status === 'pending') byStatus.pending++
      else if (t.status === 'solved') byStatus.solved++
    }

    // Category distribution
    const categoryMap: Record<string, number> = {}
    for (const t of allTickets) {
      if (t.category) categoryMap[t.category] = (categoryMap[t.category] || 0) + 1
    }
    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    // SLA compliance
    const solvedWithDue = allTickets.filter(t => t.status === 'solved' && t.sla_deadline && t.solved_at)
    const slaCompliant = solvedWithDue.filter(t => new Date(t.solved_at!) <= new Date(t.sla_deadline!))
    const slaRate = solvedWithDue.length > 0 ? Math.round((slaCompliant.length / solvedWithDue.length) * 100) : null

    // Avg resolution time overall
    const solvedTickets = allTickets.filter(t => t.status === 'solved' && t.solved_at && t.created_at)
    const avgResolutionHours = solvedTickets.length > 0
      ? Math.round(solvedTickets.reduce((sum, t) => sum + (new Date(t.solved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0) / solvedTickets.length)
      : 0

    // Avg resolution by priority
    const priorityResMap: Record<string, number[]> = {}
    for (const t of solvedTickets) {
      if (!priorityResMap[t.priority]) priorityResMap[t.priority] = []
      priorityResMap[t.priority].push((new Date(t.solved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000)
    }
    const priorityOrder = ['urgent', 'high', 'medium', 'low']
    const avgResolutionByPriority = priorityOrder
      .filter(p => priorityResMap[p]?.length)
      .map(p => ({
        priority: p.charAt(0).toUpperCase() + p.slice(1),
        avgHours: Math.round(priorityResMap[p].reduce((a, b) => a + b, 0) / priorityResMap[p].length),
      }))

    // Weekly trend: created vs resolved
    function getWeekKey(date: Date): string {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - d.getDay())
      return d.toISOString().slice(0, 10)
    }
    const weeklyCreated: Record<string, number> = {}
    const weeklyResolved: Record<string, number> = {}
    for (const t of allTickets) {
      const wk = getWeekKey(new Date(t.created_at))
      weeklyCreated[wk] = (weeklyCreated[wk] || 0) + 1
      if (t.status === 'solved' && t.solved_at) {
        const rwk = getWeekKey(new Date(t.solved_at))
        weeklyResolved[rwk] = (weeklyResolved[rwk] || 0) + 1
      }
    }
    const allWeeks = [...new Set([...Object.keys(weeklyCreated), ...Object.keys(weeklyResolved)])].sort()
    const weeklyTrend = allWeeks.map(week => ({
      week: week.slice(5),
      created: weeklyCreated[week] || 0,
      resolved: weeklyResolved[week] || 0,
    }))

    // SLA compliance over time (weekly)
    const slaWeekMap: Record<string, { compliant: number; total: number }> = {}
    for (const t of allTickets) {
      if (t.status !== 'solved' || !t.sla_deadline || !t.solved_at) continue
      const wk = getWeekKey(new Date(t.solved_at))
      if (!slaWeekMap[wk]) slaWeekMap[wk] = { compliant: 0, total: 0 }
      slaWeekMap[wk].total++
      if (new Date(t.solved_at) <= new Date(t.sla_deadline)) slaWeekMap[wk].compliant++
    }
    const slaOverTime = Object.entries(slaWeekMap).sort().map(([week, d]) => ({
      week: week.slice(5),
      rate: Math.round((d.compliant / d.total) * 100),
    }))

    // Tech performance
    const techMap: Record<string, { assigned: number; solved: number; resHours: number[]; ratings: number[] }> = {}
    for (const t of allTickets) {
      if (!t.assigned_to) continue
      if (!techMap[t.assigned_to]) techMap[t.assigned_to] = { assigned: 0, solved: 0, resHours: [], ratings: [] }
      techMap[t.assigned_to].assigned++
      if (t.status === 'solved') {
        techMap[t.assigned_to].solved++
        if (t.solved_at) techMap[t.assigned_to].resHours.push((new Date(t.solved_at).getTime() - new Date(t.created_at).getTime()) / 3600000)
        if (t.rating) techMap[t.assigned_to].ratings.push(t.rating)
      }
    }
    const techPerformance = Object.entries(techMap).map(([id, data]) => ({
      id,
      name: profileMap[id] || id,
      assigned: data.assigned,
      solved: data.solved,
      avgResolutionHours: data.resHours.length > 0 ? Math.round(data.resHours.reduce((a, b) => a + b, 0) / data.resHours.length) : 0,
      avgRating: data.ratings.length > 0 ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10 : null,
    })).sort((a, b) => b.solved - a.solved)

    res.json({ total: allTickets.length, byStatus, topCategories, slaRate, avgResolutionHours, avgResolutionByPriority, weeklyTrend, slaOverTime, techPerformance })
  } catch (err: any) {
    console.error('GET /reports/analytics error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load analytics' })
  }
})

export default router
