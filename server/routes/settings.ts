import { Router } from 'express'
import { requireAuth } from '../auth'
import { getOfficeConfig, saveOfficeConfig } from '../officeConfig'
import { db } from '../db'
import { settingsLog } from '../../shared/schema'
import { desc } from 'drizzle-orm'

const router = Router()

const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/office-location', requireAuth as any, async (req: any, res) => {
  if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  res.json(getOfficeConfig())
})

router.post('/office-location', requireAuth as any, async (req: any, res) => {
  if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  const { latitude, longitude, radius_meters } = req.body
  if (latitude == null || longitude == null || radius_meters == null) {
    return res.status(400).json({ error: 'latitude, longitude, and radius_meters are required' })
  }
  const lat = Number(latitude)
  const lng = Number(longitude)
  const radius = Number(radius_meters)
  if (isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
    return res.status(400).json({ error: 'Invalid values provided' })
  }

  const prev = getOfficeConfig()
  const config = { latitude: lat, longitude: lng, radius_meters: radius }
  saveOfficeConfig(config)

  await db.insert(settingsLog).values({
    changed_by: req.user.id,
    changed_by_name: req.profile.full_name || req.profile.email,
    from_lat: prev.latitude,
    from_lng: prev.longitude,
    from_radius: prev.radius_meters,
    to_lat: lat,
    to_lng: lng,
    to_radius: radius,
  })

  res.json(config)
})

router.get('/log', requireAuth as any, async (req: any, res) => {
  if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  const rows = await db.select().from(settingsLog).orderBy(desc(settingsLog.created_at)).limit(50)
  res.json(rows)
})

export default router
