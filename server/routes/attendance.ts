import { Router } from 'express'
import { db } from '../db'
import { loginTimes, profiles } from '../../shared/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../auth'

const router = Router()

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// GET attendance for a date (admin only or can_view_attendance)
router.get('/', requireAuth as any, async (req: any, res) => {
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
})

// GET today's login for current user
router.get('/today', requireAuth as any, async (req: any, res) => {
  const today = getLocalDateString()
  const [record] = await db.select().from(loginTimes)
    .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))
  res.json(record || null)
})

// POST register login
router.post('/login', requireAuth as any, async (req: any, res) => {
  const { latitude, longitude } = req.body
  const today = getLocalDateString()

  // Check if already logged in today
  const existing = await db.select().from(loginTimes)
    .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

  if (existing.length > 0) return res.status(400).json({ error: 'Already logged in today' })

  const [record] = await db.insert(loginTimes).values({
    user_id: req.user.id,
    date: today,
    latitude: latitude || null,
    longitude: longitude || null,
  }).returning()

  res.json(record)
})

// POST register logout
router.post('/logout', requireAuth as any, async (req: any, res) => {
  const { latitude, longitude } = req.body
  const today = getLocalDateString()

  const [existing] = await db.select().from(loginTimes)
    .where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today)))

  if (!existing) return res.status(404).json({ error: 'No login record found for today' })
  if (existing.logout_time) return res.status(400).json({ error: 'Already signed off today' })

  const [record] = await db.update(loginTimes).set({
    logout_time: new Date(),
    logout_latitude: latitude || null,
    logout_longitude: longitude || null,
  }).where(and(eq(loginTimes.user_id, req.user.id), eq(loginTimes.date, today))).returning()

  res.json(record)
})

// DELETE attendance record (admin only)
router.delete('/:id', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Admin only' })
  await db.delete(loginTimes).where(eq(loginTimes.id, req.params.id))
  res.json({ success: true })
})

export default router
