import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  factoryRotationGroups,
  factoryRotationMembers,
  factoryRotationSchedule,
  profiles,
  notifications,
} from '../../shared/schema'
import { eq, and, gte, lte, asc, desc, inArray } from 'drizzle-orm'
import { broadcast } from '../ws'
import { sendWhatsAppToUser } from '../whatsappConfig'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

// ── Helper: skip Friday (5) and Saturday (6) ─────────────────────────────────
function isWorkday(date: Date): boolean {
  const day = date.getDay()
  return day !== 5 && day !== 6
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

// ── GET /groups ───────────────────────────────────────────────────────────────
router.get('/groups', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const groups = await db
      .select()
      .from(factoryRotationGroups)
      .orderBy(asc(factoryRotationGroups.created_at))

    const members = await db
      .select({
        id: factoryRotationMembers.id,
        group_id: factoryRotationMembers.group_id,
        user_id: factoryRotationMembers.user_id,
        order_index: factoryRotationMembers.order_index,
        full_name: profiles.full_name,
        email: profiles.email,
      })
      .from(factoryRotationMembers)
      .leftJoin(profiles, eq(factoryRotationMembers.user_id, profiles.id))
      .orderBy(asc(factoryRotationMembers.order_index))

    const result = groups.map(g => ({
      ...g,
      members: members.filter(m => m.group_id === g.id),
    }))

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load groups' })
  }
})

// ── POST /groups ──────────────────────────────────────────────────────────────
router.post('/groups', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { name, members = [] } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })

    const [group] = await db
      .insert(factoryRotationGroups)
      .values({ name, created_by: req.user.id })
      .returning()

    if (members.length > 0) {
      await db.insert(factoryRotationMembers).values(
        members.map((m: { user_id: string; order_index: number }, i: number) => ({
          group_id: group.id,
          user_id: m.user_id,
          order_index: m.order_index ?? i,
        }))
      )
    }

    res.json(group)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create group' })
  }
})

// ── PUT /groups/:id ───────────────────────────────────────────────────────────
router.put('/groups/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { name, members } = req.body

    const [group] = await db
      .update(factoryRotationGroups)
      .set({ name })
      .where(eq(factoryRotationGroups.id, req.params.id))
      .returning()

    if (!group) return res.status(404).json({ error: 'Group not found' })

    if (Array.isArray(members)) {
      await db
        .delete(factoryRotationMembers)
        .where(eq(factoryRotationMembers.group_id, req.params.id))
      if (members.length > 0) {
        await db.insert(factoryRotationMembers).values(
          members.map((m: { user_id: string; order_index: number }, i: number) => ({
            group_id: req.params.id,
            user_id: m.user_id,
            order_index: m.order_index ?? i,
          }))
        )
      }
    }

    res.json(group)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update group' })
  }
})

// ── DELETE /groups/:id ────────────────────────────────────────────────────────
router.delete('/groups/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db
      .delete(factoryRotationGroups)
      .where(eq(factoryRotationGroups.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete group' })
  }
})

