import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { db } from './db'
import { profiles } from '../shared/schema'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET || 'it-ticket-secret-key-2024'

export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string }
}

export async function requireAuth(req: Request & { user?: any; profile?: any }, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const { userId } = verifyToken(auth.replace('Bearer ', ''))
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId))
    if (!profile) return res.status(401).json({ error: 'User not found' })
    req.user = { id: userId }
    req.profile = profile
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export async function requireAdmin(req: Request & { profile?: any }, res: Response, next: NextFunction) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
