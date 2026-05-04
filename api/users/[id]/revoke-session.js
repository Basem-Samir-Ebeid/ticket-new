import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile } = auth
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' })

  const { id } = req.query
  const { reason } = req.body
  const pool = getPool()

  await pool.query(
    'INSERT INTO session_revocations (user_id, reason) VALUES ($1, $2)',
    [id, reason || null]
  )
  res.json({ success: true })
}
