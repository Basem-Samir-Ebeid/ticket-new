import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { user, profile } = auth
  const pool = getPool()

  if (req.method === 'GET') {
    let rows
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      const result = await pool.query('SELECT * FROM leave_requests ORDER BY created_at DESC')
      rows = result.rows
    } else {
      const result = await pool.query(
        'SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC',
        [user.id]
      )
      rows = result.rows
    }
    const { rows: allProfiles } = await pool.query('SELECT id, full_name, email, role FROM profiles')
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    return res.json(rows.map(r => ({ ...r, user: profileMap.get(r.user_id) || null })))
  }

  if (req.method === 'POST') {
    const { start_date, end_date, reason } = req.body
    if (!start_date || !end_date) return res.status(400).json({ error: 'Dates required' })

    const { rows } = await pool.query(
      "INSERT INTO leave_requests (user_id, start_date, end_date, reason, status) VALUES ($1,$2,$3,$4,'pending') RETURNING *",
      [user.id, start_date, end_date, reason || null]
    )
    const leave = rows[0]

    const { rows: admins } = await pool.query("SELECT id FROM profiles WHERE role = 'admin'")
    const senderName = profile.full_name || profile.email
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
        [admin.id, `🌴 New leave request from ${senderName} (${start_date} → ${end_date})`]
      )
    }

    return res.json(leave)
  }
}
