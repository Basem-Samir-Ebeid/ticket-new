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
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sick_leave_balance INTEGER NOT NULL DEFAULT 7;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_leave_balance INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_start_hour INTEGER NOT NULL DEFAULT 9;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_code TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS direct_manager TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_apikey TEXT;

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

      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        serial_number TEXT UNIQUE,
        brand TEXT,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        condition TEXT NOT NULL DEFAULT 'good',
        purchase_date DATE,
        warranty_expires DATE,
        purchase_price DOUBLE PRECISION,
        location TEXT,
        notes TEXT,
        image_url TEXT,
        assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS asset_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        changed_by_name TEXT,
        action TEXT NOT NULL,
        description TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS penalties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'warning',
        reason TEXT NOT NULL,
        amount DOUBLE PRECISION,
        notes TEXT,
        issued_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS complaints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        complainant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        against_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        is_anonymous BOOLEAN NOT NULL DEFAULT false,
        admin_response TEXT,
        resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS auto_assign_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category TEXT NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        user_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance_corrections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        requested_login TEXT,
        requested_logout TEXT,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS days_count INTEGER NOT NULL DEFAULT 1;

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
    const { rows } = await getPool().query('SELECT * FROM profiles ORDER BY created_at DESC')
    const users = rows.map(u => {
      const { password_hash, ...rest } = u
      if (!isSuperAdmin) {
        const { plain_password, ...noPass } = rest
        return noPass
      }
      return rest
    })
    res.json(users)
  } catch (err) {
    console.error('[GET /users] Error:', err.message)
    res.status(500).json({ error: 'Failed to get users' })
  }
})

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      email, password, full_name, role, can_view_attendance, profile_picture_url,
      department, job_title, phone, national_id, hire_date, birth_date,
      gender, address, employment_type, employee_code, direct_manager, notes, whatsapp_phone,
    } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const db = getPool()
    const { rows: existing } = await db.query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()])
    if (existing.length) return res.status(400).json({ error: 'Email already in use' })
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      `INSERT INTO profiles (
        email, password_hash, plain_password, full_name, role, can_view_attendance, profile_picture_url,
        must_change_password, department, job_title, phone, national_id, hire_date, birth_date,
        gender, address, employment_type, employee_code, direct_manager, notes, whatsapp_phone
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        email.toLowerCase(), password_hash, password, full_name || null, role || 'employee',
        can_view_attendance || false, profile_picture_url || null,
        department || null, job_title || null, phone || null, national_id || null,
        hire_date || null, birth_date || null, gender || null, address || null,
        employment_type || 'full_time', employee_code || null, direct_manager || null,
        notes || null, whatsapp_phone || null,
      ]
    )
    const { password_hash: _ph, ...safeUser } = rows[0]
    res.json(safeUser)
  } catch (err) {
    console.error('[POST /users] Error:', err.message)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      full_name, role, can_view_attendance, profile_picture_url, leave_balance,
      sick_leave_balance, emergency_leave_balance, work_start_hour, department,
      job_title, phone, national_id, hire_date, birth_date, gender, address,
      employment_type, employee_code, direct_manager, notes, whatsapp_phone,
    } = req.body
    const fields = [], values = []
    let idx = 1
    if (full_name !== undefined) { fields.push(`full_name=$${idx++}`); values.push(full_name) }
    if (role !== undefined) { fields.push(`role=$${idx++}`); values.push(role) }
    if (can_view_attendance !== undefined) { fields.push(`can_view_attendance=$${idx++}`); values.push(can_view_attendance) }
    if (profile_picture_url !== undefined) { fields.push(`profile_picture_url=$${idx++}`); values.push(profile_picture_url) }
    if (leave_balance !== undefined) { fields.push(`leave_balance=$${idx++}`); values.push(leave_balance) }
    if (sick_leave_balance !== undefined) { fields.push(`sick_leave_balance=$${idx++}`); values.push(sick_leave_balance) }
    if (emergency_leave_balance !== undefined) { fields.push(`emergency_leave_balance=$${idx++}`); values.push(emergency_leave_balance) }
    if (work_start_hour !== undefined) { fields.push(`work_start_hour=$${idx++}`); values.push(work_start_hour) }
    if (department !== undefined) { fields.push(`department=$${idx++}`); values.push(department) }
    if (job_title !== undefined) { fields.push(`job_title=$${idx++}`); values.push(job_title) }
    if (phone !== undefined) { fields.push(`phone=$${idx++}`); values.push(phone) }
    if (national_id !== undefined) { fields.push(`national_id=$${idx++}`); values.push(national_id) }
    if (hire_date !== undefined) { fields.push(`hire_date=$${idx++}`); values.push(hire_date) }
    if (birth_date !== undefined) { fields.push(`birth_date=$${idx++}`); values.push(birth_date) }
    if (gender !== undefined) { fields.push(`gender=$${idx++}`); values.push(gender) }
    if (address !== undefined) { fields.push(`address=$${idx++}`); values.push(address) }
    if (employment_type !== undefined) { fields.push(`employment_type=$${idx++}`); values.push(employment_type) }
    if (employee_code !== undefined) { fields.push(`employee_code=$${idx++}`); values.push(employee_code) }
    if (direct_manager !== undefined) { fields.push(`direct_manager=$${idx++}`); values.push(direct_manager) }
    if (notes !== undefined) { fields.push(`notes=$${idx++}`); values.push(notes) }
    if (whatsapp_phone !== undefined) { fields.push(`whatsapp_phone=$${idx++}`); values.push(whatsapp_phone) }
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
      : await getPool().query("SELECT * FROM tickets WHERE (assigned_to=$1 OR created_by=$1) AND is_request=false ORDER BY created_at DESC", [req.user.id])
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
    const creatorName = req.profile.full_name || req.profile.email
    if (is_request) {
      const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
      for (const admin of admins) {
        await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
          [admin.id, ticket.id, `📝 New ticket request: ${title}`])
      }
      sendPushToAdmins('📝 New Ticket Request', title, '/').catch(() => {})
      sendWhatsAppToAdmins(`📝 طلب تيكت جديد من ${creatorName}: "${title}"`).catch(() => {})
    } else {
      sendPushToAdmins('🎫 New Ticket', title, '/').catch(() => {})
      sendWhatsAppToAdmins(`🎫 تيكت جديد من ${creatorName}: "${title}"`).catch(() => {})
    }

    // Notify assigned user
    if (assigned_to) {
      const priorityLabel = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' }
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [assigned_to, ticket.id, `🎫 تم تعيين تذكرة لك: "${title}"`])
      sendWhatsAppToUserId(assigned_to, `🎫 تم تعيين تذكرة لك\nالعنوان: "${title}"\nالأولوية: ${priorityLabel[priority] || priority}\nبواسطة: ${creatorName}`).catch(() => {})
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
    if (status !== undefined && rows[0]) {
      const ticket = rows[0]
      const statusLabel = status === 'solved' ? '✅ تم الحل' : status === 'pending' ? '🟡 معلق' : '🔵 مفتوح'
      if (ticket.created_by && ticket.created_by !== req.user.id)
        sendWhatsAppToUserId(ticket.created_by, `${statusLabel}\nالتيكت: "${ticket.title}"`).catch(() => {})
      if (ticket.assigned_to && ticket.assigned_to !== req.user.id)
        sendWhatsAppToUserId(ticket.assigned_to, `${statusLabel}\nالتيكت: "${ticket.title}"`).catch(() => {})
    }
    if (assigned_to !== undefined && assigned_to && assigned_to !== req.user.id)
      sendWhatsAppToUserId(assigned_to, `🎫 تم تعيين تذكرة لك\nالعنوان: "${rows[0].title}"`).catch(() => {})
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
      sendWhatsAppToUserId(ticket.created_by, `✅ تم قبول طلبك\nالتيكت: "${ticket.title}"`).catch(() => {})
    }
    if (assigned_to && assigned_to !== ticket.created_by) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [assigned_to, ticket.id, `🎫 تم تعيين تذكرة لك: "${ticket.title}"`])
      sendWhatsAppToUserId(assigned_to, `🎫 تم تعيين تذكرة لك\nالعنوان: "${ticket.title}"`).catch(() => {})
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
      sendWhatsAppToUserId(ticket.created_by, `❌ تم رفض طلبك\nالتيكت: "${ticket.title}"`).catch(() => {})
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
      sendWhatsAppToUserId(ticket.created_by, `💬 رد جديد على تيكتك: "${ticket.title}"`).catch(() => {})
    }
    if (ticket?.assigned_to && ticket.assigned_to !== req.user.id) {
      await db.query('INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1,$2,$3)',
        [ticket.assigned_to, ticket.id, `New reply on ticket: ${ticket.title}`])
      sendWhatsAppToUserId(ticket.assigned_to, `💬 رد جديد على التيكت: "${ticket.title}"`).catch(() => {})
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
    const ltype = leave_type || 'annual'

    function calcWorkingDays(s, e) {
      let count = 0
      const cur = new Date(s), end = new Date(e)
      while (cur <= end) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1) }
      return Math.max(1, count)
    }
    const days = calcWorkingDays(start_date, end_date)

    const { rows: profRows } = await db.query('SELECT leave_balance, sick_leave_balance, emergency_leave_balance FROM profiles WHERE id=$1', [req.user.id])
    const prof = profRows[0] || {}
    const balanceMap = { annual: prof.leave_balance || 0, sick: prof.sick_leave_balance || 0, emergency: prof.emergency_leave_balance || 0, unpaid: 999 }

    const { rows: pendingLeaves } = await db.query("SELECT days_count FROM leave_requests WHERE user_id=$1 AND leave_type=$2 AND status='pending'", [req.user.id, ltype])
    const pendingDays = pendingLeaves.reduce((s, l) => s + (l.days_count || 1), 0)
    const available = (balanceMap[ltype] ?? 0) - pendingDays

    if (ltype !== 'unpaid' && days > available) {
      return res.status(400).json({ error: `رصيد الإجازة غير كافٍ. المتاح: ${available} يوم، المطلوب: ${days} يوم.` })
    }

    const { rows: conflicting } = await db.query(
      "SELECT id FROM leave_requests WHERE user_id=$1 AND status='approved' AND start_date<=$2 AND end_date>=$3",
      [req.user.id, end_date, start_date]
    )

    const { rows } = await db.query(
      "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, days_count, status) VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *",
      [req.user.id, ltype, start_date, end_date, reason || null, days]
    )
    const senderName = req.profile.full_name || req.profile.email
    const { rows: admins } = await db.query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    const typeLabel = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }
    const conflictNote = conflicting.length > 0 ? ` ⚠️ تعارض مع ${conflicting.length} إجازة أخرى!` : ''
    for (const admin of admins) {
      await db.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
        [admin.id, `🌴 طلب إجازة ${typeLabel[ltype] || ltype} من ${senderName} (${start_date} → ${end_date} | ${days} أيام)${conflictNote}`])
    }
    sendWhatsAppToAdmins(`🌴 طلب إجازة ${typeLabel[ltype] || ltype} من ${senderName} (${start_date} → ${end_date} | ${days} أيام)${conflictNote}`).catch(() => {})
    res.json({ ...rows[0], conflict_count: conflicting.length })
  } catch (err) {
    console.error('[POST /leaves] Error:', err.message)
    res.status(500).json({ error: 'Failed to submit leave request' })
  }
})

app.patch('/api/leaves/:id/approve', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const db = getPool()
    const { rows: existing } = await db.query('SELECT * FROM leave_requests WHERE id=$1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Leave request not found' })
    const { rows } = await db.query(
      "UPDATE leave_requests SET status='approved', admin_note=null, decided_by=$1, decided_at=$2 WHERE id=$3 RETURNING *",
      [req.user.id, new Date(), req.params.id]
    )
    const leave = rows[0]
    if (leave && existing[0].status !== 'approved') {
      const days = leave.days_count || 1
      const ltype = leave.leave_type || 'annual'
      const typeLabel = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }
      if (ltype === 'annual') {
        const { rows: p } = await db.query('SELECT leave_balance FROM profiles WHERE id=$1', [leave.user_id])
        await db.query('UPDATE profiles SET leave_balance=$1 WHERE id=$2', [Math.max(0, (p[0]?.leave_balance || 0) - days), leave.user_id])
      } else if (ltype === 'sick') {
        const { rows: p } = await db.query('SELECT sick_leave_balance FROM profiles WHERE id=$1', [leave.user_id])
        await db.query('UPDATE profiles SET sick_leave_balance=$1 WHERE id=$2', [Math.max(0, (p[0]?.sick_leave_balance || 0) - days), leave.user_id])
      } else if (ltype === 'emergency') {
        const { rows: p } = await db.query('SELECT emergency_leave_balance FROM profiles WHERE id=$1', [leave.user_id])
        await db.query('UPDATE profiles SET emergency_leave_balance=$1 WHERE id=$2', [Math.max(0, (p[0]?.emergency_leave_balance || 0) - days), leave.user_id])
      }
      await db.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
        [leave.user_id, `✅ تمت الموافقة على إجازتك ${typeLabel[ltype] || ltype} (${leave.start_date} → ${leave.end_date} | ${days} أيام)`])
      sendWhatsAppToUserId(leave.user_id, `✅ تمت الموافقة على إجازتك ${typeLabel[ltype] || ltype} (${leave.start_date} → ${leave.end_date} | ${days} أيام)`).catch(() => {})
    }
    res.json(leave)
  } catch (err) {
    console.error('[PATCH /leaves/:id/approve] Error:', err.message)
    res.status(500).json({ error: 'Failed to approve leave' })
  }
})

app.patch('/api/leaves/:id/reject', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { note } = req.body
    const db = getPool()
    const { rows: existing } = await db.query('SELECT * FROM leave_requests WHERE id=$1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Leave request not found' })
    const { rows } = await db.query(
      "UPDATE leave_requests SET status='rejected', admin_note=$1, decided_by=$2, decided_at=$3 WHERE id=$4 RETURNING *",
      [note || null, req.user.id, new Date(), req.params.id]
    )
    const leave = rows[0]
    if (leave) {
      if (existing[0].status === 'approved') {
        const days = leave.days_count || 1
        const ltype = leave.leave_type || 'annual'
        if (ltype === 'annual') {
          const { rows: p } = await db.query('SELECT leave_balance FROM profiles WHERE id=$1', [leave.user_id])
          await db.query('UPDATE profiles SET leave_balance=$1 WHERE id=$2', [(p[0]?.leave_balance || 0) + days, leave.user_id])
        } else if (ltype === 'sick') {
          const { rows: p } = await db.query('SELECT sick_leave_balance FROM profiles WHERE id=$1', [leave.user_id])
          await db.query('UPDATE profiles SET sick_leave_balance=$1 WHERE id=$2', [(p[0]?.sick_leave_balance || 0) + days, leave.user_id])
        } else if (ltype === 'emergency') {
          const { rows: p } = await db.query('SELECT emergency_leave_balance FROM profiles WHERE id=$1', [leave.user_id])
          await db.query('UPDATE profiles SET emergency_leave_balance=$1 WHERE id=$2', [(p[0]?.emergency_leave_balance || 0) + days, leave.user_id])
        }
      }
      await db.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)',
        [leave.user_id, `❌ تم رفض طلب إجازتك (${leave.start_date} → ${leave.end_date})${note ? ' — ' + note : ''}`])
      sendWhatsAppToUserId(leave.user_id, `❌ تم رفض طلب إجازتك (${leave.start_date} → ${leave.end_date})${note ? ' — ' + note : ''}`).catch(() => {})
    }
    res.json(leave)
  } catch (err) {
    console.error('[PATCH /leaves/:id/reject] Error:', err.message)
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

// ── PROFILE UPDATE ────────────────────────────────────────────────────────────
app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { full_name, profile_picture_url, phone, department, job_title, address, gender, birth_date, whatsapp_phone } = req.body
    const updates = {}
    if (full_name !== undefined) updates.full_name = full_name
    if (profile_picture_url !== undefined) updates.profile_picture_url = profile_picture_url
    if (phone !== undefined) updates.phone = phone
    if (department !== undefined) updates.department = department
    if (job_title !== undefined) updates.job_title = job_title
    if (address !== undefined) updates.address = address
    if (gender !== undefined) updates.gender = gender
    if (birth_date !== undefined) updates.birth_date = birth_date
    if (whatsapp_phone !== undefined) updates.whatsapp_phone = whatsapp_phone
    const sets = Object.keys(updates).map((k, i) => `${k}=$${i + 2}`).join(', ')
    if (!sets) return res.json(req.profile)
    const vals = [req.user.id, ...Object.values(updates)]
    const { rows } = await getPool().query(`UPDATE profiles SET ${sets} WHERE id=$1 RETURNING *`, vals)
    const { password_hash, ...safe } = rows[0]
    res.json(safe)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ── ADDITIONAL USER ROUTES ────────────────────────────────────────────────────
app.get('/api/users/:id/profile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT * FROM profiles WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    const { password_hash, plain_password, ...safe } = rows[0]
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const { rows: att } = await getPool().query('SELECT * FROM login_times WHERE user_id=$1 ORDER BY date DESC', [req.params.id])
    const thisMonth = att.filter(a => a.date >= monthStart)
    const completed = thisMonth.filter(a => a.logout_time)
    const avgHours = completed.length > 0 ? completed.reduce((s, a) => s + (new Date(a.logout_time) - new Date(a.login_time)) / 3600000, 0) / completed.length : 0
    const { rows: tkts } = await getPool().query('SELECT id,title,status,priority,created_at,category FROM tickets WHERE assigned_to=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id])
    const { rows: leaves } = await getPool().query('SELECT * FROM leave_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id])
    const { rows: pens } = await getPool().query('SELECT * FROM penalties WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]).catch(() => ({ rows: [] }))
    const { rows: assts } = await getPool().query('SELECT * FROM assets WHERE assigned_to=$1', [req.params.id]).catch(() => ({ rows: [] }))
    res.json({
      profile: safe,
      attendance: { thisMonthDays: thisMonth.length, avgHoursPerDay: Math.round(avgHours * 10) / 10, totalRecords: att.length, recentDays: thisMonth.slice(0, 5) },
      tickets: { assigned: tkts, created: [], stats: { open: tkts.filter(t => t.status === 'opened').length, pending: tkts.filter(t => t.status === 'pending').length, solved: tkts.filter(t => t.status === 'solved').length, total: tkts.length } },
      leaves: { list: leaves, stats: { approved: leaves.filter(l => l.status === 'approved').length, pending: leaves.filter(l => l.status === 'pending').length, rejected: leaves.filter(l => l.status === 'rejected').length, totalDays: leaves.filter(l => l.status === 'approved').reduce((s, l) => s + (l.days_count || 0), 0) }, balance: { annual: safe.leave_balance, sick: safe.sick_leave_balance, emergency: safe.emergency_leave_balance } },
      penalties: { list: pens, stats: { total: pens.length, totalAmount: pens.reduce((s, p) => s + (p.amount || 0), 0), warnings: pens.filter(p => p.type === 'warning').length, deductions: pens.filter(p => p.type === 'deduction').length } },
      assets: assts,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get employee profile' })
  }
})

app.post('/api/users/:id/test-whatsapp', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT whatsapp_phone, full_name, email FROM profiles WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    if (!rows[0].whatsapp_phone) return res.status(400).json({ error: 'هذا المستخدم لا يملك رقم واتساب محفوظ — أضف رقمه أولاً' })
    const cfg = await getAppSetting('whatsapp')
    if (!cfg.greenapi_instance_id || !cfg.greenapi_token) return res.status(400).json({ error: 'Green API غير مُفعَّل — يرجى إدخال Instance ID و Token في الإعدادات' })
    const chatId = rows[0].whatsapp_phone.replace(/\D/g, '') + '@c.us'
    const url = `https://api.green-api.com/waInstance${cfg.greenapi_instance_id}/sendMessage/${cfg.greenapi_token}`
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: `✅ Finest IT — اختبار ناجح!\nمرحباً ${rows[0].full_name || rows[0].email}، ستصلك إشعارات التيكتات والحضور والإجازات هنا.` }), signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`Green API error ${r.status}`)
    res.json({ ok: true, message: 'تم إرسال رسالة اختبار! تحقق من واتساب.' })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'فشل إرسال رسالة الاختبار' })
  }
})

