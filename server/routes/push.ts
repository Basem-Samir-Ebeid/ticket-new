import { Router } from 'express'
import webpush from 'web-push'
import { db } from '../db'
import { pushSubscriptions, profiles } from '../../shared/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../auth'

const router = Router()

function initVapid() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@ticketsystem.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    return true
  } catch (e) {
    console.error('VAPID init failed:', e)
    return false
  }
}

router.post('/subscribe', requireAuth as any, async (req: any, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' })
  }
  await db.insert(pushSubscriptions).values({
    user_id: req.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }).onConflictDoNothing()
  res.json({ success: true })
})

router.delete('/unsubscribe', requireAuth as any, async (req: any, res) => {
  const { endpoint } = req.body
  if (endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  }
  res.json({ success: true })
})

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

export async function sendPushToAdmins(title: string, body: string, url = '/') {
  if (!initVapid()) return
  try {
    const adminProfiles = await db.select({ id: profiles.id, role: profiles.role }).from(profiles)
    const adminIds = adminProfiles.filter(p => p.role === 'admin' || p.role === 'super_admin').map(p => p.id)
    if (adminIds.length === 0) return

    const subs = await db.select().from(pushSubscriptions)
    const adminSubs = subs.filter(s => adminIds.includes(s.user_id))

    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(
      adminSubs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async (err: any) => {
          if (err.statusCode === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
          }
        })
      )
    )
  } catch {}
}

export default router
