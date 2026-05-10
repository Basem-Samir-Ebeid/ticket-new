import { Router } from 'express'
import { db } from '../db'
import { tickets, ticketReplies, profiles, notifications, ticketTemplates, ticketHistory, assets } from '../../shared/schema'
import { eq, and, desc, or } from 'drizzle-orm'
import { requireAuth } from '../auth'
import { broadcast, broadcastAll } from '../ws'
import { sendPushToAdmins } from './push'
import { sendWhatsAppNotification, sendWhatsAppToUser } from '../whatsappConfig'
import { findAutoAssignUser } from '../autoAssignConfig'
import {
  notifyAdminsNewTicket,
  notifyAssigned,
  notifyStatusChanged,
  notifyTicketAccepted,
  notifyTicketRefused,
  notifyNewReply,
} from '../mailer'

const router = Router()

async function withProfiles(rows: any[]) {
  const allProfiles = await db.select({
    id: profiles.id, full_name: profiles.full_name, email: profiles.email, role: profiles.role
  }).from(profiles)
  const profileMap = new Map(allProfiles.map(p => [p.id, p]))

  const assetIds = [...new Set(rows.map(t => t.asset_id).filter(Boolean))]
  let assetMap = new Map<string, any>()
  if (assetIds.length > 0) {
    const allAssets = await db.select({ id: assets.id, name: assets.name, type: assets.type, serial_number: assets.serial_number }).from(assets)
    allAssets.forEach(a => assetMap.set(a.id, a))
  }

  return rows.map(t => ({
    ...t,
    created_by_profile: profileMap.get(t.created_by) || null,
    assigned_to_profile: profileMap.get(t.assigned_to) || null,
    asset: t.asset_id ? assetMap.get(t.asset_id) || null : null,
  }))
}

const isAdminRole = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
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
  } catch (err: any) {
    console.error('GET /tickets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get tickets' })
  }
})

router.get('/requests', requireAuth as any, async (req: any, res) => {
  try {
    let rows
    if (isAdminRole(req.profile.role)) {
      rows = await db.select().from(tickets).where(eq(tickets.is_request, true)).orderBy(desc(tickets.created_at))
    } else {
      rows = await db.select().from(tickets)
        .where(and(eq(tickets.created_by, req.user.id), eq(tickets.is_request, true)))
        .orderBy(desc(tickets.created_at))
    }
    res.json(await withProfiles(rows))
  } catch (err: any) {
    console.error('GET /tickets/requests error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get requests' })
  }
})

// ─── Templates ───────────────────────────────────────────────────────────────

router.get('/templates', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(ticketTemplates).orderBy(ticketTemplates.created_at)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get templates' })
  }
})

router.post('/templates', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { name, title, description, priority } = req.body
    if (!name?.trim() || !title?.trim()) return res.status(400).json({ error: 'Name and title are required' })
    const [tmpl] = await db.insert(ticketTemplates).values({
      name: name.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || 'medium',
      created_by: req.user.id,
    }).returning()
    res.json(tmpl)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create template' })
  }
})

router.delete('/templates/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdminRole(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(ticketTemplates).where(eq(ticketTemplates.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete template' })
  }
})

