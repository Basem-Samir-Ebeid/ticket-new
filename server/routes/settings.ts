import { Router } from 'express'
import { requireAuth } from '../auth'
import { getOfficeConfig, saveOfficeConfig } from '../officeConfig'
import { getGitHubSyncConfig, saveGitHubSyncConfig } from '../githubSyncConfig'
import { getSmtpConfig, saveSmtpConfig } from '../smtpConfig'
import { getAutoAssignConfig, saveAutoAssignConfig } from '../autoAssignConfig'
import { db } from '../db'
import { settingsLog } from '../../shared/schema'
import { desc } from 'drizzle-orm'
import { execFileSync } from 'child_process'
import https from 'https'
import nodemailer from 'nodemailer'

const router = Router()

const isAdmin = (role: string) => role === 'admin' || role === 'super_admin'
const isSuperAdmin = (role: string) => role === 'super_admin'

const ALLOWED_GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/

function validateRepoUrl(url: string): string | null {
  if (!ALLOWED_GITHUB_URL.test(url)) {
    return 'Repository URL must be an HTTPS GitHub URL (e.g. https://github.com/owner/repo.git)'
  }
  return null
}

router.get('/office-location', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    res.json(await getOfficeConfig())
  } catch (err: any) {
    console.error('GET /office-location error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load office location' })
  }
})

router.post('/office-location', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { latitude, longitude, radius_meters } = req.body
    if (latitude == null || longitude == null || radius_meters == null) {
      return res.status(400).json({ error: 'latitude, longitude, and radius_meters are required' })
    }
    const lat = Number(latitude)
    const lng = Number(longitude)
    const radius = Number(radius_meters)
    if (isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
      return res.status(400).json({ error: 'Invalid values: radius must be a positive number' })
    }

    const prev = await getOfficeConfig()
    const config = { latitude: lat, longitude: lng, radius_meters: radius }

    await db.insert(settingsLog).values({
      changed_by: req.user.id,
      changed_by_name: req.profile.full_name || req.profile.email,
      from_lat: prev.latitude,
      from_lng: prev.longitude,
      from_radius: prev.radius_meters,
      to_lat: lat,
      to_lng: lng,
      to_radius: radius,
    })

    await saveOfficeConfig(config)

    res.json(config)
  } catch (err: any) {
    console.error('POST /office-location error:', err)
    res.status(500).json({ error: err?.message || 'Failed to save office location' })
  }
})

router.get('/log', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const rows = await db.select().from(settingsLog).orderBy(desc(settingsLog.created_at)).limit(50)
    res.json(rows)
  } catch (err: any) {
    console.error('GET /log error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load settings log' })
  }
})

// ─── SMTP Settings ────────────────────────────────────────────────────────────

router.get('/smtp', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const config = getSmtpConfig()
    res.json({ ...config, password: config.password ? '••••••••' : '' })
  } catch (err: any) {
    console.error('GET /settings/smtp error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load SMTP settings' })
  }
})

router.post('/smtp', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { host, port, secure, user, password, from_name, from_email, enabled } = req.body

    const existing = getSmtpConfig()
    const updates: any = {}
    if (host !== undefined) updates.host = String(host).trim()
    if (port !== undefined) updates.port = Number(port) || 587
    if (secure !== undefined) updates.secure = Boolean(secure)
    if (user !== undefined) updates.user = String(user).trim()
    if (password !== undefined && password !== '••••••••') updates.password = String(password)
    else if (password === undefined) updates.password = existing.password
    if (from_name !== undefined) updates.from_name = String(from_name).trim()
    if (from_email !== undefined) updates.from_email = String(from_email).trim()
    if (enabled !== undefined) updates.enabled = Boolean(enabled)

    const saved = saveSmtpConfig(updates)
    res.json({ ...saved, password: saved.password ? '••••••••' : '' })
  } catch (err: any) {
    console.error('POST /settings/smtp error:', err)
    res.status(500).json({ error: err?.message || 'Failed to save SMTP settings' })
  }
})

