import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' })
  }

  const pool = getPool()
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO NOTHING`,
    [auth.user.id, endpoint, keys.p256dh, keys.auth]
  )
  res.json({ success: true })
}
