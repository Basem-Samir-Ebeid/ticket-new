// ─────────────────────────────────────────────────────────────────────────────
// VERCEL SERVERLESS ONLY — This file is NOT used in Replit.
// The Replit environment runs `server/index.ts` (TypeScript) via `npm run dev`.
// This file exists solely for Vercel deployment and should not be modified
// as part of normal development on Replit.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import webpush from 'web-push'
import multer from 'multer'
import { neon, neonConfig } from '@neondatabase/serverless'
import pg from 'pg'

// ── Neon serverless config (uses HTTP fetch — no TCP timeouts on Vercel) ──────
neonConfig.fetchConnectionCache = true

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── DB: try Neon serverless HTTP first, fall back to standard pg Pool ─────────
const NEON_URL = process.env.NEON_DATABASE_URL
const PG_URL   = process.env.DATABASE_URL

if (!NEON_URL && !PG_URL) {
  console.error('[DB] FATAL: Neither NEON_DATABASE_URL nor DATABASE_URL is set')
}

// Neon HTTP client (serverless-safe, works on Vercel with no TCP timeouts)
let _neonSql = null
function getNeonSql() {
  if (!_neonSql && NEON_URL) {
    _neonSql = neon(NEON_URL)
  }
  return _neonSql
}

// Fallback pg Pool for local dev (Replit) where Neon HTTP isn't needed
if (!global._pgPool) {
  const connStr = PG_URL || NEON_URL
  if (connStr) {
    const { Pool } = pg
    global._pgPool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('neon.tech') ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    global._pgPool.on('error', (err) => console.error('[DB] Pool error:', err.message))
  }
}

// ── Unified query helper ───────────────────────────────────────────────────────
// On Vercel (NEON_URL set, no PG_URL): uses Neon HTTP → no TCP timeout
// On Replit  (PG_URL set):             uses pg Pool   → normal local dev
async function query(text, params = []) {
  // Prefer pg Pool when available (local Replit dev)
  if (global._pgPool && PG_URL) {
    return global._pgPool.query(text, params)
  }
  // Neon HTTP for Vercel serverless
  const sql = getNeonSql()
  if (sql) {
    const rows = await sql(text, params)
    return { rows }
  }
  throw new Error('No database connection available')
}

// Keep getPool() for any legacy callers — wraps the unified query
function getPool() {
  return { query }
}

