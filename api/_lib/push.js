import webpush from 'web-push'

function initVapid() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@ticketsystem.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    return true
  } catch {
    return false
  }
}

export async function sendPushToAdmins(pool, title, body, url = '/') {
  if (!initVapid()) return
  try {
    const { rows: adminProfiles } = await pool.query(
      "SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')"
    )
    const adminIds = adminProfiles.map(p => p.id)
    if (adminIds.length === 0) return

    const placeholders = adminIds.map((_, i) => `$${i + 1}`).join(',')
    const { rows: subs } = await pool.query(
      `SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`,
      adminIds
    )

    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async (err) => {
          if (err.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
          }
        })
      )
    )
  } catch {}
}
