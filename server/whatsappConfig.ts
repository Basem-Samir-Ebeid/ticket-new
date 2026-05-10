import fs from 'fs'
import path from 'path'

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

export async function sendWhatsAppNotification(text: string): Promise<void> {
  const config = getWhatsAppConfig()
  if (!config.enabled || !config.phone || !config.apikey) return
  try {
    const encoded = encodeURIComponent(text)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phone}&text=${encoded}&apikey=${config.apikey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      console.error('[WhatsApp] CallMeBot returned status:', res.status)
    }
  } catch (err: any) {
    console.error('[WhatsApp] Failed to send notification:', err?.message)
  }
}