// ── SCHEMA INIT ───────────────────────────────────────────────────────────────
let schemaInitialized = false
async function ensureSchema() {
  if (schemaInitialized) return
  try {
    const db = getPool()
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        plain_password TEXT,
        full_name TEXT,
        profile_picture_url TEXT,
        role TEXT NOT NULL DEFAULT 'employee',
        can_view_attendance BOOLEAN NOT NULL DEFAULT false,
        must_change_password BOOLEAN NOT NULL DEFAULT true,
        leave_balance INTEGER NOT NULL DEFAULT 14,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_balance INTEGER NOT NULL DEFAULT 14;

      CREATE TABLE IF NOT EXISTS tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        affected_person TEXT,
        category TEXT,
        due_date DATE,
        assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'opened',
        priority TEXT NOT NULL DEFAULT 'medium',
        is_request BOOLEAN NOT NULL DEFAULT false,
        request_status TEXT DEFAULT 'pending_review',
        review TEXT,
        rating INTEGER,
        rating_comment TEXT,
        opened_at TIMESTAMPTZ,
        pending_at TIMESTAMPTZ,
        solved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_date DATE;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating INTEGER;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating_comment TEXT;

      CREATE TABLE IF NOT EXISTS ticket_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        changed_by_name TEXT,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ticket_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ticket_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        message TEXT,
        image_url TEXT,
        attachment_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS attachment_name TEXT;

      CREATE TABLE IF NOT EXISTS login_times (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        logout_time TIMESTAMPTZ,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        logout_latitude DOUBLE PRECISION,
        logout_longitude DOUBLE PRECISION
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        leave_type TEXT NOT NULL DEFAULT 'annual',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        decided_by UUID REFERENCES profiles(id),
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type TEXT NOT NULL DEFAULT 'annual';

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session_revocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS office_settings (
        id TEXT PRIMARY KEY,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius_meters DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        changed_by_name TEXT,
        from_lat DOUBLE PRECISION,
        from_lng DOUBLE PRECISION,
        from_radius DOUBLE PRECISION,
        to_lat DOUBLE PRECISION NOT NULL,
        to_lng DOUBLE PRECISION NOT NULL,
        to_radius DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO office_settings (id, latitude, longitude, radius_meters)
      VALUES ('main', 30.0803897, 31.3524335, 20)
      ON CONFLICT (id) DO NOTHING;
    `)
    schemaInitialized = true
    console.log('[schema] Schema ready')
  } catch (err) {
    console.error('[schema] Schema init failed:', err.message)
  }
}

// ── SEED SUPER ADMINS ─────────────────────────────────────────────────────────
async function seedAdmins() {
  try {
    const db = getPool()
    const superAdmins = [
      {
        email: 'basem.samir@finest-his.com',
        password: process.env.SEED_ADMIN1_PASSWORD || 'Basem.s.ebeid#@55!',
        full_name: 'Basem Samir',
      },
      {
        email: 'admin@system.com',
        password: process.env.SEED_ADMIN2_PASSWORD || 'Admin@System#2024',
        full_name: 'System Admin',
      },
    ]
    for (const admin of superAdmins) {
      const { rows } = await db.query('SELECT id FROM profiles WHERE email = $1', [admin.email])
      if (rows.length === 0) {
        const password_hash = await bcrypt.hash(admin.password, 10)
        await db.query(
          `INSERT INTO profiles (email, password_hash, plain_password, full_name, role, must_change_password)
           VALUES ($1, $2, $3, $4, 'super_admin', false)`,
          [admin.email, password_hash, admin.password, admin.full_name]
        )
        console.log(`[seed] Created super admin: ${admin.email}`)
      } else {
        console.log(`[seed] Super admin already exists: ${admin.email}`)
      }
    }
  } catch (err) {
    console.error('[seed] Failed to seed admins:', err.message)
  }
}

async function initDb() {
  await ensureSchema()
  await seedAdmins()
}

initDb().catch(err => console.error('[init] Failed:', err))

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'it-ticket-secret-key-2024'

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' })
  try {
    const decoded = verifyToken(auth.replace('Bearer ', ''))
    const { userId, iat } = decoded

    const { rows: revocations } = await getPool().query(
      'SELECT created_at FROM session_revocations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    )
    if (revocations.length > 0) {
      const revokedAt = new Date(revocations[0].created_at).getTime() / 1000
      if (iat <= revokedAt) return res.status(401).json({ error: 'Session revoked' })
    }

    const { rows } = await getPool().query('SELECT * FROM profiles WHERE id = $1', [userId])
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    req.user = { id: userId }
    req.profile = rows[0]
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
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

// ── GEOFENCE HELPER ───────────────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getOfficeConfig() {
  try {
    const { rows } = await getPool().query(
      'SELECT latitude, longitude, radius_meters FROM office_settings WHERE id = $1',
      ['main']
    )
    if (rows[0]) return rows[0]
  } catch {}
  return { latitude: 30.0803897, longitude: 31.3524335, radius_meters: 20 }
}

// ── PUSH HELPER ───────────────────────────────────────────────────────────────
let vapidInitialized = false
function initVapid() {
  if (vapidInitialized) return true
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@ticketsystem.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    vapidInitialized = true
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
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    const { rows } = await getPool().query('SELECT * FROM profiles WHERE email = $1', [email.toLowerCase()])
    const profile = rows[0]
    if (!profile) return res.status(401).json({ error: 'Invalid email or password' })
    const valid = await bcrypt.compare(password, profile.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })
    const { password_hash, ...safeProfile } = profile
    res.json({ token: signToken(profile.id), user: safeProfile })
  } catch (err) {
    console.error('[login] Error:', err.message)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const { password_hash, ...safeProfile } = req.profile
    res.json(safeProfile)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Passwords required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (!await bcrypt.compare(currentPassword, req.profile.password_hash)) return res.status(401).json({ error: 'Current password incorrect' })
    const password_hash = await bcrypt.hash(newPassword, 10)
    await getPool().query(
      'UPDATE profiles SET password_hash=$1, must_change_password=false, plain_password=$2 WHERE id=$3',
      [password_hash, newPassword, req.user.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('[change-password] Error:', err.message)
    res.status(500).json({ error: 'Failed to change password' })
  }
})

app.post('/api/auth/force-change-password', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  try {
    const { newPassword } = req.body
    if (!newPassword) return res.status(400).json({ error: 'يجب إدخال كلمة المرور الجديدة.' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' })
    const password_hash = await bcrypt.hash(newPassword, 10)
    await getPool().query(
      'UPDATE profiles SET password_hash=$1, must_change_password=false, plain_password=$2 WHERE id=$3',
      [password_hash, newPassword, req.user.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('[force-change-password] Error:', err.message)
    res.status(500).json({ error: 'فشل تغيير كلمة المرور، يرجى المحاولة مرة أخرى.' })
  }
})

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    const { rows } = await getPool().query('SELECT id, full_name, email FROM profiles WHERE email = $1', [email.toLowerCase()])
    res.json({ success: true }) // always succeed to prevent enumeration
    const profile = rows[0]
    if (!profile) return
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await getPool().query('DELETE FROM password_reset_tokens WHERE user_id = $1', [profile.id])
    await getPool().query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [profile.id, token, expiresAt]
    )
  } catch (err) {
    console.error('[forgot-password] Error:', err.message)
    res.status(500).json({ error: 'Failed' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const { rows } = await getPool().query(
      'SELECT * FROM password_reset_tokens WHERE token=$1 AND used=false AND expires_at > NOW()',
      [token]
    )
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })
    const password_hash = await bcrypt.hash(newPassword, 10)
    await getPool().query(
      'UPDATE profiles SET password_hash=$1, plain_password=$2, must_change_password=false WHERE id=$3',
      [password_hash, newPassword, rows[0].user_id]
    )
    await getPool().query('UPDATE password_reset_tokens SET used=true WHERE id=$1', [rows[0].id])
    res.json({ success: true })
  } catch (err) {
    console.error('[reset-password] Error:', err.message)
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

app.get('/api/auth/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.json({ valid: false })
    const { rows } = await getPool().query(
      'SELECT id FROM password_reset_tokens WHERE token=$1 AND used=false AND expires_at > NOW()',
      [token]
    )
    res.json({ valid: rows.length > 0 })
  } catch {
    res.json({ valid: false })
  }
})

// ── USERS ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const isSuperAdmin = req.profile?.role === 'super_admin'
    const cols = isSuperAdmin
      ? 'id, email, full_name, role, can_view_attendance, profile_picture_url, must_change_password, leave_balance, plain_password, created_at'
      : 'id, email, full_name, role, can_view_attendance, profile_picture_url, must_change_password, leave_balance, created_at'
    const { rows } = await getPool().query(`SELECT ${cols} FROM profiles ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) {
    console.error('[GET /users] Error:', err.message)
    res.status(500).json({ error: 'Failed to get users' })
  }
})

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role, can_view_attendance, profile_picture_url } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const db = getPool()
    const { rows: existing } = await db.query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()])
    if (existing.length) return res.status(400).json({ error: 'Email already in use' })
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      `INSERT INTO profiles (email, password_hash, plain_password, full_name, role, can_view_attendance, profile_picture_url, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, must_change_password, leave_balance, created_at`,
      [email.toLowerCase(), password_hash, password, full_name || null, role || 'employee', can_view_attendance || false, profile_picture_url || null]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[POST /users] Error:', err.message)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { full_name, role, can_view_attendance, profile_picture_url, leave_balance } = req.body
    const fields = [], values = []
    let idx = 1
    if (full_name !== undefined) { fields.push(`full_name=$${idx++}`); values.push(full_name) }
    if (role !== undefined) { fields.push(`role=$${idx++}`); values.push(role) }
    if (can_view_attendance !== undefined) { fields.push(`can_view_attendance=$${idx++}`); values.push(can_view_attendance) }
    if (profile_picture_url !== undefined) { fields.push(`profile_picture_url=$${idx++}`); values.push(profile_picture_url) }
    if (leave_balance !== undefined) { fields.push(`leave_balance=$${idx++}`); values.push(leave_balance) }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    const { rows } = await getPool().query(
      `UPDATE profiles SET ${fields.join(',')} WHERE id=$${idx} RETURNING id, email, full_name, role, can_view_attendance, profile_picture_url, must_change_password, leave_balance, created_at`,
      values
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[PATCH /users/:id] Error:', err.message)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

app.post('/api/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const password_hash = await bcrypt.hash(newPassword, 10)
    const { rows } = await getPool().query(
      'UPDATE profiles SET password_hash=$1, plain_password=$2, must_change_password=true WHERE id=$3 RETURNING id',
      [password_hash, newPassword, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true })
  } catch (err) {
    console.error('[reset-password] Error:', err.message)
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

app.post('/api/users/:id/force-change-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      'UPDATE profiles SET must_change_password=true WHERE id=$1 RETURNING id',
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})

app.post('/api/users/:id/revoke-session', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body
    await getPool().query('INSERT INTO session_revocations (user_id, reason) VALUES ($1,$2)', [req.params.id, reason || null])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' })
  }
})

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = getPool()
    await db.query("INSERT INTO session_revocations (user_id, reason) VALUES ($1,'account_deleted')", [req.params.id])
    await new Promise(r => setTimeout(r, 300))
    await db.query('DELETE FROM profiles WHERE id = $1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /users/:id] Error:', err.message)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// ── TICKETS ROUTES ────────────────────────────────────────────────────────────