// ── GET /schedule ─────────────────────────────────────────────────────────────
router.get('/schedule', requireAuth as any, async (req: any, res) => {
  try {
    const { group_id, from, to } = req.query as Record<string, string>

    const conditions: any[] = []
    if (group_id) conditions.push(eq(factoryRotationSchedule.group_id, group_id))
    if (from) conditions.push(gte(factoryRotationSchedule.scheduled_date, from))
    if (to) conditions.push(lte(factoryRotationSchedule.scheduled_date, to))

    const rows = await db
      .select({
        id: factoryRotationSchedule.id,
        group_id: factoryRotationSchedule.group_id,
        user_id: factoryRotationSchedule.user_id,
        scheduled_date: factoryRotationSchedule.scheduled_date,
        notified: factoryRotationSchedule.notified,
        attended_at: factoryRotationSchedule.attended_at,
        full_name: profiles.full_name,
        email: profiles.email,
      })
      .from(factoryRotationSchedule)
      .leftJoin(profiles, eq(factoryRotationSchedule.user_id, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(factoryRotationSchedule.scheduled_date))

    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load schedule' })
  }
})

// ── POST /generate ────────────────────────────────────────────────────────────
router.post('/generate', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { group_id, from_date, to_date } = req.body
    if (!group_id || !from_date || !to_date)
      return res.status(400).json({ error: 'group_id, from_date and to_date are required' })

    const members = await db
      .select()
      .from(factoryRotationMembers)
      .where(eq(factoryRotationMembers.group_id, group_id))
      .orderBy(asc(factoryRotationMembers.order_index))

    if (members.length === 0)
      return res.status(400).json({ error: 'Group has no members' })

    await db
      .delete(factoryRotationSchedule)
      .where(
        and(
          eq(factoryRotationSchedule.group_id, group_id),
          gte(factoryRotationSchedule.scheduled_date, from_date),
          lte(factoryRotationSchedule.scheduled_date, to_date)
        )
      )

    const entries: { group_id: string; user_id: string; scheduled_date: string }[] = []
    let cursor = new Date(from_date)
    const end = new Date(to_date)
    let idx = 0

    while (cursor <= end) {
      if (isWorkday(cursor)) {
        entries.push({
          group_id,
          user_id: members[idx % members.length].user_id,
          scheduled_date: toDateStr(cursor),
        })
        idx++
      }
      cursor = addDays(cursor, 1)
    }

    if (entries.length > 0) {
      await db.insert(factoryRotationSchedule).values(entries)
    }

    res.json({ generated: entries.length })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate schedule' })
  }
})

// ── GET /my-next ──────────────────────────────────────────────────────────────
router.get('/my-next', requireAuth as any, async (req: any, res) => {
  try {
    const pastFrom = toDateStr(addDays(new Date(), -60))
    const rows = await db
      .select()
      .from(factoryRotationSchedule)
      .where(
        and(
          eq(factoryRotationSchedule.user_id, req.user.id),
          gte(factoryRotationSchedule.scheduled_date, pastFrom)
        )
      )
      .orderBy(asc(factoryRotationSchedule.scheduled_date))
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load schedule' })
  }
})

// ── POST /schedule/:id/attend ─────────────────────────────────────────────────
router.post('/schedule/:id/attend', requireAuth as any, async (req: any, res) => {
  try {
    const entry = await db
      .select()
      .from(factoryRotationSchedule)
      .where(eq(factoryRotationSchedule.id, req.params.id))
      .limit(1)

    if (!entry.length) return res.status(404).json({ error: 'Entry not found' })

    const row = entry[0]

    // Only the assigned employee can mark attendance
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'ليس يومك المحدد' })

    // Only allowed on the actual scheduled day
    const today = toDateStr(new Date())
    const rowDateStr = typeof row.scheduled_date === 'string'
      ? row.scheduled_date.slice(0, 10)
      : new Date(row.scheduled_date as any).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
    if (rowDateStr !== today) {
      return res.status(400).json({ error: 'يمكن تسجيل الحضور في يوم الدورة فقط' })
    }

    // Already attended
    if (row.attended_at) return res.status(400).json({ error: 'تم تسجيل حضورك مسبقاً' })

    const [updated] = await db
      .update(factoryRotationSchedule)
      .set({ attended_at: new Date() })
      .where(eq(factoryRotationSchedule.id, req.params.id))
      .returning()

    const [emp] = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)
    const empName = emp?.full_name || emp?.email || 'موظف'

    await db.insert(notifications).values({
      user_id: req.user.id,
      message: `✅ تم تسجيل حضورك في المصنع بتاريخ ${today}`,
    })
    broadcast(req.user.id, 'notification', { message: `✅ تم تسجيل حضورك في المصنع بتاريخ ${today}` })

    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.role, ['admin', 'super_admin']))

    const adminMsg = `🏭 ${empName} سجّل حضوره في المصنع اليوم ${today}`
    for (const admin of admins) {
      if (admin.id === req.user.id) continue
      await db.insert(notifications).values({
        user_id: admin.id,
        message: adminMsg,
      })
      broadcast(admin.id, 'notification', { message: adminMsg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to mark attendance' })
  }
})

