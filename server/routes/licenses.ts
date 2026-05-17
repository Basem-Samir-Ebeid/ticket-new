import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { softwareLicenses, licenseAssignments, profiles } from '../../shared/schema'
import { eq, and, isNull } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const licenses = await db.select().from(softwareLicenses).orderBy(softwareLicenses.software_name)
    const assignments = await db.select().from(licenseAssignments).where(isNull(licenseAssignments.unassigned_at))

    const usedMap: Record<string, number> = {}
    for (const a of assignments) {
      usedMap[a.license_id] = (usedMap[a.license_id] || 0) + 1
    }

    const now = new Date()
    const result = licenses.map(l => {
      const usedSeats = usedMap[l.id] || 0
      let status = 'active'
      if (l.expiry_date) {
        const daysLeft = Math.ceil((new Date(l.expiry_date).getTime() - now.getTime()) / 86400000)
        if (daysLeft <= 0) status = 'expired'
        else if (daysLeft <= (l.renewal_reminder_days || 30)) status = 'expiring_soon'
      }
      return { ...l, used_seats: usedSeats, status }
    })

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load licenses' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { software_name, vendor, license_key, license_type, total_seats, expiry_date, cost, renewal_reminder_days, notes } = req.body
    if (!software_name) return res.status(400).json({ error: 'software_name required' })

    const [row] = await db.insert(softwareLicenses).values({
      software_name: String(software_name).trim(),
      vendor: vendor || null,
      license_key: license_key || null,
      license_type: license_type || 'per-seat',
      total_seats: total_seats ? Number(total_seats) : null,
      expiry_date: expiry_date || null,
      cost: cost ? Number(cost) : null,
      renewal_reminder_days: Number(renewal_reminder_days) || 30,
      notes: notes || null,
      created_by: req.user.id,
    }).returning()

    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create license' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { software_name, vendor, license_key, license_type, total_seats, expiry_date, cost, renewal_reminder_days, notes } = req.body
    const updates: any = {}
    if (software_name !== undefined) updates.software_name = software_name
    if (vendor !== undefined) updates.vendor = vendor
    if (license_key !== undefined) updates.license_key = license_key
    if (license_type !== undefined) updates.license_type = license_type
    if (total_seats !== undefined) updates.total_seats = total_seats ? Number(total_seats) : null
    if (expiry_date !== undefined) updates.expiry_date = expiry_date || null
    if (cost !== undefined) updates.cost = cost ? Number(cost) : null
    if (renewal_reminder_days !== undefined) updates.renewal_reminder_days = Number(renewal_reminder_days)
    if (notes !== undefined) updates.notes = notes

    const [row] = await db.update(softwareLicenses).set(updates).where(eq(softwareLicenses.id, req.params.id)).returning()
    if (!row) return res.status(404).json({ error: 'License not found' })
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update license' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(softwareLicenses).where(eq(softwareLicenses.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete license' })
  }
})

// Assignments
router.get('/:id/assignments', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const assignments = await db.select().from(licenseAssignments)
      .where(and(eq(licenseAssignments.license_id, req.params.id), isNull(licenseAssignments.unassigned_at)))
    const userRows = await db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email }).from(profiles)
    const profileMap = Object.fromEntries(userRows.map(p => [p.id, p.full_name || p.email]))
    res.json(assignments.map(a => ({ ...a, user_name: profileMap[a.user_id] || a.user_id })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load assignments' })
  }
})

router.post('/:id/assign', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })
    const [row] = await db.insert(licenseAssignments).values({ license_id: req.params.id, user_id }).returning()
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to assign license' })
  }
})

router.post('/:id/unassign', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })
    await db.update(licenseAssignments)
      .set({ unassigned_at: new Date() })
      .where(and(
        eq(licenseAssignments.license_id, req.params.id),
        eq(licenseAssignments.user_id, user_id),
        isNull(licenseAssignments.unassigned_at)
      ))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to unassign license' })
  }
})

export default router