async function withProfiles(rows) {
  const { rows: allProfiles } = await getPool().query('SELECT id, full_name, email, role FROM profiles')
  const map = new Map(allProfiles.map(p => [p.id, p]))
  return rows.map(t => ({
    ...t,
    created_by_profile: map.get(t.created_by) || null,
    assigned_to_profile: map.get(t.assigned_to) || null,
  }))
}

app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const q = isAdminRole(req.profile.role)
      ? await getPool().query("SELECT * FROM tickets WHERE is_request=false ORDER BY created_at DESC")
      : await getPool().query("SELECT * FROM tickets WHERE assigned_to=$1 AND is_request=false ORDER BY created_at DESC", [req.user.id])
    res.json(await withProfiles(q.rows))
  } catch (err) {
    console.error('[GET /tickets] Error:', err.message)
    res.status(500).json({ error: 'Failed to get tickets' })
  }
})

app.get('/api/tickets/requests', requireAuth, async (req, res) => {
  try {
    const q = isAdminRole(req.profile.role)
      ? await getPool().query("SELECT * FROM tickets WHERE is_request=true ORDER BY created_at DESC")
      : await getPool().query("SELECT * FROM tickets WHERE created_by=$1 AND is_request=true ORDER BY created_at DESC", [req.user.id])
    res.json(await withProfiles(q.rows))
  } catch (err) {
    res.status(500).json({ error: 'Failed to get requests' })
  }
})

