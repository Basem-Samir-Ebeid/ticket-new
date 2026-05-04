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
    'SELECT id FROM login_times WHERE user_id = $1 AND date = $2',
    [auth.user.id, today]
  )
  if (existing.length > 0) return res.status(400).json({ error: 'Already logged in today' })

  const { rows } = await pool.query(
    'INSERT INTO login_times (user_id, date, latitude, longitude) VALUES ($1,$2,$3,$4) RETURNING *',
    [auth.user.id, today, latitude || null, longitude || null]
  )
  res.json(rows[0])
}
