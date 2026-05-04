import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'
import { sendPushToAdmins } from '../_lib/push.js'

async function withProfiles(pool, rows) {
  const { rows: allProfiles } = await pool.query('SELECT id, full_name, email, role FROM profiles')
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))
  return rows.map(t => ({
    ...t,
    created_by_profile: profileMap.get(t.created_by) || null,
    assigned_to_profile: profileMap.get(t.assigned_to) || null,
  }))
}

const isAdminRole = (role) => role === 'admin' || role === 'super_admin'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { user, profile } = auth
  const pool = getPool()

  if (req.method === 'GET') {
    let rows
    if (isAdminRole(profile.role)) {
      const result = await pool.query(
        "SELECT * FROM tickets WHERE is_request = false ORDER BY created_at DESC"
      )
      rows = result.rows
    } else {
      const result = await pool.query(
        "SELECT * FROM tickets WHERE assigned_to = $1 AND is_request = false ORDER BY created_at DESC",
        [user.id]
      )
      rows = result.rows
    }
    return res.json(await withProfiles(pool, rows))
  }

  if (req.method === 'POST') {
    const { title, description, affected_person, assigned_to, status, is_request } = req.body
    const now = new Date()
    const { rows } = await pool.query(
      `INSERT INTO tickets (title, description, affected_person, assigned_to, created_by, status, is_request, request_status, opened_at, pending_at, solved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        title,
        description || null,
        affected_person || null,
        assigned_to || null,
        user.id,
        status || 'opened',
        is_request || false,
        is_request ? 'pending_review' : null,
        now,
        status === 'pending' ? now : null,
        status === 'solved' ? now : null,
      ]
    )
    const ticket = rows[0]

    if (is_request) {
      const { rows: admins } = await pool.query(
        "SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')"
      )
      for (const admin of admins) {
        await pool.query(
          'INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1, $2, $3)',
          [admin.id, ticket.id, `📝 New ticket request: ${title}`]
        )
      }
      sendPushToAdmins(pool, '📝 New Ticket Request', title, '/')
    } else {
      sendPushToAdmins(pool, '🎫 New Ticket', title, '/')
    }

    return res.json(ticket)
  }
}
