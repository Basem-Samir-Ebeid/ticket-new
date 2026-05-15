import { Router } from 'express'
import { db } from '../db'
import { loginTimes, profiles, notifications, attendanceCorrections, penalties, remoteAttendanceRequests } from '../../shared/schema'
import { eq, and, gte, lte, desc, or, sql } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'
import { getOfficeConfig } from '../officeConfig'
import { sendWhatsAppToUser } from '../whatsappConfig'

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
    return { allowed: false, error: 'إحداثيات غير صالحة أو مرفوضة. تأكد من تفعيل GPS.' }
  }

  const cfg = await getOfficeConfig()
  const distance = haversineDistance(coords.lat, coords.lng, cfg.latitude, cfg.longitude)

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

function getLocalHour(date = new Date()) {
  return parseInt(date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Africa/Cairo' }))
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
    res.status(500).json({ error: err?.message || 'Failed to get today attendance' })
  }
})

router.get('/live', requireAuth as any, async (req: any, res) => {
  try {
    const allowed = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    if (!allowed) return res.status(403).json({ error: 'Admin only' })

    const today = getLocalDateString()
    const rows = await db.select().from(loginTimes).where(eq(loginTimes.date, today))

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email,
      role: profiles.role, profile_picture_url: profiles.profile_picture_url, work_start_hour: profiles.work_start_hour
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    const attendanceMap = new Map(rows.map(r => [r.user_id, r]))

    const employees = allProfiles.filter(p => p.role === 'employee')

    const result = employees.map(emp => {
      const record = attendanceMap.get(emp.id)
      const isIn = record && !record.logout_time
      const isOut = record && !!record.logout_time

      let lateMinutes = 0
      if (record && record.login_time) {
        const loginHour = getLocalHour(new Date(record.login_time))
        const loginMinute = new Date(record.login_time).getMinutes()
        const workStart = emp.work_start_hour || 9
        const minutesSinceStart = (loginHour - workStart) * 60 + loginMinute
        lateMinutes = Math.max(0, minutesSinceStart)
      }

      let overtimeMinutes = 0
      if (record && record.login_time && record.logout_time) {
        const totalMinutes = (new Date(record.logout_time).getTime() - new Date(record.login_time).getTime()) / 60000
        const standardMinutes = 8 * 60
        overtimeMinutes = Math.max(0, Math.round(totalMinutes - standardMinutes))
      }

      return {
        ...emp,
        status: isIn ? 'in' : isOut ? 'out' : 'absent',
        login_time: record?.login_time || null,
        logout_time: record?.logout_time || null,
        late_minutes: lateMinutes,
        overtime_minutes: overtimeMinutes,
        attendance_type: record?.attendance_type || null,
      }
    })

    const inCount = result.filter(r => r.status === 'in').length
    const outCount = result.filter(r => r.status === 'out').length
    const absentCount = result.filter(r => r.status === 'absent').length

    res.json({ date: today, employees: result, summary: { in: inCount, out: outCount, absent: absentCount } })
  } catch (err: any) {
    console.error('GET /attendance/live error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get live attendance' })
  }
})

router.post('/remote-request', requireAuth as any, async (req: any, res) => {
  try {
    const today = getLocalDateString()

    const existingLogin = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))
    if (existingLogin.length > 0) return res.status(400).json({ error: 'لديك حضور مسجل اليوم بالفعل' })

    const existingReq = await db.select().from(remoteAttendanceRequests)
      .where(and(eq(remoteAttendanceRequests.user_id, req.user.id), eq(remoteAttendanceRequests.date, today)))
    if (existingReq.length > 0) return res.status(400).json({ error: 'لديك طلب حضور عن بعد معلق بالفعل' })

    const [request] = await db.insert(remoteAttendanceRequests).values({
      user_id: req.user.id,
      date: today,
    }).returning()

    const superAdmins = await db.select({ id: profiles.id }).from(profiles)
      .where(eq(profiles.role, 'super_admin'))
    const empName = req.profile.full_name || req.profile.email
    for (const admin of superAdmins) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        message: `🏠 طلب حضور عن بُعد من ${empName} — بتاريخ ${today}`,
      }).returning()
      broadcast(admin.id, 'notification', notif)
      broadcast(admin.id, 'remote_request_update', { action: 'created', request: { ...request, user: { full_name: empName } } })
    }

    broadcastAll('remote_request_update', { action: 'created' })
    res.json(request)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create remote request' })
  }
})

