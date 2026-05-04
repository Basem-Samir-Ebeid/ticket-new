import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { id } = req.query
  const pool = getPool()

  const { rows } = await pool.query(
    "UPDATE tickets SET request_status = 'refused' WHERE id = $1 RETURNING *",
    [id]
  )
  const ticket = rows[0]

  if (ticket?.created_by) {
    await pool.query(
      'INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1, $2, $3)',
      [ticket.created_by, ticket.id, `❌ Your ticket request "${ticket.title}" has been refused by the admin.`]
    )
  }

  res.json(ticket)
}
