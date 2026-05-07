import { Router } from 'express'
import { db } from '../db'
import { loginTimes, profiles } from '../../shared/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcastAll } from '../ws'
import { getOfficeConfig } from '../officeConfig'

const router = Router()

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function validateCoords(lat: any, lng: any): { lat: number; lng: number } | null {
  const latN = Number(lat)
  const lngN = Number(lng)
  if (!isFinite(latN) || !isFinite(lngN)) return null
  if (isNaN(latN) || isNaN(lngN)) return null
  if (latN === 0 && lngN === 0) return null
  if (latN < -90 || latN > 90) return null
  if (lngN < -180 || lngN > 180) return null
  return { lat: latN, lng: lngN }
}

async function checkGeofence(
  rawLat: any,
  rawLng: any,
  action: 'check-in' | 'check-out'
): Promise<{ allowed: boolean; error?: string; distance?: number; effectiveRadius?: number }> {
  const coords = validateCoords(rawLat, rawLng)
  if (!coords) {
    console.warn(`[Attendance][${action}] رُفض: إحداثيات غير صالحة — lat=${rawLat}, lng=${rawLng}`)
    return { allowed: false, error: 'إحداثيات غير صالحة أو مرفوضة. تأكد من تفعيل GPS.' }
  }

  const cfg = await getOfficeConfig()
  const distance = haversineDistance(coords.lat, coords.lng, cfg.latitude, cfg.longitude)

  console.log(
    `[Attendance][${action}] ` +
    `المستخدم=(${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}) | ` +
    `المكتب=(${cfg.latitude.toFixed(6)}, ${cfg.longitude.toFixed(6)}) | ` +
    `المسافة=${distance.toFixed(1)}م | ` +
    `الحد المسموح=${cfg.radius_meters}م | ` +
    `النتيجة=${distance <= cfg.radius_meters ? 'مسموح ✓' : 'مرفوض ✗'}`
  )

  if (!isFinite(distance) || distance > cfg.radius_meters) {
    return {
      allowed: false,
      error: `أنت خارج نطاق الشركة ولا يمكن تسجيل الحضور أو الانصراف. المسافة الحالية: ${Math.round(distance)} متر، الحد المسموح: ${cfg.radius_meters} متر.`,
      distance,
      effectiveRadius: cfg.radius_meters,
    }
  }

  return { allowed: true, distance, effectiveRadius: cfg.radius_meters }
}

function getLocalDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const { date } = req.query
    const targetDate = (date as string) || getLocalDateString()

    const allowed = req.profile.role === 'admin' || req.profile.role === 'super_admin' || req.profile.can_view_attendance
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view attendance' })

    const rows = await db.select().from(loginTimes).where(eq(loginTimes.date, targetDate))

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    const records = rows.map(r => ({
      ...r,
      full_name: profileMap.get(r.user_id)?.full_name || null,
      email: profileMap.get(r.user_id)?.email || null,
      role: profileMap.get(r.user_id)?.role || null,
    }))

    res.json(records)
  } catch (err: any) {
    console.error('GET /attendance error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get attendance' })
  }
})

router.get('/today', requireAuth as any, async (req: any, res) => {
  try {
    const today = getLocalDateString()
    const [record] = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))
    res.json(record || null)
  } catch (err: any) {
    console.error('GET /attendance/today error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get today attendance' })
  }
})

router.post('/login', requireAuth as any, async (req: any, res) => {
  try {
    const { latitude, longitude } = req.body

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'يجب إرسال الإحداثيات لتسجيل الحضور.' })
    }

    const geo = await checkGeofence(latitude, longitude, 'check-in')
    if (!geo.allowed) {
      return res.status(403).json({ error: geo.error })
    }

    const today = getLocalDateString()
    const existing = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

    if (existing.length > 0) return res.status(400).json({ error: 'Already logged in today' })

    const [record] = await db.insert(loginTimes).values({
      user_id: req.user.id,
      date: today,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }).returning()

    console.log(`[Attendance][check-in] تم تسجيل حضور المستخدم ${req.user.id} بنجاح — المسافة=${Math.round(geo.distance!)}م`)
    broadcastAll('attendance_update', { action: 'login', user_id: req.user.id, date: today })
    res.json(record)
  } catch (err: any) {
    console.error('POST /attendance/login error:', err)
    res.status(500).json({ error: err?.message || 'Failed to check in' })
  }
})