app.post('/api/users/bulk-reset-leave', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { leave_balance, sick_leave_balance, emergency_leave_balance, roles, user_ids } = req.body
    if (leave_balance === undefined && sick_leave_balance === undefined && emergency_leave_balance === undefined) {
      return res.status(400).json({ error: 'At least one balance field is required' })
    }
    const db = getPool()
    const sets = [], vals = []
    if (leave_balance !== undefined) { sets.push(` leave_balance=$${vals.length + 1}`); vals.push(Number(leave_balance)) }
    if (sick_leave_balance !== undefined) { sets.push(` sick_leave_balance=$${vals.length + 1}`); vals.push(Number(sick_leave_balance)) }
    if (emergency_leave_balance !== undefined) { sets.push(` emergency_leave_balance=$${vals.length + 1}`); vals.push(Number(emergency_leave_balance)) }

    if (roles?.length) {
      const { rows: profRoles } = await db.query('SELECT id, role FROM profiles')
      const filteredIds = profRoles.filter(u => roles.includes(u.role)).map(u => u.id)
      let updated = 0
      for (const uid of filteredIds) {
        await db.query(`UPDATE profiles SET ${sets.join(',')} WHERE id=$${vals.length + 1}`, [...vals, uid])
        updated++
      }
      res.json({ success: true, updated })
    } else if (user_ids?.length) {
      const ph = user_ids.map((_, i) => `$${vals.length + i + 1}`).join(',')
      await db.query(`UPDATE profiles SET ${sets.join(',')} WHERE id IN (${ph})`, [...vals, ...user_ids])
      res.json({ success: true, updated: user_ids.length })
    } else {
      await db.query(`UPDATE profiles SET ${sets.join(',')}`, vals)
      const { rows } = await db.query('SELECT COUNT(*) FROM profiles')
      res.json({ success: true, updated: parseInt(rows[0].count) })
    }
  } catch (err) {
    console.error('[bulk-reset-leave] Error:', err.message)
    res.status(500).json({ error: 'Failed to reset leave balances' })
  }
})