router.get('/remote-requests', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(remoteAttendanceRequests).orderBy(desc(remoteAttendanceRequests.created_at))
    } else {
      const today = getLocalDateString()
      rows = await db.select().from(remoteAttendanceRequests)
        .where(and(eq(remoteAttendanceRequests.user_id, req.user.id), eq(remoteAttendanceRequests.date, today)))
    }
    const allProfiles = await db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    res.json(rows.map(r => ({ ...r, user: profileMap.get(r.user_id) || null })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get remote requests' })
  }
})

router.patch('/remote-requests/:id/approve', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const [request] = await db.update(remoteAttendanceRequests).set({
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    }).where(eq(remoteAttendanceRequests.id, req.params.id)).returning()

    if (!request) return res.status(404).json({ error: 'Request not found' })

    const existingLogin = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, request.user_id), eq(loginTimes.date, request.date)))
    if (existingLogin.length === 0) {
      await db.insert(loginTimes).values({
        user_id: request.user_id,
        date: request.date,
        login_time: request.requested_at,
        attendance_type: 'remote',
      })
    }

    const [notif] = await db.insert(notifications).values({
      user_id: request.user_id,
      message: '✅ تمت الموافقة على طلب حضورك عن بُعد',
    }).returning()
    broadcast(request.user_id, 'notification', notif)
    broadcast(request.user_id, 'remote_request_update', { action: 'approved' })
    broadcastAll('attendance_update', { action: 'login', user_id: request.user_id, date: request.date })
    broadcastAll('remote_request_update', { action: 'approved' })
    res.json(request)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to approve request' })
  }
})

router.patch('/remote-requests/:id/reject', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })

    const [request] = await db.update(remoteAttendanceRequests).set({
      status: 'rejected',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    }).where(eq(remoteAttendanceRequests.id, req.params.id)).returning()

    if (!request) return res.status(404).json({ error: 'Request not found' })

    const [notif] = await db.insert(notifications).values({
      user_id: request.user_id,
      message: '❌ تم رفض طلب حضورك عن بُعد — الرجاء التوجه إلى المكتب',
    }).returning()
    broadcast(request.user_id, 'notification', notif)
    broadcast(request.user_id, 'remote_request_update', { action: 'rejected' })
    broadcastAll('remote_request_update', { action: 'rejected' })
    res.json(request)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject request' })
  }
})

router.post('/login', requireAuth as any, async (req: any, res) => {
  try {
    const { latitude, longitude, attendance_type } = req.body
    const isRemote = attendance_type === 'remote'

    if (!isRemote) {
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'يجب إرسال الإحداثيات لتسجيل الحضور.' })
      }
      const geo = await checkGeofence(latitude, longitude, 'check-in')
      if (!geo.allowed) {
        return res.status(403).json({ error: geo.error })
      }
    }

    const today = getLocalDateString()
    const existing = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

    if (existing.length > 0) return res.status(400).json({ error: 'Already logged in today' })

    const [record] = await db.insert(loginTimes).values({
      user_id: req.user.id,
      date: today,
      latitude: isRemote ? null : Number(latitude),
      longitude: isRemote ? null : Number(longitude),
      attendance_type: isRemote ? 'remote' : 'office',
    }).returning()

    const workStartHour = req.profile.work_start_hour || 9
    const nowHour = getLocalHour()
    const nowMinute = new Date().getMinutes()
    const lateMinutes = Math.max(0, (nowHour - workStartHour) * 60 + nowMinute)

    if (lateMinutes > 5) {
      const admins = await db.select({ id: profiles.id }).from(profiles)
        .where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'super_admin')))
      const empName = req.profile.full_name || req.profile.email
      const h = Math.floor(lateMinutes / 60)
      const m = lateMinutes % 60
      const lateStr = h > 0 ? `${h} ساعة ${m} دقيقة` : `${m} دقيقة`
      for (const admin of admins) {
        const [notif] = await db.insert(notifications).values({
          user_id: admin.id,
          message: `⏰ تأخير: ${empName} سجّل حضوره متأخراً بـ ${lateStr}`,
        }).returning()
        broadcast(admin.id, 'notification', notif)
      }

      if (lateMinutes >= 60) {
        await db.insert(penalties).values({
          user_id: req.user.id,
          type: 'warning',
          reason: `تأخر عن موعد العمل بمقدار ${lateStr} بتاريخ ${today}`,
          issued_by: null,
        })
      }
    }

    const loginTimeStr = new Date(record.login_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })
    const lateNote = lateMinutes > 5 ? ` (متأخر ${lateMinutes} دقيقة)` : ''
    const typeNote = isRemote ? ' 🏠 عن بُعد' : ''
    sendWhatsAppToUser(req.user.id, `✅ تم تسجيل حضورك${typeNote}\nالوقت: ${loginTimeStr}${lateNote}\nالتاريخ: ${today}`).catch(() => {})
    broadcastAll('attendance_update', { action: 'login', user_id: req.user.id, date: today })
    res.json({ ...record, late_minutes: lateMinutes })
  } catch (err: any) {
    console.error('POST /attendance/login error:', err)
    res.status(500).json({ error: err?.message || 'Failed to check in' })
  }
})

