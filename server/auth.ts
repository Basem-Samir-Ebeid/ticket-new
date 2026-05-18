import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { db } from './db'
import { profiles, sessionRevocations } from '../shared/schema'
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
    const decoded = verifyToken(auth.replace('Bearer ', ''))
    const { userId } = decoded
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId))
    if (!profile) return res.status(401).json({ error: 'User not found' })

    const iat = (decoded as any).iat
    if (iat) {
      const issuedAt = new Date(iat * 1000)
      const [revocation] = await db
        .select()
        .from(sessionRevocations)
        .where(eq(sessionRevocations.user_id, userId))
        .limit(1)
      if (revocation && new Date(revocation.created_at) > issuedAt) {
        return res.status(401).json({ error: 'Session revoked. Please sign in again.' })
      }
    }

    req.user = { id: userId }
    req.profile = profile
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export async function requireAdmin(req: Request & { profile?: any }, res: Response, next: NextFunction) {
  if (req.profile?.role !== 'admin' && req.profile?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export function checkPermission(profile: any, permission: string): boolean {
  if (!profile) return false
  if (profile.role === 'admin' || profile.role === 'super_admin') return true

  // Legacy boolean columns
  if (permission === 'can_view_attendance' && profile.can_view_attendance) return true
  if (permission === 'can_view_assets' && profile.can_view_assets) return true
  if (permission === 'can_view_whatsapp_contacts' && profile.can_view_whatsapp_contacts) return true

  // JSONB permissions object
  const perms = profile.permissions
  if (perms && typeof perms === 'object' && perms[permission] === true) return true

  return false
}

export function requirePermission(permission: string) {
  return (req: Request & { profile?: any }, res: Response, next: NextFunction) => {
    if (!checkPermission(req.profile, permission)) {
      return res.status(403).json({ error: 'Permission denied' })
    }
    next()
  }
}
