import { Router } from 'express'
import { db } from '../db'
import { profiles, notifications } from '../../shared/schema'
import { eq } from 'drizzle-orm'
import { broadcast } from '../ws'

const router = Router()

router.post('/notify-failure', async (req, res) => {
  const secret = req.headers['x-internal-secret']
  const expected = process.env.INTERNAL_NOTIFY_SECRET

  if (!expected || secret !== expected) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { branch, error } = req.body
  if (!branch) {
    return res.status(400).json({ error: 'branch is required' })
  }

  const errorSnippet = (error || 'Unknown error').slice(0, 200)
  const message = `⚠️ GitHub sync failed for branch "${branch}": ${errorSnippet}`

  try {
    const superAdmins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'super_admin'))

    for (const admin of superAdmins) {
      const [notif] = await db
        .insert(notifications)
        .values({ user_id: admin.id, message })
        .returning()
      broadcast(admin.id, 'notification', notif)
    }

    res.json({ notified: superAdmins.length })
  } catch (err: any) {
    console.error('[github-sync] Failed to send failure notifications:', err)
    res.status(500).json({ error: err?.message || 'Internal error' })
  }
})

export default router
