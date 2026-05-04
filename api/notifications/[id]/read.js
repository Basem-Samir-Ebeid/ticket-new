import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { id } = req.query
  const pool = getPool()
  await pool.query('UPDATE notifications SET read = true WHERE id = $1', [id])
  res.json({ success: true })
}
