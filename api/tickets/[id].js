import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH', 'DELETE'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { id } = req.query
  const pool = getPool()

  if (req.method === 'PATCH') {
    const { status, request_status, assigned_to, is_request, opened_at, review } = req.body
    const fields = []
    const values = []
    let idx = 1

    if (status !== undefined) {
      fields.push(`status = $${idx++}`)
      values.push(status)
      if (status === 'pending') { fields.push(`pending_at = $${idx++}`); values.push(new Date()) }
      if (status === 'solved')  { fields.push(`solved_at = $${idx++}`);  values.push(new Date()) }
    }
    if (request_status !== undefined) { fields.push(`request_status = $${idx++}`); values.push(request_status) }
    if (assigned_to     !== undefined) { fields.push(`assigned_to = $${idx++}`);    values.push(assigned_to) }
    if (is_request      !== undefined) { fields.push(`is_request = $${idx++}`);     values.push(is_request) }
    if (opened_at       !== undefined) { fields.push(`opened_at = $${idx++}`);      values.push(opened_at) }
    if (review          !== undefined) { fields.push(`review = $${idx++}`);         values.push(review) }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' })

    values.push(id)
    const { rows } = await pool.query(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' })
    return res.json(rows[0])
  }

  if (req.method === 'DELETE') {
    await pool.query('DELETE FROM tickets WHERE id = $1', [id])
    return res.json({ success: true })
  }
}