app.get('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT * FROM tickets WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
    const [ticket] = await withProfiles(rows)
    res.json(ticket)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get ticket' })
  }
})

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { title, description, affected_person, category, due_date, assigned_to, status, priority, is_request } = req.body
    const now = new Date()
    const db = getPool()
    const { rows } = await db.query(
      `INSERT INTO tickets (title,description,affected_person,category,due_date,assigned_to,created_by,status,priority,is_request,request_status,opened_at,pending_at,solved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [title, description || null, affected_person || null, category || null, due_date || null,
       assigned_to || null, req.user.id, status || 'opened', priority || 'medium',
       is_request || false, is_request ? 'pending_review' : null,
       now, status === 'pending' ? now : null, status === 'solved' ? now : null]
    )
    const ticket = rows[0]
    if (is_request) {
      const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
      for (const admin of admins) {
        await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
          [admin.id, ticket.id, `📝 New ticket request: ${title}`])
      }
      sendPushToAdmins('📝 New Ticket Request', title, '/').catch(() => {})
    } else {
      sendPushToAdmins('🎫 New Ticket', title, '/').catch(() => {})
    }
    res.json(ticket)
  } catch (err) {
    console.error('[POST /tickets] Error:', err.message)
    res.status(500).json({ error: 'Failed to create ticket' })
  }
})

app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { status, request_status, assigned_to, is_request, opened_at, review, priority, category, due_date, rating, rating_comment } = req.body
    const fields = [], values = []
    let idx = 1
    if (status !== undefined) {
      fields.push(`status=$${idx++}`); values.push(status)
      if (status === 'pending') { fields.push(`pending_at=$${idx++}`); values.push(new Date()) }
      if (status === 'solved') { fields.push(`solved_at=$${idx++}`); values.push(new Date()) }
    }
    if (request_status !== undefined) { fields.push(`request_status=$${idx++}`); values.push(request_status) }
    if (assigned_to !== undefined) { fields.push(`assigned_to=$${idx++}`); values.push(assigned_to) }
    if (is_request !== undefined) { fields.push(`is_request=$${idx++}`); values.push(is_request) }
    if (opened_at !== undefined) { fields.push(`opened_at=$${idx++}`); values.push(opened_at) }
    if (review !== undefined) { fields.push(`review=$${idx++}`); values.push(review) }
    if (priority !== undefined) { fields.push(`priority=$${idx++}`); values.push(priority) }
    if (category !== undefined) { fields.push(`category=$${idx++}`); values.push(category) }
    if (due_date !== undefined) { fields.push(`due_date=$${idx++}`); values.push(due_date) }
    if (rating !== undefined) { fields.push(`rating=$${idx++}`); values.push(rating) }
    if (rating_comment !== undefined) { fields.push(`rating_comment=$${idx++}`); values.push(rating_comment) }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    const { rows } = await getPool().query(`UPDATE tickets SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`, values)
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[PATCH /tickets/:id] Error:', err.message)
    res.status(500).json({ error: 'Failed to update ticket' })
  }
})

app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    await getPool().query('DELETE FROM tickets WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ticket' })
  }
})

app.post('/api/tickets/:id/accept', requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept ticket' })
  }
})

app.post('/api/tickets/:id/refuse', requireAuth, async (req, res) => {
  try {
    const db = getPool()
    const { rows } = await db.query("UPDATE tickets SET request_status='refused' WHERE id=$1 RETURNING *", [req.params.id])
    const ticket = rows[0]
    if (ticket?.created_by) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [ticket.created_by, ticket.id, `❌ Your ticket request "${ticket.title}" has been refused by the admin.`])
    }
    res.json(ticket)
  } catch (err) {
    res.status(500).json({ error: 'Failed to refuse ticket' })
  }
})

app.get('/api/tickets/:id/replies', requireAuth, async (req, res) => {
  try {
    const db = getPool()
    const { rows } = await db.query('SELECT * FROM ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC', [req.params.id])
    const { rows: allProfiles } = await db.query('SELECT id, full_name FROM profiles')
    const map = new Map(allProfiles.map(p => [p.id, p]))
    res.json(rows.map(r => ({ ...r, profiles: map.get(r.user_id) || null })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to get replies' })
  }
})

app.post('/api/tickets/:id/replies', requireAuth, async (req, res) => {
  try {
    const { message, image_url, attachment_name } = req.body
    const db = getPool()
    const { rows } = await db.query(
      'INSERT INTO ticket_replies (ticket_id, user_id, message, image_url, attachment_name) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, req.user.id, message || null, image_url || null, attachment_name || null]
    )
    const reply = rows[0]
    const { rows: tickets } = await db.query('SELECT * FROM tickets WHERE id=$1', [req.params.id])
    const ticket = tickets[0]
    if (ticket?.created_by && ticket.created_by !== req.user.id) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [ticket.created_by, ticket.id, `New reply on ticket: ${ticket.title}`])
    }
    if (ticket?.assigned_to && ticket.assigned_to !== req.user.id) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [ticket.assigned_to, ticket.id, `New reply on ticket: ${ticket.title}`])
    }
    res.json(reply)
  } catch (err) {
    res.status(500).json({ error: 'Failed to post reply' })
  }
})

app.get('/api/tickets/:id/history', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      'SELECT * FROM ticket_history WHERE ticket_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get history' })
  }
})

// ── TICKET TEMPLATES ──────────────────────────────────────────────────────────
app.get('/api/tickets/templates', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT * FROM ticket_templates ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get templates' })
  }
})

app.post('/api/tickets/templates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, title, description, priority } = req.body
    if (!name || !title) return res.status(400).json({ error: 'Name and title required' })
    const { rows } = await getPool().query(
      'INSERT INTO ticket_templates (name, title, description, priority, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, title, description || null, priority || 'medium', req.user.id]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' })
  }
})

app.delete('/api/tickets/templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getPool().query('DELETE FROM ticket_templates WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
app.get('/api/attendance', requireAuth, async (req, res) => {
  try {
    const { profile } = req
    const allowed = profile.role === 'admin' || profile.role === 'super_admin' || profile.can_view_attendance
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view attendance' })
    const targetDate = req.query.date || getLocalDateString()
    const db = getPool()
    const { rows } = await db.query('SELECT * FROM login_times WHERE date=$1', [targetDate])
    const { rows: allProfiles } = await db.query('SELECT id, full_name, email, role FROM profiles')
    const map = new Map(allProfiles.map(p => [p.id, p]))
    res.json(rows.map(r => ({
      ...r,
      full_name: map.get(r.user_id)?.full_name || null,
      email: map.get(r.user_id)?.email || null,
      role: map.get(r.user_id)?.role || null,
    })))
  } catch (err) {
    console.error('[GET /attendance] Error:', err.message)
    res.status(500).json({ error: 'Failed to get attendance' })
  }
})

app.get('/api/attendance/today', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT * FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, getLocalDateString()])
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get attendance' })
  }
})

app.post('/api/attendance/login', requireAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body
    if (latitude == null || longitude == null) return res.status(400).json({ error: 'Location is required to check in' })
    const office = await getOfficeConfig()
    const distance = haversineDistance(Number(latitude), Number(longitude), office.latitude, office.longitude)
    if (distance > office.radius_meters) {
      return res.status(403).json({ error: `أنت بعيد جداً عن المكتب (${Math.round(distance)}م، الحد الأقصى المسموح: ${office.radius_meters}م)` })
    }
    const today = getLocalDateString()
    const db = getPool()
    const { rows: existing } = await db.query('SELECT id FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, today])
    if (existing.length) return res.status(400).json({ error: 'Already logged in today' })
    const { rows } = await db.query(
      'INSERT INTO login_times (user_id, date, latitude, longitude) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, today, latitude, longitude]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[attendance/login] Error:', err.message)
    res.status(500).json({ error: 'Failed to check in' })
  }
})

app.post('/api/attendance/logout', requireAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body
    if (latitude == null || longitude == null) return res.status(400).json({ error: 'Location is required to check out' })
    const office = await getOfficeConfig()
    const distance = haversineDistance(Number(latitude), Number(longitude), office.latitude, office.longitude)
    if (distance > office.radius_meters) {
      return res.status(403).json({ error: `أنت بعيد جداً عن المكتب (${Math.round(distance)}م، الحد الأقصى المسموح: ${office.radius_meters}م)` })
    }
    const today = getLocalDateString()
    const db = getPool()
    const { rows: existing } = await db.query('SELECT * FROM login_times WHERE user_id=$1 AND date=$2', [req.user.id, today])
    if (!existing[0]) return res.status(404).json({ error: 'No login record found for today' })
    if (existing[0].logout_time) return res.status(400).json({ error: 'Already signed off today' })
    const { rows } = await db.query(
      'UPDATE login_times SET logout_time=$1, logout_latitude=$2, logout_longitude=$3 WHERE user_id=$4 AND date=$5 RETURNING *',
      [new Date(), latitude, longitude, req.user.id, today]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[attendance/logout] Error:', err.message)
    res.status(500).json({ error: 'Failed to check out' })
  }
})

app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await getPool().query('DELETE FROM login_times WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete attendance' })
  }
})

// ── LEAVE ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/leaves', requireAuth, async (req, res) => {
  try {
    const db = getPool()
    const q = isAdminRole(req.profile.role)
      ? await db.query('SELECT * FROM leave_requests ORDER BY created_at DESC')
      : await db.query('SELECT * FROM leave_requests WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])
    const { rows: allProfiles } = await db.query('SELECT id, full_name, email, role FROM profiles')
    const map = new Map(allProfiles.map(p => [p.id, p]))
    res.json(q.rows.map(r => ({ ...r, user: map.get(r.user_id) || null })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to get leave requests' })
  }
})

app.post('/api/leaves', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, reason, leave_type } = req.body
    if (!start_date || !end_date) return res.status(400).json({ error: 'Dates required' })
    const db = getPool()
    const { rows } = await db.query(
      "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *",
      [req.user.id, leave_type || 'annual', start_date, end_date, reason || null]
    )
    const senderName = req.profile.full_name || req.profile.email
    const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    for (const admin of admins) {
      await db.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
        [admin.id, `🌴 New leave request from ${senderName} (${start_date} → ${end_date})`])
    }
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit leave request' })
  }
})

app.patch('/api/leaves/:id/approve', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query(
      "UPDATE leave_requests SET status='approved', admin_note=null, decided_by=$1, decided_at=$2 WHERE id=$3 RETURNING *",
      [req.user.id, new Date(), req.params.id]
    )
    const leave = rows[0]
    if (leave) await getPool().query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
      [leave.user_id, `✅ Your leave request (${leave.start_date} → ${leave.end_date}) was approved`])
    res.json(leave)
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve leave' })
  }
})

app.patch('/api/leaves/:id/reject', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { note } = req.body
    const { rows } = await getPool().query(
      "UPDATE leave_requests SET status='rejected', admin_note=$1, decided_by=$2, decided_at=$3 WHERE id=$4 RETURNING *",
      [note || null, req.user.id, new Date(), req.params.id]
    )
    const leave = rows[0]
    if (leave) await getPool().query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
      [leave.user_id, `❌ Your leave request (${leave.start_date} → ${leave.end_date}) was rejected${note ? ' — ' + note : ''}`])
    res.json(leave)
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject leave' })
  }
})

app.delete('/api/leaves/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await getPool().query('DELETE FROM leave_requests WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete leave request' })
  }
})

// ── NOTIFICATIONS ROUTES ──────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      'SELECT * FROM notifications WHERE user_id=$1 AND read=false ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get notifications' })
  }
})

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await getPool().query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

app.patch('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
  try {
    await getPool().query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

app.patch('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await getPool().query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

// ── PUSH ROUTES ───────────────────────────────────────────────────────────────
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
})

app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' })
    await getPool().query(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO NOTHING',
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

app.delete('/api/push/unsubscribe', requireAuth, async (req, res) => {
  try {
    if (req.body?.endpoint) await getPool().query('DELETE FROM push_subscriptions WHERE endpoint=$1', [req.body.endpoint])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

// ── UPLOAD ROUTE ──────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    res.json({ url })
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' })
  }
})

// ── SETTINGS ROUTES ───────────────────────────────────────────────────────────
app.get('/api/settings/office-location', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    res.json(await getOfficeConfig())
  } catch (err) {
    res.status(500).json({ error: 'Failed to load office location' })
  }
})

app.post('/api/settings/office-location', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { latitude, longitude, radius_meters } = req.body
    if (latitude == null || longitude == null || radius_meters == null) {
      return res.status(400).json({ error: 'latitude, longitude, and radius_meters are required' })
    }
    const lat = Number(latitude)
    const lng = Number(longitude)
    const radius = Number(radius_meters)
    if (isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
      return res.status(400).json({ error: 'Invalid values: radius must be a positive number' })
    }
    const prev = await getOfficeConfig()
    const changedByName = req.profile.full_name || req.profile.email
    const db = getPool()
    await db.query(
      `INSERT INTO office_settings (id, latitude, longitude, radius_meters, updated_at)
       VALUES ('main', $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET latitude=$1, longitude=$2, radius_meters=$3, updated_at=NOW()`,
      [lat, lng, radius]
    )
    await db.query(
      `INSERT INTO settings_log (changed_by, changed_by_name, from_lat, from_lng, from_radius, to_lat, to_lng, to_radius)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.user.id, changedByName, prev.latitude, prev.longitude, prev.radius_meters, lat, lng, radius]
    )
    res.json({ latitude: lat, longitude: lng, radius_meters: radius })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save office location' })
  }
})

app.get('/api/settings/log', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM settings_log ORDER BY created_at DESC LIMIT 50')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings log' })
  }
})

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message })
  }
})

export default app
