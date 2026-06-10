import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { missions, profiles, notifications } from '../../shared/schema'
import { eq, and, or, desc, inArray } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

// ── GET / — list missions ──────────────────────────────────────────────────────
router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db
      .select({
        id: missions.id,
        title: missions.title,
        description: missions.description,
        assigned_to: missions.assigned_to,
        assigned_by: missions.assigned_by,
        location: missions.location,
        status: missions.status,
        priority: missions.priority,
        start_date: missions.start_date,
        end_date: missions.end_date,
        notes: missions.notes,
        created_at: missions.created_at,
        updated_at: missions.updated_at,
        assignee_name: profiles.full_name,
        assignee_email: profiles.email,
      })
      .from(missions)
      .leftJoin(profiles, eq(missions.assigned_to, profiles.id))
      .orderBy(desc(missions.created_at))

    // Enrich with assigner names
    const assignerIds = [...new Set(rows.map(r => r.assigned_by).filter(Boolean))] as string[]
    let assignerMap: Record<string, string> = {}
    if (assignerIds.length > 0) {
      const assigners = await db
        .select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.id, assignerIds))
      assignerMap = Object.fromEntries(assigners.map(a => [a.id, a.full_name || a.email || '']))
    }

    const result = rows.map(r => ({
      ...r,
      assigner_name: r.assigned_by ? (assignerMap[r.assigned_by] || '') : '',
    }))

    // Employees only see their own missions
    if (!isAdmin(req.profile.role)) {
      return res.json(result.filter(r => r.assigned_to === req.user.id))
    }
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load missions' })
  }
})

// ── POST / — create mission ────────────────────────────────────────────────────
router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { title, description, assigned_to, location, priority, start_date, end_date, notes } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'العنوان مطلوب' })

    const [mission] = await db.insert(missions).values({
      title: title.trim(),
      description: description || null,
      assigned_to: assigned_to || null,
      assigned_by: req.user.id,
      location: location || null,
      priority: priority || 'medium',
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || null,
    }).returning()

    // Notify the assigned employee
    if (assigned_to) {
      const [assigner] = await db.select({ full_name: profiles.full_name }).from(profiles).where(eq(profiles.id, req.user.id)).limit(1)
      const msg = `📋 تم تكليفك بمأمورية جديدة: "${title}"`
      await db.insert(notifications).values({ user_id: assigned_to, message: msg })
      broadcast(assigned_to, 'notification', { message: msg })
    }

    res.status(201).json(mission)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create mission' })
  }
})

// ── PUT /:id — update mission ──────────────────────────────────────────────────
router.put('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { title, description, assigned_to, location, priority, status, start_date, end_date, notes } = req.body

    const [existing] = await db.select().from(missions).where(eq(missions.id, req.params.id)).limit(1)
    if (!existing) return res.status(404).json({ error: 'Mission not found' })

    const [updated] = await db.update(missions).set({
      title: title?.trim() || existing.title,
      description: description ?? existing.description,
      assigned_to: assigned_to !== undefined ? (assigned_to || null) : existing.assigned_to,
      location: location ?? existing.location,
      priority: priority || existing.priority,
      status: status || existing.status,
      start_date: start_date ?? existing.start_date,
      end_date: end_date ?? existing.end_date,
      notes: notes ?? existing.notes,
      updated_at: new Date(),
    }).where(eq(missions.id, req.params.id)).returning()

    // Notify if newly assigned
    if (assigned_to && assigned_to !== existing.assigned_to) {
      const msg = `📋 تم تكليفك بمأمورية: "${updated.title}"`
      await db.insert(notifications).values({ user_id: assigned_to, message: msg })
      broadcast(assigned_to, 'notification', { message: msg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update mission' })
  }
})

// ── PATCH /:id/status — employee updates status ───────────────────────────────
router.patch('/:id/status', requireAuth as any, async (req: any, res) => {
  try {
    const { status } = req.body
    const allowed = ['pending', 'in_progress', 'completed', 'cancelled']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'حالة غير صحيحة' })

    const [existing] = await db.select().from(missions).where(eq(missions.id, req.params.id)).limit(1)
    if (!existing) return res.status(404).json({ error: 'Mission not found' })

    // Employee can only update their own missions
    if (!isAdmin(req.profile.role) && existing.assigned_to !== req.user.id)
      return res.status(403).json({ error: 'غير مصرح' })

    const [updated] = await db.update(missions)
      .set({ status, updated_at: new Date() })
      .where(eq(missions.id, req.params.id))
      .returning()

    // Notify admins when completed
    if (status === 'completed') {
      const [emp] = await db.select({ full_name: profiles.full_name, email: profiles.email }).from(profiles).where(eq(profiles.id, req.user.id)).limit(1)
      const empName = emp?.full_name || emp?.email || 'الموظف'
      const admins = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.role, ['admin', 'super_admin']))
      const msg = `✅ ${empName} أتم مأمورية: "${existing.title}"`
      for (const admin of admins) {
        if (admin.id === req.user.id) continue
        await db.insert(notifications).values({ user_id: admin.id, message: msg })
        broadcast(admin.id, 'notification', { message: msg })
      }
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update status' })
  }
})

// ── DELETE /:id — delete mission ───────────────────────────────────────────────
router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(missions).where(eq(missions.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete mission' })
  }
})

export default router