router.post('/logout', requireAuth as any, async (req: any, res) => {
  try {
    const { latitude, longitude } = req.body

    const today = getLocalDateString()
    const [existing] = await db.select().from(loginTimes)
      .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

    if (!existing) return res.status(404).json({ error: 'No login record found for today' })
    if (existing.logout_time) return res.status(400).json({ error: 'Already signed off today' })

    const isRemote = existing.attendance_type === 'remote'

    if (!isRemote) {
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'يجب إرسال الإحداثيات لتسجيل الانصراف.' })
      }
      const geo = await checkGeofence(latitude, longitude, 'check-out')
      if (!geo.allowed) {
        return res.status(403).json({ error: geo.error })
      }
    }

    const [record] = await db.update(loginTimes).set({
      logout_time: new Date(),
      logout_latitude: isRemote ? null : Number(latitude),
      logout_longitude: isRemote ? null : Number(longitude),
    }).where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today))).returning()

    const totalMinutes = (new Date(record.logout_time!).getTime() - new Date(record.login_time).getTime()) / 60000
    const overtimeMinutes = Math.max(0, Math.round(totalMinutes - 8 * 60))

    const logoutTimeStr = new Date(record.logout_time!).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })
    const overtimeNote = overtimeMinutes > 0 ? ` (إضافي: ${overtimeMinutes} دقيقة)` : ''
    sendWhatsAppToUser(req.user.id, `🏁 تم تسجيل انصرافك\nالوقت: ${logoutTimeStr}${overtimeNote}\nالتاريخ: ${today}`).catch(() => {})
    broadcastAll('attendance_update', { action: 'logout', user_id: req.user.id, date: today })
    res.json({ ...record, overtime_minutes: overtimeMinutes })
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
      id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role, work_start_hour: profiles.work_start_hour
    }).from(profiles)

    const statsMap = new Map<string, { profile: any; days: string[]; totalMinutes: number; overtimeMinutes: number; lateCount: number; lateTotalMinutes: number }>()

    for (const p of allProfiles) {
      if (p.role === 'admin' || p.role === 'super_admin') continue
      statsMap.set(p.id, { profile: p, days: [], totalMinutes: 0, overtimeMinutes: 0, lateCount: 0, lateTotalMinutes: 0 })
    }

    for (const r of rows) {
      if (!statsMap.has(r.user_id)) continue
      const entry = statsMap.get(r.user_id)!
      const prof = entry.profile
      if (!entry.days.includes(r.date)) entry.days.push(r.date)
      if (r.login_time && r.logout_time) {
        const mins = (new Date(r.logout_time).getTime() - new Date(r.login_time).getTime()) / 60000
        if (mins > 0) {
          entry.totalMinutes += mins
          const overtime = Math.max(0, mins - 8 * 60)
          entry.overtimeMinutes += overtime
        }
      }
      if (r.login_time) {
        const loginHour = getLocalHour(new Date(r.login_time))
        const loginMin = new Date(r.login_time).getMinutes()
        const workStart = prof.work_start_hour || 9
        const lateMin = Math.max(0, (loginHour - workStart) * 60 + loginMin)
        if (lateMin > 5) {
          entry.lateCount++
          entry.lateTotalMinutes += lateMin
        }
      }
    }

    const report = Array.from(statsMap.values()).map(({ profile, days, totalMinutes, overtimeMinutes, lateCount, lateTotalMinutes }) => ({
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
      overtime_minutes: Math.round(overtimeMinutes),
      late_count: lateCount,
      late_total_minutes: Math.round(lateTotalMinutes),
    }))

    report.sort((a, b) => b.attendance_rate - a.attendance_rate)
    res.json({ year, month, working_days: workingDays, employees: report })
  } catch (err: any) {
    console.error('GET /attendance/monthly-report error:', err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

router.get('/late-overtime-detail', requireAuth as any, async (req: any, res) => {
  try {
    const allowed = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    if (!allowed) return res.status(403).json({ error: 'Admin only' })

    const cairoNow = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
    const [cairoYear, cairoMonth] = cairoNow.split('-').map(Number)
    const year  = parseInt(req.query.year  as string) || cairoYear
    const month = parseInt(req.query.month as string) || cairoMonth
    const userId = req.query.user_id as string | undefined

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDayDate = new Date(year, month, 0)
    const lastDay  = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

    const conds: any[] = [gte(loginTimes.date, firstDay), lte(loginTimes.date, lastDay)]
    if (userId) conds.push(eq(loginTimes.user_id, userId))
    const rows = await db.select().from(loginTimes).where(and(...conds))

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email,
      role: profiles.role, work_start_hour: profiles.work_start_hour,
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    const empMap = new Map<string, { profile: any; days: any[] }>()

    for (const r of rows) {
      const prof = profileMap.get(r.user_id)
      if (!prof) continue
      if (!userId && (prof.role === 'admin' || prof.role === 'super_admin')) continue

      if (!empMap.has(r.user_id)) empMap.set(r.user_id, { profile: prof, days: [] })
      const entry = empMap.get(r.user_id)!
      const workStart = prof.work_start_hour || 9

      let lateMinutes = 0
      if (r.login_time) {
        const loginCairo = new Date(new Date(r.login_time).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
        const loginHour  = loginCairo.getHours()
        const loginMin   = loginCairo.getMinutes()
        lateMinutes = Math.max(0, (loginHour - workStart) * 60 + loginMin)
      }

      let workedMinutes = 0
      let overtimeMinutes = 0
      if (r.login_time && r.logout_time) {
        workedMinutes   = Math.round((new Date(r.logout_time).getTime() - new Date(r.login_time).getTime()) / 60000)
        overtimeMinutes = Math.max(0, workedMinutes - 9 * 60)
      }

      const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date)
      entry.days.push({
        date: dateStr,
        login_time:       r.login_time,
        logout_time:      r.logout_time,
        late_minutes:     lateMinutes,
        worked_minutes:   workedMinutes,
        overtime_minutes: overtimeMinutes,
      })
    }

    const result = Array.from(empMap.values()).map(({ profile, days }) => {
      const lateDays = days.filter(d => d.late_minutes > 5)
      const otDays   = days.filter(d => d.overtime_minutes > 0)
      return {
        id:                    profile.id,
        full_name:             profile.full_name,
        email:                 profile.email,
        work_start_hour:       profile.work_start_hour || 9,
        days_present:          days.length,
        late_days:             lateDays.length,
        late_total_minutes:    lateDays.reduce((s: number, d: any) => s + d.late_minutes, 0),
        overtime_days:         otDays.length,
        overtime_total_minutes:otDays.reduce((s: number, d: any) => s + d.overtime_minutes, 0),
        day_records:           days.sort((a: any, b: any) => a.date.localeCompare(b.date) || 0),
      }
    })

    result.sort((a, b) => b.late_total_minutes - a.late_total_minutes)
    res.json({ year, month, employees: result })
  } catch (err: any) {
    console.error('GET /attendance/late-overtime-detail error:', err?.message || err)
    res.status(500).json({ error: err?.message || 'Failed to generate report' })
  }
})

router.get('/corrections', requireAuth as any, async (req: any, res) => {
  try {
    const isAdmin = req.profile.role === 'admin' || req.profile.role === 'super_admin'
    let rows
    if (isAdmin) {
      rows = await db.select().from(attendanceCorrections).orderBy(desc(attendanceCorrections.created_at))
    } else {
      rows = await db.select().from(attendanceCorrections)
        .where(eq(attendanceCorrections.user_id, req.user.id))
        .orderBy(desc(attendanceCorrections.created_at))
    }

    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({
      ...r,
      user: profileMap.get(r.user_id) || null,
      reviewed_by_user: r.reviewed_by ? profileMap.get(r.reviewed_by) || null : null,
    })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get corrections' })
  }
})

router.post('/corrections', requireAuth as any, async (req: any, res) => {
  try {
    const { date, requested_login, requested_logout, reason } = req.body
    if (!date || !reason) return res.status(400).json({ error: 'Date and reason are required' })

    const [correction] = await db.insert(attendanceCorrections).values({
      user_id: req.user.id,
      date,
      requested_login: requested_login || null,
      requested_logout: requested_logout || null,
      reason,
      status: 'pending',
    }).returning()

    const admins = await db.select({ id: profiles.id }).from(profiles)
      .where(or(eq(profiles.role, 'admin'), eq(profiles.role, 'super_admin')))
    const empName = req.profile.full_name || req.profile.email
    for (const admin of admins) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        message: `🔧 طلب تصحيح حضور من ${empName} بتاريخ ${date}`,
      }).returning()
      broadcast(admin.id, 'notification', notif)
    }

    broadcastAll('attendance_update', { action: 'correction_created' })
    res.json(correction)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create correction request' })
  }
})

