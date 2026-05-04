import pg from 'pg'
import jwt from 'jsonwebtoken'

const { Pool } = pg
const JWT_SECRET = process.env.JWT_SECRET || 'it-ticket-secret-key-2024'

let pool
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  }
  return pool
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export async function authenticate(req, res) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return null
  }
  try {
    const { userId } = verifyToken(auth.replace('Bearer ', ''))
    const pool = getPool()
    const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId])
    if (rows.length === 0) {
      res.status(401).json({ error: 'User not found' })
      return null
    }
    return { user: { id: userId }, profile: rows[0] }
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function allowMethods(req, res, methods) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return false }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  return true
}
