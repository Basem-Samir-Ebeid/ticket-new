import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import webpush from 'web-push'
import multer from 'multer'
import pg from 'pg'

const { Pool } = pg
const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// ── DB ──────────────────────────────────────────────────────────────────────
let pool
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

// ── AUTH HELPERS ─────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'it-ticket-secret-key-2024'
function signToken(userId) { return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' }) }
function verifyToken(token) { return jwt.verify(token, JWT_SECRET) }

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' })
  try {
    const { userId } = verifyToken(auth.replace('Bearer ', ''))
    const { rows } = await getPool().query('SELECT * FROM profiles WHERE id = $1', [userId])
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    req.user = { id: userId }
    req.profile = rows[0]
    next()
  } catch { res.status(401).json({ error: 'Invalid token' }) }
}

function requireAdmin(req, res, next) {
  const role = req.profile?.role
  if (role !== 'admin' && role !== 'super_admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

const isAdminRole = (role) => role === 'admin' || role === 'super_admin'

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ── PUSH HELPER ───────────────────────────────────────────────────────────────
function initVapid() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@ticketsystem.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    return true
  } catch { return false }
}

async function sendPushToAdmins(title, body, url = '/') {
  if (!initVapid()) return
  try {
    const db = getPool()
    const { rows: adminIds } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    if (!adminIds.length) return
    const ids = adminIds.map(p => p.id)
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const { rows: subs } = await db.query(`SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`, ids)
    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch(async (err) => {
          if (err.statusCode === 410) await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
        })
    ))
  } catch {}
}

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const { rows } = await getPool().query('SELECT * FROM profiles WHERE email = $1', [email.toLowerCase()])
  const profile = rows[0]
  if (!profile) return res.status(401).json({ error: 'Invalid email or password' })
  if (!await bcrypt.compare(password, profile.password_hash)) return res.status(401).json({ error: 'Invalid email or password' })
  const { password_hash, ...safeProfile } = profile
  res.json({ token: signToken(profile.id), user: safeProfile })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const { password_hash, ...safeProfile } = req.profile
  res.json(safeProfile)
})

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Passwords required' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  if (!await bcrypt.compare(currentPassword, req.profile.password_hash)) return res.status(401).json({ error: 'Current password incorrect' })
  const password_hash = await bcrypt.hash(newPassword, 10)
  await getPool().query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [password_hash, req.user.id])
  res.json({ success: true })
})

// ── USERS ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await getPool().query(
    'SELECT id, email, full_name, role, can_view_attendance, profile_picture_url, created_at FROM profiles ORDER BY created_at DESC'
  )
  res.json(rows)
})

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, full_name, role, can_view_attendance, profile_picture_url } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  const db = getPool()
  const { rows: existing } = await db.query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()])
  if (existing.length) return res.status(400).json({ error: 'Email already in use' })
  const password_hash = await bcrypt.hash(password, 10)
  const { rows } = await db.query(
    `INSERT INTO profiles (email, password_hash, full_name, role, can_view_attendance, profile_picture_url)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, created_at`,
    [email.toLowerCase(), password_hash, full_name || null, role || 'employee', can_view_attendance || false, profile_picture_url || null]
  )
  res.json(rows[0])
})

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { full_name, role, can_view_attendance, profile_picture_url } = req.body
  const { rows } = await getPool().query(
    `UPDATE profiles SET full_name=$1, role=$2, can_view_attendance=$3, profile_picture_url=$4
     WHERE id=$5 RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, created_at`,
    [full_name, role, can_view_attendance, profile_picture_url, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json(rows[0])
})

app.post('/api/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  const password_hash = await bcrypt.hash(newPassword, 10)
  const { rows } = await getPool().query('UPDATE profiles SET password_hash=$1 WHERE id=$2 RETURNING id', [password_hash, req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json({ success: true })
})

app.post('/api/users/:id/revoke-session', requireAuth, requireAdmin, async (req, res) => {
  const { reason } = req.body
  await getPool().query('INSERT INTO session_revocations (user_id, reason) VALUES ($1,$2)', [req.params.id, reason || null])
  res.json({ success: true })
})

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = getPool()
  await db.query("INSERT INTO session_revocations (user_id, reason) VALUES ($1,'account_deleted')", [req.params.id])
  await new Promise(r => setTimeout(r, 700))
  await db.query('DELETE FROM profiles WHERE id = $1', [req.params.id])
  res.json({ success: true })
})