// ─── Create ticket ────────────────────────────────────────────────────────────

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    const { title, description, affected_person, status, is_request, priority, category, due_date, asset_id } = req.body
    let { assigned_to } = req.body
    const now = new Date()

    // Auto-assign: if no assignee and category has a rule, use it
    if (!assigned_to && category) {
      const autoUser = await findAutoAssignUser(category)
      if (autoUser) assigned_to = autoUser
    }

    const [ticket] = await db.insert(tickets).values({
      title,
      description: description || null,
      affected_person: affected_person || null,
      assigned_to: assigned_to || null,
      asset_id: asset_id || null,
      created_by: req.user.id,
      status: status || 'opened',
      priority: priority || 'medium',
      category: category || null,
      due_date: due_date || null,
      is_request: is_request || false,
      request_status: is_request ? 'pending_review' : null,
      opened_at: now,
      pending_at: status === 'pending' ? now : null,
      solved_at: status === 'solved' ? now : null,
    }).returning()

    const creatorName = req.profile?.full_name || req.profile?.email || 'Someone'

    // Check if linked asset is under maintenance → urgent alert to admins
    let linkedAsset: any = null
    if (asset_id) {
      const [found] = await db.select().from(assets).where(eq(assets.id, asset_id)).limit(1)
      linkedAsset = found || null
    }

    const adminProfiles = await db.select({ id: profiles.id, role: profiles.role }).from(profiles)
    const adminTargets = adminProfiles.filter(p => isAdminRole(p.role))

    if (linkedAsset?.status === 'under_maintenance') {
      for (const admin of adminTargets) {
        const [notif] = await db.insert(notifications).values({
          user_id: admin.id,
          ticket_id: ticket.id,
          message: `🔧 تنبيه: تذكرة جديدة مرتبطة بجهاز تحت الصيانة — "${linkedAsset.name}". أنشأها: ${creatorName}`,
        }).returning()
        broadcast(admin.id, 'notification', notif)
      }
      sendPushToAdmins(
        '🔧 جهاز تحت الصيانة — تذكرة عاجلة',
        `${linkedAsset.name}: ${title}`,
        '/'
      )
      sendWhatsAppNotification(`🔧 تذكرة عاجلة — جهاز تحت الصيانة\nالجهاز: ${linkedAsset.name}\nالعنوان: ${title}\nأنشأها: ${creatorName}`).catch(() => {})
    } else if (is_request) {
      for (const admin of adminTargets) {
        const [notif] = await db.insert(notifications).values({
          user_id: admin.id,
          ticket_id: ticket.id,
          message: `📝 New ticket request: ${title}`,
        }).returning()
        broadcast(admin.id, 'notification', notif)
      }
      sendPushToAdmins('📝 New Ticket Request', title, '/')
      sendWhatsAppNotification(`📝 طلب جديد على Finest IT\nالعنوان: ${title}\nأنشأه: ${creatorName}`).catch(() => {})
    } else {
      sendPushToAdmins('🎫 New Ticket', title, '/')
      sendWhatsAppNotification(`🎫 تكيت جديد على Finest IT\nالعنوان: ${title}\nأنشأه: ${creatorName}`).catch(() => {})
    }

    notifyAdminsNewTicket(ticket, creatorName).catch(() => {})
    if (assigned_to) {
      notifyAssigned(ticket, assigned_to, creatorName).catch(() => {})
    }

    broadcastAll('ticket_update', { action: 'created', ticket_id: ticket.id, is_request: ticket.is_request })
    res.json(ticket)
  } catch (err: any) {
    console.error('POST /tickets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create ticket' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    const { status, request_status, assigned_to, is_request, opened_at, review, priority, category, due_date, title, description, asset_id } = req.body
    const updates: any = {}
    const changerName = req.profile?.full_name || req.profile?.email || 'Someone'

    // Fetch existing ticket for history comparison
    const [existing] = await db.select().from(tickets).where(eq(tickets.id, req.params.id)).limit(1)
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })

    const historyEntries: any[] = []

    if (status !== undefined) {
      const isAdmin = req.profile?.role === 'admin' || req.profile?.role === 'super_admin'
      if (!isAdmin && existing.status === 'solved') {
        return res.status(403).json({ error: 'لا يمكن تغيير حالة التيكت بعد حلّه.' })
      }
      if (existing.status !== status) {
        historyEntries.push({ field: 'status', old_value: existing.status, new_value: status })
      }
      updates.status = status
      if (status === 'pending') updates.pending_at = new Date()
      if (status === 'solved') updates.solved_at = new Date()
    }
    if (request_status !== undefined) updates.request_status = request_status
    if (assigned_to !== undefined) {
      if (existing.assigned_to !== assigned_to) {
        historyEntries.push({ field: 'assigned_to', old_value: existing.assigned_to || 'unassigned', new_value: assigned_to || 'unassigned' })
      }
      updates.assigned_to = assigned_to
    }
    if (is_request !== undefined) updates.is_request = is_request
    if (opened_at !== undefined) updates.opened_at = opened_at
    if (review !== undefined) updates.review = review
    if (priority !== undefined) {
      if (existing.priority !== priority) {
        historyEntries.push({ field: 'priority', old_value: existing.priority, new_value: priority })
      }
      updates.priority = priority
    }
    if (category !== undefined) {
      if (existing.category !== category) {
        historyEntries.push({ field: 'category', old_value: existing.category || '', new_value: category || '' })
      }
      updates.category = category
    }
    if (due_date !== undefined) {
      if (existing.due_date !== due_date) {
        historyEntries.push({ field: 'due_date', old_value: existing.due_date || '', new_value: due_date || '' })
      }
      updates.due_date = due_date
    }
    if (title !== undefined) {
      if (existing.title !== title) {
        historyEntries.push({ field: 'title', old_value: existing.title, new_value: title })
      }
      updates.title = title
    }
    if (description !== undefined) {
      updates.description = description
    }
    if (asset_id !== undefined) {
      if (existing.asset_id !== asset_id) {
        historyEntries.push({ field: 'asset_id', old_value: existing.asset_id || '', new_value: asset_id || '' })
      }
      updates.asset_id = asset_id || null
    }

    const [ticket] = await db.update(tickets).set(updates).where(eq(tickets.id, req.params.id)).returning()
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    // Write history entries
    for (const entry of historyEntries) {
      await db.insert(ticketHistory).values({
        ticket_id: ticket.id,
        changed_by: req.user.id,
        changed_by_name: changerName,
        field: entry.field,
        old_value: entry.old_value,
        new_value: entry.new_value,
      }).catch(() => {})
    }

    if (status !== undefined) {
      const statusLabel = status === 'solved' ? '✅ Solved' : status === 'pending' ? '🟡 Pending' : '🔵 Opened'
      const notifMessage = `${statusLabel}: Ticket "${ticket.title}" was marked as ${status} by ${changerName}`
      const notifyIds = new Set<string>()
      if (ticket.created_by && ticket.created_by !== req.user.id) notifyIds.add(ticket.created_by)
      if (ticket.assigned_to && ticket.assigned_to !== req.user.id) notifyIds.add(ticket.assigned_to)
      for (const userId of notifyIds) {
        const [notif] = await db.insert(notifications).values({
          user_id: userId,
          ticket_id: ticket.id,
          message: notifMessage,
        }).returning()
        broadcast(userId, 'notification', notif)
        sendWhatsAppToUser(userId, `${statusLabel}\nالتيكت: "${ticket.title}"\nتم التغيير بواسطة: ${changerName}`).catch(() => {})
      }
      notifyStatusChanged(ticket, status, changerName, [...notifyIds]).catch(() => {})
    }

    if (assigned_to !== undefined && assigned_to && assigned_to !== req.user.id) {
      notifyAssigned(ticket, assigned_to, changerName).catch(() => {})
      sendWhatsAppToUser(assigned_to, `🎫 تم تعيين تيكت جديد لك\nالعنوان: "${ticket.title}"\nمن قِبل: ${changerName}`).catch(() => {})
    }

    broadcastAll('ticket_update', { action: 'updated', ticket_id: ticket.id, status: ticket.status })
    res.json(ticket)
  } catch (err: any) {
    console.error('PATCH /tickets/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to update ticket' })
  }
})

