import fs from 'fs'
import path from 'path'
import { db } from './db'
import { profiles } from '../shared/schema'
import { eq } from 'drizzle-orm'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'whatsapp-config.json')

export interface WhatsAppConfig {
  phone: string
  apikey: string
  enabled: boolean
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  phone: '',
  apikey: '',
  enabled: false,
}

export function getWhatsAppConfig(): WhatsAppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveWhatsAppConfig(config: Partial<WhatsAppConfig>): WhatsAppConfig {
  const existing = getWhatsAppConfig()
  const merged: WhatsAppConfig = { ...existing, ...config }
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8')
  } catch (err) {
    console.error('[whatsappConfig] Failed to save config:', err)
  }
  return merged
}

async function callMeBot(phone: string, apikey: string, text: string): Promise<void> {
  const encoded = encodeURIComponent(text)
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    console.error('[WhatsApp] CallMeBot status:', res.status, 'phone:', phone)
  }
}

// Send to admin global number
export async function sendWhatsAppNotification(text: string): Promise<void> {
  const config = getWhatsAppConfig()
  if (!config.enabled || !config.phone || !config.apikey) return
  try {
    await callMeBot(config.phone, config.apikey, text)
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send admin notification:', err?.message)
  }
}

// Send to a specific user by userId (uses their whatsapp_phone + whatsapp_apikey from profile)
export async function sendWhatsAppToUser(userId: string, text: string): Promise<void> {
  try {
    const [prof] = await db.select({
      whatsapp_phone: profiles.whatsapp_phone,
      whatsapp_apikey: profiles.whatsapp_apikey,
    }).from(profiles).where(eq(profiles.id, userId)).limit(1)

    if (!prof?.whatsapp_phone || !prof?.whatsapp_apikey) return
    await callMeBot(prof.whatsapp_phone, prof.whatsapp_apikey, text)
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send to user:', userId, err?.message)
  }
}

// Send to a specific phone+apikey directly
export async function sendWhatsAppToPhone(phone: string, apikey: string, text: string): Promise<void> {
  if (!phone || !apikey) return
  try {
    await callMeBot(phone, apikey, text)
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send to phone:', phone, err?.message)
  }
}
