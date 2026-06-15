import { Router } from 'express'
import { db } from '../db'
import { departments, profiles } from '../../shared/schema'
import { requireAuth, requireAdmin } from '../auth'
import { eq } from 'drizzle-orm'

const router = Router()

router.get('/', requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description,
        manager_id: departments.manager_id,
        color: departments.color,
        created_at: departments.created_at,
        manager_name: profiles.full_name,
      })
      .from(departments)
      .leftJoin(profiles, eq(profiles.id, departments.manager_id))
      .orderBy(departments.name)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { name, description, manager_id, color } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const [dept] = await db.insert(departments).values({
      name, description, manager_id: manager_id || null, color: color || '#6366f1',
    }).returning()
    res.json(dept)
  } catch (err: any) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'اسم القسم موجود بالفعل' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { name, description, manager_id, color } = req.body
    const [dept] = await db.update(departments)
      .set({ name, description, manager_id: manager_id || null, color })
      .where(eq(departments.id, req.params.id))
      .returning()
    if (!dept) return res.status(404).json({ error: 'Department not found' })
    res.json(dept)
  } catch (err: any) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'اسم القسم موجود بالفعل' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    await db.delete(departments).where(eq(departments.id, req.params.id))
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
