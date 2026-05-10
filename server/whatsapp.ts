import https from 'https'
import { db } from './db'
import { profiles } from '../shared/schema'
import { eq } from 'drizzle-orm'

export async function sendWhatsAppToUser(userId: string, message: string): Promise<void> {
  try {
    const [user] = await db
      .select({ phone: profiles.phone, apikey: profiles.whatsapp_apikey })
      .from(profiles)
      .where(eq(profiles.id, userId))

    if (!user?.phone || !user?.apikey) {
      console.warn(`[WhatsApp] User ${userId} missing phone or whatsapp_apikey, skipping.`)
      return
    }

    let phone = user.phone.replace(/[\s\-().]/g, '')
    if (phone.startsWith('0')) phone = '20' + phone.slice(1)
    if (!phone.startsWith('+')) phone = '+' + phone

    const encodedMsg = encodeURIComponent(message)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMsg}&apikey=${user.apikey}`

    await new Promise<void>((resolve) => {
      https.get(url, (res) => {
        res.resume()
        res.on('end', resolve)
      }).on('error', (err) => {
        console.error('[WhatsApp] CallMeBot error:', err.message)
        resolve()
      })
    })
  } catch (err: any) {
    console.error('[WhatsApp] sendWhatsAppToUser error:', err.message)
  }
}
