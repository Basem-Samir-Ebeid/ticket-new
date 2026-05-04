import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['DELETE'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile } = auth
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { id } = req.query
  const pool = getPool()
  await pool.query('DELETE FROM login_times WHERE id = $1', [id])
  res.json({ success: true })
}
