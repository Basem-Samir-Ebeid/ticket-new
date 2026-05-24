import { Router } from 'express'
import { requireAuth } from '../auth'
import { db } from '../db'
import { knowledgeArticles } from '../../shared/schema'
import { eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
})

const router = Router()

router.post('/suggest', requireAuth as any, async (req: any, res) => {
  try {
    const { title, description } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })

    const hasAI = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!hasAI) return res.status(503).json({ error: 'AI suggestions are not configured' })

    const articles = await db.select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      category: knowledgeArticles.category,
      tags: knowledgeArticles.tags,
    }).from(knowledgeArticles).where(eq(knowledgeArticles.is_published, true))

    const articleList = articles.slice(0, 30).map(a =>
      `ID: ${a.id} | Title: ${a.title} | Category: ${a.category}`
    ).join('\n')

    const prompt = `You are an IT helpdesk assistant. A ticket has been submitted with the following details:

Title: ${title}
Description: ${description || '(no description)'}

Available knowledge base articles:
${articleList || '(none)'}

Respond ONLY with valid JSON (no markdown, no explanation) in this exact format:
{
  "priority": "urgent|high|medium|low",
  "category": "string (e.g. Hardware, Software, Network, Access, Other)",
  "tags": ["tag1", "tag2"],
  "relatedArticleIds": ["uuid1", "uuid2"],
  "reasoning": "brief 1-sentence explanation"
}`

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = (aiResponse.content[0] as any)?.text || ''

    let parsed: any
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      console.error('[AI suggest] Failed to parse AI response:', rawText)
      return res.status(502).json({ error: 'Failed to parse AI response' })
    }

    const validPriorities = ['urgent', 'high', 'medium', 'low']
    const priority = validPriorities.includes(parsed.priority) ? parsed.priority : 'medium'

    const relatedArticles = (parsed.relatedArticleIds || [])
      .filter((id: string) => articles.some(a => a.id === id))
      .slice(0, 3)
      .map((id: string) => {
        const a = articles.find(x => x.id === id)
        return { id, title: a?.title || id }
      })

    res.json({
      priority,
      category: parsed.category || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      relatedArticles,
      reasoning: parsed.reasoning || '',
    })
  } catch (err: any) {
    console.error('[AI suggest] Error:', err?.message)
    res.status(500).json({ error: err?.message || 'Failed to get AI suggestions' })
  }
})

export default router