// ── POST /schedule/assign (assign empty day) ──────────────────────────────────
router.post('/schedule/assign', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { group_id, user_id, scheduled_date } = req.body
    if (!group_id || !user_id || !scheduled_date)
      return res.status(400).json({ error: 'group_id, user_id and scheduled_date are required' })

    const dow = new Date(scheduled_date).getDay()
    if (dow === 5 || dow === 6) return res.status(400).json({ error: 'Cannot assign on weekend' })

    const existing = await db
      .select()
      .from(factoryRotationSchedule)
      .where(and(eq(factoryRotationSchedule.group_id, group_id), eq(factoryRotationSchedule.scheduled_date, scheduled_date)))
      .limit(1)

    let row
    if (existing.length > 0) {
      ;[row] = await db
        .update(factoryRotationSchedule)
        .set({ user_id, notified: false })
        .where(eq(factoryRotationSchedule.id, existing[0].id))
        .returning()
    } else {
      ;[row] = await db
        .insert(factoryRotationSchedule)
        .values({ group_id, user_id, scheduled_date })
        .returning()
    }
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to assign entry' })
  }
})

// ── PUT /schedule/:id (manual override) ──────────────────────────────────────
router.put('/schedule/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })
    const [row] = await db
      .update(factoryRotationSchedule)
      .set({ user_id, notified: false })
      .where(eq(factoryRotationSchedule.id, req.params.id))
      .returning()
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update entry' })
  }
})

// ── GET /groups/:id/members (no admin restriction — employees need for swaps) ──
router.get('/groups/:id/members', requireAuth as any, async (req: any, res) => {
  try {
    const members = await db
      .select({
        user_id: factoryRotationMembers.user_id,
        order_index: factoryRotationMembers.order_index,
        full_name: profiles.full_name,
        email: profiles.email,
      })
      .from(factoryRotationMembers)
      .leftJoin(profiles, eq(factoryRotationMembers.user_id, profiles.id))
      .where(eq(factoryRotationMembers.group_id, req.params.id))
      .orderBy(asc(factoryRotationMembers.order_index))
    res.json(members)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load members' })
  }
})

export default router

// ── Exported cron function ────────────────────────────────────────────────────
export async function runFactoryRotationNotifications() {
  try {
    const tomorrow = toDateStr(addDays(new Date(), 1))
    const entries = await db
      .select({
        id: factoryRotationSchedule.id,
        user_id: factoryRotationSchedule.user_id,
        scheduled_date: factoryRotationSchedule.scheduled_date,
        full_name: profiles.full_name,
      })
      .from(factoryRotationSchedule)
      .leftJoin(profiles, eq(factoryRotationSchedule.user_id, profiles.id))
      .where(
        and(
          eq(factoryRotationSchedule.scheduled_date, tomorrow),
          eq(factoryRotationSchedule.notified, false)
        )
      )

    for (const entry of entries) {
      const name = entry.full_name || 'الموظف'
      const message = `🏭 تذكير المصنع\nعزيزي ${name}، غداً ${entry.scheduled_date} هو يوم دورتك للذهاب إلى المصنع.\nيرجى الاستعداد والالتزام بالمواعيد. 🙏`

      await db.insert(notifications).values({
        user_id: entry.user_id,
        message: `🏭 تذكير: غداً ${entry.scheduled_date} هو يوم دورتك في المصنع.`,
      })
      broadcast(entry.user_id, 'notification', {
        message: `🏭 تذكير: غداً ${entry.scheduled_date} هو يوم دورتك في المصنع.`,
      })
      sendWhatsAppToUser(entry.user_id, message).catch(() => {})

      await db
        .update(factoryRotationSchedule)
        .set({ notified: true })
        .where(eq(factoryRotationSchedule.id, entry.id))
    }
    if (entries.length) console.log(`[Factory Rotation] Notified ${entries.length} employee(s)`)
  } catch (err) {
    console.error('[Factory Rotation cron error]', err)
  }
}