// ── APP SETTINGS HELPER ────────────────────────────────────────────────────────
async function getAppSetting(key) {
  try {
    const { rows } = await getPool().query('SELECT value FROM system_settings WHERE key=$1', [key])
    const raw = rows[0]?.value
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
  } catch { return {} }
}
async function setAppSetting(key, value) {
  await getPool().query(
    'INSERT INTO system_settings (key, value, updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
    [key, JSON.stringify(value)]
  )
  return value
}

// ── WHATSAPP HELPERS ───────────────────────────────────────────────────────────
async function sendWhatsApp(phone, message) {
  try {
    const cfg = await getAppSetting('whatsapp')
    console.log('[WA-DEBUG] cfg:', JSON.stringify(cfg))
    console.log('[WA-DEBUG] phone:', phone)
    const isEnabled = cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === 1
    console.log('[WA-DEBUG] isEnabled:', isEnabled, '| instance:', cfg.greenapi_instance_id, '| token exists:', !!cfg.greenapi_token)
    if (!isEnabled || !cfg.greenapi_instance_id || !cfg.greenapi_token) {
      console.log('[WA-DEBUG] Skipping — not enabled or missing config')
      return
    }
    const chatId = phone.replace(/\D/g, '') + '@c.us'
    console.log('[WA-DEBUG] Sending to chatId:', chatId)
    const url = `https://api.green-api.com/waInstance${cfg.greenapi_instance_id}/sendMessage/${cfg.greenapi_token}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
      signal: AbortSignal.timeout(10000),
    })
    const responseText = await r.text().catch(() => '')
    console.log('[WA-DEBUG] Response:', r.status, responseText)
    if (!r.ok) console.error('[WA] sendWhatsApp error:', r.status, responseText)
  } catch (err) {
    console.error('[WA] sendWhatsApp exception:', err.message)
  }
}
async function sendWhatsAppToUserId(userId, message) {
  try {
    const { rows } = await getPool().query('SELECT whatsapp_phone FROM profiles WHERE id=$1', [userId])
    const phone = rows[0]?.whatsapp_phone
    if (!phone) return
    await sendWhatsApp(phone, message)
  } catch (err) {
    console.error('[WA] sendWhatsAppToUserId exception:', err.message)
  }
}
async function sendWhatsAppToAdmins(message) {
  try {
    const { rows } = await getPool().query(
      "SELECT whatsapp_phone FROM profiles WHERE role IN ('admin','super_admin') AND whatsapp_phone IS NOT NULL AND whatsapp_phone != ''"
    )
    for (const r of rows) await sendWhatsApp(r.whatsapp_phone, message)
  } catch (err) {
    console.error('[WA] sendWhatsAppToAdmins exception:', err.message)
  }
}

// ── WHATSAPP SETTINGS ─────────────────────────────────────────────────────────
app.get('/api/settings/whatsapp', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const cfg = await getAppSetting('whatsapp')
    res.json({ enabled: cfg.enabled || false, greenapi_instance_id: cfg.greenapi_instance_id || '', greenapi_token: cfg.greenapi_token ? '••••••••' : '', phone: cfg.phone || '' })
  } catch (err) { res.status(500).json({ error: 'Failed to load WhatsApp settings' }) }
})

app.post('/api/settings/whatsapp', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const existing = await getAppSetting('whatsapp')
    const { enabled, greenapi_instance_id, greenapi_token, phone } = req.body
    const updated = { ...existing }
    if (enabled !== undefined) updated.enabled = Boolean(enabled)
    if (greenapi_instance_id !== undefined) updated.greenapi_instance_id = String(greenapi_instance_id).trim()
    if (greenapi_token !== undefined && greenapi_token !== '••••••••') updated.greenapi_token = String(greenapi_token).trim()
    if (phone !== undefined) updated.phone = String(phone).trim().replace(/\s/g, '')
    await setAppSetting('whatsapp', updated)
    res.json({ enabled: updated.enabled || false, greenapi_instance_id: updated.greenapi_instance_id || '', greenapi_token: updated.greenapi_token ? '••••••••' : '', phone: updated.phone || '' })
  } catch (err) { res.status(500).json({ error: 'Failed to save WhatsApp settings' }) }
})

app.post('/api/settings/whatsapp/test', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const cfg = await getAppSetting('whatsapp')
    if (!cfg.greenapi_instance_id || !cfg.greenapi_token) return res.status(400).json({ error: 'يرجى إدخال Instance ID و API Token أولاً' })
    if (!cfg.phone) return res.status(400).json({ error: 'يرجى إدخال رقم واتساب للاختبار' })
    const chatId = cfg.phone.replace(/\D/g, '') + '@c.us'
    const url = `https://api.green-api.com/waInstance${cfg.greenapi_instance_id}/sendMessage/${cfg.greenapi_token}`
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: '✅ Finest IT — اختبار ناجح! ستصلك إشعارات التيكتات والحضور والإجازات هنا.' }), signal: AbortSignal.timeout(10000) })
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Green API error ${r.status}: ${t}`) }
    res.json({ ok: true, message: 'تم إرسال رسالة اختبار! تحقق من واتساب.' })
  } catch (err) { res.status(400).json({ error: err?.message || 'فشل إرسال رسالة الاختبار' }) }
})

// ── SMTP SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/settings/smtp', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const cfg = await getAppSetting('smtp')
    res.json({ host: cfg.host || '', port: cfg.port || 587, secure: cfg.secure || false, user: cfg.user || '', password: cfg.password ? '••••••••' : '', from_name: cfg.from_name || '', from_email: cfg.from_email || '', enabled: cfg.enabled || false })
  } catch (err) { res.status(500).json({ error: 'Failed to load SMTP settings' }) }
})

app.post('/api/settings/smtp', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const existing = await getAppSetting('smtp')
    const { host, port, secure, user, password, from_name, from_email, enabled } = req.body
    const updated = { ...existing }
    if (host !== undefined) updated.host = String(host).trim()
    if (port !== undefined) updated.port = Number(port) || 587
    if (secure !== undefined) updated.secure = Boolean(secure)
    if (user !== undefined) updated.user = String(user).trim()
    if (password !== undefined && password !== '••••••••') updated.password = String(password)
    if (from_name !== undefined) updated.from_name = String(from_name).trim()
    if (from_email !== undefined) updated.from_email = String(from_email).trim()
    if (enabled !== undefined) updated.enabled = Boolean(enabled)
    await setAppSetting('smtp', updated)
    res.json({ ...updated, password: updated.password ? '••••••••' : '' })
  } catch (err) { res.status(500).json({ error: 'Failed to save SMTP settings' }) }
})

app.post('/api/settings/smtp/test', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    res.status(400).json({ error: 'SMTP test not available in this environment' })
  } catch (err) { res.status(500).json({ error: 'Failed' }) }
})

// ── GITHUB SYNC SETTINGS ──────────────────────────────────────────────────────
app.get('/api/settings/github-sync', requireAuth, async (req, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
    const cfg = await getAppSetting('github_sync')
    res.json({ repo_url: cfg.repo_url || '', branch: cfg.branch || 'main', has_token: Boolean(cfg.token) })
  } catch (err) { res.status(500).json({ error: 'Failed to load GitHub sync settings' }) }
})

app.post('/api/settings/github-sync', requireAuth, async (req, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
    const { repo_url, branch, token } = req.body
    if (!repo_url || !branch) return res.status(400).json({ error: 'repo_url and branch are required' })
    const existing = await getAppSetting('github_sync')
    const updated = { repo_url: String(repo_url).trim(), branch: String(branch).trim(), token: token !== undefined ? String(token) : existing.token }
    await setAppSetting('github_sync', updated)
    res.json({ ok: true, repo_url: updated.repo_url, branch: updated.branch, has_token: Boolean(updated.token) })
  } catch (err) { res.status(500).json({ error: 'Failed to save GitHub sync settings' }) }
})

app.post('/api/settings/github-sync/test', requireAuth, async (req, res) => {
  try {
    if (req.profile.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
    res.json({ ok: true, message: 'GitHub sync test not available in this environment' })
  } catch (err) { res.status(500).json({ error: 'Failed' }) }
})

// ── AUTO-ASSIGN RULES ─────────────────────────────────────────────────────────
app.get('/api/settings/auto-assign', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM auto_assign_rules ORDER BY created_at')
    res.json({ rules: rows.map(r => ({ category: r.category, user_id: r.user_id, user_name: r.user_name || '' })) })
  } catch (err) { res.status(500).json({ error: 'Failed to load auto-assign rules' }) }
})

app.post('/api/settings/auto-assign', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rules } = req.body
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' })
    await getPool().query('DELETE FROM auto_assign_rules')
    const cleaned = rules.filter(r => r.category?.trim() && r.user_id?.trim())
    for (const r of cleaned) {
      await getPool().query('INSERT INTO auto_assign_rules (category, user_id, user_name) VALUES ($1,$2,$3) ON CONFLICT (category) DO UPDATE SET user_id=$2, user_name=$3', [r.category.trim(), r.user_id.trim(), r.user_name || ''])
    }
    const { rows } = await getPool().query('SELECT * FROM auto_assign_rules ORDER BY created_at')
    res.json({ rules: rows.map(r => ({ category: r.category, user_id: r.user_id, user_name: r.user_name || '' })) })
  } catch (err) { res.status(500).json({ error: 'Failed to save auto-assign rules' }) }
})

// ── GITHUB SYNC STATUS ────────────────────────────────────────────────────────
app.get('/api/github-sync-status', requireAuth, async (req, res) => {
  try {
    res.json({ synced: false, last_sync: null, status: 'not_configured' })
  } catch (err) { res.status(500).json({ error: 'Failed' }) }
})

// ── ASSETS ────────────────────────────────────────────────────────────────────
app.get('/api/assets', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM assets ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Failed to get assets' }) }
})

app.get('/api/assets/stats', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT status, COUNT(*) as count FROM assets GROUP BY status')
    const stats = { total: 0, active: 0, inactive: 0, maintenance: 0, retired: 0 }
    rows.forEach(r => { stats[r.status] = parseInt(r.count); stats.total += parseInt(r.count) })
    res.json(stats)
  } catch (err) { res.status(500).json({ error: 'Failed to get asset stats' }) }
})

app.get('/api/assets/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM assets WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to get asset' }) }
})

app.post('/api/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, serial_number, brand, model, status, condition, purchase_date, warranty_expires, purchase_price, location, notes, image_url, assigned_to } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const { rows } = await getPool().query(
      `INSERT INTO assets (name,type,serial_number,brand,model,status,condition,purchase_date,warranty_expires,purchase_price,location,notes,image_url,assigned_to,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, type||'other', serial_number||null, brand||null, model||null, status||'active', condition||'good', purchase_date||null, warranty_expires||null, purchase_price?Number(purchase_price):null, location||null, notes||null, image_url||null, assigned_to||null, req.user.id]
    )
    await getPool().query('INSERT INTO asset_history (asset_id,changed_by,changed_by_name,action,description) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, req.user.id, req.profile.full_name||req.profile.email, 'created', `Asset "${name}" created`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err?.message || 'Failed to create asset' }) }
})

