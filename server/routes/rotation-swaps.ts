import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import {
  rotationSwapRequests,
  factoryRotationSchedule,
  overtimeRotationSchedule,
  profiles,
  notifications,
} from '../../shared/schema'
import { eq, or, and, inArray } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()

function getTable(module: string) {
  return module === 'factory' ? factoryRotationSchedule : overtimeRotationSchedule
}

// ── POST / — create swap request ──────────────────────────────────────────────
router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    const { module, requester_schedule_id, requester_date, target_id, note } = req.body
    if (!module || !requester_schedule_id || !requester_date || !target_id)
      return res.status(400).json({ error: 'Missing required fields' })
    if (!['factory', 'overtime'].includes(module))
      return res.status(400).json({ error: 'Invalid module' })
    if (target_id === req.user.id)
      return res.status(400).json({ error: 'Cannot swap with yourself' })

    const table = getTable(module)
    const [entry] = await db.select().from(table).where(eq(table.id, requester_schedule_id)).limit(1)
    if (!entry || entry.user_id !== req.user.id)
      return res.status(403).json({ error: 'Schedule entry not found or not yours' })

    const [swap] = await db.insert(rotationSwapRequests).values({
      module,
      requester_id: req.user.id,
      target_id,
      requester_schedule_id,
      requester_date,
      note: note || null,
    }).returning()

    const [requesterProfile] = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)
    const requesterName = requesterProfile?.full_name || requesterProfile?.email || 'زميل'
    const moduleName = module === 'factory' ? 'المصنع' : 'الأوفر تايم'
    const msg = `🔄 ${requesterName} يطلب تبديل دوام ${moduleName} بتاريخ ${requester_date}`
    await db.insert(notifications).values({ user_id: target_id, message: msg })
    broadcast(target_id, 'notification', { message: msg })

    res.json(swap)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create swap request' })
  }
})

// ── GET /my — get my swap requests ────────────────────────────────────────────
router.get('/my', requireAuth as any, async (req: any, res) => {
  try {
    const all = await db
      .select()
      .from(rotationSwapRequests)
      .where(or(
        eq(rotationSwapRequests.requester_id, req.user.id),
        eq(rotationSwapRequests.target_id, req.user.id),
      ))

    const userIds = [...new Set(all.flatMap(s => [s.requester_id, s.target_id]))]
    const profileData = userIds.length > 0
      ? await db
          .select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email })
          .from(profiles)
          .where(inArray(profiles.id, userIds))
      : []
    const byId: Record<string, any> = Object.fromEntries(profileData.map(p => [p.id, p]))

    const enriched = all.map(s => ({
      ...s,
      requester_name: byId[s.requester_id]?.full_name || byId[s.requester_id]?.email || s.requester_id,
      target_name: byId[s.target_id]?.full_name || byId[s.target_id]?.email || s.target_id,
    }))

    res.json({
      incoming: enriched.filter(s => s.target_id === req.user.id && s.status === 'pending'),
      outgoing: enriched.filter(s => s.requester_id === req.user.id),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load swaps' })
  }
})

// ── POST /:id/accept ──────────────────────────────────────────────────────────
router.post('/:id/accept', requireAuth as any, async (req: any, res) => {
  try {
    const { target_schedule_id } = req.body
    if (!target_schedule_id) return res.status(400).json({ error: 'target_schedule_id required' })

    const [swap] = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)
    if (!swap) return res.status(404).json({ error: 'Swap not found' })
    if (swap.target_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
    if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' })

    const table = getTable(swap.module)
    const [targetEntry] = await db.select().from(table).where(eq(table.id, target_schedule_id)).limit(1)
    if (!targetEntry || targetEntry.user_id !== req.user.id)
      return res.status(403).json({ error: 'Target schedule entry not found or not yours' })

    await db.update(table).set({ user_id: swap.target_id }).where(eq(table.id, swap.requester_schedule_id))
    await db.update(table).set({ user_id: swap.requester_id }).where(eq(table.id, target_schedule_id))

    const targetDate = typeof targetEntry.scheduled_date === 'string'
      ? targetEntry.scheduled_date
      : String(targetEntry.scheduled_date)

    const [updated] = await db
      .update(rotationSwapRequests)
      .set({ status: 'accepted', target_schedule_id, target_date: targetDate, updated_at: new Date() })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    const [acceptorProfile] = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)
    const acceptorName = acceptorProfile?.full_name || acceptorProfile?.email || 'زميل'
    const msg = `✅ ${acceptorName} قبل طلب تبديل الدوام — تم التبديل بنجاح`
    await db.insert(notifications).values({ user_id: swap.requester_id, message: msg })
    broadcast(swap.requester_id, 'notification', { message: msg })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to accept swap' })
  }
})

// ── POST /:id/reject ──────────────────────────────────────────────────────────
router.post('/:id/reject', requireAuth as any, async (req: any, res) => {
  try {
    const [swap] = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)
    if (!swap) return res.status(404).json({ error: 'Swap not found' })
    if (swap.target_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
    if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' })

    const [updated] = await db
      .update(rotationSwapRequests)
      .set({ status: 'rejected', updated_at: new Date() })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    const [rejecterProfile] = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)
    const rejecterName = rejecterProfile?.full_name || rejecterProfile?.email || 'زميل'
    const msg = `❌ ${rejecterName} رفض طلب تبديل الدوام بتاريخ ${swap.requester_date}`
    await db.insert(notifications).values({ user_id: swap.requester_id, message: msg })
    broadcast(swap.requester_id, 'notification', { message: msg })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject swap' })
  }
})

export default router
