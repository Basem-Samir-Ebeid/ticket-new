import { Router } from 'express'
import { requireAuth } from '../auth'
import { getOfficeConfig, saveOfficeConfig } from '../officeConfig'

const router = Router()

router.get('/office-location', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  res.json(getOfficeConfig())
})

router.post('/office-location', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'admin' && req.profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
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
  const config = { latitude: lat, longitude: lng, radius_meters: radius }
  saveOfficeConfig(config)
  res.json(config)
})

export default router
