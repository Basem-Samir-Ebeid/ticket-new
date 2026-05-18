import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  overtimeRotationGroups,
  overtimeRotationMembers,
  overtimeRotationSchedule,
  profiles,
  notifications,
} from '../../shared/schema'
import { eq, and, gte, lte, asc } from 'drizzle-orm'
import { broadcast } from '../ws'
import { sendWhatsAppToUser } from '../whatsappConfig'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

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
  return date.toISOString().slice(0, 10)
}

// ── GET /groups ───────────────────────────────────────────────────────────────
router.get('/groups', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const groups = await db
      .select()
      .from(overtimeRotationGroups)
      .orderBy(asc(overtimeRotationGroups.created_at))

    const members = await db
      .select({
        id: overtimeRotationMembers.id,
        group_id: overtimeRotationMembers.group_id,
        user_id: overtimeRotationMembers.user_id,
        order_index: overtimeRotationMembers.order_index,
        full_name: profiles.full_name,
        email: profiles.email,
      })
      .from(overtimeRotationMembers)
      .leftJoin(profiles, eq(overtimeRotationMembers.user_id, profiles.id))
      .orderBy(asc(overtimeRotationMembers.order_index))

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
      .insert(overtimeRotationGroups)
      .values({ name, created_by: req.user.id })
      .returning()

    if (members.length > 0) {
      await db.insert(overtimeRotationMembers).values(
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
      .update(overtimeRotationGroups)
      .set({ name })
      .where(eq(overtimeRotationGroups.id, req.params.id))
      .returning()

    if (!group) return res.status(404).json({ error: 'Group not found' })

    if (Array.isArray(members)) {
      await db
        .delete(overtimeRotationMembers)
        .where(eq(overtimeRotationMembers.group_id, req.params.id))
      if (members.length > 0) {
        await db.insert(overtimeRotationMembers).values(
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
      .delete(overtimeRotationGroups)
      .where(eq(overtimeRotationGroups.id, req.params.id))
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
    if (group_id) conditions.push(eq(overtimeRotationSchedule.group_id, group_id))
    if (from) conditions.push(gte(overtimeRotationSchedule.scheduled_date, from))
    if (to) conditions.push(lte(overtimeRotationSchedule.scheduled_date, to))

    const rows = await db
      .select({
        id: overtimeRotationSchedule.id,
        group_id: overtimeRotationSchedule.group_id,
        user_id: overtimeRotationSchedule.user_id,
        scheduled_date: overtimeRotationSchedule.scheduled_date,
        notified: overtimeRotationSchedule.notified,
        full_name: profiles.full_name,
        email: profiles.email,
      })
      .from(overtimeRotationSchedule)
      .leftJoin(profiles, eq(overtimeRotationSchedule.user_id, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(overtimeRotationSchedule.scheduled_date))

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
      .from(overtimeRotationMembers)
      .where(eq(overtimeRotationMembers.group_id, group_id))
      .orderBy(asc(overtimeRotationMembers.order_index))

    if (members.length === 0)
      return res.status(400).json({ error: 'Group has no members' })

    await db
      .delete(overtimeRotationSchedule)
      .where(
        and(
          eq(overtimeRotationSchedule.group_id, group_id),
          gte(overtimeRotationSchedule.scheduled_date, from_date),
          lte(overtimeRotationSchedule.scheduled_date, to_date)
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
      await db.insert(overtimeRotationSchedule).values(entries)
    }

    res.json({ generated: entries.length })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate schedule' })
  }
})

// ── GET /my-next ──────────────────────────────────────────────────────────────
router.get('/my-next', requireAuth as any, async (req: any, res) => {
  try {
    const today = toDateStr(new Date())
    const rows = await db
      .select()
      .from(overtimeRotationSchedule)
      .where(
        and(
          eq(overtimeRotationSchedule.user_id, req.user.id),
          gte(overtimeRotationSchedule.scheduled_date, today)
        )
      )
      .orderBy(asc(overtimeRotationSchedule.scheduled_date))
      .limit(10)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load schedule' })
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
      .from(overtimeRotationSchedule)
      .where(and(eq(overtimeRotationSchedule.group_id, group_id), eq(overtimeRotationSchedule.scheduled_date, scheduled_date)))
      .limit(1)

    let row
    if (existing.length > 0) {
      ;[row] = await db
        .update(overtimeRotationSchedule)
        .set({ user_id, notified: false })
        .where(eq(overtimeRotationSchedule.id, existing[0].id))
        .returning()
    } else {
      ;[row] = await db
        .insert(overtimeRotationSchedule)
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
      .update(overtimeRotationSchedule)
      .set({ user_id, notified: false })
      .where(eq(overtimeRotationSchedule.id, req.params.id))
      .returning()
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update entry' })
  }
})

export default router

// ── Exported cron function ────────────────────────────────────────────────────
export async function runOvertimeRotationNotifications() {
  try {
    const today = toDateStr(new Date())
    const entries = await db
      .select({
        id: overtimeRotationSchedule.id,
        user_id: overtimeRotationSchedule.user_id,
        scheduled_date: overtimeRotationSchedule.scheduled_date,
        full_name: profiles.full_name,
      })
      .from(overtimeRotationSchedule)
      .leftJoin(profiles, eq(overtimeRotationSchedule.user_id, profiles.id))
      .where(
        and(
          eq(overtimeRotationSchedule.scheduled_date, today),
          eq(overtimeRotationSchedule.notified, false)
        )
      )

    for (const entry of entries) {
      const name = entry.full_name || 'الموظف'
      const message = `🌙 تذكير الأوفر تايم\nعزيزي ${name}، اليوم ${entry.scheduled_date} هو دورتك في الأوفر تايم.\nستكون مطلوباً للبقاء بعد انتهاء دوام العمل الرسمي. شكراً لالتزامك! 💪`

      await db.insert(notifications).values({
        user_id: entry.user_id,
        message: `🌙 تذكير: اليوم ${entry.scheduled_date} هو دورتك في الأوفر تايم.`,
      })
      broadcast(entry.user_id, 'notification', {
        message: `🌙 تذكير: اليوم ${entry.scheduled_date} هو دورتك في الأوفر تايم.`,
      })
      sendWhatsAppToUser(entry.user_id, message).catch(() => {})

      await db
        .update(overtimeRotationSchedule)
        .set({ notified: true })
        .where(eq(overtimeRotationSchedule.id, entry.id))
    }
    if (entries.length) console.log(`[Overtime Rotation] Notified ${entries.length} employee(s)`)
  } catch (err) {
    console.error('[Overtime Rotation cron error]', err)
  }
}
