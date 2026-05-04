import bcrypt from 'bcryptjs'
import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile } = auth
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' })

  const { id } = req.query
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const password_hash = await bcrypt.hash(newPassword, 10)
  const pool = getPool()
  const { rows } = await pool.query(
    'UPDATE profiles SET password_hash = $1 WHERE id = $2 RETURNING id',
    [password_hash, id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
  res.json({ success: true })
}