// ── TICKETS ROUTES ────────────────────────────────────────────────────────────
async function withProfiles(rows) {
  const { rows: allProfiles } = await getPool().query('SELECT id, full_name, email, role FROM profiles')
  const map = new Map(allProfiles.map(p => [p.id, p]))
  return rows.map(t => ({ ...t, created_by_profile: map.get(t.created_by) || null, assigned_to_profile: map.get(t.assigned_to) || null }))
}

app.get('/api/tickets', requireAuth, async (req, res) => {
  const q = isAdminRole(req.profile.role)
    ? await getPool().query("SELECT * FROM tickets WHERE is_request=false ORDER BY created_at DESC")
    : await getPool().query("SELECT * FROM tickets WHERE assigned_to=$1 AND is_request=false ORDER BY created_at DESC", [req.user.id])
  res.json(await withProfiles(q.rows))
})

app.get('/api/tickets/requests', requireAuth, async (req, res) => {
  const q = isAdminRole(req.profile.role)
    ? await getPool().query("SELECT * FROM tickets WHERE is_request=true ORDER BY created_at DESC")
    : await getPool().query("SELECT * FROM tickets WHERE created_by=$1 AND is_request=true ORDER BY created_at DESC", [req.user.id])
  res.json(await withProfiles(q.rows))
})

