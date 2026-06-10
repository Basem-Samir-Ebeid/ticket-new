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

const isSuperAdmin = (role: string) => role === 'super_admin'
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

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
    const msg = `🔄 ${requesterName} يطلب تحويل دوام ${moduleName} بتاريخ ${requester_date} إليك`
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
      pending_admin: enriched.filter(s => s.status === 'peer_accepted'),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load swaps' })
  }
})

// ── GET /admin-pending — super admin sees all peer_accepted swaps ──────────────
router.get('/admin-pending', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const all = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.status, 'peer_accepted'))

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

    res.json(enriched)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load pending approvals' })
  }
})

// ── POST /:id/accept — target user accepts (sets peer_accepted, waits for admin) ─
router.post('/:id/accept', requireAuth as any, async (req: any, res) => {
  try {
    const { target_schedule_id } = req.body

    const [swap] = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)
    if (!swap) return res.status(404).json({ error: 'Swap not found' })
    if (swap.target_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
    if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' })

    // Validate the target's chosen schedule entry (optional — one-way transfer if not provided)
    let targetDate: string | null = null
    if (target_schedule_id) {
      const table = getTable(swap.module)
      const [targetEntry] = await db.select().from(table).where(eq(table.id, target_schedule_id)).limit(1)
      if (!targetEntry || targetEntry.user_id !== req.user.id)
        return res.status(403).json({ error: 'Target schedule entry not found or not yours' })
      targetDate = typeof targetEntry.scheduled_date === 'string'
        ? targetEntry.scheduled_date
        : String(targetEntry.scheduled_date)
    }

    // Mark as peer_accepted — actual swap happens after super admin approves
    const [updated] = await db
      .update(rotationSwapRequests)
      .set({
        status: 'peer_accepted',
        target_schedule_id: target_schedule_id || null,
        target_date: targetDate,
        updated_at: new Date(),
      })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    const [acceptorProfile] = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1)
    const acceptorName = acceptorProfile?.full_name || acceptorProfile?.email || 'زميل'

    // Notify the requester
    const requesterMsg = `✅ ${acceptorName} وافق على طلب التحويل — في انتظار موافقة الإدارة`
    await db.insert(notifications).values({ user_id: swap.requester_id, message: requesterMsg })
    broadcast(swap.requester_id, 'notification', { message: requesterMsg })

    // Notify super admins
    const moduleName = swap.module === 'factory' ? 'المصنع' : 'الأوفر تايم'
    const adminMsg = `🔄 طلب تحويل دوام ${moduleName} بتاريخ ${swap.requester_date} يحتاج موافقتك`
    const superAdmins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))
    for (const admin of superAdmins) {
      await db.insert(notifications).values({ user_id: admin.id, message: adminMsg })
      broadcast(admin.id, 'notification', { message: adminMsg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to accept swap' })
  }
})

// ── POST /:id/reject — target user rejects ────────────────────────────────────
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
    const msg = `❌ ${rejecterName} رفض طلب تحويل الدوام بتاريخ ${swap.requester_date}`
    await db.insert(notifications).values({ user_id: swap.requester_id, message: msg })
    broadcast(swap.requester_id, 'notification', { message: msg })

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject swap' })
  }
})

// ── POST /:id/admin-approve — super admin approves and applies the swap ────────
router.post('/:id/admin-approve', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const [swap] = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)
    if (!swap) return res.status(404).json({ error: 'Swap not found' })
    if (swap.status !== 'peer_accepted') return res.status(400).json({ error: 'Swap is not awaiting admin approval' })

    const table = getTable(swap.module)

    // Apply the actual swap
    await db.update(table).set({ user_id: swap.target_id }).where(eq(table.id, swap.requester_schedule_id))

    if (swap.target_schedule_id) {
      await db.update(table).set({ user_id: swap.requester_id }).where(eq(table.id, swap.target_schedule_id))
    }

    const [updated] = await db
      .update(rotationSwapRequests)
      .set({ status: 'admin_approved', updated_at: new Date() })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    // Notify both parties
    const moduleName = swap.module === 'factory' ? 'المصنع' : 'الأوفر تايم'
    const approvedMsg = `✅ تمت الموافقة على تحويل دوام ${moduleName} بتاريخ ${swap.requester_date} من قِبَل الإدارة`
    for (const uid of [swap.requester_id, swap.target_id]) {
      await db.insert(notifications).values({ user_id: uid, message: approvedMsg })
      broadcast(uid, 'notification', { message: approvedMsg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to approve swap' })
  }
})

// ── POST /:id/admin-reject — super admin rejects ───────────────────────────────
router.post('/:id/admin-reject', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })

    const [swap] = await db
      .select()
      .from(rotationSwapRequests)
      .where(eq(rotationSwapRequests.id, req.params.id))
      .limit(1)
    if (!swap) return res.status(404).json({ error: 'Swap not found' })
    if (swap.status !== 'peer_accepted') return res.status(400).json({ error: 'Swap is not awaiting admin approval' })

    const [updated] = await db
      .update(rotationSwapRequests)
      .set({ status: 'admin_rejected', updated_at: new Date() })
      .where(eq(rotationSwapRequests.id, req.params.id))
      .returning()

    const moduleName = swap.module === 'factory' ? 'المصنع' : 'الأوفر تايم'
    const rejectedMsg = `❌ رفضت الإدارة طلب تحويل دوام ${moduleName} بتاريخ ${swap.requester_date}`
    for (const uid of [swap.requester_id, swap.target_id]) {
      await db.insert(notifications).values({ user_id: uid, message: rejectedMsg })
      broadcast(uid, 'notification', { message: rejectedMsg })
    }

    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reject swap' })
  }
})

export default router
