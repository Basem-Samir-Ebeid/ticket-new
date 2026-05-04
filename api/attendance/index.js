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

  const { profile } = auth
  const allowed = profile.role === 'admin' || profile.role === 'super_admin' || profile.can_view_attendance
  if (!allowed) return res.status(403).json({ error: 'Not allowed to view attendance' })

  const targetDate = req.query.date || getLocalDateString()
  const pool = getPool()

  const { rows } = await pool.query('SELECT * FROM login_times WHERE date = $1', [targetDate])
  const { rows: allProfiles } = await pool.query('SELECT id, full_name, email, role FROM profiles')
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))

  res.json(rows.map(r => ({
    ...r,
    full_name: profileMap.get(r.user_id)?.full_name || null,
    email: profileMap.get(r.user_id)?.email || null,
    role: profileMap.get(r.user_id)?.role || null,
  })))
}