app.patch('/api/assets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const fields = ['name','type','serial_number','brand','model','status','condition','purchase_date','warranty_expires','purchase_price','location','notes','image_url','assigned_to']
    const sets = [], vals = [req.params.id]
    fields.forEach(f => { if (req.body[f] !== undefined) { sets.push(`${f}=$${vals.length+1}`); vals.push(req.body[f] === '' ? null : req.body[f]) } })
    sets.push(`updated_at=$${vals.length+1}`); vals.push(new Date())
    if (sets.length === 1) return res.status(400).json({ error: 'Nothing to update' })
    const { rows } = await getPool().query(`UPDATE assets SET ${sets.join(',')} WHERE id=$1 RETURNING *`, vals)
    if (!rows[0]) return res.status(404).json({ error: 'Asset not found' })
    await getPool().query('INSERT INTO asset_history (asset_id,changed_by,changed_by_name,action,description) VALUES ($1,$2,$3,$4,$5)', [req.params.id, req.user.id, req.profile.full_name||req.profile.email, 'updated', `Asset updated`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err?.message || 'Failed to update asset' }) }
})

app.delete('/api/assets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getPool().query('DELETE FROM assets WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete asset' }) }
})

app.get('/api/assets/:id/history', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM asset_history WHERE asset_id=$1 ORDER BY created_at DESC', [req.params.id])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Failed to get asset history' }) }
})

