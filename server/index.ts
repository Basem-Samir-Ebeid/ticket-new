import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket, broadcast } from './ws'
import app from './app'
import { db } from './db'
import { tickets, profiles, notifications, systemSettings, factoryRotationSchedule, overtimeRotationSchedule } from '../shared/schema'
import { eq, and, lt, lte, gt, isNotNull, isNull, inArray } from 'drizzle-orm'
import { sendEmail } from './email'
import { sendWhatsAppNotification, startWhatsAppKeepAlive } from './whatsappConfig'
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

// ─── SLA Early Warning (every 15 min) ────────────────────────────────────────
async function runSlaWarnings() {
  try {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const atRiskTickets = await db.select({
      id: tickets.id, title: tickets.title, priority: tickets.priority,
      sla_deadline: tickets.sla_deadline, status: tickets.status,
      assigned_to: tickets.assigned_to,
    }).from(tickets)
      .where(and(
        isNotNull(tickets.sla_deadline),
        eq(tickets.sla_escalated, false),
        eq(tickets.sla_warned, false),
        gt(tickets.sla_deadline, new Date()),
        lte(tickets.sla_deadline, twoHoursFromNow),
      ))

    if (!atRiskTickets.length) return

    const admins = await db.select({ id: profiles.id, email: profiles.email, role: profiles.role })
      .from(profiles).where(inArray(profiles.role, ['admin', 'super_admin']))

    for (const ticket of atRiskTickets) {
      await db.update(tickets).set({ sla_warned: true }).where(eq(tickets.id, ticket.id))
      const msg = `⚠️ SLA at risk: ticket #${ticket.id.slice(0, 8)} — "${ticket.title}" will breach in less than 2 hours`

      // Notify assignee
      if (ticket.assigned_to) {
        await db.insert(notifications).values({ user_id: ticket.assigned_to, ticket_id: ticket.id, message: msg })
        broadcast(ticket.assigned_to, 'notification', { ticket_id: ticket.id, message: msg })
      }

      // Notify admins
      for (const admin of admins) {
        if (admin.id === ticket.assigned_to) continue
        await db.insert(notifications).values({ user_id: admin.id, ticket_id: ticket.id, message: msg })
        broadcast(admin.id, 'notification', { ticket_id: ticket.id, message: msg })
        sendEmail(admin.email, '⚠️ SLA Warning', `<p>${msg}</p>`).catch(() => {})
      }
    }
    if (atRiskTickets.length) console.log(`[SLA] Warned ${atRiskTickets.length} at-risk ticket(s)`)
  } catch (err) {
    console.error('[SLA warning error]', err)
  }
}

setInterval(runSlaWarnings, 15 * 60 * 1000)
setTimeout(runSlaWarnings, 45000)

// ─── Cairo time helper ────────────────────────────────────────────────────────
function shouldRunAt(hour: number, minute: number = 0): boolean {
  const now = new Date()
  const cairo = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  return cairo.getHours() === hour && cairo.getMinutes() === minute
}

// ─── Factory & Overtime Rotation crons (every 60s) ───────────────────────────
const lastRun: Record<string, string> = {}

// ─── Auto-absent job (23:55 Cairo) ───────────────────────────────────────────
async function runAbsentMarkingJob() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

    // ── Factory absences (today AND any unprocessed past days) ───────────────
    const factoryAbsent = await db
      .select({ id: factoryRotationSchedule.id, user_id: factoryRotationSchedule.user_id })
      .from(factoryRotationSchedule)
      .where(and(
        lte(factoryRotationSchedule.scheduled_date, today),
        isNull(factoryRotationSchedule.attended_at),
        eq(factoryRotationSchedule.is_absent, false),
      ))

    for (const row of factoryAbsent) {
      await db.update(factoryRotationSchedule)
        .set({ is_absent: true })
        .where(eq(factoryRotationSchedule.id, row.id))
      const msg = `❌ تم تسجيل غيابك في المصنع بتاريخ ${today}`
      await db.insert(notifications).values({ user_id: row.user_id, message: msg })
      broadcast(row.user_id, 'notification', { message: msg })
    }

    // ── Overtime absences (today AND any unprocessed past days) ──────────────
    const overtimeAbsent = await db
      .select({ id: overtimeRotationSchedule.id, user_id: overtimeRotationSchedule.user_id })
      .from(overtimeRotationSchedule)
      .where(and(
        lte(overtimeRotationSchedule.scheduled_date, today),
        isNull(overtimeRotationSchedule.attended_at),
        eq(overtimeRotationSchedule.is_absent, false),
      ))

    for (const row of overtimeAbsent) {
      await db.update(overtimeRotationSchedule)
        .set({ is_absent: true })
        .where(eq(overtimeRotationSchedule.id, row.id))
      const msg = `❌ تم تسجيل غيابك في الأوفرتايم بتاريخ ${today}`
      await db.insert(notifications).values({ user_id: row.user_id, message: msg })
      broadcast(row.user_id, 'notification', { message: msg })
    }

    // ── Admin summary ─────────────────────────────────────────────────────────
    if (factoryAbsent.length || overtimeAbsent.length) {
      const allUserIds = [...new Set([...factoryAbsent, ...overtimeAbsent].map(r => r.user_id))]
      const empRows = await db
        .select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.id, allUserIds))
      const nameMap = Object.fromEntries(empRows.map(e => [e.id, e.full_name || e.email]))

      const factoryNames = factoryAbsent.map(r => nameMap[r.user_id]).filter(Boolean)
      const overtimeNames = overtimeAbsent.map(r => nameMap[r.user_id]).filter(Boolean)

      const adminRows = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(inArray(profiles.role, ['admin', 'super_admin']))

      let adminMsg = `📋 تقرير الغياب ليوم ${today}\n`
      if (factoryNames.length) adminMsg += `🏭 مصنع: ${factoryNames.join('، ')}\n`
      if (overtimeNames.length) adminMsg += `⏱️ أوفرتايم: ${overtimeNames.join('، ')}`

      for (const admin of adminRows) {
        await db.insert(notifications).values({ user_id: admin.id, message: adminMsg })
        broadcast(admin.id, 'notification', { message: adminMsg })
      }
    }

    console.log(`[AbsentJob] Factory: ${factoryAbsent.length}, Overtime: ${overtimeAbsent.length} marked absent for ${today}`)
  } catch (err) {
    console.error('[AbsentJob error]', err)
  }
}

// ─── Startup scan: catch any historical unprocessed absences ─────────────────
setTimeout(() => {
  runAbsentMarkingJob().catch(err => console.error('[StartupAbsentScan]', err))
}, 15000)

setInterval(() => {
  const now = new Date()
  const cairo = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

  if (cairo.getHours() === 8 && !lastRun[`factory-${todayKey}`]) {
    lastRun[`factory-${todayKey}`] = '1'
    runFactoryRotationNotifications()
  }
  if (cairo.getHours() === 15 && !lastRun[`overtime-${todayKey}`]) {
    lastRun[`overtime-${todayKey}`] = '1'
    runOvertimeRotationNotifications()
  }
  if (cairo.getHours() === 23 && cairo.getMinutes() === 55 && !lastRun[`absent-${todayKey}`]) {
    lastRun[`absent-${todayKey}`] = '1'
    runAbsentMarkingJob()
  }
}, 60 * 1000)

const PORT = parseInt(process.env.PORT || '3000')
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  startWhatsAppKeepAlive()
})

export default app
