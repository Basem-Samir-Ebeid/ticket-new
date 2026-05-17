import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { onboardingTasks } from '../../shared/schema'
import { eq, and } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

const DEFAULT_ONBOARDING = [
  'Create email account',
  'Assign laptop/device',
  'Set up system access',
  'Create necessary accounts',
  'Give office tour',
  'Complete HR paperwork',
]

const DEFAULT_OFFBOARDING = [
  'Retrieve all assigned assets',
  'Revoke system access',
  'Archive email account',
  'Final attendance report',
  'Process final paycheck',
  'Return office keys/badge',
]

export async function createOnboardingTasks(userId: string, type: 'onboarding' | 'offboarding' = 'onboarding') {
  const templates = type === 'onboarding' ? DEFAULT_ONBOARDING : DEFAULT_OFFBOARDING
  const tasks = templates.map(task_name => ({
    user_id: userId,
    task_name,
    task_type: type,
  }))
  await db.insert(onboardingTasks).values(tasks)
}

router.get('/:userId', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role) && req.user.id !== req.params.userId) return res.status(403).json({ error: 'Forbidden' })
    const tasks = await db.select().from(onboardingTasks).where(eq(onboardingTasks.user_id, req.params.userId))
    res.json(tasks)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load tasks' })
  }
})

router.post('/:userId/generate', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { type = 'onboarding' } = req.body
    await createOnboardingTasks(req.params.userId, type as any)
    const tasks = await db.select().from(onboardingTasks).where(eq(onboardingTasks.user_id, req.params.userId))
    res.json(tasks)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate tasks' })
  }
})

router.post('/:userId', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { task_name, task_type, due_date } = req.body
    if (!task_name) return res.status(400).json({ error: 'task_name required' })
    const [task] = await db.insert(onboardingTasks).values({
      user_id: req.params.userId,
      task_name,
      task_type: task_type || 'onboarding',
      due_date: due_date || null,
    }).returning()
    res.json(task)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create task' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { completed, notes } = req.body
    const updates: any = {}
    if (completed !== undefined) {
      updates.completed = Boolean(completed)
      updates.completed_by = completed ? req.user.id : null
      updates.completed_at = completed ? new Date() : null
    }
    if (notes !== undefined) updates.notes = notes

    const [task] = await db.update(onboardingTasks).set(updates).where(eq(onboardingTasks.id, req.params.id)).returning()
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update task' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(onboardingTasks).where(eq(onboardingTasks.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete task' })
  }
})

export default router
