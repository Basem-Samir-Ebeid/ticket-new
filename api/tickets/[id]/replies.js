import { authenticate, getPool, allowMethods } from '../../_lib/helpers.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { id } = req.query
  const { user } = auth
  const pool = getPool()

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      'SELECT * FROM ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC',
      [id]
    )
    const { rows: allProfiles } = await pool.query('SELECT id, full_name FROM profiles')
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    return res.json(rows.map(r => ({ ...r, profiles: profileMap.get(r.user_id) || null })))
  }

  if (req.method === 'POST') {
    const { message, image_url } = req.body
    const { rows } = await pool.query(
      'INSERT INTO ticket_replies (ticket_id, user_id, message, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, user.id, message || null, image_url || null]
    )
    const reply = rows[0]

    const { rows: tickets } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id])
    const ticket = tickets[0]
    if (ticket?.created_by && ticket.created_by !== user.id) {
      await pool.query(
        'INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [ticket.created_by, ticket.id, `New reply on ticket: ${ticket.title}`]
      )
    }

    return res.json(reply)
  }
}
