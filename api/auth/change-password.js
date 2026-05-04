import bcrypt from 'bcryptjs'
import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Passwords required' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const valid = await bcrypt.compare(currentPassword, auth.profile.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' })

  const password_hash = await bcrypt.hash(newPassword, 10)
  const pool = getPool()
  await pool.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [password_hash, auth.user.id])
  res.json({ success: true })
}
