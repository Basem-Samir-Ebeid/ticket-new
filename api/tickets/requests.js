import { authenticate, getPool, allowMethods } from '../_lib/helpers.js'

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
  if (!allowMethods(req, res, ['GET'])) return
  const auth = await authenticate(req, res)
  if (!auth) return

  const { user, profile } = auth
  const pool = getPool()
  let rows

  if (isAdminRole(profile.role)) {
    const result = await pool.query(
      "SELECT * FROM tickets WHERE is_request = true ORDER BY created_at DESC"
    )
    rows = result.rows
  } else {
    const result = await pool.query(
      "SELECT * FROM tickets WHERE created_by = $1 AND is_request = true ORDER BY created_at DESC",
      [user.id]
    )
    rows = result.rows
  }

  res.json(await withProfiles(pool, rows))
}
