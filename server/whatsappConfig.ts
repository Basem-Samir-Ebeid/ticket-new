import { db } from './db'
import { profiles, systemSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

export interface WhatsAppConfig {
  enabled: boolean
  // Green API (primary — send to any number without recipient activation)
  greenapi_instance_id: string
  greenapi_token: string
  // Admin global notification phone
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

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  try {
    const [row] = await db.select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'whatsapp_config'))
      .limit(1)
    if (row?.value) return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export async function saveWhatsAppConfig(config: Partial<WhatsAppConfig>): Promise<WhatsAppConfig> {
  const existing = await getWhatsAppConfig()
  const merged: WhatsAppConfig = { ...existing, ...config }
  if (typeof merged.enabled !== 'boolean') {
    merged.enabled = merged.enabled === true || (merged.enabled as any) === 'true'
  }
  await db.insert(systemSettings)
    .values({ key: 'whatsapp_config', value: JSON.stringify(merged) })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(merged), updated_at: new Date() } })
  return merged
}

// Normalize phone → Green API chatId format (e.g. +201023588751 → 201023588751@c.us)
function toGreenApiChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@c.us`
}

// Send via Green API (no recipient activation needed — just add phone number)
async function sendViaGreenApi(phone: string, text: string): Promise<void> {
  const config = await getWhatsAppConfig()
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
    const config = await getWhatsAppConfig()
    console.log('[WA-DEBUG] sendWhatsAppToUser called, userId:', userId, 'enabled:', config.enabled, 'token exists:', !!config.greenapi_token)
    if (!config.enabled) {
      console.log('[WA-DEBUG] WhatsApp disabled, skipping')
      return
    }

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
  const config = await getWhatsAppConfig()
  console.log('[WA-DEBUG] sendWhatsAppNotification called, enabled:', config.enabled, 'token exists:', !!config.greenapi_token, 'phone:', config.phone)
  if (!config.enabled) {
    console.log('[WA-DEBUG] WhatsApp disabled, skipping')
    return
  }
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
