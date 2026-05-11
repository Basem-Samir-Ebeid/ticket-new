import { Router } from 'express'
import { db } from '../db'
import { assets, assetHistory, profiles, notifications, tickets } from '../../shared/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../auth'
import { broadcast, broadcastAll } from '../ws'

const router = Router()

async function logHistory(
  asset_id: string,
  changed_by: string | null,
  changed_by_name: string,
  action: string,
  description: string,
  old_value?: string,
  new_value?: string
) {
  await db.insert(assetHistory).values({
    asset_id,
    changed_by,
    changed_by_name,
    action,
    description,
    old_value: old_value ?? null,
    new_value: new_value ?? null,
  })
}

// GET /api/assets — list all assets with assigned user info
router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(assets).orderBy(desc(assets.created_at))
    const allProfiles = await db.select({
      id: profiles.id,
      full_name: profiles.full_name,
      email: profiles.email,
      profile_picture_url: profiles.profile_picture_url,
      role: profiles.role,
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    res.json(rows.map(a => ({
      ...a,
      assigned_user: a.assigned_to ? profileMap.get(a.assigned_to) || null : null,
      created_by_user: a.created_by ? profileMap.get(a.created_by) || null : null,
    })))
  } catch (err: any) {
    console.error('GET /assets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get assets' })
  }
})

// GET /api/assets/stats — summary stats
router.get('/stats', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(assets)
    const total = rows.length
    const active = rows.filter(a => a.status === 'active').length
    const maintenance = rows.filter(a => a.status === 'under_maintenance').length
    const retired = rows.filter(a => a.status === 'retired').length
    const lost = rows.filter(a => a.status === 'lost').length
    const assigned = rows.filter(a => a.assigned_to !== null).length
    const unassigned = rows.filter(a => a.assigned_to === null).length
    const warrantyExpiringSoon = rows.filter(a => {
      if (!a.warranty_expires) return false
      const diff = new Date(a.warranty_expires).getTime() - Date.now()
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
    }).length
    const warrantyExpired = rows.filter(a => {
      if (!a.warranty_expires) return false
      return new Date(a.warranty_expires).getTime() < Date.now()
    }).length
    res.json({ total, active, maintenance, retired, lost, assigned, unassigned, warrantyExpiringSoon, warrantyExpired })
  } catch (err: any) {
    console.error('GET /assets/stats error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get stats' })
  }
})