router.post('/logout', requireAuth as any, async (req: any, res) => {
  try {
    const { latitude, longitude } = req.body

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'يجب إرسال الإحداثيات لتسجيل الانصراف.' })
    }

    const geo = await checkGeofence(latitude, longitude, 'check-out')
    if (!geo.allowed) {
      return res.status(403).json({ error: geo.error })
    }

    const today = getLocalDateString()
    const [existing] = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

    if (!existing) return res.status(404).json({ error: 'No login record found for today' })
    if (existing.logout_time) return res.status(400).json({ error: 'Already signed off today' })

    const [record] = await db.update(loginTimes).set({
      logout_time: new Date(),
      logout_latitude: Number(latitude),
      logout_longitude: Number(longitude),
    }).where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today))).returning()

    console.log(`[Attendance][check-out] تم تسجيل انصراف المستخدم ${req.user.id} بنجاح — المسافة=${Math.round(geo.distance!)}م`)
    broadcastAll('attendance_update', { action: 'logout', user_id: req.user.id, date: today })
    res.json(record)
  } catch (err: any) {
    console.error('POST /attendance/logout error:', err)
    res.status(500).json({ error: err?.message || 'Failed to check out' })
  }
})

router.get('/monthly-report', requireAuth as any, async (req: any, res) => {
  res.setHeader('Content-Type', 'application/json')
  try {
    const allowed = req.profile?.role === 'admin' || req.profile?.role === 'super_admin'
    if (!allowed) return res.status(403).json({ error: 'غير مصرح لك بعرض التقرير الشهري.' })

    const cairoNow = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
    const [cairoYear, cairoMonth] = cairoNow.split('-').map(Number)
    const year = parseInt(req.query.year as string) || cairoYear
    const month = parseInt(req.query.month as string) || cairoMonth

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDayDate = new Date(year, month, 0)
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

    let workingDays = 0
    for (let d = new Date(year, month - 1, 1); d <= lastDayDate; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) workingDays++
    }

    const rows = await db.select().from(loginTimes)
      .where(and(gte(loginTimes.date, firstDay), lte(loginTimes.date, lastDay)))

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
    }).from(profiles)

    const statsMap = new Map<string, { profile: any; days: string[]; totalMinutes: number }>()

    for (const p of allProfiles) {
      if (p.role === 'admin' || p.role === 'super_admin') continue
      statsMap.set(p.id, { profile: p, days: [], totalMinutes: 0 })
    }

    for (const r of rows) {
      if (!statsMap.has(r.user_id)) continue
      const entry = statsMap.get(r.user_id)!
      if (!entry.days.includes(r.date)) entry.days.push(r.date)
      if (r.login_time && r.logout_time) {
        const mins = (new Date(r.logout_time).getTime() - new Date(r.login_time).getTime()) / 60000
        if (mins > 0) entry.totalMinutes += mins
      }
    }

    const report = Array.from(statsMap.values()).map(({ profile, days, totalMinutes }) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      days_present: days.length,
      days_absent: Math.max(0, workingDays - days.length),
      working_days: workingDays,
      attendance_rate: workingDays > 0 ? Math.round((days.length / workingDays) * 100) : 0,
      total_minutes: Math.round(totalMinutes),
      avg_minutes_per_day: days.length > 0 ? Math.round(totalMinutes / days.length) : 0,
    }))

    report.sort((a, b) => b.attendance_rate - a.attendance_rate)

    res.json({ year, month, working_days: workingDays, employees: report })
  } catch (err: any) {
    console.error('GET /attendance/monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })
    await db.delete(loginTimes).where(eq(loginTimes.id, req.params.id))
    broadcastAll('attendance_update', { action: 'deleted' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /attendance/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete attendance record' })
  }
})

export default router
