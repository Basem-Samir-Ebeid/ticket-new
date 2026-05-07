import { Router } from 'express'
import { db } from '../db'
import { profiles, notifications } from '../../shared/schema'
import { eq } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()

/**
 * POST /api/internal/github-sync/notify-failure
 *
 * Called by scripts/github-sync.sh (via notify_failure) when a git push fails.
 * Authenticated with x-internal-secret header (INTERNAL_NOTIFY_SECRET env var).
 * Inserts an in-app notification for every super_admin and broadcasts it over
 * WebSocket so online admins see the alert immediately.
 */
router.post('/notify-failure', async (req, res) => {
  const secret = req.headers['x-internal-secret']
  const expected = process.env.INTERNAL_NOTIFY_SECRET

  if (!expected || secret !== expected) {
    console.warn('[github-sync] notify-failure: rejected request — missing or incorrect secret')
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { branch, error } = req.body
  if (!branch || typeof branch !== 'string') {
    return res.status(400).json({ error: 'branch is required' })
  }

  const errorSnippet = (typeof error === 'string' ? error : 'Unknown error').slice(0, 200)
  const message = `⚠️ GitHub sync failed for branch "${branch}": ${errorSnippet}`

  console.error(`[github-sync] Sync failure on branch "${branch}": ${errorSnippet}`)

  try {
    const superAdmins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    if (superAdmins.length === 0) {
      console.warn('[github-sync] notify-failure: no super_admin users found to notify')
    }

    for (const admin of superAdmins) {
      const [notif] = await db
        .insert(notifications)
        .values({ user_id: admin.id, message })
        .returning()
      broadcast(admin.id, 'notification', notif)
    }

    console.log(`[github-sync] Notified ${superAdmins.length} super_admin(s) of sync failure`)
    res.json({ notified: superAdmins.length })
  } catch (err: any) {
    console.error('[github-sync] Failed to send failure notifications:', err)
    res.status(500).json({ error: err?.message || 'Internal error' })
  }
})

export default router
