import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import { db } from '../db'
import { profiles, passwordResetTokens } from '../../shared/schema'
import { eq, and, gt } from 'drizzle-orm'

const router = Router()

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass) return null

  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, tls: { rejectUnauthorized: false } }), from }
}

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase()))

    // Always return success to prevent email enumeration
    if (!profile) return res.json({ success: true })

    // Delete any existing unused tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.user_id, profile.id))

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.insert(passwordResetTokens).values({
      user_id: profile.id,
      token,
      expires_at: expiresAt,
    })

    const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    const smtp = getTransporter()
    if (smtp) {
      await smtp.transporter.sendMail({
        from: smtp.from,
        to: profile.email,
        subject: 'Finest — Reset Your Password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#05050a;color:#e2e8f0;padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
            <h2 style="color:#ffffff;margin-bottom:8px">Reset your password</h2>
            <p style="color:#94a3b8;margin-bottom:24px">Hi ${profile.full_name || profile.email},</p>
            <p style="color:#94a3b8;margin-bottom:24px">We received a request to reset your password for the <strong style="color:#fff">Finest IT Ticket System</strong>. Click the button below to choose a new password. This link is valid for <strong style="color:#fff">1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Reset Password</a>
            <p style="color:#475569;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            <p style="color:#475569;font-size:12px;">Or copy this link: <a href="${resetUrl}" style="color:#6366f1">${resetUrl}</a></p>
          </div>
        `,
      })
    } else {
      console.warn('[forgot-password] SMTP not configured — reset token generated but email not sent. Token:', token)
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /forgot-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to send reset email' })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expires_at, new Date())
        )
      )

    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset link' })

    const password_hash = await bcrypt.hash(newPassword, 10)
    await db.update(profiles)
      .set({ password_hash, must_change_password: false })
      .where(eq(profiles.id, resetToken.user_id))

    await db.update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetToken.id))

    res.json({ success: true })
  } catch (err: any) {
    console.error('POST /reset-password error:', err)
    res.status(500).json({ error: err?.message || 'Failed to reset password' })
  }
})

router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query as { token: string }
    if (!token) return res.status(400).json({ valid: false })

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expires_at, new Date())
        )
      )

    res.json({ valid: !!resetToken })
  } catch (err: any) {
    res.status(500).json({ valid: false })
  }
})

export default router
