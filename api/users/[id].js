import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH', 'DELETE'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { profile } = auth
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' })

  const { id } = req.query
  const pool = getPool()

  if (req.method === 'PATCH') {
    const { full_name, role, can_view_attendance, profile_picture_url } = req.body
    const { rows } = await pool.query(
      `UPDATE profiles SET full_name = $1, role = $2, can_view_attendance = $3, profile_picture_url = $4
       WHERE id = $5 RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, created_at`,
      [full_name, role, can_view_attendance, profile_picture_url, id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
    return res.json(rows[0])
  }

  if (req.method === 'DELETE') {
    await pool.query(
      `INSERT INTO session_revocations (user_id, reason) VALUES ($1, $2)`,
      [id, 'account_deleted']
    )
    await new Promise(r => setTimeout(r, 700))
    await pool.query('DELETE FROM profiles WHERE id = $1', [id])
    return res.json({ success: true })
  }
}