app.get('/api/assets/:id/tickets', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rows } = await getPool().query('SELECT * FROM tickets WHERE asset_id=$1 ORDER BY created_at DESC', [req.params.id]).catch(() => ({ rows: [] }))
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Failed to get asset tickets' }) }
})

// ── PENALTIES ─────────────────────────────────────────────────────────────────
app.get('/api/penalties', requireAuth, async (req, res) => {
  try {
    const isAdmin = isAdminRole(req.profile.role)
    const { rows } = isAdmin
      ? await getPool().query('SELECT * FROM penalties ORDER BY created_at DESC')
      : await getPool().query('SELECT * FROM penalties WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])
    const { rows: profs } = await getPool().query('SELECT id,full_name,email,role FROM profiles')
    const pm = new Map(profs.map(p => [p.id, p]))
    res.json(rows.map(r => ({ ...r, user: pm.get(r.user_id)||null, issued_by_user: r.issued_by ? pm.get(r.issued_by)||null : null })))
  } catch (err) { res.status(500).json({ error: 'Failed to get penalties' }) }
})

app.post('/api/penalties', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { user_id, type, reason, amount, notes } = req.body
    if (!user_id || !reason) return res.status(400).json({ error: 'user_id and reason are required' })
    const { rows } = await getPool().query(
      'INSERT INTO penalties (user_id,type,reason,amount,notes,issued_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [user_id, type||'warning', reason, amount?Number(amount):null, notes||null, req.user.id]
    )
    await getPool().query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [user_id, `⚠️ ${type||'warning'}: ${reason}`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to create penalty' }) }
})

app.patch('/api/penalties/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type, reason, amount, notes } = req.body
    const sets = [], vals = [req.params.id]
    if (type) { sets.push(`type=$${vals.length+1}`); vals.push(type) }
    if (reason) { sets.push(`reason=$${vals.length+1}`); vals.push(reason) }
    if (amount !== undefined) { sets.push(`amount=$${vals.length+1}`); vals.push(Number(amount)) }
    if (notes !== undefined) { sets.push(`notes=$${vals.length+1}`); vals.push(notes) }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
    const { rows } = await getPool().query(`UPDATE penalties SET ${sets.join(',')} WHERE id=$1 RETURNING *`, vals)
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to update penalty' }) }
})

