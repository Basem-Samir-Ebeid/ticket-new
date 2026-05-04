import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { latitude, longitude } = req.body
  const today = getLocalDateString()
  const pool = getPool()

  const { rows: existing } = await pool.query(
    'SELECT * FROM login_times WHERE user_id = $1 AND date = $2',
    [auth.user.id, today]
  )
  if (!existing[0]) return res.status(404).json({ error: 'No login record found for today' })
  if (existing[0].logout_time) return res.status(400).json({ error: 'Already signed off today' })

  const { rows } = await pool.query(
    'UPDATE login_times SET logout_time = $1, logout_latitude = $2, logout_longitude = $3 WHERE user_id = $4 AND date = $5 RETURNING *',
    [new Date(), latitude || null, longitude || null, auth.user.id, today]
  )
  res.json(rows[0])
}
