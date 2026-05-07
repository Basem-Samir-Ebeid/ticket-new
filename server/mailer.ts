import nodemailer from 'nodemailer'
import { db } from './db'
import { profiles } from '../shared/schema'
import { eq, inArray } from 'drizzle-orm'

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return {
    transporter: nodemailer.createTransport({
      host, port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    }),
    from: `"Finest IT" <${process.env.SMTP_FROM || user}>`,
  }
}

function emailCard(title: string, bodyHtml: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#05050a;color:#e2e8f0;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
      <div style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed)"></div>
      <div style="padding:28px 32px">
        <div style="margin-bottom:20px">
          <span style="font-size:22px;font-weight:700;color:#fff">Finest</span>
          <span style="font-size:12px;color:#475569;margin-left:8px">IT Ticket System</span>
        </div>
        <h2 style="color:#fff;font-size:16px;margin:0 0 16px">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
        <p style="color:#334155;font-size:11px;margin:0">You received this because you are an admin or were mentioned in a ticket on the Finest IT system.</p>
      </div>
    </div>
  `
}

function row(label: string, value: string) {
  return `<tr><td style="color:#64748b;font-size:12px;padding:4px 0;width:120px">${label}</td><td style="color:#cbd5e1;font-size:12px;padding:4px 0">${value}</td></tr>`
}

export async function sendMail(to: string | string[], subject: string, html: string) {
  const smtp = createTransporter()
  if (!smtp) return
  try {
    await smtp.transporter.sendMail({ from: smtp.from, to: Array.isArray(to) ? to.join(', ') : to, subject, html })
  } catch (err: any) {
    console.error('[mailer] Failed to send email:', err.message)
  }
}

export async function getAdminEmails(): Promise<string[]> {
  const rows = await db.select({ email: profiles.email, role: profiles.role }).from(profiles)
  return rows.filter(p => p.role === 'admin' || p.role === 'super_admin').map(p => p.email)
}

export async function getProfileById(id: string) {
  const [p] = await db.select({ email: profiles.email, full_name: profiles.full_name }).from(profiles).where(eq(profiles.id, id))
  return p || null
}

// ─── Email templates ─────────────────────────────────────────────────────────

export async function notifyAdminsNewTicket(ticket: any, creatorName: string) {
  const to = await getAdminEmails()
  if (!to.length) return
  const type = ticket.is_request ? '📝 New Ticket Request' : '🎫 New Ticket'
  const html = emailCard(type, `
    <p style="color:#94a3b8;margin:0 0 16px">A new ${ticket.is_request ? 'request' : 'ticket'} has been submitted and needs your attention.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Title', ticket.title)}
      ${row('Submitted by', creatorName)}
      ${ticket.affected_person ? row('Affected person', ticket.affected_person) : ''}
      ${ticket.description ? row('Description', ticket.description.substring(0, 120) + (ticket.description.length > 120 ? '...' : '')) : ''}
      ${row('Status', ticket.status)}
    </table>
    <p style="color:#475569;font-size:12px">Log in to the system to view and manage this ticket.</p>
  `)
  await sendMail(to, `[Finest] ${type}: ${ticket.title}`, html)
}

export async function notifyAssigned(ticket: any, assignedTo: string, assignerName: string) {
  const assignedProfile = await getProfileById(assignedTo)
  if (!assignedProfile) return
  const html = emailCard('🔔 Ticket Assigned to You', `
    <p style="color:#94a3b8;margin:0 0 16px">A ticket has been assigned to you by <strong style="color:#fff">${assignerName}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Title', ticket.title)}
      ${ticket.affected_person ? row('Affected person', ticket.affected_person) : ''}
      ${ticket.description ? row('Description', ticket.description.substring(0, 120) + (ticket.description.length > 120 ? '...' : '')) : ''}
      ${row('Status', ticket.status)}
    </table>
    <p style="color:#475569;font-size:12px">Log in to the system to view and handle this ticket.</p>
  `)
  await sendMail(assignedProfile.email, `[Finest] Ticket assigned to you: ${ticket.title}`, html)
}

export async function notifyStatusChanged(ticket: any, newStatus: string, changerName: string, notifyUserIds: string[]) {
  if (!notifyUserIds.length) return
  const rows = await db.select({ id: profiles.id, email: profiles.email }).from(profiles).where(inArray(profiles.id, notifyUserIds))
  const emails = rows.map(r => r.email)
  if (!emails.length) return
  const statusLabel: Record<string, string> = { solved: '✅ Solved', pending: '🟡 Pending', opened: '🔵 Opened' }
  const label = statusLabel[newStatus] || newStatus
  const html = emailCard(`${label}: Ticket Status Updated`, `
    <p style="color:#94a3b8;margin:0 0 16px"><strong style="color:#fff">${changerName}</strong> updated the status of a ticket you're involved in.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Title', ticket.title)}
      ${row('New status', label)}
      ${row('Updated by', changerName)}
    </table>
    <p style="color:#475569;font-size:12px">Log in to the system to view the full ticket details.</p>
  `)
  await sendMail(emails, `[Finest] Ticket ${newStatus}: ${ticket.title}`, html)
}

export async function notifyTicketAccepted(ticket: any) {
  if (!ticket.created_by) return
  const creator = await getProfileById(ticket.created_by)
  if (!creator) return
  const html = emailCard('✅ Your Ticket Request Was Accepted', `
    <p style="color:#94a3b8;margin:0 0 16px">Great news! Your ticket request has been <strong style="color:#22c55e">accepted</strong> and assigned to a team member.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Title', ticket.title)}
      ${row('Status', 'Accepted & Assigned')}
    </table>
    <p style="color:#475569;font-size:12px">Log in to the system to track progress on your ticket.</p>
  `)
  await sendMail(creator.email, `[Finest] Request accepted: ${ticket.title}`, html)
}

export async function notifyTicketRefused(ticket: any) {
  if (!ticket.created_by) return
  const creator = await getProfileById(ticket.created_by)
  if (!creator) return
  const html = emailCard('❌ Your Ticket Request Was Refused', `
    <p style="color:#94a3b8;margin:0 0 16px">Your ticket request has been <strong style="color:#ef4444">refused</strong> by the admin team.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Title', ticket.title)}
    </table>
    <p style="color:#475569;font-size:12px">If you believe this is a mistake, please contact your admin directly.</p>
  `)
  await sendMail(creator.email, `[Finest] Request refused: ${ticket.title}`, html)
}

export async function notifyNewReply(ticket: any, replierName: string, message: string | null, notifyUserIds: string[]) {
  if (!notifyUserIds.length) return
  const rows = await db.select({ id: profiles.id, email: profiles.email }).from(profiles).where(inArray(profiles.id, notifyUserIds))
  const emails = rows.map(r => r.email)
  if (!emails.length) return
  const html = emailCard('💬 New Reply on Your Ticket', `
    <p style="color:#94a3b8;margin:0 0 16px"><strong style="color:#fff">${replierName}</strong> replied to a ticket you're involved in.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${row('Ticket', ticket.title)}
      ${message ? row('Message', message.substring(0, 200) + (message.length > 200 ? '...' : '')) : row('Attachment', 'File attached')}
    </table>
    <p style="color:#475569;font-size:12px">Log in to the system to read the full reply and respond.</p>
  `)
  await sendMail(emails, `[Finest] New reply on: ${ticket.title}`, html)
}