router.patch('/corrections/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin')
      return res.status(403).json({ error: 'Admin only' })

    const { status, admin_note } = req.body
    const [correction] = await db.update(attendanceCorrections).set({
      status,
      admin_note: admin_note || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    }).where(eq(attendanceCorrections.id, req.params.id)).returning()

    if (correction && status === 'approved' && (correction.requested_login || correction.requested_logout)) {
      const timeUpdates: any = {}
      if (correction.requested_login) {
        timeUpdates.login_time = new Date(`${correction.date}T${correction.requested_login}:00`)
      }
      if (correction.requested_logout) {
        timeUpdates.logout_time = new Date(`${correction.date}T${correction.requested_logout}:00`)
      }
      await db.update(loginTimes).set(timeUpdates)
        .where(and(eq(loginTimes.user_id, correction.user_id), eq(loginTimes.date, correction.date)))
    }

    if (correction && correction.user_id) {
      const label = status === 'approved' ? '✅ تم قبول' : '❌ تم رفض'
      const [notif] = await db.insert(notifications).values({
        user_id: correction.user_id,
        message: `${label} طلب تصحيح الحضور بتاريخ ${correction.date}${admin_note ? ` — ${admin_note}` : ''}`,
      }).returning()
      broadcast(correction.user_id, 'notification', notif)
    }

    broadcastAll('attendance_update', { action: 'correction_updated' })
    res.json(correction)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update correction' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admins only' })
    const { login_time, logout_time, attendance_type } = req.body
    const updates: Record<string, any> = {}
    if (login_time !== undefined)      updates.login_time      = login_time ? new Date(login_time) : null
    if (logout_time !== undefined)     updates.logout_time     = logout_time ? new Date(logout_time) : null
    if (attendance_type !== undefined) updates.attendance_type = attendance_type
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
    const [row] = await db.update(loginTimes).set(updates).where(eq(loginTimes.id, req.params.id)).returning()
    broadcastAll('attendance_update', { action: 'update' })
    res.json(row ?? { id: req.params.id })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update attendance' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })
    await db.delete(loginTimes).where(eq(loginTimes.id, req.params.id))
    broadcastAll('attendance_update', { action: 'deleted' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete attendance record' })
  }
})

export default router