// GET /api/assets/:id — single asset with history
router.get('/:id', requireAuth as any, async (req: any, res) => {
  try {
    const [asset] = await db.select().from(assets).where(eq(assets.id, req.params.id))
    if (!asset) return res.status(404).json({ error: 'Asset not found' })
    const history = await db.select().from(assetHistory)
      .where(eq(assetHistory.asset_id, req.params.id))
      .orderBy(desc(assetHistory.created_at))
    const allProfiles = await db.select({
      id: profiles.id,
      full_name: profiles.full_name,
      email: profiles.email,
      profile_picture_url: profiles.profile_picture_url,
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    res.json({
      ...asset,
      assigned_user: asset.assigned_to ? profileMap.get(asset.assigned_to) || null : null,
      created_by_user: asset.created_by ? profileMap.get(asset.created_by) || null : null,
      history,
    })
  } catch (err: any) {
    console.error('GET /assets/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get asset' })
  }
})

// Middleware: allow admins OR users with can_view_assets permission
function requireAdminOrCanViewAssets(req: any, res: any, next: any) {
  const p = req.profile
  if (!p) return res.status(401).json({ error: 'Unauthorized' })
  if (p.role === 'admin' || p.role === 'super_admin' || p.can_view_assets) return next()
  return res.status(403).json({ error: 'Access denied' })
}

// POST /api/assets — create asset (admin or user with can_view_assets)
router.post('/', requireAuth as any, requireAdminOrCanViewAssets, async (req: any, res) => {
  try {
    const {
      name, type, serial_number, brand, model, status, condition,
      purchase_date, warranty_expires, purchase_price, location, notes, image_url, assigned_to,
    } = req.body
    if (!name) return res.status(400).json({ error: 'Asset name is required' })
    const [asset] = await db.insert(assets).values({
      name,
      type: type || 'other',
      serial_number: serial_number || null,
      brand: brand || null,
      model: model || null,
      status: status || 'active',
      condition: condition || 'good',
      purchase_date: purchase_date || null,
      warranty_expires: warranty_expires || null,
      purchase_price: purchase_price ? parseFloat(purchase_price) : null,
      location: location || null,
      notes: notes || null,
      image_url: image_url || null,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
    }).returning()

    const actorName = req.profile.full_name || req.profile.email
    await logHistory(asset.id, req.user.id, actorName, 'created', `Asset "${name}" was added to the inventory`)

    if (assigned_to) {
      const [assignedUser] = await db.select().from(profiles).where(eq(profiles.id, assigned_to))
      if (assignedUser) {
        await logHistory(asset.id, req.user.id, actorName, 'assigned',
          `Assigned to ${assignedUser.full_name || assignedUser.email}`,
          null, assignedUser.full_name || assignedUser.email)
        const [notif] = await db.insert(notifications).values({
          user_id: assigned_to,
          message: `🖥️ تم تعيين أصل جديد لك: "${name}"`,
        }).returning()
        broadcast(assigned_to, 'notification', notif)
      }
    }

    broadcastAll('asset_update', { action: 'created', asset_id: asset.id })
    res.json(asset)
  } catch (err: any) {
    console.error('POST /assets error:', err)
    if (err.code === '23505') return res.status(400).json({ error: 'Serial number already exists' })
    res.status(500).json({ error: err?.message || 'Failed to create asset' })
  }
})

// PATCH /api/assets/:id — update asset (admin or user with can_view_assets)
router.patch('/:id', requireAuth as any, requireAdminOrCanViewAssets, async (req: any, res) => {
  try {
    const [existing] = await db.select().from(assets).where(eq(assets.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Asset not found' })

    const {
      name, type, serial_number, brand, model, status, condition,
      purchase_date, warranty_expires, purchase_price, location, notes, image_url, assigned_to,
    } = req.body

    const actorName = req.profile.full_name || req.profile.email
    const historyEntries: Parameters<typeof logHistory>[] = []

    if (status && status !== existing.status) {
      historyEntries.push([existing.id, req.user.id, actorName, 'status_changed',
        `Status changed from "${existing.status}" to "${status}"`, existing.status, status])
    }
    if (condition && condition !== existing.condition) {
      historyEntries.push([existing.id, req.user.id, actorName, 'condition_changed',
        `Condition changed from "${existing.condition}" to "${condition}"`, existing.condition, condition])
    }

    const newAssignedTo = assigned_to === '' ? null : (assigned_to ?? existing.assigned_to)
    if (newAssignedTo !== existing.assigned_to) {
      if (!newAssignedTo && existing.assigned_to) {
        const [prev] = await db.select().from(profiles).where(eq(profiles.id, existing.assigned_to))
        historyEntries.push([existing.id, req.user.id, actorName, 'unassigned',
          `Unassigned from ${prev?.full_name || prev?.email || 'user'}`,
          prev?.full_name || prev?.email, null])
      } else if (newAssignedTo) {
        const [newUser] = await db.select().from(profiles).where(eq(profiles.id, newAssignedTo))
        if (newUser) {
          historyEntries.push([existing.id, req.user.id, actorName, 'assigned',
            `Assigned to ${newUser.full_name || newUser.email}`,
            existing.assigned_to || null, newUser.full_name || newUser.email])
          const [notif] = await db.insert(notifications).values({
            user_id: newAssignedTo,
            message: `🖥️ تم تعيين أصل لك: "${name || existing.name}"`,
          }).returning()
          broadcast(newAssignedTo, 'notification', notif)
        }
      }
    }

    if (name && name !== existing.name) {
      historyEntries.push([existing.id, req.user.id, actorName, 'renamed',
        `Renamed from "${existing.name}" to "${name}"`, existing.name, name])
    }

    const [updated] = await db.update(assets).set({
      name: name ?? existing.name,
      type: type ?? existing.type,
      serial_number: serial_number !== undefined ? serial_number || null : existing.serial_number,
      brand: brand !== undefined ? brand || null : existing.brand,
      model: model !== undefined ? model || null : existing.model,
      status: status ?? existing.status,
      condition: condition ?? existing.condition,
      purchase_date: purchase_date !== undefined ? purchase_date || null : existing.purchase_date,
      warranty_expires: warranty_expires !== undefined ? warranty_expires || null : existing.warranty_expires,
      purchase_price: purchase_price !== undefined ? (purchase_price ? parseFloat(purchase_price) : null) : existing.purchase_price,
      location: location !== undefined ? location || null : existing.location,
      notes: notes !== undefined ? notes || null : existing.notes,
      image_url: image_url !== undefined ? image_url || null : existing.image_url,
      assigned_to: newAssignedTo,
      updated_at: new Date(),
    }).where(eq(assets.id, req.params.id)).returning()

    for (const entry of historyEntries) {
      await logHistory(...entry)
    }
    if (historyEntries.length === 0) {
      await logHistory(existing.id, req.user.id, actorName, 'updated', `Asset details were updated`)
    }

    broadcastAll('asset_update', { action: 'updated', asset_id: updated.id })
    res.json(updated)
  } catch (err: any) {
    console.error('PATCH /assets/:id error:', err)
    if (err.code === '23505') return res.status(400).json({ error: 'Serial number already exists' })
    res.status(500).json({ error: err?.message || 'Failed to update asset' })
  }
})

// DELETE /api/assets/:id — delete asset (admin only)
router.delete('/:id', requireAuth as any, requireAdmin as any, async (req: any, res) => {
  try {
    const [existing] = await db.select().from(assets).where(eq(assets.id, req.params.id))
    if (!existing) return res.status(404).json({ error: 'Asset not found' })
    await db.delete(assets).where(eq(assets.id, req.params.id))
    broadcastAll('asset_update', { action: 'deleted', asset_id: req.params.id })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /assets/:id error:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete asset' })
  }
})

// GET /api/assets/:id/tickets — tickets linked to this asset
router.get('/:id/tickets', requireAuth as any, async (req: any, res) => {
  try {
    const rows = await db.select().from(tickets)
      .where(eq(tickets.asset_id, req.params.id))
      .orderBy(desc(tickets.created_at))
    const allProfiles = await db.select({
      id: profiles.id, full_name: profiles.full_name, email: profiles.email
    }).from(profiles)
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))
    res.json(rows.map(t => ({
      ...t,
      created_by_profile: profileMap.get(t.created_by) || null,
      assigned_to_profile: profileMap.get(t.assigned_to) || null,
    })))
  } catch (err: any) {
    console.error('GET /assets/:id/tickets error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get tickets' })
  }
})

// GET /api/assets/:id/history — asset history
router.get('/:id/history', requireAuth as any, async (req: any, res) => {
  try {
    const history = await db.select().from(assetHistory)
      .where(eq(assetHistory.asset_id, req.params.id))
      .orderBy(desc(assetHistory.created_at))
    res.json(history)
  } catch (err: any) {
    console.error('GET /assets/:id/history error:', err)
    res.status(500).json({ error: err?.message || 'Failed to get history' })
  }
})

export default router
