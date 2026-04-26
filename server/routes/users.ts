import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { profiles, sessionRevocations, tickets, loginTimes, leaveRequests, notifications } from '../../shared/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../auth'
import { broadcast } from '../ws'

const router = Router()

router.get('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const users = await db.select({
    id: profiles.id,
    email: profiles.email,
    full_name: profiles.full_name,
    role: profiles.role,
    can_view_attendance: profiles.can_view_attendance,
    created_at: profiles.created_at,
  }).from(profiles).orderBy(desc(profiles.created_at))
  res.json(users)
})

router.post('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const { email, password, full_name, role, can_view_attendance } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const existing = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase()))
  if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' })

  const password_hash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(profiles).values({
    email: email.toLowerCase(),
    password_hash,
    full_name: full_name || null,
    role: role || 'employee',
    can_view_attendance: can_view_attendance || false,
  }).returning()

  const { password_hash: _, ...safeUser } = user
  res.json(safeUser)
})

router.patch('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const { full_name, role, can_view_attendance } = req.body
  const [user] = await db.update(profiles)
    .set({ full_name, role, can_view_attendance })
    .where(eq(profiles.id, req.params.id))
    .returning()

  if (!user) return res.status(404).json({ error: 'User not found' })
  const { password_hash, ...safeUser } = user
  res.json(safeUser)
})

router.post('/:id/reset-password', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const password_hash = await bcrypt.hash(newPassword, 10)
  const [user] = await db.update(profiles).set({ password_hash }).where(eq(profiles.id, req.params.id)).returning()
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ success: true })
})

router.delete('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const userId = req.params.id

  // Insert session revocation first (so client disconnects)
  await db.insert(sessionRevocations).values({ user_id: userId, reason: 'account_deleted' })
  broadcast(userId, 'session_revoked', { reason: 'account_deleted' })

  await new Promise(r => setTimeout(r, 700))
  await db.delete(profiles).where(eq(profiles.id, userId))
  res.json({ success: true })
})

router.post('/:id/revoke-session', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  const userId = req.params.id
  const { reason } = req.body

  await db.insert(sessionRevocations).values({ user_id: userId, reason: reason || null })
  broadcast(userId, 'session_revoked', { reason })
  res.json({ success: true })
})

export default router