app.post('/api/tickets', requireAuth, async (req, res) => {
  const { title, description, affected_person, assigned_to, status, is_request } = req.body
  const now = new Date()
  const db = getPool()
  const { rows } = await db.query(
    `INSERT INTO tickets (title,description,affected_person,assigned_to,created_by,status,is_request,request_status,opened_at,pending_at,solved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [title, description||null, affected_person||null, assigned_to||null, req.user.id, status||'opened',
     is_request||false, is_request?'pending_review':null, now, status==='pending'?now:null, status==='solved'?now:null]
  )
  const ticket = rows[0]
  if (is_request) {
    const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    for (const admin of admins) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [admin.id, ticket.id, `📝 New ticket request: ${title}`])
    }
    sendPushToAdmins('📝 New Ticket Request', title, '/')
  } else {
    sendPushToAdmins('🎫 New Ticket', title, '/')
  }
  res.json(ticket)
})

app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  const { status, request_status, assigned_to, is_request, opened_at, review } = req.body
  const fields = [], values = []
  let idx = 1
  if (status !== undefined) {
    fields.push(`status=$${idx++}`); values.push(status)
    if (status === 'pending') { fields.push(`pending_at=$${idx++}`); values.push(new Date()) }
    if (status === 'solved')  { fields.push(`solved_at=$${idx++}`);  values.push(new Date()) }
  }
  if (request_status !== undefined) { fields.push(`request_status=$${idx++}`); values.push(request_status) }
  if (assigned_to     !== undefined) { fields.push(`assigned_to=$${idx++}`);    values.push(assigned_to) }
  if (is_request      !== undefined) { fields.push(`is_request=$${idx++}`);     values.push(is_request) }
  if (opened_at       !== undefined) { fields.push(`opened_at=$${idx++}`);      values.push(opened_at) }
  if (review          !== undefined) { fields.push(`review=$${idx++}`);         values.push(review) }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' })
  values.push(req.params.id)
  const { rows } = await getPool().query(`UPDATE tickets SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`, values)
  if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
  res.json(rows[0])
})

app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
  await getPool().query('DELETE FROM tickets WHERE id=$1', [req.params.id])
  res.json({ success: true })
})

app.post('/api/tickets/:id/accept', requireAuth, async (req, res) => {
  const { assigned_to } = req.body
  const db = getPool()
  const { rows } = await db.query(
    "UPDATE tickets SET request_status='accepted', assigned_to=$1, is_request=false, opened_at=$2 WHERE id=$3 RETURNING *",
    [assigned_to, new Date(), req.params.id]
  )
  const ticket = rows[0]
  if (ticket?.created_by) {
    await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
      [ticket.created_by, ticket.id, `✅ Your ticket request "${ticket.title}" has been accepted and assigned.`])
  }
  res.json(ticket)
})

app.post('/api/tickets/:id/refuse', requireAuth, async (req, res) => {
  const db = getPool()
  const { rows } = await db.query("UPDATE tickets SET request_status='refused' WHERE id=$1 RETURNING *", [req.params.id])
  const ticket = rows[0]
  if (ticket?.created_by) {
    await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
      [ticket.created_by, ticket.id, `❌ Your ticket request "${ticket.title}" has been refused by the admin.`])
  }
  res.json(ticket)
})

app.get('/api/tickets/:id/replies', requireAuth, async (req, res) => {
  const db = getPool()
  const { rows } = await db.query('SELECT * FROM ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC', [req.params.id])
  const { rows: allProfiles } = await db.query('SELECT id, full_name FROM profiles')
  const map = new Map(allProfiles.map(p => [p.id, p]))
  res.json(rows.map(r => ({ ...r, profiles: map.get(r.user_id) || null })))
})

app.post('/api/tickets/:id/replies', requireAuth, async (req, res) => {
  const { message, image_url } = req.body
  const db = getPool()
  const { rows } = await db.query(
    'INSERT INTO ticket_replies (ticket_id, user_id, message, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user.id, message||null, image_url||null]
  )
  const reply = rows[0]
  const { rows: tickets } = await db.query('SELECT * FROM tickets WHERE id=$1', [req.params.id])
  const ticket = tickets[0]
  if (ticket?.created_by && ticket.created_by !== req.user.id) {
    await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
      [ticket.created_by, ticket.id, `New reply on ticket: ${ticket.title}`])
  }
  res.json(reply)
})

// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
app.get('/api/attendance', requireAuth, async (req, res) => {
  const { profile } = req
  const allowed = profile.role === 'admin' || profile.role === 'super_admin' || profile.can_view_attendance
  if (!allowed) return res.status(403).json({ error: 'Not allowed to view attendance' })
  const targetDate = req.query.date || getLocalDateString()
  const db = getPool()
  const { rows } = await db.query('SELECT * FROM login_times WHERE date=$1', [targetDate])
  const { rows: allProfiles } = await db.query('SELECT id, full_name, email, role FROM profiles')
  const map = new Map(allProfiles.map(p => [p.id, p]))
  res.json(rows.map(r => ({ ...r, full_name: map.get(r.user_id)?.full_name||null, email: map.get(r.user_id)?.email||null, role: map.get(r.user_id)?.role||null })))
})

app.get('/api/attendance/today', requireAuth, async (req, res) => {
  const { rows } = await getPool().query('SELECT * FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, getLocalDateString()])
  res.json(rows[0] || null)
})

app.post('/api/attendance/login', requireAuth, async (req, res) => {
  const { latitude, longitude } = req.body
  const today = getLocalDateString()
  const db = getPool()
  const { rows: existing } = await db.query('SELECT id FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, today])
  if (existing.length) return res.status(400).json({ error: 'Already logged in today' })
  const { rows } = await db.query(
    'INSERT INTO login_times (user_id, date, latitude, longitude) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, today, latitude||null, longitude||null]
  )
  res.json(rows[0])
})

app.post('/api/attendance/logout', requireAuth, async (req, res) => {
  const { latitude, longitude } = req.body
  const today = getLocalDateString()
  const db = getPool()
  const { rows: existing } = await db.query('SELECT * FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, today])
  if (!existing[0]) return res.status(404).json({ error: 'No login record found for today' })
  if (existing[0].logout_time) return res.status(400).json({ error: 'Already signed off today' })
  const { rows } = await db.query(
    'UPDATE login_times SET logout_time=$1, logout_latitude=$2, logout_longitude=$3 WHERE user_id=$4 AND date=$5 RETURNING *',
    [new Date(), latitude||null, longitude||null, req.user.id, today]
  )
  res.json(rows[0])
})

app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
  if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  await getPool().query('DELETE FROM login_times WHERE id=$1', [req.params.id])
  res.json({ success: true })
})

// ── LEAVE ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/leaves', requireAuth, async (req, res) => {
  const db = getPool()
  const q = isAdminRole(req.profile.role)
    ? await db.query('SELECT * FROM leave_requests ORDER BY created_at DESC')
    : await db.query('SELECT * FROM leave_requests WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])
  const { rows: allProfiles } = await db.query('SELECT id, full_name, email, role FROM profiles')
  const map = new Map(allProfiles.map(p => [p.id, p]))
  res.json(q.rows.map(r => ({ ...r, user: map.get(r.user_id) || null })))
})

app.post('/api/leaves', requireAuth, async (req, res) => {
  const { start_date, end_date, reason } = req.body
  if (!start_date || !end_date) return res.status(400).json({ error: 'Dates required' })
  const db = getPool()
  const { rows } = await db.query(
    "INSERT INTO leave_requests (user_id, start_date, end_date, reason, status) VALUES ($1,$2,$3,$4,'pending') RETURNING *",
    [req.user.id, start_date, end_date, reason||null]
  )
  const senderName = req.profile.full_name || req.profile.email
  const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
  for (const admin of admins) {
    await db.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
      [admin.id, `🌴 New leave request from ${senderName} (${start_date} → ${end_date})`])
  }
  res.json(rows[0])
})

app.patch('/api/leaves/:id/approve', requireAuth, async (req, res) => {
  if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  const { rows } = await getPool().query(
    "UPDATE leave_requests SET status='approved', admin_note=null, decided_by=$1, decided_at=$2 WHERE id=$3 RETURNING *",
    [req.user.id, new Date(), req.params.id]
  )
  const leave = rows[0]
  if (leave) await getPool().query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
    [leave.user_id, `✅ Your leave request (${leave.start_date} → ${leave.end_date}) was approved`])
  res.json(leave)
})

app.patch('/api/leaves/:id/reject', requireAuth, async (req, res) => {
  if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  const { note } = req.body
  const { rows } = await getPool().query(
    "UPDATE leave_requests SET status='rejected', admin_note=$1, decided_by=$2, decided_at=$3 WHERE id=$4 RETURNING *",
    [note||null, req.user.id, new Date(), req.params.id]
  )
  const leave = rows[0]
  if (leave) await getPool().query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
    [leave.user_id, `❌ Your leave request (${leave.start_date} → ${leave.end_date}) was rejected${note ? ' — '+note : ''}`])
  res.json(leave)
})

app.delete('/api/leaves/:id', requireAuth, async (req, res) => {
  if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
  await getPool().query('DELETE FROM leave_requests WHERE id=$1', [req.params.id])
  res.json({ success: true })
})

// ── NOTIFICATIONS ROUTES ──────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { rows } = await getPool().query(
    'SELECT * FROM notifications WHERE user_id=$1 AND read=false ORDER BY created_at DESC',
    [req.user.id]
  )
  res.json(rows)
})

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  await getPool().query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id])
  res.json({ success: true })
})

// ── PUSH ROUTES ───────────────────────────────────────────────────────────────
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
})

app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' })
  await getPool().query(
    'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO NOTHING',
    [req.user.id, endpoint, keys.p256dh, keys.auth]
  )
  res.json({ success: true })
})

app.delete('/api/push/unsubscribe', requireAuth, async (req, res) => {
  if (req.body?.endpoint) await getPool().query('DELETE FROM push_subscriptions WHERE endpoint=$1', [req.body.endpoint])
  res.json({ success: true })
})

// ── UPLOAD ROUTE ──────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  res.json({ url })
})

export default app
