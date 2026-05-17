import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './ws'
import app from './app'
import { db } from './db'
import { tickets, profiles, notifications, systemSettings } from '../shared/schema'
import { eq, and, lt, isNotNull, inArray } from 'drizzle-orm'
import { broadcast } from './ws'
import { sendEmail } from './email'
import { sendWhatsAppNotification } from './whatsappConfig'
import { runFactoryRotationNotifications } from './routes/factory-rotation'
import { runOvertimeRotationNotifications } from './routes/overtime-rotation'

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Server error (staying alive):', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Unhandled promise rejection (staying alive):', reason)
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

setupWebSocket(wss)

// ─── SLA Escalation (every 15 min) ───────────────────────────────────────────
async function runSlaEscalation() {
  try {
    const slaKeys = ['sla_urgent', 'sla_high', 'sla_medium', 'sla_low']
    const slaRows = await db.select().from(systemSettings).where(inArray(systemSettings.key, slaKeys))
    const slaHours: Record<string, number> = { sla_urgent: 4, sla_high: 24, sla_medium: 72, sla_low: 120 }
    for (const row of slaRows) slaHours[row.key] = Number(row.value)

    const breachedTickets = await db.select({
      id: tickets.id, title: tickets.title, priority: tickets.priority,
      sla_deadline: tickets.sla_deadline, status: tickets.status,
      created_by: tickets.created_by, assigned_to: tickets.assigned_to,
    }).from(tickets)
      .where(and(
        isNotNull(tickets.sla_deadline),
        eq(tickets.sla_escalated, false),
        lt(tickets.sla_deadline, new Date()),
      ))

    if (!breachedTickets.length) return

    const admins = await db.select({ id: profiles.id, email: profiles.email, role: profiles.role })
      .from(profiles)
      .where(inArray(profiles.role, ['admin', 'super_admin']))

    for (const ticket of breachedTickets) {
      await db.update(tickets).set({ sla_escalated: true }).where(eq(tickets.id, ticket.id))
      const msg = `SLA breached: ticket #${ticket.id.slice(0, 8)} — ${ticket.title}`
      for (const admin of admins) {
        await db.insert(notifications).values({ user_id: admin.id, ticket_id: ticket.id, message: msg })
        broadcast(admin.id, 'notification', { ticket_id: ticket.id, message: msg })
        sendEmail(admin.email, 'SLA Breach Alert', `<p>${msg}</p>`).catch(() => {})
      }
      sendWhatsAppNotification(`⚠️ SLA Breach: ${ticket.title}`).catch(() => {})
    }
    if (breachedTickets.length) console.log(`[SLA] Escalated ${breachedTickets.length} ticket(s)`)
  } catch (err) {
    console.error('[SLA escalation error]', err)
  }
}

setInterval(runSlaEscalation, 15 * 60 * 1000)
setTimeout(runSlaEscalation, 30000)

// ─── Cairo time helper ────────────────────────────────────────────────────────
function shouldRunAt(hour: number, minute: number = 0): boolean {
  const now = new Date()
  const cairo = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return cairo.getHours() === hour && cairo.getMinutes() === minute
}

// ─── Factory & Overtime Rotation crons (every 60s) ───────────────────────────
setInterval(() => {
  if (shouldRunAt(8)) runFactoryRotationNotifications()
  if (shouldRunAt(15)) runOvertimeRotationNotifications()
}, 60 * 1000)

const PORT = parseInt(process.env.PORT || '3000')
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