app.delete('/api/penalties/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getPool().query('DELETE FROM penalties WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete penalty' }) }
})

// ── COMPLAINTS ────────────────────────────────────────────────────────────────
app.get('/api/complaints', requireAuth, async (req, res) => {
  try {
    const isAdmin = isAdminRole(req.profile.role)
    const { rows } = isAdmin
      ? await getPool().query('SELECT * FROM complaints ORDER BY created_at DESC')
      : await getPool().query('SELECT * FROM complaints WHERE complainant_id=$1 OR against_user_id=$1 ORDER BY created_at DESC', [req.user.id])
    const { rows: profs } = await getPool().query('SELECT id,full_name,email,role FROM profiles')
    const pm = new Map(profs.map(p => [p.id, p]))
    res.json(rows.map(r => ({ ...r, complainant: r.is_anonymous ? null : (r.complainant_id ? pm.get(r.complainant_id)||null : null), against_user: r.against_user_id ? pm.get(r.against_user_id)||null : null, resolved_by_user: r.resolved_by ? pm.get(r.resolved_by)||null : null })))
  } catch (err) { res.status(500).json({ error: 'Failed to get complaints' }) }
})

app.post('/api/complaints', requireAuth, async (req, res) => {
  try {
    const { against_user_id, subject, description, is_anonymous } = req.body
    if (!subject || !description) return res.status(400).json({ error: 'Subject and description are required' })
    const { rows } = await getPool().query(
      'INSERT INTO complaints (complainant_id,against_user_id,subject,description,is_anonymous,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [is_anonymous ? null : req.user.id, against_user_id||null, subject, description, !!is_anonymous, 'pending']
    )
    const { rows: admins } = await getPool().query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    const name = is_anonymous ? 'مجهول' : (req.profile.full_name || req.profile.email)
    for (const a of admins) await getPool().query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [a.id, `📣 شكوى جديدة من ${name}: ${subject}`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to create complaint' }) }
})

app.patch('/api/complaints/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, admin_response } = req.body
    const sets = [], vals = [req.params.id]
    if (status) { sets.push(`status=$${vals.length+1}`); vals.push(status) }
    if (admin_response !== undefined) { sets.push(`admin_response=$${vals.length+1}`); vals.push(admin_response) }
    if (status === 'resolved' || status === 'rejected') { sets.push(`resolved_by=$${vals.length+1}`); vals.push(req.user.id); sets.push(`resolved_at=$${vals.length+1}`); vals.push(new Date()) }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
    const { rows } = await getPool().query(`UPDATE complaints SET ${sets.join(',')} WHERE id=$1 RETURNING *`, vals)
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to update complaint' }) }
})

app.delete('/api/complaints/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getPool().query('DELETE FROM complaints WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete complaint' }) }
})

