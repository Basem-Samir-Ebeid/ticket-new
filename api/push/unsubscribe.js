import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['DELETE'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { endpoint } = req.body
  if (endpoint) {
    const pool = getPool()
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
  }
  res.json({ success: true })
}
