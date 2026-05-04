import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC',
    [auth.user.id]
  )
  res.json(rows)
}
