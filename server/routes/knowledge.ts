import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { knowledgeArticles, profiles } from '../../shared/schema'
import { eq, ilike, or, sql } from 'drizzle-orm'

const router = Router()
const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'

router.get('/', requireAuth as any, async (req: any, res) => {
  try {
    const { search, category } = req.query
    let query = db.select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      category: knowledgeArticles.category,
      tags: knowledgeArticles.tags,
      views_count: knowledgeArticles.views_count,
      helpful_count: knowledgeArticles.helpful_count,
      not_helpful_count: knowledgeArticles.not_helpful_count,
      is_published: knowledgeArticles.is_published,
      created_by: knowledgeArticles.created_by,
      created_at: knowledgeArticles.created_at,
      updated_at: knowledgeArticles.updated_at,
    }).from(knowledgeArticles)

    const articles = await query.orderBy(sql`${knowledgeArticles.updated_at} DESC`)

    let filtered = articles
    if (!isAdmin(req.profile.role)) {
      filtered = filtered.filter(a => a.is_published)
    }
    if (search) {
      const q = String(search).toLowerCase()
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      )
    }
    if (category) {
      filtered = filtered.filter(a => a.category === category)
    }

    res.json(filtered)
  } catch (err: any) {
    console.error('GET /knowledge error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load articles' })
  }
})

router.get('/categories', requireAuth as any, async (_req, res) => {
  try {
    const articles = await db.select({ category: knowledgeArticles.category }).from(knowledgeArticles)
    const cats = [...new Set(articles.map(a => a.category).filter(Boolean))]
    res.json(cats)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load categories' })
  }
})

router.get('/:id', requireAuth as any, async (req: any, res) => {
  try {
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, req.params.id))
    if (!article) return res.status(404).json({ error: 'Article not found' })
    if (!article.is_published && !isAdmin(req.profile.role)) return res.status(403).json({ error: 'Not published' })

    // Increment views
    await db.update(knowledgeArticles)
      .set({ views_count: (article.views_count || 0) + 1 })
      .where(eq(knowledgeArticles.id, req.params.id))

    res.json({ ...article, views_count: (article.views_count || 0) + 1 })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load article' })
  }
})

router.post('/', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { title, content, category, tags, is_published } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required' })

    const [article] = await db.insert(knowledgeArticles).values({
      title: String(title).trim(),
      content: content || '',
      category: category || 'general',
      tags: Array.isArray(tags) ? tags : [],
      is_published: Boolean(is_published),
      created_by: req.user.id,
      updated_by: req.user.id,
    }).returning()

    res.json(article)
  } catch (err: any) {
    console.error('POST /knowledge error:', err)
    res.status(500).json({ error: err?.message || 'Failed to create article' })
  }
})

router.patch('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { title, content, category, tags, is_published } = req.body
    const updates: any = { updated_by: req.user.id, updated_at: new Date() }
    if (title !== undefined) updates.title = String(title).trim()
    if (content !== undefined) updates.content = content
    if (category !== undefined) updates.category = category
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : []
    if (is_published !== undefined) updates.is_published = Boolean(is_published)

    const [article] = await db.update(knowledgeArticles).set(updates).where(eq(knowledgeArticles.id, req.params.id)).returning()
    if (!article) return res.status(404).json({ error: 'Article not found' })
    res.json(article)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update article' })
  }
})

router.delete('/:id', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete article' })
  }
})

// ─── Suggest articles for ticket creation ────────────────────────────────────
router.get('/suggest', async (req: any, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q || q.length < 2) return res.json([])
    const pattern = `%${q}%`
    const articles = await db.select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      category: knowledgeArticles.category,
    }).from(knowledgeArticles)
      .where(and(
        eq(knowledgeArticles.is_published, true),
        or(
          ilike(knowledgeArticles.title, pattern),
          ilike(knowledgeArticles.content, pattern),
        )
      ))
      .limit(3)
    res.json(articles)
  } catch (err: any) {
    res.status(500).json({ error: err?.message })
  }
})

router.post('/:id/rate', requireAuth as any, async (req: any, res) => {
  try {
    const { helpful } = req.body
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, req.params.id))
    if (!article) return res.status(404).json({ error: 'Article not found' })

    if (helpful) {
      await db.update(knowledgeArticles).set({ helpful_count: (article.helpful_count || 0) + 1 }).where(eq(knowledgeArticles.id, req.params.id))
    } else {
      await db.update(knowledgeArticles).set({ not_helpful_count: (article.not_helpful_count || 0) + 1 }).where(eq(knowledgeArticles.id, req.params.id))
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to rate article' })
  }
})

export default router
