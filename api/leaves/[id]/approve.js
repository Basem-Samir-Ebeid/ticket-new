import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile, user } = auth
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { id } = req.query
  const pool = getPool()

  const { rows } = await pool.query(
    `UPDATE leave_requests SET status = 'approved', admin_note = null, decided_by = $1, decided_at = $2
     WHERE id = $3 RETURNING *`,
    [user.id, new Date(), id]
  )
  const leave = rows[0]

  if (leave) {
    await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
      [leave.user_id, `✅ Your leave request (${leave.start_date} → ${leave.end_date}) was approved`]
    )
  }

  res.json(leave)
}