// ─── Ticket history ───────────────────────────────────────────────────────────

router.get('/:id/history', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(ticketHistory)
      .where(eq(ticketHistory.ticket_id, req.params.id))
      .orderBy(desc(ticketHistory.created_at))
    res.json(rows)
  } catch (err: any) {
    console.error('GET /tickets/:id/history error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get ticket history' })
  }
})

// ─── Rate a solved ticket ─────────────────────────────────────────────────────

router.post('/:id/rate', requireAuth as any, async (req: any, res) => {
  try {
    const { rating, rating_comment } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' })

    const [existing] = await db.select().from(tickets).where(eq(tickets.id, req.params.id)).limit(1)
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })
    if (existing.status !== 'solved') return res.status(400).json({ error: 'Can only rate solved tickets' })
    if (existing.created_by !== req.user.id) return res.status(403).json({ error: 'Only the ticket creator can rate' })
    if (existing.rating != null) return res.status(409).json({ error: 'This ticket has already been rated' })

    const [ticket] = await db.update(tickets)
      .set({ rating: Number(rating), rating_comment: rating_comment?.trim() || null })
      .where(eq(tickets.id, req.params.id))
      .returning()

    broadcastAll('ticket_update', { action: 'rated', ticket_id: ticket.id })
    res.json(ticket)
  } catch (err: any) {
    console.error('POST /tickets/:id/rate error:', err)
    res.status(500).json({ error: err?.message || 'Failed to rate ticket' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    await db.delete(tickets).where(eq(tickets.id, req.params.id))
    broadcastAll('ticket_update', { action: 'deleted', ticket_id: req.params.id })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /tickets/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete ticket' })
  }
})

