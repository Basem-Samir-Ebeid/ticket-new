import { db } from './db'
import { profiles, systemSettings } from '../shared/schema'
import { eq } from 'drizzle-orm'

export interface WhatsAppConfig {
  enabled: boolean
  greenapi_instance_id: string
  greenapi_token: string
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

function toGreenApiChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@c.us`
}

async function wakeGreenApiInstance(instanceId: string, token: string): Promise<void> {
  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`
    await fetch(url, { signal: AbortSignal.timeout(8000) })
    await new Promise(resolve => setTimeout(resolve, 3000))
  } catch {}
}

export async function getGreenApiState(instanceId: string, token: string): Promise<string> {
  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return 'unknown'
    const data = await res.json()
    return data?.stateInstance ?? 'unknown'
  } catch {
    return 'unreachable'
  }
}

async function sendViaGreenApi(phone: string, text: string, attempt = 1): Promise<void> {
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
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const status = res.status
    if (attempt === 1 && (status === 401 || status === 466 || status === 429)) {
      console.warn(`[WhatsApp] Instance returned ${status} on attempt 1 — waking up and retrying...`)
      await wakeGreenApiInstance(config.greenapi_instance_id, config.greenapi_token)
      return sendViaGreenApi(phone, text, 2)
    }
    throw new Error(`Green API error ${status}: ${body}`)
  }
}

async function sendViaCallMeBot(phone: string, apikey: string, text: string): Promise<void> {
  const encoded = encodeURIComponent(text)
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) {
    console.error('[WhatsApp] CallMeBot status:', res.status)
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null

export function startWhatsAppKeepAlive(): void {
  if (keepAliveTimer) return
  keepAliveTimer = setInterval(async () => {
    try {
      const config = await getWhatsAppConfig()
      if (!config.enabled || !config.greenapi_instance_id || !config.greenapi_token) return
      const state = await getGreenApiState(config.greenapi_instance_id, config.greenapi_token)
      if (state === 'sleepMode' || state === 'starting') {
        console.log(`[WhatsApp] Keep-alive: instance is "${state}" — sending wake-up ping`)
        await wakeGreenApiInstance(config.greenapi_instance_id, config.greenapi_token)
      } else {
        console.log(`[WhatsApp] Keep-alive: instance state = ${state}`)
      }
    } catch (err: any) {
      console.error('[WhatsApp] Keep-alive check failed:', err?.message)
    }
  }, 4 * 60 * 1000)
  console.log('[WhatsApp] Keep-alive started (every 4 min)')
}

export function stopWhatsAppKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
    console.log('[WhatsApp] Keep-alive stopped')
  }
}

export async function sendWhatsAppToPhone(phone: string, _apikey: string, text: string): Promise<void> {
  if (!phone) return
  await sendViaGreenApi(phone, text)
}

export async function sendWhatsAppToUser(userId: string, text: string): Promise<void> {
  try {
    const config = await getWhatsAppConfig()
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

export async function sendWhatsAppNotification(text: string): Promise<void> {
  const config = await getWhatsAppConfig()
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