// ── TICKET RATE ───────────────────────────────────────────────────────────────
app.post('/api/tickets/:id/rate', requireAuth, async (req, res) => {
  try {
    const { rating, rating_comment } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' })
    const { rows } = await getPool().query('UPDATE tickets SET rating=$1, rating_comment=$2 WHERE id=$3 AND created_by=$4 RETURNING *', [rating, rating_comment||null, req.params.id, req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found or not authorized' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to rate ticket' }) }
})

// ── ATTENDANCE EXTRA ROUTES ───────────────────────────────────────────────────
app.get('/api/attendance/live', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role) && !req.profile.can_view_attendance) return res.status(403).json({ error: 'Admin only' })
    const today = new Date().toISOString().slice(0, 10)
    const { rows } = await getPool().query('SELECT lt.*, p.full_name, p.email, p.profile_picture_url FROM login_times lt JOIN profiles p ON p.id=lt.user_id WHERE lt.date=$1 ORDER BY lt.login_time DESC', [today])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Failed to get live attendance' }) }
})

app.get('/api/attendance/monthly-report', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const now = new Date()
    const year = parseInt(req.query.year) || now.getFullYear()
    const month = parseInt(req.query.month) || (now.getMonth() + 1)
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0)
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    const { rows } = await getPool().query('SELECT * FROM login_times WHERE date >= $1 AND date <= $2', [firstDay, lastDayStr])
    const { rows: profs } = await getPool().query("SELECT * FROM profiles WHERE role NOT IN ('admin','super_admin')")
    const statsMap = new Map()
    profs.forEach(p => statsMap.set(p.id, { profile: p, days: [], totalMinutes: 0, overtimeMinutes: 0, lateCount: 0, lateTotalMinutes: 0 }))
    rows.forEach(r => {
      if (!statsMap.has(r.user_id)) return
      const e = statsMap.get(r.user_id)
      if (!e.days.includes(r.date)) e.days.push(r.date)
      if (r.login_time && r.logout_time) {
        const mins = (new Date(r.logout_time) - new Date(r.login_time)) / 60000
        if (mins > 0) { e.totalMinutes += mins; e.overtimeMinutes += Math.max(0, mins - 480) }
      }
      if (r.login_time) {
        const d = new Date(r.login_time)
        const h = d.getHours(), m = d.getMinutes()
        const ws = statsMap.get(r.user_id)?.profile?.work_start_hour || 9
        const late = Math.max(0, (h - ws) * 60 + m)
        if (late > 5) { e.lateCount++; e.lateTotalMinutes += late }
      }
    })
    const workingDays = lastDay.getDate()
    const report = Array.from(statsMap.values()).map(({ profile, days, totalMinutes, overtimeMinutes, lateCount, lateTotalMinutes }) => ({ id: profile.id, full_name: profile.full_name, email: profile.email, role: profile.role, days_present: days.length, days_absent: Math.max(0, workingDays - days.length), working_days: workingDays, attendance_rate: workingDays > 0 ? Math.round((days.length / workingDays) * 100) : 0, total_minutes: Math.round(totalMinutes), avg_minutes_per_day: days.length > 0 ? Math.round(totalMinutes / days.length) : 0, overtime_minutes: Math.round(overtimeMinutes), late_count: lateCount, late_total_minutes: Math.round(lateTotalMinutes) }))
    report.sort((a, b) => b.attendance_rate - a.attendance_rate)
    res.json({ year, month, working_days: workingDays, employees: report })
  } catch (err) { res.status(500).json({ error: 'Failed to generate report' }) }
})

app.get('/api/attendance/late-overtime-detail', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const now = new Date()
    const year = parseInt(req.query.year) || now.getFullYear()
    const month = parseInt(req.query.month) || (now.getMonth() + 1)
    const userId = req.query.user_id
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0)
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    const qParams = [firstDay, lastDayStr]
    let q = 'SELECT * FROM login_times WHERE date >= $1 AND date <= $2'
    if (userId) { q += ' AND user_id=$3'; qParams.push(userId) }
    const { rows } = await getPool().query(q, qParams)
    const { rows: profs } = await getPool().query('SELECT * FROM profiles')
    const pm = new Map(profs.map(p => [p.id, p]))
    const empMap = new Map()
    rows.forEach(r => {
      const prof = pm.get(r.user_id)
      if (!prof || (!userId && (prof.role === 'admin' || prof.role === 'super_admin'))) return
      if (!empMap.has(r.user_id)) empMap.set(r.user_id, { profile: prof, days: [] })
      const ws = prof.work_start_hour || 9
      let lateMin = 0, workedMin = 0, otMin = 0
      if (r.login_time) { const d = new Date(r.login_time); lateMin = Math.max(0, (d.getHours() - ws) * 60 + d.getMinutes()) }
      if (r.login_time && r.logout_time) { workedMin = Math.round((new Date(r.logout_time) - new Date(r.login_time)) / 60000); otMin = Math.max(0, workedMin - 480) }
      empMap.get(r.user_id).days.push({ date: r.date, login_time: r.login_time, logout_time: r.logout_time, late_minutes: lateMin, worked_minutes: workedMin, overtime_minutes: otMin })
    })
    const result = Array.from(empMap.values()).map(({ profile, days }) => {
      const lateDays = days.filter(d => d.late_minutes > 5)
      const otDays = days.filter(d => d.overtime_minutes > 0)
      return { id: profile.id, full_name: profile.full_name, email: profile.email, work_start_hour: profile.work_start_hour || 9, days_present: days.length, late_days: lateDays.length, late_total_minutes: lateDays.reduce((s, d) => s + d.late_minutes, 0), overtime_days: otDays.length, overtime_total_minutes: otDays.reduce((s, d) => s + d.overtime_minutes, 0), day_records: days.sort((a, b) => a.date.localeCompare(b.date)) }
    })
    result.sort((a, b) => b.late_total_minutes - a.late_total_minutes)
    res.json({ year, month, employees: result })
  } catch (err) { res.status(500).json({ error: 'Failed to generate report' }) }
})

