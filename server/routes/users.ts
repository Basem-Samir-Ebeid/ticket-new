import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { profiles, sessionRevocations } from '../../shared/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../auth'
import { broadcast } from '../ws'

const router = Router()

router.get('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const isSuperAdmin = req.profile?.role === 'super_admin'
    const rows = await db.select().from(profiles).orderBy(desc(profiles.created_at))
    const users = rows.map(u => {
      const { password_hash, ...rest } = u
      if (!isSuperAdmin) {
        const { plain_password, ...noPass } = rest
        return noPass
      }
      return rest
    })
    res.json(users)
  } catch (err: any) {
    console.error('GET /users error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get users' })
  }
})

router.post('/', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const { email, password, full_name, role, can_view_attendance } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const existing = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase()))
    if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' })

    const password_hash = await bcrypt.hash(password, 10)
    const [user] = await db.insert(profiles).values({
      email: email.toLowerCase(),
      password_hash,
      plain_password: password,
      full_name: full_name || null,
      role: role || 'employee',
      can_view_attendance: can_view_attendance || false,
      must_change_password: true,
    }).returning()

    const { password_hash: _, ...safeUser } = user
    res.json(safeUser)
  } catch (err: any) {
    console.error('POST /users error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create user' })
  }
})

router.patch('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const { full_name, role, can_view_attendance, profile_picture_url } = req.body
    const [user] = await db.update(profiles)
      .set({ full_name, role, can_view_attendance, profile_picture_url })
      .where(eq(profiles.id, req.params.id))
      .returning()

    if (!user) return res.status(404).json({ error: 'User not found' })
    const { password_hash, ...safeUser } = user
    res.json(safeUser)
  } catch (err: any) {
    console.error('PATCH /users/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update user' })
  }
})

router.post('/:id/reset-password', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const password_hash = await bcrypt.hash(newPassword, 10)
    const [user] = await db.update(profiles).set({ password_hash, plain_password: newPassword, must_change_password: true }).where(eq(profiles.id, req.params.id)).returning()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /users/:id/reset-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to reset password' })
  }
})

router.delete('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const userId = req.params.id
    await db.insert(sessionRevocations).values({ user_id: userId, reason: 'account_deleted' })
    broadcast(userId, 'session_revoked', { reason: 'account_deleted' })
    await new Promise(r => setTimeout(r, 700))
    await db.delete(profiles).where(eq(profiles.id, userId))
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /users/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete user' })
  }
})

router.post('/:id/revoke-session', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const userId = req.params.id
    const { reason } = req.body
    await db.insert(sessionRevocations).values({ user_id: userId, reason: reason || null })
    broadcast(userId, 'session_revoked', { reason })
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /users/:id/revoke-session error:', err)
    res.status(500).json({ error: err?.message || 'Failed to revoke session' })
  }
})

export default router
