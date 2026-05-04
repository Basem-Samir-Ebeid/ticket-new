import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const today = getLocalDateString()
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT * FROM login_times WHERE user_id = $1 AND date = $2',
    [auth.user.id, today]
  )
  res.json(rows[0] || null)
}
