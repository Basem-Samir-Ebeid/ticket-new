import fs from 'fs'
import path from 'path'
import { db } from './db'
import { profiles } from '../shared/schema'
import { eq } from 'drizzle-orm'

const CONFIG_FILE = path.join(process.cwd(), 'server', 'whatsapp-config.json')

export interface WhatsAppConfig {
  enabled: boolean
  // Green API (primary — send to any number without recipient activation)
  greenapi_instance_id: string
  greenapi_token: string
  // CallMeBot (legacy admin-only global notification)
  phone: string
  apikey: string
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  enabled: false,
  greenapi_instance_id: '',
  greenapi_token: '',
  phone: '',
  apikey: '',
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

// Normalize phone → Green API chatId format (e.g. +201023588751 → 201023588751@c.us)
function toGreenApiChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@c.us`
}

// Send via Green API (no recipient activation needed — just add phone number)
async function sendViaGreenApi(phone: string, text: string): Promise<void> {
  const config = getWhatsAppConfig()
  if (!config.greenapi_instance_id || !config.greenapi_token) {
    throw new Error('Green API غير مُفعَّل — يرجى إدخال Instance ID و Token في الإعدادات')
  }
  const chatId = toGreenApiChatId(phone)
  const url = `https://api.green-api.com/waInstance${config.greenapi_instance_id}/sendMessage/${config.greenapi_token}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: text }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Green API error ${res.status}: ${body}`)
  }
}

// Legacy CallMeBot (kept for backward compat — admin global notifications)
async function sendViaCallMeBot(phone: string, apikey: string, text: string): Promise<void> {
  const encoded = encodeURIComponent(text)
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    console.error('[WhatsApp] CallMeBot status:', res.status)
  }
}

// Send to a specific phone number via Green API
export async function sendWhatsAppToPhone(phone: string, _apikey: string, text: string): Promise<void> {
  if (!phone) return
  await sendViaGreenApi(phone, text)
}

// Send to a specific user (only needs whatsapp_phone in profile)
export async function sendWhatsAppToUser(userId: string, text: string): Promise<void> {
  try {
    const config = getWhatsAppConfig()
    if (!config.enabled) return

    const [prof] = await db.select({
      whatsapp_phone: profiles.whatsapp_phone,
    }).from(profiles).where(eq(profiles.id, userId)).limit(1)

    if (!prof?.whatsapp_phone) return
    await sendViaGreenApi(prof.whatsapp_phone, text)
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send to user:', userId, err?.message)
  }
}

// Legacy: global admin notification (tries Green API first, falls back to CallMeBot)
export async function sendWhatsAppNotification(text: string): Promise<void> {
  const config = getWhatsAppConfig()
  if (!config.enabled) return
  try {
    if (config.greenapi_instance_id && config.greenapi_token && config.phone) {
      await sendViaGreenApi(config.phone, text)
    } else if (config.phone && config.apikey) {
      await sendViaCallMeBot(config.phone, config.apikey, text)
    }
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send admin notification:', err?.message)
  }
}
