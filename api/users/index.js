import bcrypt from 'bcryptjs'
import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile } = auth
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' })

  const pool = getPool()

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, can_view_attendance, profile_picture_url, created_at FROM profiles ORDER BY created_at DESC'
    )
    return res.json(rows)
  }

  if (req.method === 'POST') {
    const { email, password, full_name, role, can_view_attendance, profile_picture_url } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const { rows: existing } = await pool.query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()])
    if (existing.length > 0) return res.status(400).json({ error: 'Email already in use' })

    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO profiles (email, password_hash, full_name, role, can_view_attendance, profile_picture_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, created_at`,
      [email.toLowerCase(), password_hash, full_name || null, role || 'employee', can_view_attendance || false, profile_picture_url || null]
    )
    return res.json(rows[0])
  }
}