router.post('/smtp/test', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const config = getSmtpConfig()
    const testEmail = req.body.test_email || req.profile.email

    if (!config.host || !config.user || !config.password) {
      return res.status(400).json({ error: 'SMTP host, user and password are required' })
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
    })

    await transporter.verify()
    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email || config.user}>`,
      to: testEmail,
      subject: 'Finest — SMTP Test',
      text: 'This is a test email from Finest IT Ticket System. SMTP is configured correctly.',
    })

    res.json({ ok: true, message: `Test email sent successfully to ${testEmail}` })
  } catch (err: any) {
    console.error('POST /settings/smtp/test error:', err)
    res.status(400).json({ error: err?.message || 'SMTP test failed' })
  }
})

// ─── GitHub Sync ──────────────────────────────────────────────────────────────

router.get('/github-sync', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) return res.status(403).json({ error: 'Super admin only' })
    const config = getGitHubSyncConfig()
    res.json({
      repo_url: config.repo_url,
      branch: config.branch,
      has_token: Boolean(config.token),
    })
  } catch (err: any) {
    console.error('GET /github-sync error:', err)
    res.status(500).json({ error: err?.message || 'Failed to load GitHub sync settings' })
  }
})

router.post('/github-sync', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) return res.status(403).json({ error: 'Super admin only' })

    const { repo_url, branch, token } = req.body
    if (!repo_url || !branch) {
      return res.status(400).json({ error: 'repo_url and branch are required' })
    }

    const cleanUrl = String(repo_url).trim()
    const cleanBranch = String(branch).trim()

    const urlError = validateRepoUrl(cleanUrl)
    if (urlError) return res.status(400).json({ error: urlError })

    if (!/^[A-Za-z0-9/_.-]+$/.test(cleanBranch)) {
      return res.status(400).json({ error: 'Branch name contains invalid characters' })
    }

    const existing = getGitHubSyncConfig()
    const newToken = token !== undefined ? String(token) : existing.token

    const config = { repo_url: cleanUrl, branch: cleanBranch, token: newToken }
    saveGitHubSyncConfig(config)

    let gitRemoteError: string | null = null
    try {
      const remotes = execFileSync('git', ['remote'], { encoding: 'utf-8', timeout: 5000 }).trim()
      if (remotes.split('\n').includes('origin')) {
        execFileSync('git', ['remote', 'set-url', 'origin', cleanUrl], { encoding: 'utf-8', timeout: 5000 })
      } else {
        execFileSync('git', ['remote', 'add', 'origin', cleanUrl], { encoding: 'utf-8', timeout: 5000 })
      }
    } catch (gitErr: any) {
      gitRemoteError = gitErr?.stderr || gitErr?.message || 'Unknown git error'
      console.error('[github-sync] Could not update git remote:', gitRemoteError)
    }

    if (gitRemoteError) {
      return res.status(207).json({
        ok: false,
        repo_url: config.repo_url,
        branch: config.branch,
        has_token: Boolean(config.token),
        warning: 'Settings saved to config file, but updating the git remote failed: ' + gitRemoteError,
      })
    }

    res.json({ ok: true, repo_url: config.repo_url, branch: config.branch, has_token: Boolean(config.token) })
  } catch (err: any) {
    console.error('POST /github-sync error:', err)
    res.status(500).json({ error: err?.message || 'Failed to save GitHub sync settings' })
  }
})

router.post('/github-sync/test', requireAuth as any, async (req: any, res) => {
  try {
    if (!isSuperAdmin(req.profile.role)) return res.status(403).json({ error: 'Super admin only' })

    const config = getGitHubSyncConfig()
    const token = req.body.token !== undefined ? String(req.body.token) : config.token
    const repo_url = String(req.body.repo_url || config.repo_url || '').trim()

    if (!token) {
      return res.status(400).json({ error: 'No token configured. Save a token first.' })
    }
    if (!repo_url) {
      return res.status(400).json({ error: 'No repository URL configured.' })
    }

    const urlError = validateRepoUrl(repo_url)
    if (urlError) return res.status(400).json({ error: urlError })

    const repoMatch = repo_url.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/)
    if (!repoMatch) {
      return res.status(400).json({ error: 'Could not parse GitHub owner/repo from URL.' })
    }

    const [, owner, repo] = repoMatch

    const result = await new Promise<{ ok: boolean; status: number; body: any }>((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'finest-github-sync/1.0',
          Accept: 'application/vnd.github+json',
        },
      }
      const req2 = https.request(options, (r) => {
        let data = ''
        r.on('data', (chunk) => { data += chunk })
        r.on('end', () => {
          let body: any = {}
          try { body = JSON.parse(data) } catch {}
          resolve({ ok: r.statusCode === 200, status: r.statusCode!, body })
        })
      })
      req2.on('error', (e) => resolve({ ok: false, status: 0, body: { message: e.message } }))
      req2.setTimeout(8000, () => { req2.destroy(); resolve({ ok: false, status: 0, body: { message: 'Request timed out' } }) })
      req2.end()
    })

    if (result.ok) {
      return res.json({
        ok: true,
        message: `Connected successfully to ${result.body.full_name}. Repository is ${result.body.private ? 'private' : 'public'}.`,
      })
    }

    if (result.status === 401) {
      return res.status(400).json({ error: 'Authentication failed — token is invalid or expired.' })
    }
    if (result.status === 404) {
      return res.status(400).json({ error: `Repository "${owner}/${repo}" not found or token lacks access.` })
    }
    return res.status(400).json({ error: result.body?.message || `GitHub API returned status ${result.status}` })
  } catch (err: any) {
    console.error('POST /github-sync/test error:', err)
    res.status(500).json({ error: err?.message || 'Test connection failed' })
  }
})

// ─── Auto-assign rules ────────────────────────────────────────────────────────

router.get('/auto-assign', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    res.json(getAutoAssignConfig())
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load auto-assign rules' })
  }
})

router.post('/auto-assign', requireAuth as any, async (req: any, res) => {
  try {
    if (!isAdmin(req.profile.role)) return res.status(403).json({ error: 'Admin only' })
    const { rules } = req.body
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' })
    const cleaned = rules
      .filter((r: any) => r.category?.trim() && r.user_id?.trim())
      .map((r: any) => ({ category: r.category.trim(), user_id: r.user_id.trim(), user_name: r.user_name || '' }))
    const config = saveAutoAssignConfig({ rules: cleaned })
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save auto-assign rules' })
  }
})

export default router
