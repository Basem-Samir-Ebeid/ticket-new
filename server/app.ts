import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { initVapid } from './routes/push'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import ticketRoutes from './routes/tickets'
import attendanceRoutes from './routes/attendance'
import leaveRoutes from './routes/leaves'
import notificationRoutes from './routes/notifications'
import uploadRoutes from './routes/uploads'
import pushRoutes from './routes/push'
import settingsRoutes from './routes/settings'
import githubSyncRoutes from './routes/github-sync'
import githubSyncStatusRoutes from './routes/github-sync-status'
import forgotPasswordRoutes from './routes/forgot-password'
import assetRoutes from './routes/assets'
import penaltyRoutes from './routes/penalties'
import complaintRoutes from './routes/complaints'
import reportsRoutes from './routes/reports'
import knowledgeRoutes from './routes/knowledge'
import auditLogsRoutes from './routes/audit-logs'
import maintenanceRoutes from './routes/maintenance'
import onboardingRoutes from './routes/onboarding'
import accessRecordsRoutes from './routes/access-records'
import licensesRoutes from './routes/licenses'
import searchRoutes from './routes/search'
import factoryRotationRoutes from './routes/factory-rotation'
import overtimeRotationRoutes from './routes/overtime-rotation'
import rotationSwapsRoutes from './routes/rotation-swaps'
import aiTicketsRoutes from './routes/ai-tickets'

const app = express()

initVapid()

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5000',
].filter(Boolean)

const replitDomains = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(',').map(d => `https://${d.trim()}`)
  : []
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN
  ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
  : []
const allAllowedOrigins = [...allowedOrigins, ...replitDomains, ...replitDevDomain]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allAllowedOrigins.includes(origin)) return callback(null, true)
    if (origin.endsWith('.replit.dev') || origin.endsWith('.repl.co') || origin.endsWith('.replit.app')) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/auth/login', authLimiter)
app.use('/api/auth/forgot-password', authLimiter)
app.use('/api/auth/reset-password', authLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/tickets/ai', aiTicketsRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/internal/github-sync', githubSyncRoutes)
app.use('/api/github-sync-status', githubSyncStatusRoutes)
app.use('/api/auth', forgotPasswordRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/penalties', penaltyRoutes)
app.use('/api/complaints', complaintRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/audit-logs', auditLogsRoutes)
app.use('/api/maintenance', maintenanceRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/access-records', accessRecordsRoutes)
app.use('/api/licenses', licensesRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/factory-rotation', factoryRotationRoutes)
app.use('/api/overtime-rotation', overtimeRotationRoutes)
app.use('/api/rotation-swaps', rotationSwapsRoutes)

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(process.cwd(), 'dist')))
  app.get('*', (_req, res, next) => {
    const filePath = path.join(process.cwd(), 'dist', 'index.html')
    res.sendFile(filePath, (err) => {
      if (err) next(err)
    })
  })
}

// 404 handler — always return JSON for API routes
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
  }
  next()
})

// Global error handler — ensures all errors return JSON for API routes
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express error]', err?.message || err)
  if (req.path.startsWith('/api/')) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' })
  }
  res.status(err?.status || 500).send(err?.message || 'Internal server error')
})

export default app
