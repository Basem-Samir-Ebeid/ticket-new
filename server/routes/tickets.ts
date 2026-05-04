import { Router } from 'express'
import { db } from '../db'
import { tickets, ticketReplies, profiles, notifications } from '../../shared/schema'
import { eq, and, desc, or } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'
import { sendPushToAdmins } from './push'

const router = Router()

// Helper to join profiles
async function withProfiles(rows: any[]) {
  const allProfiles = await db.select({
    id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
  }).from(profiles)
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))

  return rows.map(t => ({
    ...t,
    created_by_profile: profileMap.get(t.created_by) || null,
    assigned_to_profile: profileMap.get(t.assigned_to) || null,
  }))
}

const isAdminRole = (role: string) => role === 'admin' || role === 'super_admin'

// GET tickets (not requests)
router.get('/', requireAuth as any, async (req: any, res) => {
  let rows
  if (isAdminRole(req.profile.role)) {
    rows = await db.select().from(tickets).where(eq(tickets.is_request, false)).orderBy(desc(tickets.created_at))
  } else {
    rows = await db.select().from(tickets)
      .where(and(
        or(eq(tickets.assigned_to, req.user.id), eq(tickets.created_by, req.user.id)),
        eq(tickets.is_request, false)
      ))
      .orderBy(desc(tickets.created_at))
  }
  res.json(await withProfiles(rows))
})

// GET requests
router.get('/requests', requireAuth as any, async (req: any, res) => {
  let rows
  if (isAdminRole(req.profile.role)) {
    rows = await db.select().from(tickets).where(eq(tickets.is_request, true)).orderBy(desc(tickets.created_at))
  } else {
    rows = await db.select().from(tickets)
      .where(and(eq(tickets.created_by, req.user.id), eq(tickets.is_request, true)))
      .orderBy(desc(tickets.created_at))
  }
  res.json(await withProfiles(rows))
})

// POST ticket
router.post('/', requireAuth as any, async (req: any, res) => {
  const { title, description, affected_person, assigned_to, status, is_request } = req.body
  const now = new Date()
  const [ticket] = await db.insert(tickets).values({
    title,
    description: description || null,
    affected_person: affected_person || null,
    assigned_to: assigned_to || null,
    created_by: req.user.id,
    status: status || 'opened',
    is_request: is_request || false,
    request_status: is_request ? 'pending_review' : null,
    opened_at: now,
    pending_at: status === 'pending' ? now : null,
    solved_at: status === 'solved' ? now : null,
  }).returning()

  // Notify admins and super_admins if it's a member request
  if (is_request) {
    const adminProfiles = await db.select({ id: profiles.id, role: profiles.role }).from(profiles)
    const adminTargets = adminProfiles.filter(p => isAdminRole(p.role))
    for (const admin of adminTargets) {
      const [notif] = await db.insert(notifications).values({
        user_id: admin.id,
        ticket_id: ticket.id,
        message: `📝 New ticket request: ${title}`,
      }).returning()
      broadcast(admin.id, 'notification', notif)
    }
    sendPushToAdmins('📝 New Ticket Request', title, '/')
  } else {
    sendPushToAdmins('🎫 New Ticket', title, '/')
  }

  broadcastAll('ticket_update', { action: 'created', ticket_id: ticket.id, is_request: ticket.is_request })
  res.json(ticket)
})

// PATCH ticket
router.patch('/:id', requireAuth as any, async (req: any, res) => {
  const { status, request_status, assigned_to, is_request, opened_at, review } = req.body
  const updates: any = {}
  if (status !== undefined) {
    updates.status = status
    if (status === 'pending') updates.pending_at = new Date()
    if (status === 'solved') updates.solved_at = new Date()
  }
  if (request_status !== undefined) updates.request_status = request_status
  if (assigned_to !== undefined) updates.assigned_to = assigned_to
  if (is_request !== undefined) updates.is_request = is_request
  if (opened_at !== undefined) updates.opened_at = opened_at
  if (review !== undefined) updates.review = review

  const [ticket] = await db.update(tickets).set(updates).where(eq(tickets.id, req.params.id)).returning()
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  broadcastAll('ticket_update', { action: 'updated', ticket_id: ticket.id, status: ticket.status })
  res.json(ticket)
})

// DELETE ticket
router.delete('/:id', requireAuth as any, async (req: any, res) => {
  await db.delete(tickets).where(eq(tickets.id, req.params.id))
  broadcastAll('ticket_update', { action: 'deleted', ticket_id: req.params.id })
  res.json({ success: true })
})

// Accept request
router.post('/:id/accept', requireAuth as any, async (req: any, res) => {
  const { assigned_to } = req.body
  const [ticket] = await db.update(tickets).set({
    request_status: 'accepted',
    assigned_to,
    is_request: false,
    opened_at: new Date(),
  }).where(eq(tickets.id, req.params.id)).returning()

  if (ticket?.created_by) {
    const [notif] = await db.insert(notifications).values({
      user_id: ticket.created_by,
      ticket_id: ticket.id,
      message: `✅ Your ticket request "${ticket.title}" has been accepted and assigned.`,
    }).returning()
    broadcast(ticket.created_by, 'notification', notif)
  }

  broadcastAll('ticket_update', { action: 'accepted', ticket_id: ticket?.id })
  res.json(ticket)
})

// Refuse request
router.post('/:id/refuse', requireAuth as any, async (req: any, res) => {
  const [ticket] = await db.update(tickets).set({ request_status: 'refused' })
    .where(eq(tickets.id, req.params.id)).returning()

  if (ticket?.created_by) {
    const [notif] = await db.insert(notifications).values({
      user_id: ticket.created_by,
      ticket_id: ticket.id,
      message: `❌ Your ticket request "${ticket.title}" has been refused by the admin.`,
    }).returning()
    broadcast(ticket.created_by, 'notification', notif)
  }

  broadcastAll('ticket_update', { action: 'refused', ticket_id: ticket?.id })
  res.json(ticket)
})

// GET replies
router.get('/:id/replies', requireAuth as any, async (req: any, res) => {
  const rows = await db.select().from(ticketReplies)
    .where(eq(ticketReplies.ticket_id, req.params.id))
    .orderBy(ticketReplies.created_at)

  const allProfiles = await db.select({ id: profiles.id, full_name: profiles.full_name }).from(profiles)
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))

  res.json(rows.map(r => ({ ...r, profiles: profileMap.get(r.user_id) || null })))
})

// POST reply
router.post('/:id/replies', requireAuth as any, async (req: any, res) => {
  const { message, image_url } = req.body
  const [reply] = await db.insert(ticketReplies).values({
    ticket_id: req.params.id,
    user_id: req.user.id,
    message: message || null,
    image_url: image_url || null,
  }).returning()

  // Notify ticket creator
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, req.params.id))
  if (ticket?.created_by && ticket.created_by !== req.user.id) {
    const [notif] = await db.insert(notifications).values({
      user_id: ticket.created_by,
      message: `New reply on ticket: ${ticket.title}`,
      ticket_id: ticket.id,
    }).returning()
    broadcast(ticket.created_by, 'notification', notif)
  }

  broadcastAll('ticket_reply', { ticket_id: req.params.id, reply_id: reply.id })
  res.json(reply)
})

export default router
