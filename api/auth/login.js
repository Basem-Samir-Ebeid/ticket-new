import bcrypt from 'bcryptjs'
import { getPool, signToken, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const pool = getPool()
  const { rows } = await pool.query('SELECT * FROM profiles WHERE email = $1', [email.toLowerCase()])
  const profile = rows[0]
  if (!profile) return res.status(401).json({ error: 'Invalid email or password' })

  const valid = await bcrypt.compare(password, profile.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

  const token = signToken(profile.id)
  const { password_hash, ...safeProfile } = profile
  res.json({ token, user: safeProfile })
}
