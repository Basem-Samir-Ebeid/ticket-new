import { Router } from 'express'
import { requireAuth } from '../auth'
import fs from 'fs'
import path from 'path'

const router = Router()

router.get('/', requireAuth as any, async (req: any, res) => {
  if (req.profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin only' })
  }
  try {
    const statusFile = path.join(process.cwd(), '.github-sync-status')
    if (!fs.existsSync(statusFile)) {
      return res.json({ result: null, timestamp: null, message: 'No sync has run yet' })
    }
    const raw = fs.readFileSync(statusFile, 'utf8').trim()
    const match = raw.match(/^\[([^\]]+)\]\s+(\w+):\s+(.+)$/)
    if (!match) {
      return res.json({ result: null, timestamp: null, message: raw })
    }
    const [, timestamp, result, message] = match
    return res.json({ result, timestamp, message })
  } catch (err: any) {
    console.error('[github-sync-status] Failed to read status file:', err)
    res.status(500).json({ error: err?.message || 'Internal error' })
  }
})

export default router