router.post('/:id/accept', requireAuth as any, async (req: any, res) => {
  try {
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
      sendWhatsAppToUser(ticket.created_by, `✅ تم قبول طلبك\nالتيكت: "${ticket.title}"\nتم قبوله وإسناده`).catch(() => {})
    }

    notifyTicketAccepted(ticket).catch(() => {})

    broadcastAll('ticket_update', { action: 'accepted', ticket_id: ticket?.id })
    res.json(ticket)
  } catch (err: any) {
    console.error('POST /tickets/:id/accept error:', err)
    res.status(500).json({ error: err?.message || 'Failed to accept request' })
  }
})

router.post('/:id/refuse', requireAuth as any, async (req: any, res) => {
  try {
    const [ticket] = await db.update(tickets).set({ request_status: 'refused' })
      .where(eq(tickets.id, req.params.id)).returning()

    if (ticket?.created_by) {
      const [notif] = await db.insert(notifications).values({
        user_id: ticket.created_by,
        ticket_id: ticket.id,
        message: `❌ Your ticket request "${ticket.title}" has been refused by the admin.`,
      }).returning()
      broadcast(ticket.created_by, 'notification', notif)
      sendWhatsAppToUser(ticket.created_by, `❌ تم رفض طلبك\nالتيكت: "${ticket.title}"\nتم رفضه من قِبل الأدمن`).catch(() => {})
    }

    notifyTicketRefused(ticket).catch(() => {})

    broadcastAll('ticket_update', { action: 'refused', ticket_id: ticket?.id })
    res.json(ticket)
  } catch (err: any) {
    console.error('POST /tickets/:id/refuse error:', err)
    res.status(500).json({ error: err?.message || 'Failed to refuse request' })
  }
})

router.get('/:id/replies', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, req.params.id))
      .orderBy(ticketReplies.created_at)

    const allProfiles = await db.select({ id: profiles.id, full_name: profiles.full_name }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    res.json(rows.map(r => ({ ...r, profiles: profileMap.get(r.user_id) || null })))
  } catch (err: any) {
    console.error('GET /tickets/:id/replies error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get replies' })
  }
})

router.post('/:id/replies', requireAuth as any, async (req: any, res) => {
  try {
    const { message, image_url, attachment_name } = req.body
    if (!message && !image_url) {
      return res.status(400).json({ error: 'Reply must have a message or attachment' })
    }
    const [reply] = await db.insert(ticketReplies).values({
      ticket_id: req.params.id,
      user_id: req.user.id,
      message: message || null,
      image_url: image_url || null,
      attachment_name: attachment_name || null,
    }).returning()

    try {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, req.params.id))
      const replierName = req.profile?.full_name || req.profile?.email || 'Someone'
      const notifyIds = new Set<string>()
      if (ticket?.created_by && ticket.created_by !== req.user.id) {
        notifyIds.add(ticket.created_by)
        const [notif] = await db.insert(notifications).values({
          user_id: ticket.created_by,
          message: `New reply on ticket: ${ticket.title}`,
          ticket_id: ticket.id,
        }).returning()
        broadcast(ticket.created_by, 'notification', notif)
      }
      if (ticket?.assigned_to && ticket.assigned_to !== req.user.id) {
        notifyIds.add(ticket.assigned_to)
      }
      broadcastAll('ticket_reply', { ticket_id: req.params.id, reply_id: reply.id })
      if (ticket) {
        notifyNewReply(ticket, replierName, message || null, [...notifyIds]).catch(() => {})
      }
    } catch {}

    res.json(reply)
  } catch (err: any) {
    console.error('POST /tickets/:id/replies error:', err)
    res.status(500).json({ error: err?.message || 'Failed to post reply' })
  }
})

export default router
