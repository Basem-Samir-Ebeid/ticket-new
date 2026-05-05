import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { profiles } from '../../shared/schema'
import { eq } from 'drizzle-orm'
import { signToken, requireAuth } from '../auth'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase()))
    if (!profile) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, profile.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const token = signToken(profile.id)
    const { password_hash, ...safeProfile } = profile
    res.json({ token, user: safeProfile })
  } catch (err: any) {
    console.error('POST /login error:', err)
    res.status(500).json({ error: err?.message || 'Login failed' })
  }
})

router.get('/me', requireAuth as any, async (req: any, res) => {
  try {
    const { password_hash, ...safeProfile } = req.profile
    res.json(safeProfile)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get profile' })
  }
})

router.post('/change-password', requireAuth as any, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Passwords required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, req.user.id))
    const valid = await bcrypt.compare(currentPassword, profile.password_hash)
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' })

    const password_hash = await bcrypt.hash(newPassword, 10)
    await db.update(profiles).set({ password_hash, plain_password: newPassword, must_change_password: false }).where(eq(profiles.id, req.user.id))
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /change-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to change password' })
  }
})

router.post('/force-change-password', requireAuth as any, async (req: any, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) return res.status(400).json({ error: 'New password required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const password_hash = await bcrypt.hash(newPassword, 10)
    await db.update(profiles).set({ password_hash, plain_password: newPassword, must_change_password: false }).where(eq(profiles.id, req.user.id))
    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /force-change-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to change password' })
  }
})

export default router