app.get('/api/attendance/corrections', requireAuth, async (req, res) => {
  try {
    const isAdmin = isAdminRole(req.profile.role)
    const { rows } = isAdmin
      ? await getPool().query('SELECT * FROM attendance_corrections ORDER BY created_at DESC')
      : await getPool().query('SELECT * FROM attendance_corrections WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])
    const { rows: profs } = await getPool().query('SELECT id,full_name,email FROM profiles')
    const pm = new Map(profs.map(p => [p.id, p]))
    res.json(rows.map(r => ({ ...r, user: pm.get(r.user_id)||null, reviewed_by_user: r.reviewed_by ? pm.get(r.reviewed_by)||null : null })))
  } catch (err) { res.status(500).json({ error: 'Failed to get corrections' }) }
})

app.post('/api/attendance/corrections', requireAuth, async (req, res) => {
  try {
    const { date, requested_login, requested_logout, reason } = req.body
    if (!date || !reason) return res.status(400).json({ error: 'Date and reason are required' })
    const { rows } = await getPool().query('INSERT INTO attendance_corrections (user_id,date,requested_login,requested_logout,reason,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.user.id, date, requested_login||null, requested_logout||null, reason, 'pending'])
    const { rows: admins } = await getPool().query("SELECT id FROM profiles WHERE role IN ('admin','super_admin')")
    const name = req.profile.full_name || req.profile.email
    for (const a of admins) await getPool().query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [a.id, `🔧 طلب تصحيح حضور من ${name} بتاريخ ${date}`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to create correction' }) }
})

app.patch('/api/attendance/corrections/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, admin_note } = req.body
    const { rows } = await getPool().query('UPDATE attendance_corrections SET status=$1, admin_note=$2, reviewed_by=$3, reviewed_at=$4 WHERE id=$5 RETURNING *', [status, admin_note||null, req.user.id, new Date(), req.params.id])
    if (rows[0] && status === 'approved' && (rows[0].requested_login || rows[0].requested_logout)) {
      const sets = [], vals = [rows[0].user_id, rows[0].date]
      if (rows[0].requested_login) { sets.push(`login_time=$${vals.length+1}`); vals.push(new Date(`${rows[0].date}T${rows[0].requested_login}:00`)) }
      if (rows[0].requested_logout) { sets.push(`logout_time=$${vals.length+1}`); vals.push(new Date(`${rows[0].date}T${rows[0].requested_logout}:00`)) }
      if (sets.length) await getPool().query(`UPDATE login_times SET ${sets.join(',')} WHERE user_id=$1 AND date=$2`, vals)
    }
    if (rows[0]?.user_id) await getPool().query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [rows[0].user_id, `${status==='approved'?'✅ تم قبول':'❌ تم رفض'} طلب تصحيح الحضور بتاريخ ${rows[0].date}`])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Failed to update correction' }) }
})

// ── LEAVE EXTRA ROUTES ────────────────────────────────────────────────────────
app.get('/api/leaves/calendar', requireAuth, async (req, res) => {
  try {
    const { rows } = await getPool().query("SELECT lr.*, p.full_name, p.email FROM leave_requests lr JOIN profiles p ON p.id=lr.user_id WHERE lr.status='approved' ORDER BY lr.start_date")
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Failed to get leave calendar' }) }
})

app.get('/api/leaves/balance', requireAuth, async (req, res) => {
  try {
    const targetId = req.query.user_id || req.user.id
    const isAdmin = isAdminRole(req.profile.role)
    if (targetId !== req.user.id && !isAdmin) return res.status(403).json({ error: 'Forbidden' })
    const db = getPool()
    const { rows } = await db.query('SELECT id, full_name, email, leave_balance, sick_leave_balance, emergency_leave_balance FROM profiles WHERE id=$1', [targetId])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    const prof = rows[0]
    const { rows: approvedLeaves } = await db.query("SELECT leave_type, days_count FROM leave_requests WHERE user_id=$1 AND status='approved'", [targetId])
    const usedByType = { annual: 0, sick: 0, emergency: 0, unpaid: 0 }
    for (const l of approvedLeaves) {
      const t = l.leave_type || 'annual'
      if (!usedByType[t]) usedByType[t] = 0
      usedByType[t] += l.days_count || 1
    }
    res.json({
      user: { id: prof.id, full_name: prof.full_name, email: prof.email, leave_balance: prof.leave_balance, sick_leave_balance: prof.sick_leave_balance, emergency_leave_balance: prof.emergency_leave_balance },
      balance: {
        annual: { total: prof.leave_balance, used: usedByType.annual, remaining: Math.max(0, prof.leave_balance - usedByType.annual) },
        sick: { total: prof.sick_leave_balance, used: usedByType.sick, remaining: Math.max(0, prof.sick_leave_balance - usedByType.sick) },
        emergency: { total: prof.emergency_leave_balance, used: usedByType.emergency, remaining: Math.max(0, prof.emergency_leave_balance - usedByType.emergency) },
        unpaid: { total: 999, used: usedByType.unpaid, remaining: 999 },
      }
    })
  } catch (err) { res.status(500).json({ error: 'Failed to get leave balance' }) }
})

app.get('/api/leaves/monthly-report', requireAuth, async (req, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const now = new Date()
    const year = parseInt(req.query.year) || now.getFullYear()
    const month = parseInt(req.query.month) || (now.getMonth() + 1)
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
    const db = getPool()
    const { rows } = await db.query('SELECT * FROM leave_requests WHERE start_date >= $1 AND start_date <= $2', [firstDay, lastDay])
    const { rows: profs } = await db.query('SELECT id, full_name, email, role, leave_balance, sick_leave_balance, emergency_leave_balance FROM profiles')
    const pm = new Map(profs.map(p => [p.id, p]))

    const stats = {
      total: rows.length,
      approved: rows.filter(r => r.status === 'approved').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
      pending: rows.filter(r => r.status === 'pending').length,
      byType: {},
      topUsers: [],
    }
    for (const r of rows) {
      if (!stats.byType[r.leave_type]) stats.byType[r.leave_type] = 0
      stats.byType[r.leave_type]++
    }
    const userLeaveMap = new Map()
    for (const r of rows.filter(x => x.status === 'approved')) {
      const days = r.days_count || 1
      userLeaveMap.set(r.user_id, (userLeaveMap.get(r.user_id) || 0) + days)
    }
    stats.topUsers = Array.from(userLeaveMap.entries())
      .map(([id, days]) => ({ user: pm.get(id) || null, days }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10)

    res.json({ year, month, stats, leaves: rows.map(r => ({ ...r, user: pm.get(r.user_id) || null })) })
  } catch (err) { res.status(500).json({ error: 'Failed to get leave report' }) }
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
