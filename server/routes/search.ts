import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { tickets, assets, knowledgeArticles, profiles } from '../../shared/schema'
import { ilike, or, and, eq } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q || q.length < 2) return res.json({ tickets: [], assets: [], articles: [], employees: [] })

    const pat = `%${q}%`

    const [ticketResults, assetResults, articleResults, employeeResults] = await Promise.all([
      db.select({ id: tickets.id, title: tickets.title, status: tickets.status, priority: tickets.priority, category: tickets.category })
        .from(tickets)
        .where(or(ilike(tickets.title, pat), ilike(tickets.description, pat), ilike(tickets.category, pat)))
        .limit(5),
      isAdmin(req.profile.role)
        ? db.select({ id: assets.id, name: assets.name, serial_number: assets.serial_number, brand: assets.brand, type: assets.type })
            .from(assets)
            .where(or(ilike(assets.name, pat), ilike(assets.serial_number, pat), ilike(assets.brand, pat)))
            .limit(5)
        : Promise.resolve([]),
      db.select({ id: knowledgeArticles.id, title: knowledgeArticles.title, category: knowledgeArticles.category })
        .from(knowledgeArticles)
        .where(and(
          or(ilike(knowledgeArticles.title, pat), ilike(knowledgeArticles.content, pat)),
          eq(knowledgeArticles.is_published, true)
        ))
        .limit(5),
      isAdmin(req.profile.role)
        ? db.select({ id: profiles.id, full_name: profiles.full_name, email: profiles.email, department: profiles.department, job_title: profiles.job_title })
            .from(profiles)
            .where(or(ilike(profiles.full_name, pat), ilike(profiles.email, pat)))
            .limit(5)
        : Promise.resolve([]),
    ])

    res.json({
      tickets: ticketResults,
      assets: assetResults,
      articles: articleResults,
      employees: employeeResults,
    })
  } catch (err: any) {
    console.error('GET /search error:', err)
    res.status(500).json({ error: err?.message || 'Search failed' })
  }
})

export default router
