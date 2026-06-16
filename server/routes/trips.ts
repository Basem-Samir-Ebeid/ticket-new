import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { employeeTrips, tripLogs, profiles, notifications } from '../../shared/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()

const isAdmin = (role) => role === 'admin' || role === 'super_admin'

// ── GET /trips – list all trips (with filters) ──
router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const { status, month, year, employee_id } = req.query
    let query = db.select().from(employeeTrips)

    if (!isAdmin(req.profile.role)) {
      query = query.where(eq(employeeTrips.employee_id, req.user.id))
    } else if (employee_id) {
      query = query.where(eq(employeeTrips.employee_id, employee_id))
    }

    if (status) query = query.where(eq(employeeTrips.status, status))

    const trips = await query.orderBy(desc(employeeTrips.created_at))
    res.json(trips)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get trips' })
  }
})

// ── POST /trips – create trip request ──
router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    const {
      trip_name,
      purpose,
      location_from,
      location_to,
      departure_time,
      return_time,
      transport_type,
      transport_notes,
      notes,
    } = req.body

    if (!trip_name || !location_from || !location_to || !departure_time || !return_time) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const [trip] = await db
      .insert(employeeTrips)
      .values({
        employee_id: req.user.id,
        trip_name,
        purpose: purpose || '',
        location_from,
        location_to,
        departure_time: new Date(departure_time),
        return_time: new Date(return_time),
        transport_type: transport_type || 'car',
        transport_notes,
        notes,
        status: 'pending',
      })
      .returning()

    // Log action
    await db.insert(tripLogs).values({
      trip_id: trip.id,
      action: 'trip_requested',
      performed_by: req.user.id,
      notes: 'Trip request created',
    })

    // Notify admins
    const [empProfile] = await db
      .select({ full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)

    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where((p) => {
        const role = p.role
        return role === 'admin' || role === 'super_admin'
      })

    const msg = `📍 ${empProfile?.full_name} طلب ماموريه من ${location_from} إلى ${location_to}`
    for (const admin of admins) {
      await db.insert(notifications).values({
        user_id: admin.id,
        message: msg,
      })
      broadcast(admin.id, 'notification', { message: msg })
    }

    res.json(trip)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create trip' })
  }
})

// ── PUT /trips/:id – update trip ──
router.put('/:id', requireAuth as any, async (req: any, res) => {
  try {
    const [trip] = await db
      .select()
      .from(employeeTrips)
      .where(eq(employeeTrips.id, req.params.id))
      .limit(1)

    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    if (trip.employee_id !== req.user.id && !isAdmin(req.profile.role)) {
      return res.status(403).json({ error: 'Not authorized' })
    }
    if (trip.status !== 'pending') {
      return res.status(400).json({ error: 'Can only edit pending trips' })
    }

    const updated = await db
      .update(employeeTrips)
      .set({
        ...req.body,
        updated_at: new Date(),
      })
      .where(eq(employeeTrips.id, req.params.id))
      .returning()

    res.json(updated[0])
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update trip' })
  }
})

// ── POST /trips/:id/approve – approve trip ──
router.post('/:id/approve', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const [trip] = await db
      .select()
      .from(employeeTrips)
      .where(eq(employeeTrips.id, req.params.id))
      .limit(1)

    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    const [updated] = await db
      .update(employeeTrips)
      .set({
        status: 'approved',
        approved_by: req.user.id,
        approval_notes: req.body.notes || null,
        updated_at: new Date(),
      })
      .where(eq(employeeTrips.id, req.params.id))
      .returning()

    await db.insert(tripLogs).values({
      trip_id: trip.id,
      action: 'trip_approved',
      performed_by: req.user.id,
      notes: req.body.notes || 'Approved',
    })

    const msg = `✅ تمت الموافقة على ماموريتك: ${trip.trip_name}`
    await db.insert(notifications).values({
      user_id: trip.employee_id,
      message: msg,
    })
    broadcast(trip.employee_id, 'notification', { message: msg })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to approve trip' })
  }
})

// ── POST /trips/:id/reject – reject trip ──
router.post('/:id/reject', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const [trip] = await db
      .select()
      .from(employeeTrips)
      .where(eq(employeeTrips.id, req.params.id))
      .limit(1)

    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    const [updated] = await db
      .update(employeeTrips)
      .set({
        status: 'rejected',
        approval_notes: req.body.notes || null,
        updated_at: new Date(),
      })
      .where(eq(employeeTrips.id, req.params.id))
      .returning()

    await db.insert(tripLogs).values({
      trip_id: trip.id,
      action: 'trip_rejected',
      performed_by: req.user.id,
      notes: req.body.notes || 'Rejected',
    })

    const msg = `❌ تم رفض ماموريتك: ${trip.trip_name} - ${req.body.notes || ''}`
    await db.insert(notifications).values({
      user_id: trip.employee_id,
      message: msg,
    })
    broadcast(trip.employee_id, 'notification', { message: msg })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject trip' })
  }
})

// ── POST /trips/:id/start – start trip ──
router.post('/:id/start', requireAuth as any, async (req: any, res) => {
  try {
    const [trip] = await db
      .select()
      .from(employeeTrips)
      .where(eq(employeeTrips.id, req.params.id))
      .limit(1)

    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    if (trip.employee_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })

    const [updated] = await db
      .update(employeeTrips)
      .set({
        status: 'in-progress',
        actual_departure: new Date(),
        updated_at: new Date(),
      })
      .where(eq(employeeTrips.id, req.params.id))
      .returning()

    await db.insert(tripLogs).values({
      trip_id: trip.id,
      action: 'trip_started',
      performed_by: req.user.id,
      notes: 'Trip started',
    })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to start trip' })
  }
})

// ── POST /trips/:id/complete – complete trip ──
router.post('/:id/complete', requireAuth as any, async (req: any, res) => {
  try {
    const [trip] = await db
      .select()
      .from(employeeTrips)
      .where(eq(employeeTrips.id, req.params.id))
      .limit(1)

    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    if (trip.employee_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })

    const [updated] = await db
      .update(employeeTrips)
      .set({
        status: 'completed',
        actual_return: new Date(),
        updated_at: new Date(),
      })
      .where(eq(employeeTrips.id, req.params.id))
      .returning()

    await db.insert(tripLogs).values({
      trip_id: trip.id,
      action: 'trip_completed',
      performed_by: req.user.id,
      notes: 'Trip completed',
    })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to complete trip' })
  }
})

export default router
